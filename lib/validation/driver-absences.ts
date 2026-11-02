import { z } from "zod";

// Feature 012 (contracts/actions.md AbsenceInput). A day-off's end date is its start date; an
// On-leave needs a To date unless it is open-ended, and To can't be before From.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");

export const absenceInputSchema = z.object({
  id: z.uuid().optional(),
  driverId: z.uuid(),
  type: z.enum(["day_off", "on_leave"], { error: "Choose Day-off or On-leave." }),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
  openEnded: z.boolean().default(false),
  reason: z.enum(["sick", "vacation", "family_emergency", "personal", "other"], { error: "Choose a reason." }),
  note: z.string().trim().max(500, "Keep the note to 500 characters.").optional(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
}).superRefine((value, ctx) => {
  if (value.type !== "on_leave" || value.openEnded) return;
  if (!value.endDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Choose the To date, or tick No end date yet." });
  else if (value.endDate < value.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "The To date must be on or after the From date." });
}).transform((value) => ({
  ...value,
  endDate: value.type === "day_off" ? value.startDate : value.openEnded ? null : value.endDate ?? null,
  note: value.note || undefined,
}));

export const saveAbsenceSchema = z.object({ releaseIds: z.array(z.uuid()).default([]) });

export const absenceActionSchema = z.object({ id: z.uuid(), expectedUpdatedAt: z.iso.datetime({ offset: true }) });
export const endAbsenceSchema = absenceActionSchema.extend({ cancelUpcoming: z.boolean().default(false) });

export type AbsenceInput = z.infer<typeof absenceInputSchema>;

export const absenceFieldLabels = { type: "Type", startDate: "Date", endDate: "To", reason: "Reason", note: "Note" };
