import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type PaymentStatus = 'INITIATED' | 'SUCCESS' | 'FAILED';
export type RefundStatus = 'NONE' | 'REFUND_PENDING' | 'REFUNDED';
export type GatewayOutcome = 'MOCK_SUCCESS' | 'MOCK_FAIL' | 'MOCK_TIMEOUT';

export interface IPayment extends Document {
  booking: Types.ObjectId;
  amountInPaise: number;
  currency: string;
  status: PaymentStatus;
  refundStatus: RefundStatus;
  refundAmountInPaise: number;
  refundedAt?: Date;
  transactionReference: string;
  gatewayOutcome: GatewayOutcome;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    booking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    amountInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      required: true,
    },
    status: {
      type: String,
      enum: ['INITIATED', 'SUCCESS', 'FAILED'],
      default: 'INITIATED',
      required: true,
    },
    refundStatus: {
      type: String,
      enum: ['NONE', 'REFUND_PENDING', 'REFUNDED'],
      default: 'NONE',
      required: true,
    },
    refundAmountInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    refundedAt: {
      type: Date,
    },
    transactionReference: {
      type: String,
      required: true,
      trim: true,
    },
    gatewayOutcome: {
      type: String,
      enum: ['MOCK_SUCCESS', 'MOCK_FAIL', 'MOCK_TIMEOUT'],
      required: true,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// General lookup index for payments by booking
paymentSchema.index({ booking: 1 });

// Partial unique index: at most one SUCCESS payment allowed per booking
paymentSchema.index(
  { booking: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'SUCCESS' },
    name: 'unique_booking_success_payment',
  },
);

export const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', paymentSchema);
