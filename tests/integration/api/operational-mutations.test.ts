import { describe, expect, it } from "vitest";
import { resources } from "@/lib/domain/resource-config";

describe("operational mutation contract", () => {
  it("keeps remittance identity immutable", () => expect(resources.remittances.updateFields).toEqual(["notes"]));
  it("requires retry identities for money creates", () => {
    for (const name of ["expenses", "remittances", "remittance-payments"]) expect(resources[name].idempotent).toBe(true);
  });
  it("writes the fixed expense categories, never the old category id or the move markers (feature 011)", () => {
    expect(resources.expenses.createFields).toEqual(["unit_id", "category", "custom_category", "expense_date", "replaced_date", "amount_centavos", "notes"]);
    expect(resources.expenses.updateFields).toEqual(resources.expenses.createFields);
    for (const field of ["category_id", "needs_review", "source_table", "source_id"]) expect(resources.expenses.createFields).not.toContain(field);
    expect(resources.expenses.filterFields).toEqual(["unit_id", "category", "needs_review", "source_table"]);
  });
  it("allows staff operations through encode permission", () => {
    for (const name of ["mileage-readings", "expenses", "remittances"]) expect(resources[name].writePermission).toBe("encode_operations");
  });
});
