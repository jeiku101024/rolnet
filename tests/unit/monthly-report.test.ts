import { beforeEach, describe, expect, it, vi } from "vitest";
import { countUnitRows, escapeCsv, monthlyCsv, neutraliseFormula, reportColumns, reportHasActivity } from "@/lib/reports/monthly-csv";

const mocks = vi.hoisted(() => ({ profile: null as unknown, unit: null as unknown, rpc: vi.fn() }));

vi.mock("@/lib/auth/guards", () => ({ getSessionProfile: vi.fn(async () => mocks.profile) }));
vi.mock("@/lib/demo/mode", () => ({ demoMode: false, demoUnits: [] }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: () => ({ select: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: mocks.unit, error: null }) }) }) }) }),
    rpc: mocks.rpc,
  })),
}));

import { GET } from "@/app/api/reports/monthly/route";

const unitId = "00000000-0000-4000-8000-000000000001";
const owner = { userId: "o", displayName: "Owner", role: "owner", accountStatus: "approved" };
const get = (query: string) => GET(new Request(`http://localhost/api/reports/monthly?${query}`));

describe("monthly CSV", () => {
  it("writes the 14 contract columns with body and plate mapped", () => {
    const csv = monthlyCsv("2026-10", [{ unit_id: unitId, body_number: "T-01", plate_number: "ABC 123", remittance_due_centavos: 18000, net_income_centavos: -500 }]);
    const [header, row] = csv.replace(/^﻿/, "").split("\r\n");
    expect(header.split(",")).toEqual([...reportColumns]);
    expect(row.split(",")).toEqual(["2026-10", "T-01", "ABC 123", "18000", "0", "0", "0", "0", "0", "0", "0", "0", "0", "-500"]);
  });

  it("keeps the FLEET TOTAL row with an empty plate", () => {
    const csv = monthlyCsv("2026-10", [{ unit_id: null, body_number: "FLEET TOTAL", plate_number: null, total_expense_centavos: 100 }]);
    expect(csv).toContain("\r\n2026-10,FLEET TOTAL,,0,");
  });

  it("neutralises formula-looking text but not negative numbers", () => {
    expect(neutraliseFormula("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    for (const start of ["+", "-", "@", "\t"]) expect(neutraliseFormula(`${start}1+1`)).toBe(`'${start}1+1`);
    expect(neutraliseFormula("-1500")).toBe("-1500");
    expect(escapeCsv("=1,2")).toBe("\"'=1,2\"");
    expect(escapeCsv("a\"b")).toBe("\"a\"\"b\"");
  });

  it("summarises a downloaded CSV for the export form (T142)", () => {
    const total = { unit_id: null, body_number: "FLEET TOTAL", plate_number: null };
    const quiet = monthlyCsv("2020-01", [{ unit_id: "u", body_number: "=SUM(1,2)", plate_number: "A,B" }, total]);
    expect(countUnitRows(quiet)).toBe(1);
    expect(reportHasActivity(quiet)).toBe(false);
    expect(countUnitRows(monthlyCsv("2020-01", [total]))).toBe(0);
    expect(reportHasActivity(monthlyCsv("2026-10", [{ ...total, net_income_centavos: -500 }]))).toBe(true);
  });
});

describe("GET /api/reports/monthly", () => {
  beforeEach(() => {
    mocks.profile = owner;
    mocks.unit = { id: unitId, body_number: "T-01" };
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: [{ unit_id: unitId, body_number: "T-01", plate_number: "P" }], error: null });
  });

  it("returns 401 when signed out and 403 for staff", async () => {
    mocks.profile = null;
    expect((await get("month=2026-10&scope=fleet")).status).toBe(401);
    mocks.profile = { ...owner, role: "staff" };
    expect((await get("month=2026-10&scope=fleet")).status).toBe(403);
    mocks.profile = { ...owner, accountStatus: "pending" };
    expect((await get("month=2026-10&scope=fleet")).status).toBe(403);
  });

  it("returns 400 for bad parameters", async () => {
    expect((await get("month=2026-13&scope=fleet")).status).toBe(400);
    expect((await get("month=2026-10&scope=all")).status).toBe(400);
    expect((await get("month=2026-10&scope=unit")).status).toBe(400);
    expect((await get("month=2026-10&scope=unit&unitId=not-a-uuid")).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown unit", async () => {
    mocks.unit = null;
    const response = await get(`month=2026-10&scope=unit&unitId=${unitId}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("returns the CSV for one unit and for the fleet", async () => {
    const unit = await get(`month=2026-10&scope=unit&unitId=${unitId}`);
    expect(unit.status).toBe(200);
    expect(unit.headers.get("content-type")).toContain("text/csv");
    expect(unit.headers.get("content-disposition")).toContain("rolnet-2026-10-unit-T-01.csv");
    expect(mocks.rpc).toHaveBeenLastCalledWith("monthly_report", { month_start: "2026-10-01", selected_unit_id: unitId });
    const fleet = await get(`month=2026-10&scope=fleet&unitId=${unitId}`);
    expect(fleet.status).toBe(200);
    expect(mocks.rpc).toHaveBeenLastCalledWith("monthly_report", { month_start: "2026-10-01", selected_unit_id: null });
  });
});
