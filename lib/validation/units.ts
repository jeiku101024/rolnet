import { z } from "zod";

export const unitSchema = z.object({
  name: z.string().trim().min(1).max(40),
  bodyNumber: z.string().trim().min(1).max(40),
  plateNumber: z.string().trim().min(1).max(20),
  makeModel: z.string().trim().min(1).max(120),
  status: z.enum(["active", "in_repair", "retired"]),
});

const unitStatus = z.enum(["active", "in_repair", "retired"]);

/** Status change from a list or the unit page; expectedStatus is the status the screen showed. */
export const unitStatusSchema = z.object({ id: z.uuid(), status: unitStatus, expectedStatus: unitStatus });

/** Edit-details form: everything but the status, plus the version the form was loaded with. */
export const unitDetailsSchema = unitSchema.omit({ status: true }).extend({ expectedUpdatedAt: z.iso.datetime({ offset: true }) });

export const mileageSchema = z.object({
  unitId: z.string().uuid(),
  readingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mileage: z.number().int().nonnegative(),
  notes: z.string().max(500).optional(),
});
