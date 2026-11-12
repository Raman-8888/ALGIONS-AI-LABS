import { z } from 'zod';

export const updateRoleSchema = z.object({
  role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN'], {
    errorMap: () => ({ message: 'Role must be CUSTOMER, STAFF, or ADMIN' }),
  }),
});

