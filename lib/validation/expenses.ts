import { z } from "zod";
import { fleetToday } from "@/lib/dates/fleet-date";
import { cleanCategoryName, expenseCategoryOptions } from "@/lib/expenses/categories";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date.");
const futureMessage = "Dates can't be in the future.";

const expenseFields = z.object({
  unitId: z.string().uuid("Choose a unit."),
  category: z.enum(expenseCategoryOptions, { message: "Choose a category." }),
  customCategory: z.string().transform(cleanCategoryName).optional(),
  expenseDate: isoDate,
  replacedDate: isoDate.optional(),
  amountCentavos: z.number().int().positive("Enter an amount greater than ₱0.00."),
  notes: z.string().max(1000, "Notes can be up to 1,000 characters.").optional(),
});

type ExpenseFields = z.infer<typeof expenseFields>;

/**
 * Category rules (feature 011, FR-010/FR-019): Others needs a category name and no date replaced;
 * a main category needs a date replaced and no name. Neither date may be after today (fleet time);
 * the database doesn't check dates (research R5 note), so this is the rule.
 */
function categoryRules(value: ExpenseFields, ctx: z.RefinementCtx) {
  const today = fleetToday();
  if (value.category === "others") {
    if (!value.customCategory) ctx.addIssue({ code: "custom", path: ["customCategory"], message: "Enter a category name." });
    else if (value.customCategory.length > 80) ctx.addIssue({ code: "custom", path: ["customCategory"], message: "Use 80 characters or fewer." });
    if (value.replacedDate) ctx.addIssue({ code: "custom", path: ["replacedDate"], message: "Others has no date replaced." });
  } else {
    if (!value.replacedDate) ctx.addIssue({ code: "custom", path: ["replacedDate"], message: "Enter the date replaced." });
    if (value.customCategory) ctx.addIssue({ code: "custom", path: ["customCategory"], message: "Only Others has a category name." });
  }
  if (value.expenseDate > today) ctx.addIssue({ code: "custom", path: ["expenseDate"], message: futureMessage });
  if (value.replacedDate && value.replacedDate > today) ctx.addIssue({ code: "custom", path: ["replacedDate"], message: futureMessage });
}

export const expenseSchema = expenseFields.extend({ idempotencyKey: z.string().uuid() }).superRefine(categoryRules);

export const expenseUpdateSchema = expenseFields.extend({ expectedUpdatedAt: z.string().min(1) }).superRefine(categoryRules);

export type ExpenseInput = z.input<typeof expenseSchema>;
export type ExpenseUpdateInput = z.input<typeof expenseUpdateSchema>;

export const receiptUploadSchema = z
  .object({
    expenseId: z.string().uuid(),
    objectPath: z.string().regex(/^receipts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpeg|jpg|png|webp)$/),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z.number().int().positive().max(512000),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  // A receipt must be stored in this expense's own folder (matches the database check).
  .refine((value) => value.objectPath.startsWith(`receipts/${value.expenseId.toLowerCase()}/`), {
    message: "The receipt must be uploaded for this expense.",
    path: ["objectPath"],
  });
