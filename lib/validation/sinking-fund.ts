import { z } from "zod";
import { fleetToday } from "@/lib/dates/fleet-date";
import { sfMessages } from "@/lib/sinking-fund/messages";
import { SF_LOAN_STEP_CENTAVOS } from "@/lib/sinking-fund/rules";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date.");
const notes = z.string().trim().max(500, "Notes can be up to 500 characters.").optional();
const timestamp = z.string().min(1);
const amount = z.number().int("Enter a peso amount such as 180 or 180.50.").positive("Enter an amount greater than ₱0.00.");

/** Dates can't be in the future (fleet time). The database re-checks with its own business date. */
const pastDate = isoDate.refine((value) => value <= fleetToday(), "The date cannot be in the future.");

export const participantSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120, "Use 120 characters or fewer."),
  driverId: z.string().uuid().nullable().optional(),
  notes,
});

export const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name.").max(120, "Use 120 characters or fewer."),
  expectedUpdatedAt: timestamp,
});

export const archiveSchema = z.object({ id: z.string().uuid(), expectedUpdatedAt: timestamp });

export const depositSchema = z.object({
  participantId: z.string().uuid("Choose a participant."),
  date: pastDate,
  amountCentavos: amount,
  notes,
  idempotencyKey: z.string().uuid(),
});

export const loanSchema = depositSchema.extend({
  amountCentavos: amount.refine((value) => value % SF_LOAN_STEP_CENTAVOS === 0, sfMessages.loanStep),
});

export const paymentSchema = z.object({
  loanId: z.string().uuid("Choose a loan."),
  date: pastDate,
  amountCentavos: amount,
  interestPartCentavos: z.number().int().nonnegative().nullable().optional(),
  notes,
  idempotencyKey: z.string().uuid(),
});

export const savingsWithdrawalSchema = depositSchema;

export const loanWithdrawalSchema = z.object({ loanId: z.string().uuid(), expectedBalanceCentavos: z.number().int().positive() });

export const changeInterestSchema = z.object({
  paymentId: z.string().uuid(),
  interestPartCentavos: z.number().int().nonnegative("Enter ₱0.00 or more."),
  expectedUpdatedAt: timestamp,
});

export const distributeSchema = z.object({
  date: pastDate,
  participantIds: z.array(z.string().uuid()).min(1, "Tick at least one participant.").max(200, "Tick up to 200 participants."),
  notes,
  /** The total the owner saw in the pop-up; the database refuses the distribution if the figures changed since. */
  expectedTotalCentavos: z.number().int().min(1, "There is nothing to distribute."),
  idempotencyKey: z.string().uuid(),
});

const reason = z.string().trim().min(3, "Give a reason of 3 to 300 characters.").max(300, "Give a reason of 3 to 300 characters.");
export const voidSchema = z.object({ id: z.string().uuid(), reason, expectedUpdatedAt: timestamp });

export const settingsSchema = z.object({ prefill: z.enum(["first", "last"]) });
