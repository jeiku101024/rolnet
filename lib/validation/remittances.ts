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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Feature 008: saving an unrecorded Daily view card (contracts/daily-actions.md). */
export const dailyRemittanceSchema = z.object({
  assignmentId: z.string().uuid(),
  serviceDate: isoDate,
  disposition: z.enum(["returned", "overnight_overtime"]),
  notes: z.string().max(1000).optional(),
  paymentCentavos: z.number().int().min(0).optional(),
  remittanceKey: z.string().uuid(),
  paymentKey: z.string().uuid(),
});

/** Feature 008: saving an edited, saved Daily view card. The disposition is never an input (FR-026). */
export const editDailyRemittanceSchema = z.object({
  remittanceId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  notes: z.string().max(1000),
  targetPaymentCentavos: z.number().int().min(0),
  reason: z.string().trim().min(3).max(500).optional(),
  paymentKey: z.string().uuid(),
});
