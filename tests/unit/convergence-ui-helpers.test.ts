import { describe, expect, it } from "vitest";
import { remittanceTotals } from "@/lib/remittances/totals";
import { dueText, orderDueMaintenance } from "@/lib/dashboard/ordering";
import { loginErrorMessage } from "@/lib/auth/login-errors";
import { startPageFor } from "@/lib/permissions/roles";

describe("remittanceTotals (T139)", () => {
  it("shows a balance when underpaid and a credit when overpaid", () => {
    expect(remittanceTotals(18000, [{ amount_centavos: 10000 }])).toEqual({ paid: 10000, balance: 8000, credit: 0 });
    expect(remittanceTotals(18000, [{ amount_centavos: 10000 }, { amount_centavos: 10000 }])).toEqual({ paid: 20000, balance: 0, credit: 2000 });
    expect(remittanceTotals(30000, null)).toEqual({ paid: 0, balance: 30000, credit: 0 });
  });
});

describe("due maintenance wording (T141, feature 006)", () => {
  const item = { item_id: "i", item_type: "part", unit_id: "u", item_name: "Oil", body_number: "T-001" };
  it("names the date and/or mileage that made the item due", () => {
    const [byDate] = orderDueMaintenance([{ ...item, due_date: "2026-10-01", due_mileage: null, current_mileage: 1000 }], "2026-10-29");
    expect(dueText(byDate)).toBe("28 days overdue");
    const [both] = orderDueMaintenance([{ ...item, due_date: "2026-10-29", due_mileage: 1100, current_mileage: 1250 }], "2026-10-29");
    expect(dueText(both)).toBe("Due today · 150 km past due");
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
