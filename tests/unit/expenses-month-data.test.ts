import { describe, expect, it, vi } from "vitest";

// Feature 019 (contracts/expenses-month.md): the rows behind the monthly Expenses workbook, in demo mode.

vi.mock("@/lib/demo/mode", async () => ({ ...(await vi.importActual<typeof import("@/lib/demo/mode")>("@/lib/demo/mode")), demoMode: true }));

import { demoExpenses, demoUnits } from "@/lib/demo/mode";
import { expensesFileName, expensesMonthLabel, loadExpensesMonth } from "@/lib/expenses/month-data";

const busyMonth = demoExpenses[0].expense_date.slice(0, 7);

describe("loadExpensesMonth (feature 019)", () => {
  it("returns every non-archived unit in natural name order, even the ones with no expenses", async () => {
    const payload = await loadExpensesMonth(null, busyMonth);
    const names = payload.units.map((unit) => unit.name);
    expect(names).toEqual(demoUnits.filter((unit) => !unit.archived).map((unit) => unit.name).sort((a, b) => a.localeCompare(b, "en", { numeric: true })));
    expect(names.indexOf("ROLNET-2")).toBeLessThan(names.indexOf("ROLNET-10"));
  });

  it("leaves out an archived unit with no expenses that month", async () => {
    const payload = await loadExpensesMonth(null, busyMonth);
    expect(payload.units.some((unit) => unit.name === "ROLNET-12")).toBe(false);
  });

  it("includes an archived unit that has an expense that month", async () => {
    const archived = demoUnits.find((unit) => unit.archived)!;
    const month = "2020-03";
    demoExpenses.push({ ...demoExpenses[0], id: "archived-demo", unit_id: archived.id, expense_date: `${month}-10` });
    try {
      const payload = await loadExpensesMonth(null, month);
      expect(payload.units.map((unit) => unit.name)).toContain(archived.name);
      expect(payload.expenses.filter((row) => row.unitId === archived.id)).toHaveLength(1);
    } finally {
      demoExpenses.pop();
    }
  });

  it("holds only the chosen month, oldest first, without receipt data", async () => {
    const payload = await loadExpensesMonth(null, busyMonth);
    expect(payload.expenses.length).toBeGreaterThan(0);
    expect(payload.expenses.every((row) => row.date.startsWith(busyMonth))).toBe(true);
    expect(payload.expenses.map((row) => row.date)).toEqual([...payload.expenses.map((row) => row.date)].sort());
    expect(Object.keys(payload.expenses[0]).sort()).toEqual(["amountCentavos", "category", "customCategory", "date", "notes", "replacedDate", "unitId"]);
  });

  it("names the file and the month", async () => {
    const payload = await loadExpensesMonth(null, "2026-11");
    expect(payload.fileName).toBe("rolnet-expenses-2026-11.xlsx");
    expect(expensesFileName("2026-11")).toBe(payload.fileName);
    expect(payload.monthLabel).toBe("November 2026");
    expect(expensesMonthLabel("2026-01")).toBe("January 2026");
  });
});
