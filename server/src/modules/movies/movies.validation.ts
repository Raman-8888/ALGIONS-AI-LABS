import { z } from 'zod';

export const createMovieSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().min(5, 'Description must be at least 5 characters long'),
  durationMinutes: z.number().int().min(15, 'Duration must be at least 15 minutes').max(360),
  languages: z.array(z.string().trim().min(2)).min(1, 'At least one language is required'),
  genres: z.array(z.string().trim().min(2)).min(1, 'At least one genre is required'),
  posterUrl: z.string().trim().url('Poster URL must be a valid URL'),
  trailerUrl: z.string().trim().url('Trailer URL must be a valid URL').optional().or(z.literal('')),
  releaseDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const updateMovieSchema = createMovieSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const movieQuerySchema = z.object({
  q: z.string().optional(),
  genre: z.string().optional(),
  language: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['releaseDate', '-releaseDate', 'title', '-title']).default('-releaseDate'),
});

export type CreateMovieInput = z.infer<typeof createMovieSchema>;
export type UpdateMovieInput = z.infer<typeof updateMovieSchema>;
export type MovieQueryInput = z.infer<typeof movieQuerySchema>;

