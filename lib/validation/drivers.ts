import { z } from "zod";

export const driverSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  driverKind: z.enum(["primary", "backup"]),
  licenseNumber: z.string().trim().min(1).max(80),
  licenseExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().trim().min(3).max(40),
  address: z.string().max(500).optional(),
});

export const primaryAssignmentSchema = z.object({
  unitId: z.string().uuid(),
  driverId: z.string().uuid(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const dayOffSchema = z.object({
  primaryAssignmentId: z.string().uuid(),
  dayOffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
});

export const backupAssignmentSchema = z.object({
  dayOffId: z.string().uuid(),
  backupDriverId: z.string().uuid(),
});
