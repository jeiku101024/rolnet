import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expenseSchema, expenseUpdateSchema } from "@/lib/validation/expenses";

const unitId = "00000000-0000-4000-8000-000000000001";
const idempotencyKey = "00000000-0000-4000-8000-000000000002";
const base = { unitId, expenseDate: "2026-11-01", amountCentavos: 35000, idempotencyKey };

function fieldErrors(input: unknown) {
  const result = expenseSchema.safeParse(input);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message]));
}

describe("expense validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T04:00:00Z")); // 12:00 in Manila
  });
  afterEach(() => vi.useRealTimers());

  it("accepts a main category with a date replaced", () => {
    expect(expenseSchema.safeParse({ ...base, category: "chain", replacedDate: "2026-10-31" }).success).toBe(true);
  });

  it("requires a date replaced for main categories, and no name", () => {
    expect(fieldErrors({ ...base, category: "chain" })).toEqual({ replacedDate: "Enter the date replaced." });
    expect(fieldErrors({ ...base, category: "chain", replacedDate: "2026-11-01", customCategory: "Chain" })).toEqual({ customCategory: "Only Others has a category name." });
  });

  it("requires a category name for Others, and no date replaced", () => {
    expect(fieldErrors({ ...base, category: "others" })).toEqual({ customCategory: "Enter a category name." });
    expect(fieldErrors({ ...base, category: "others", customCategory: "   " })).toEqual({ customCategory: "Enter a category name." });
    expect(fieldErrors({ ...base, category: "others", customCategory: "Brake pads", replacedDate: "2026-11-01" })).toEqual({ replacedDate: "Others has no date replaced." });
    expect(fieldErrors({ ...base, category: "others", customCategory: "x".repeat(81) })).toEqual({ customCategory: "Use 80 characters or fewer." });
  });

  it("tidies the category name like the database", () => {
    const parsed = expenseSchema.parse({ ...base, category: "others", customCategory: "  Brake   pads " });
    expect(parsed.customCategory).toBe("Brake pads");
  });

  it("rejects dates after today in fleet time, and accepts today", () => {
    expect(fieldErrors({ ...base, category: "battery", expenseDate: "2026-11-02", replacedDate: "2026-11-01" })).toEqual({ expenseDate: "Dates can't be in the future." });
    expect(fieldErrors({ ...base, category: "battery", replacedDate: "2026-11-02" })).toEqual({ replacedDate: "Dates can't be in the future." });
    expect(expenseSchema.safeParse({ ...base, category: "battery", replacedDate: "2026-11-01" }).success).toBe(true);
  });

  it("rejects an unknown category, a missing unit and a ₱0 amount", () => {
    expect(fieldErrors({ ...base, category: "fuel", replacedDate: "2026-11-01" })).toHaveProperty("category");
    expect(fieldErrors({ ...base, unitId: "", category: "battery", replacedDate: "2026-11-01" })).toHaveProperty("unitId", "Choose a unit.");
    expect(fieldErrors({ ...base, category: "battery", replacedDate: "2026-11-01", amountCentavos: 0 })).toHaveProperty("amountCentavos", "Enter an amount greater than ₱0.00.");
  });

  it("applies the same rules on update, with the expected timestamp", () => {
    const { idempotencyKey: _key, ...rest } = base;
    void _key;
    expect(expenseUpdateSchema.safeParse({ ...rest, category: "others", customCategory: "Wash", expectedUpdatedAt: "2026-11-01T00:00:00Z" }).success).toBe(true);
    expect(expenseUpdateSchema.safeParse({ ...rest, category: "chain", expectedUpdatedAt: "2026-11-01T00:00:00Z" }).success).toBe(false);
  });
});
