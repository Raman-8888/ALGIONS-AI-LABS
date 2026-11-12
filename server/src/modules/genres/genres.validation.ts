import { z } from 'zod';

export const createGenreSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(50),
});

export const updateGenreSchema = z.object({
  name: z.string().trim().min(2).max(50),
});

export type CreateGenreInput = z.infer<typeof createGenreSchema>;

