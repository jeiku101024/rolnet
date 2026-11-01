import { describe, expect, it } from "vitest";
import { remittanceTotals } from "@/lib/remittances/totals";
import { loginErrorMessage } from "@/lib/auth/login-errors";
import { startPageFor } from "@/lib/permissions/roles";

describe("remittanceTotals (T139)", () => {
  it("shows a balance when underpaid and Paid when fully paid", () => {
    expect(remittanceTotals(18000, [{ amount_centavos: 10000 }])).toEqual({ paid: 10000, balance: 8000 });
    // A legacy overpaid record (before feature 009) is simply settled.
    expect(remittanceTotals(18000, [{ amount_centavos: 10000 }, { amount_centavos: 10000 }])).toEqual({ paid: 20000, balance: 0 });
    expect(remittanceTotals(30000, null)).toEqual({ paid: 0, balance: 30000 });
  });
});

describe("login helpers (T143)", () => {
  it("maps ?error= codes to plain messages and roles to start pages", () => {
    expect(loginErrorMessage("pending")).toMatch(/waiting for owner approval/);
    expect(loginErrorMessage("whatever")).toBe("We could not sign you in. Try again.");
    expect(loginErrorMessage(undefined)).toBeUndefined();
    expect(startPageFor("owner")).toBe("/dashboard");
    expect(startPageFor("staff")).toBe("/remittances");
  });
});
