import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates/fleet-date";
import { expiryText, orderExpiringDocuments, orderExtradors, orderInRepair, orderUnpaidBalances, orderUnpaidLoans, repairText, toPanel } from "@/lib/dashboard/ordering";

const today = "2026-10-30";

describe("dashboard attention ordering (feature 006)", () => {
  it("lists expired documents first, then the soonest to expire", () => {
    const rows = [25, 2, -3, 10].map((days, index) => ({ id: `d${index}`, document_type: "insurance", expires_on: addDays(today, days), bucket: "due_30", holderLabel: "Body T-001" }));
    const ordered = orderExpiringDocuments(rows, today);
    expect(ordered.map((item) => item.daysUntil)).toEqual([-3, 2, 10, 25]);
    expect(ordered.map((item) => expiryText(item.daysUntil))).toEqual(["Expired 3 days ago", "Expires in 2 days", "Expires in 10 days", "Expires in 25 days"]);
    expect(expiryText(0)).toBe("Expires today");
    expect(expiryText(-1)).toBe("Expired 1 day ago");
  });

  it("orders unpaid balances by amount, then by the oldest unpaid day, and drops zero balances", () => {
    const ordered = orderUnpaidBalances([
      { driver_id: "a", driver_name: "A", outstanding_centavos: 18000, unpaid_remittance_count: 1, first_unpaid_service_date: "2026-10-20" },
      { driver_id: "b", driver_name: "B", outstanding_centavos: 18000, unpaid_remittance_count: 2, first_unpaid_service_date: "2026-10-01" },
      { driver_id: "c", driver_name: "C", outstanding_centavos: 50000, unpaid_remittance_count: 3, first_unpaid_service_date: "2026-10-25" },
      { driver_id: "d", driver_name: "D", outstanding_centavos: 0, unpaid_remittance_count: 0, first_unpaid_service_date: null },
    ]);
    expect(ordered.map((item) => item.driverId)).toEqual(["c", "b", "a"]);
  });

  it("caps panels at 5 items and keeps the total for View all", () => {
    const panel = toPanel(Array.from({ length: 12 }, (_, index) => index), "/maintenance?due=1");
    expect(panel.items).toHaveLength(5);
    expect(panel.total).toBe(12);
  });
});

describe("unpaid sinking fund loans (feature 017)", () => {
  const people = [{ id: "a", name: "Ana" }, { id: "b", name: "Ben" }, { id: "c", name: "Cora" }];
  const loan = (participant_id: string, balance_centavos: number, overdue = false, due_date: string | null = "2026-11-30") => ({ participant_id, balance_centavos, overdue, due_date });

  it("combines a participant's open loans into one row", () => {
    const [row] = orderUnpaidLoans([loan("a", 30000, false, "2026-12-01"), loan("a", 20000, true, "2026-10-01")], people);
    expect(row).toMatchObject({ participantName: "Ana", outstandingCentavos: 50000, openLoanCount: 2, overdue: true, earliestDueDate: "2026-10-01" });
  });

  it("orders by balance then name and drops paid loans and unknown participants", () => {
    const ordered = orderUnpaidLoans([loan("b", 10000), loan("c", 10000), loan("a", 90000), loan("a", 0), loan("zzz", 5000)], people);
    expect(ordered.map((item) => item.participantName)).toEqual(["Ana", "Ben", "Cora"]);
    expect(orderUnpaidLoans([loan("a", 0)], people)).toEqual([]);
    expect(orderUnpaidLoans([], people)).toEqual([]);
  });

  it("is not overdue when no open loan is past due", () => {
    expect(orderUnpaidLoans([loan("a", 100)], people)[0]?.overdue).toBe(false);
  });
});

describe("dashboard fleet status ordering (feature 006)", () => {
  it("puts assigned extradors first", () => {
    const ordered = orderExtradors([
      { driverId: "1", fullName: "Ana", phone: "", currentUnit: null, assignmentType: null },
      { driverId: "2", fullName: "Zed", phone: "", currentUnit: { unitId: "u", bodyNumber: "T-012" }, assignmentType: "backup" },
    ]);
    expect(ordered.map((item) => item.driverId)).toEqual(["2", "1"]);
  });

  it("lists the unit longest in repair first and unknown start times last", () => {
    const ordered = orderInRepair([
      { unitId: "a", bodyNumber: "T-001", plateNumber: "", inRepairSince: null, daysInRepair: null },
      { unitId: "b", bodyNumber: "T-002", plateNumber: "", inRepairSince: "2026-10-28T00:00:00Z", daysInRepair: 2 },
      { unitId: "c", bodyNumber: "T-003", plateNumber: "", inRepairSince: "2026-10-01T00:00:00Z", daysInRepair: 29 },
    ]);
    expect(ordered.map((item) => item.unitId)).toEqual(["c", "b", "a"]);
    expect(ordered.map(repairText)).toEqual(["In repair for 29 days", "In repair for 2 days", "In repair"]);
  });
});
