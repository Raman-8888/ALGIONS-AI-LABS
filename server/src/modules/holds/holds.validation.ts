import { z } from 'zod';

export const createHoldSchema = z.object({
  showId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Show ID is required'),
  seatIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Seat ID required'))
    .min(1, 'At least one seat must be selected')
    .max(8, 'Maximum 8 seats can be held at once')
    .refine((items) => new Set(items).size === items.length, 'Duplicate seat IDs in request'),
});

export const releaseHoldSchema = z.object({
  showId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Show ID is required'),
  seatIds: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Seat ID required'))
    .min(1, 'At least one seat must be provided'),
});

export type CreateHoldInput = z.infer<typeof createHoldSchema>;
export type ReleaseHoldInput = z.infer<typeof releaseHoldSchema>;

