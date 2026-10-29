import { z } from "zod";

export const remittanceSchema = z.object({
  assignmentId: z.string().uuid(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  disposition: z.enum(["returned", "overnight_overtime"]),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().uuid(),
});

export const paymentSchema = z.object({
  remittanceId: z.string().uuid(),
  paidAt: z.string().datetime({ offset: true }).optional(),
  amountCentavos: z.number().int().positive(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid(),
});

export const remittanceNotesSchema = z.object({
  remittanceId: z.string().uuid(),
  notes: z.string().max(1000),
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});
