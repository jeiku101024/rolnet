import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ActionError, databaseFailure, runAction, toActionFailure, validationFailure } from "@/lib/actions/errors";
import { parseCentavos, parsePositiveCentavos } from "@/lib/money/centavos";
import { expenseSchema } from "@/lib/validation/expenses";
import { tireSchema } from "@/lib/validation/maintenance";

describe("databaseFailure", () => {
  it("maps unique indexes to plain messages", () => {
    const result = databaseFailure({ code: "23505", message: 'duplicate key value violates unique constraint "units_plate_number_unique"' }, "fallback");
    expect(result).toMatchObject({ ok: false, code: "DUPLICATE_PLATE" });
    expect(result.message).toMatch(/plate number/);
    expect(result.message).not.toMatch(/constraint|duplicate key/);
  });

  it("maps exclusion constraints on assignments", () => {
    const result = databaseFailure({ code: "23P01", message: 'conflicting key value violates exclusion constraint "primary_unit_date_exclusion"' }, "fallback");
    expect(result.code).toBe("ASSIGNMENT_CONFLICT");
  });

  it("passes through messages raised by our own triggers", () => {
    expect(databaseFailure({ code: "23514", message: "Mileage cannot be higher than a later reading" }, "fallback").message).toBe("Mileage cannot be higher than a later reading.");
    expect(databaseFailure({ code: "23P01", message: "Driver already operates another unit on this date" }, "fallback").message).toBe("Driver already operates another unit on this date.");
    // From 20261029001400 (PR #10): unit delete blocked by assignments.
    expect(databaseFailure({ code: "23503", message: "This unit still has current or upcoming driver assignments. End or remove them before deleting the unit" }, "fallback").message).toMatch(/^This unit still has current/);
  });

  it("never shows PostgreSQL-generated text", () => {
    const fk = databaseFailure({ code: "23503", message: 'insert or update on table "expenses" violates foreign key constraint "expenses_unit_id_fkey"' }, "fallback");
    expect(fk.message).not.toMatch(/violates|table/);
    const rls = databaseFailure({ code: "42501", message: 'new row violates row-level security policy for table "units"' }, "fallback");
    expect(rls.code).toBe("FORBIDDEN");
    expect(rls.message).not.toMatch(/row-level/);
    const unknownCheck = databaseFailure({ code: "23514", message: 'new row for relation "x" violates check constraint "x_check"' }, "Could not save.");
    expect(unknownCheck.message).toBe("Could not save.");
    expect(databaseFailure({ code: "XX000", message: "internal" }, "Could not save.").message).toBe("Could not save.");
  });

  it("maps known check constraints by name", () => {
    expect(databaseFailure({ code: "23514", message: 'new row for relation "documents" violates check constraint "document_holder_type_check"' }, "f").code).toBe("INVALID_HOLDER");
  });
});

describe("validationFailure", () => {
  it("names fields instead of showing raw Zod output", () => {
    const parsed = expenseSchema.safeParse({ unitId: "x", categoryId: "00000000-0000-4000-8000-000000000001", expenseDate: "2026-10-29", amountCentavos: 0, idempotencyKey: "00000000-0000-4000-8000-000000000002" });
    expect(parsed.success).toBe(false);
    const result = validationFailure(parsed.error!, { unitId: "unit", amountCentavos: "amount" });
    expect(result.message).toBe("Check the unit and amount.");
    expect(result.message).not.toMatch(/[[{]/);
    expect(result.fieldErrors?.amountCentavos).toBeDefined();
  });

  it("uses refine messages as written", () => {
    const parsed = tireSchema.safeParse({ unitId: "00000000-0000-4000-8000-000000000001", position: "front", brand: "IRC", installedOn: "2026-10-29", costCentavos: 0 });
    expect(validationFailure(parsed.error!).message).toBe("Add a next due date or a next due mileage.");
  });
});

describe("runAction", () => {
  it("returns success and failure results instead of throwing", async () => {
    await expect(runAction({ fallback: "f" }, async () => 5)).resolves.toEqual({ ok: true, data: 5 });
    await expect(runAction({ fallback: "f" }, async () => { throw new ActionError("NOT_FOUND", "Gone."); })).resolves.toEqual({ ok: false, code: "NOT_FOUND", message: "Gone." });
  });

  it("lets Next.js control-flow errors through", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    const rethrow = vi.fn((reason: unknown) => { if (reason === redirect) throw reason; });
    await expect(runAction({ fallback: "f", rethrow }, async () => { throw redirect; })).rejects.toBe(redirect);
  });

  it("uses the fallback for unexpected errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toActionFailure(new Error("socket hang up"), "Could not save.")).toEqual({ ok: false, code: "UNEXPECTED", message: "Could not save." });
    expect(toActionFailure(z.string().safeParse(1).error, "f").code).toBe("INVALID_INPUT");
  });
});

describe("peso parsing", () => {
  it("parses pesos to integer centavos", () => {
    expect(parseCentavos("₱1,234.5")).toBe(123450);
    expect(parseCentavos("0")).toBe(0);
  });

  it("rejects zero where an amount is required", () => {
    expect(() => parsePositiveCentavos("0")).toThrow("Enter an amount greater than ₱0.00.");
    expect(() => parsePositiveCentavos("0.00")).toThrow(/greater than/);
    expect(parsePositiveCentavos("0.01")).toBe(1);
  });

  it("explains invalid amounts in plain language", () => {
    expect(() => parseCentavos("abc")).toThrow("Enter a peso amount such as 180 or 180.50.");
    expect(() => parseCentavos("-5")).toThrow(/peso amount/);
    expect(() => parseCentavos("99999999999")).toThrow(/too large/);
  });
});
