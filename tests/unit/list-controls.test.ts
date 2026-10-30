import { describe, expect, it } from "vitest";
import { applyFilters, applySort, controlRows, fleetDayStart, parseControls, prepareSpec } from "@/lib/pagination/list-controls";
import { listControlSpecs } from "@/lib/pagination/list-control-specs";

const today = "2026-10-30";

/** Records the builder calls instead of talking to Supabase. */
function recorder() {
  const calls: string[] = [];
  const q: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["eq", "is", "not", "gt", "gte", "lt", "lte", "order"]) q[method] = (...args: unknown[]) => { calls.push(`${method}(${args.map((arg) => JSON.stringify(arg)).join(",")})`); return q; };
  return { q, calls };
}

describe("list sort and filter controls (feature 006, US8)", () => {
  it("ignores values a list does not offer and falls back to the default sort", () => {
    const parsed = parseControls({ sort: "bogus", status: "flying", from: "2026-02-30", to: "yesterday" }, listControlSpecs.units, today);
    expect(parsed.sort.value).toBe("body");
    expect(parsed.sortIsDefault).toBe(true);
    expect(parsed.count).toBe(0);
  });

  it("reads valid sorts, filters and a date range", () => {
    const parsed = parseControls({ sort: "amount-desc", from: "2026-10-01", to: "2026-10-31", disposition: "returned" }, listControlSpecs.remittances, today);
    expect(parsed.sort.value).toBe("amount-desc");
    expect(parsed.values).toEqual({ from: "2026-10-01", to: "2026-10-31", disposition: "returned" });
    expect(parsed.count).toBe(2);
    const { q, calls } = recorder();
    applySort(applyFilters(q, parsed), parsed);
    expect(calls).toEqual(['gte("service_date","2026-10-01")', 'lte("service_date","2026-10-31")', 'eq("disposition","returned")', 'order("amount_due_centavos",{"ascending":false,"nullsFirst":false})', 'order("service_date",{"ascending":false,"nullsFirst":false})']);
  });

  it("only accepts unit, driver and category ids the page offers", () => {
    const spec = prepareSpec(listControlSpecs.expenses, { options: { unit: [{ value: "u1", label: "Body T-001" }], category: [{ value: "c1", label: "Fuel" }] } });
    expect(parseControls({ unit: "u1", category: "c9" }, spec, today).values).toEqual({ unit: "u1" });
  });

  it("hides owner-only filters from staff", () => {
    const staffSpec = prepareSpec(listControlSpecs.remittances, { isOwner: false });
    expect(staffSpec.filters.map((def) => ("param" in def ? def.param : "range"))).not.toContain("balance");
    expect(parseControls({ balance: "unpaid" }, staffSpec, today).count).toBe(0);
  });

  it("maps status words to column values and receipts to empty or filled", () => {
    const drivers = parseControls({ status: "inactive", license: "soon" }, listControlSpecs.drivers, today);
    const { q, calls } = recorder();
    applyFilters(q, drivers);
    expect(calls).toEqual(['eq("is_active",false)', 'gte("license_expiry_date","2026-10-30")', 'lte("license_expiry_date","2026-11-29")']);
    const expenses = parseControls({ receipt: "missing" }, listControlSpecs.expenses, today);
    const second = recorder();
    applyFilters(second.q, expenses);
    expect(second.calls).toEqual(['is("receipt_object_path",null)']);
  });

  it("uses the fleet's calendar day for timestamp ranges", () => {
    expect(fleetDayStart("2026-10-30", "Asia/Manila")).toBe("2026-10-29T16:00:00.000Z");
    const parsed = parseControls({ from: "2026-10-30", to: "2026-10-30" }, listControlSpecs.audit, today);
    const { q, calls } = recorder();
    applyFilters(q, parsed);
    expect(calls).toEqual(['gte("occurred_at","2026-10-29T16:00:00.000Z")', 'lt("occurred_at","2026-10-30T16:00:00.000Z")']);
  });

  it("filters and sorts in memory by the same rules (demo mode)", () => {
    const rows = [
      { id: "a", expires_on: "2026-10-27", document_type: "or_cr", unit_id: "u", driver_id: null, created_at: "2026-10-01" },
      { id: "b", expires_on: "2026-11-05", document_type: "insurance", unit_id: null, driver_id: "d", created_at: "2026-10-02" },
      { id: "c", expires_on: "2027-03-01", document_type: "insurance", unit_id: "u", driver_id: null, created_at: "2026-10-03" },
    ];
    const ids = (query: Record<string, string>) => controlRows(rows, parseControls(query, listControlSpecs.documents, today)).map((row) => row.id);
    expect(ids({ expiry: "expired" })).toEqual(["a"]);
    expect(ids({ expiry: "soon" })).toEqual(["b"]);
    expect(ids({ expiry: "due" })).toEqual(["a", "b"]);
    expect(ids({ expiry: "later" })).toEqual(["c"]);
    expect(ids({ holder: "driver" })).toEqual(["b"]);
    expect(ids({ type: "insurance", sort: "expiry-desc" })).toEqual(["c", "b"]);
    expect(ids({ sort: "newest" })).toEqual(["c", "b", "a"]);
  });

  it("puts the Manila day of a late-evening change under that day", () => {
    const events = [{ id: 1, occurred_at: "2026-10-30T15:30:00Z" }, { id: 2, occurred_at: "2026-10-30T16:30:00Z" }];
    const parsed = parseControls({ from: "2026-10-30", to: "2026-10-30" }, listControlSpecs.audit, today);
    expect(controlRows(events, parsed).map((event) => event.id)).toEqual([1]);
  });
});
