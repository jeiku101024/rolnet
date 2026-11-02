import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The editable details shared by Add driver and Edit details (feature 012 adds notes). */
const driverDetails = z.object({
  fullName: z.string().trim().min(1).max(160),
  licenseNumber: z.string().trim().min(1).max(80),
  licenseExpiryDate: isoDate,
  phone: z.string().trim().min(3).max(40),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

/** Add driver (feature 012, FR-010): the details plus the role and the starting status. */
export const driverSchema = driverDetails.extend({
  driverKind: z.enum(["primary", "backup"]),
  isActive: z.boolean().default(true),
});

/** Edit details: the role and status change only through the profile header (FR-019). */
export const driverDetailsSchema = driverDetails.extend({ expectedUpdatedAt: z.iso.datetime({ offset: true }) });

const driverStatus = z.enum(["active", "inactive"]);

/** Status change from a list or the driver page; expectedStatus is the status the screen showed. */
export const driverStatusSchema = z.object({ id: z.uuid(), status: driverStatus, expectedStatus: driverStatus });

export const driverIdSchema = z.object({ id: z.uuid() });

/** Primary/Backup switch (FR-024); expectedUpdatedAt is the driver version the screen showed. */
export const driverRoleSchema = z.object({ id: z.uuid(), role: z.enum(["primary", "backup"]), expectedUpdatedAt: z.iso.datetime({ offset: true }) });

export const undoDriverRoleSchema = z.object({ changeId: z.uuid(), driverId: z.uuid() });

export const previewAvailabilitySchema = z.object({ date: isoDate });
