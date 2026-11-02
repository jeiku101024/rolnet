import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const documentTypes = ["or_cr", "driver_license", "mtop_franchise", "insurance"] as const;
export const documentTypeLabels: Record<string, string> = { or_cr: "OR/CR", driver_license: "Driver's license", mtop_franchise: "MTOP franchise", insurance: "Insurance" };

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
  // Feature 013: the chosen file's name (shown in History and Activity) and the current version the
  // user saw, so a renewal against a changed document is refused (contracts/actions.md).
  fileName: z.string().trim().min(1, "Choose the document file again").max(200, "Rename the file to 200 characters or fewer"),
  expectedCurrentId: z.string().uuid().nullable().optional(),
}).refine(holderMatchesType, holderMessage)
  .refine((value) => !value.issuedOn || value.issuedOn <= value.expiresOn, { message: "The issue date must be on or before the expiry date", path: ["issuedOn"] });

// Feature 013: revert, restore and bring back act on the version the user saw (contracts/actions.md).
export const documentIdSchema = z.object({ id: z.string().uuid() });
export const revertDocumentSchema = z.object({ currentId: z.string().uuid() });
export const restoreVersionSchema = z.object({ versionId: z.string().uuid(), currentId: z.string().uuid().nullable() });
export const bringBackSchema = z.object({ versionId: z.string().uuid(), currentId: z.string().uuid().nullable() });
export const driverDocumentTypes = ["driver_license"] as const;
