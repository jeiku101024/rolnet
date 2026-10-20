import { z } from "zod";

export const unitSchema = z.object({
  bodyNumber: z.string().trim().min(1).max(40),
  plateNumber: z.string().trim().min(1).max(20),
  makeModel: z.string().trim().min(1).max(120),
  status: z.enum(["active", "in_repair", "retired"]),
});

export const mileageSchema = z.object({
  unitId: z.string().uuid(),
  readingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mileage: z.number().int().nonnegative(),
  notes: z.string().max(500).optional(),
});
