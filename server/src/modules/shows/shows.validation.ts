import { z } from 'zod';

export const createShowSchema = z.object({
  movieId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Movie ID required'),
  screenId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Screen ID required'),
  startsAt: z.string().datetime({ message: 'startsAt must be a valid ISO 8601 timestamp' }),
  language: z.string().trim().min(2, 'Language is required'),
  format: z.enum(['2D', '3D', 'IMAX']).default('2D'),
  priceByCategory: z.record(
    z.string(),
    z.number().int().min(0, 'Price must be a non-negative integer in paise'),
  ),
});

export const showQuerySchema = z.object({
  movieId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  theatreId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.enum(['2D', '3D', 'IMAX']).optional(),
  language: z.string().optional(),
});

export type CreateShowInput = z.infer<typeof createShowSchema>;
export type ShowQueryInput = z.infer<typeof showQuerySchema>;

