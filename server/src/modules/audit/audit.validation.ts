import { z } from 'zod';

export const auditQuerySchema = z.object({
  entity: z.string().optional(),
  action: z.string().optional(),
  actorType: z.enum(['USER', 'SYSTEM']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AuditQueryInput = z.infer<typeof auditQuerySchema>;

