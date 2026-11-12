import { z } from 'zod';

export const reportQuerySchema = z.object({
  theatreId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  movieId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;

