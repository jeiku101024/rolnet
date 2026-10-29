import { describe, expect, it } from "vitest";
import { remittanceTotals } from "@/lib/remittances/totals";
import { dueBasis } from "@/components/dashboard/due-maintenance-panel";
import { loginErrorMessage } from "@/lib/auth/login-errors";
import { startPageFor } from "@/lib/permissions/roles";

describe("remittanceTotals (T139)", () => {
  it("shows a balance when underpaid and a credit when overpaid", () => {
    expect(remittanceTotals(18000, [{ amount_centavos: 10000 }])).toEqual({ paid: 10000, balance: 8000, credit: 0 });
    expect(remittanceTotals(18000, [{ amount_centavos: 10000 }, { amount_centavos: 10000 }])).toEqual({ paid: 20000, balance: 0, credit: 2000 });
    expect(remittanceTotals(30000, null)).toEqual({ paid: 0, balance: 30000, credit: 0 });
  });
});

describe("dueBasis (T141)", () => {
  const item = { item_id: "i", item_type: "part", unit_id: "u" };
  it("names the date and/or mileage that made the item due", () => {
    expect(dueBasis({ ...item, due_date: "2026-10-01", due_mileage: null }, "2026-10-29")).toBe("Due by date 2026-10-01");
    expect(dueBasis({ ...item, due_date: "2026-12-01", due_mileage: 1100, current_mileage: 1250 }, "2026-10-29")).toBe("Due by 1,100 km (now 1,250 km)");
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
