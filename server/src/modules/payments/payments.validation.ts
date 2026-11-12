import { z } from 'zod';

export const simulatePaymentSchema = z.object({
  bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Booking ID is required'),
  gatewayOutcome: z
    .enum(['MOCK_SUCCESS', 'MOCK_FAIL', 'MOCK_TIMEOUT'])
    .default('MOCK_SUCCESS'),
});

export type SimulatePaymentInput = z.infer<typeof simulatePaymentSchema>;

