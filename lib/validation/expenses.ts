import { z } from "zod";

export const expenseSchema = z.object({
  unitId: z.string().uuid(),
  categoryId: z.string().uuid(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCentavos: z.number().int().positive(),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().uuid(),
});

export const receiptUploadSchema = z
  .object({
    expenseId: z.string().uuid(),
    objectPath: z.string().regex(/^receipts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpeg|jpg|png|webp)$/),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z.number().int().positive().max(512000),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  // A receipt must be stored in this expense's own folder (matches the database check).
  .refine((value) => value.objectPath.startsWith(`receipts/${value.expenseId.toLowerCase()}/`), {
    message: "The receipt must be uploaded for this expense.",
    path: ["objectPath"],
  });
