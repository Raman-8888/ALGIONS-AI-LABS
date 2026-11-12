import { z } from 'zod';

export const createScreenSchema = z.object({
  theatre: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Theatre ID required'),
  name: z.string().trim().min(1, 'Screen name is required').max(50),
  seatLayout: z.object({
    rows: z.number().int().min(1).max(26),
    columns: z.number().int().min(1).max(50),
    aisleColumns: z.array(z.number().int().min(1)).default([]),
    gapSeats: z.array(z.string().trim().toUpperCase()).default([]),
    rowCategories: z.record(z.string(), z.string()).refine(
      (cats) => Object.keys(cats).length > 0,
      'At least one row category mapping is required',
    ),
  }),
});

export const updateScreenSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

export type CreateScreenInput = z.infer<typeof createScreenSchema>;
export type UpdateScreenInput = z.infer<typeof updateScreenSchema>;

