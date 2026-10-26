import { z } from 'zod';
export const createCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(3),
    email: z.string().email()
  })
});
