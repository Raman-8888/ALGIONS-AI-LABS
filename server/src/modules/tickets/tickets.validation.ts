import { z } from 'zod';

export const validateTicketSchema = z
  .object({
    qrToken: z.string().optional(),
    ticketReference: z.string().trim().optional(),
    activeShowId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid active Show ID is required'),
  })
  .refine(
    (data) => Boolean(data.qrToken || data.ticketReference),
    'Either qrToken or ticketReference must be provided',
  );

export type ValidateTicketInput = z.infer<typeof validateTicketSchema>;

