import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const km = z.number().int().nonnegative().max(9_999_999);
const due = { message: "Add a next due date or a next due mileage", path: ["nextDue"] };

export const partSchema = z.object({ unitId: z.string().uuid(), partName: z.string().trim().min(1).max(120), costCentavos: z.number().int().nonnegative(), replacedOn: date, replacementMileage: km.optional(), nextDueDate: date.optional(), nextDueMileage: km.optional(), notes: z.string().max(1000).optional() })
  .refine((v) => Boolean(v.nextDueDate || v.nextDueMileage !== undefined), due)
  .refine((v) => !v.nextDueDate || v.nextDueDate > v.replacedOn, { message: "The next due date must be after the replacement date", path: ["nextDueDate"] })
  .refine((v) => v.nextDueMileage === undefined || v.replacementMileage === undefined || v.nextDueMileage > v.replacementMileage, { message: "The next due mileage must be higher than the replacement mileage", path: ["nextDueMileage"] });

export const tireSchema = z.object({ unitId: z.string().uuid(), position: z.enum(["front", "rear_left", "rear_right"]), brand: z.string().trim().min(1).max(80), installedOn: date, installedMileage: km.optional(), costCentavos: z.number().int().nonnegative(), nextDueDate: date.optional(), nextDueMileage: km.optional() })
  .refine((v) => Boolean(v.nextDueDate || v.nextDueMileage !== undefined), due)
  .refine((v) => !v.nextDueDate || v.nextDueDate > v.installedOn, { message: "The next due date must be after the installation date", path: ["nextDueDate"] })
  .refine((v) => v.nextDueMileage === undefined || v.installedMileage === undefined || v.nextDueMileage > v.installedMileage, { message: "The next due mileage must be higher than the installed mileage", path: ["nextDueMileage"] });

export const tirePositions = ["front", "rear_left", "rear_right"] as const;
export const tirePositionLabels: Record<string, string> = { front: "Front", rear_left: "Rear left", rear_right: "Rear right" };
