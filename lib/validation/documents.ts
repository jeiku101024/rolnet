import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const documentTypes = ["or_cr", "driver_license", "mtop_franchise", "insurance"] as const;
export const documentTypeLabels: Record<string, string> = { or_cr: "OR/CR", driver_license: "Driver license", mtop_franchise: "MTOP franchise", insurance: "Insurance" };

/** A driver license belongs to a driver; the other documents belong to a unit (data model). */
export function holderMatchesType(value: { documentType: string; unitId?: string; driverId?: string }) {
  return value.documentType === "driver_license" ? Boolean(value.driverId) && !value.unitId : Boolean(value.unitId) && !value.driverId;
}
const holderMessage = { message: "Choose the driver for a driver license, or the unit for OR/CR, MTOP franchise and insurance", path: ["holder"] };
const mimeType = z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export const documentUploadRequestSchema = z.object({
  documentType: z.enum(documentTypes),
  unitId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  mimeType,
  sizeBytes: z.number().int().positive().max(5242880),
}).refine(holderMatchesType, holderMessage);

export const documentSchema = z.object({
  documentType: z.enum(documentTypes),
  unitId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  documentNumber: z.string().trim().max(120).optional(),
  issuedOn: date.optional(),
  expiresOn: date,
  mimeType,
  sizeBytes: z.number().int().positive().max(5242880),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  objectPath: z.string().regex(/^documents\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpeg|png|webp|pdf)$/),
  idempotencyKey: z.string().uuid(),
}).refine(holderMatchesType, holderMessage)
  .refine((value) => !value.issuedOn || value.issuedOn <= value.expiresOn, { message: "The issue date must be on or before the expiry date", path: ["issuedOn"] });
