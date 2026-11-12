import { Payment } from '../../db/models/Payment.js';
import { Booking } from '../../db/models/Booking.js';
import { AppError } from '../../common/errors/AppError.js';
import { generateReference } from '../../common/utils/index.js';
import { logAudit } from '../../common/audit/auditLogger.js';
import { SimulatePaymentInput } from './payments.validation.js';

export class PaymentsService {
  /**
   * Executes a simulated payment gateway call OUTSIDE any database transaction.
   * Supports retry upon failure via non-unique Payment records.
   */
  static async simulatePayment(
    userId: string,
    input: SimulatePaymentInput,
    requestId = 'system',
  ) {
    const booking = await Booking.findById(input.bookingId);
    if (!booking) {
      throw AppError.notFound(`Booking with id ${input.bookingId} not found`);
    }

    if (booking.user.toString() !== userId) {
      throw AppError.forbidden('You do not have permission to pay for this booking');
    }

    if (booking.status === 'CONFIRMED') {
      throw AppError.badRequest('This booking is already confirmed and paid');
    }

    if (booking.status === 'EXPIRED') {
      throw AppError.badRequest('This booking has expired. Please select seats and try again.');
    }

    if (booking.status === 'CANCELLED') {
      throw AppError.badRequest('Cannot process payment for a cancelled booking');
    }

    const transactionReference = generateReference('TXN');

    // 1. Create Payment in INITIATED state
    const payment = await Payment.create({
      booking: booking._id,
      amountInPaise: booking.totalAmountInPaise,
      currency: booking.currency,
      status: 'INITIATED',
      refundStatus: 'NONE',
      refundAmountInPaise: 0,
      transactionReference,
      gatewayOutcome: input.gatewayOutcome,
    });

    // 2. Simulate Gateway Processing
    if (input.gatewayOutcome === 'MOCK_FAIL') {
      payment.status = 'FAILED';
      await payment.save();

      await logAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'PAYMENT_FAILED',
        entity: 'Payment',
        entityId: payment._id.toString(),
        details: {
          bookingId: booking._id.toString(),
          amountInPaise: payment.amountInPaise,
          gatewayOutcome: 'MOCK_FAIL',
        },
        requestId,
      });

      throw AppError.badRequest(
        'Payment declined by simulated gateway. You may retry payment before the seat hold expires.',
        {
          paymentId: payment._id.toString(),
          transactionReference,
          gatewayOutcome: 'MOCK_FAIL',
        },
      );
    }

    if (input.gatewayOutcome === 'MOCK_TIMEOUT') {
      payment.status = 'FAILED';
      await payment.save();

      await logAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'PAYMENT_TIMEOUT',
        entity: 'Payment',
        entityId: payment._id.toString(),
        details: {
          bookingId: booking._id.toString(),
          amountInPaise: payment.amountInPaise,
          gatewayOutcome: 'MOCK_TIMEOUT',
        },
        requestId,
      });

      throw new AppError(
        'Payment gateway connection timed out. Please retry.',
        504,
        'BAD_REQUEST',
        {
          paymentId: payment._id.toString(),
          transactionReference,
          gatewayOutcome: 'MOCK_TIMEOUT',
        },
      );
    }

    // 3. Success outcome
    payment.status = 'SUCCESS';
    payment.paidAt = new Date();
    await payment.save();

    await logAudit({
      actorType: 'USER',
      actorId: userId,
      action: 'PAYMENT_SUCCESS',
      entity: 'Payment',
      entityId: payment._id.toString(),
      details: {
        bookingId: booking._id.toString(),
        amountInPaise: payment.amountInPaise,
        transactionReference,
      },
      requestId,
    });

    return payment;
  }
}

