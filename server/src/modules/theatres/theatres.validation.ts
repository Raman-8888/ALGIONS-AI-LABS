import { z } from 'zod';

export const createTheatreSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100),
  city: z.string().trim().min(2, 'City is required').max(100),
  address: z.string().trim().min(5, 'Address is required').max(250),
  timezone: z.string().trim().default('Asia/Kolkata'),
});

export const updateTheatreSchema = createTheatreSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateTheatreInput = z.infer<typeof createTheatreSchema>;
export type UpdateTheatreInput = z.infer<typeof updateTheatreSchema>;

