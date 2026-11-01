import { z } from "zod";

// Feature 010: saving a Daily assignment card (contracts/actions.md). A missing driver is reported
// as "Choose a driver first" by the action, before any database call (FR-017).
export const saveUnitAssignmentSchema = z.object({
  unitId: z.uuid(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  driverId: z.uuid().nullable(),
  notes: z.string().trim().max(500).default(""),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
});

export const upcomingAssignmentsSchema = z.union([z.object({ unitId: z.uuid() }), z.object({ driverId: z.uuid() })]);
