import { z } from 'zod';

export const initiateBookingSchema = z.object({
  showId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Show ID is required'),
  seatIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Seat ID required'))
    .min(1, 'At least one seat must be selected')
    .max(8, 'Maximum 8 seats allowed per booking'),
});

export const checkoutSchema = z.object({
  showId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Show ID is required'),
  seatIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Seat ID required'))
    .min(1, 'At least one seat must be selected')
    .max(8, 'Maximum 8 seats allowed per booking'),
  gatewayOutcome: z
    .enum(['MOCK_SUCCESS', 'MOCK_FAIL', 'MOCK_TIMEOUT'])
    .default('MOCK_SUCCESS'),
});

export const confirmBookingSchema = z.object({
  paymentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Payment ID is required'),
});

export type InitiateBookingInput = z.infer<typeof initiateBookingSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>;

