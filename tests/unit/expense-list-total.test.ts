import { describe, expect, it } from "vitest";
import { loadExpenseTotal, sumAmounts, type AmountQuery } from "@/lib/expenses/list-total";
import { parseControls, prepareSpec } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";

/** A fake query that records its calls and serves `rows` in the requested ranges. */
function fakeClient(rows: number[]) {
  const calls: string[][] = [];
  const select = () => {
    const log: string[] = [];
    calls.push(log);
    const query: AmountQuery = {
      is: (column) => { log.push(`is:${column}`); return query; },
      or: (filter) => { log.push(`or:${filter}`); return query; },
      order: (column) => { log.push(`order:${column}`); return query; },
      range: (from, to) => { log.push(`range:${from}-${to}`); return Promise.resolve({ data: rows.slice(from, to + 1).map((amount_centavos) => ({ amount_centavos })) }); },
    };
    // applyFilters calls eq/not/gte/lte on the same object.
    return Object.assign(query, {
      eq: (column: string, value: unknown) => { log.push(`eq:${column}=${String(value)}`); return query; },
      not: (column: string) => { log.push(`not:${column}`); return query; },
      gte: (column: string, value: unknown) => { log.push(`gte:${column}=${String(value)}`); return query; },
      lte: (column: string, value: unknown) => { log.push(`lte:${column}=${String(value)}`); return query; },
    });
  };
  return { select, calls };
}

describe("loadExpenseTotal", () => {
  const controls = parseControls({ category: "others", unit: "u1", from: "2026-10-01", to: "2026-10-31" }, prepareSpec(listControlSpecs.expenses, { options: { unit: [{ value: "u1", label: "Body 1" }] } }));

  it("applies the table's filters and search to every read", async () => {
    const { select, calls } = fakeClient([100, 250]);
    await expect(loadExpenseTotal(select, controls, "notes.ilike.*oil*", 2)).resolves.toBe(350);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.arrayContaining(["is:deleted_at", "eq:category=others", "eq:unit_id=u1", "gte:expense_date=2026-10-01", "lte:expense_date=2026-10-31", "or:notes.ilike.*oil*"]));
  });

  it("sums across pages of 1000 with integer math", async () => {
    const rows = Array.from({ length: 2345 }, (_, index) => (index % 3) + 1);
    const { select, calls } = fakeClient(rows);
    await expect(loadExpenseTotal(select, controls, null, rows.length)).resolves.toBe(rows.reduce((sum, value) => sum + value, 0));
    expect(calls.map((log) => log.find((entry) => entry.startsWith("range:")))).toEqual(["range:0-999", "range:1000-1999", "range:2000-2999"]);
  });

  it("skips the read when nothing matches", async () => {
    const { select, calls } = fakeClient([]);
    await expect(loadExpenseTotal(select, controls, null, 0)).resolves.toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("sums demo rows in memory", () => {
    expect(sumAmounts([{ amount_centavos: 100 }, { amount_centavos: 5 }])).toBe(105);
  });
});
