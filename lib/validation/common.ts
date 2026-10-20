import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const idempotencyKeySchema = uuidSchema;
export const centavosSchema = z.number().int().nonnegative();
export const auditFieldsSchema = z.object({
  expectedUpdatedAt: z.string().datetime().optional(),
});
