import { beforeEach, describe, expect, it, vi } from "vitest";

// Feature 014 (contracts/reports-http.md): the report data route and the units-for-period route, in demo mode.

vi.mock("next/server", async () => ({ ...(await vi.importActual<typeof import("next/server")>("next/server")), connection: async () => undefined }));
vi.mock("@/lib/auth/guards", () => ({ getSessionProfile: vi.fn() }));
vi.mock("@/lib/demo/mode", async () => ({ ...(await vi.importActual<typeof import("@/lib/demo/mode")>("@/lib/demo/mode")), demoMode: true }));

import { getSessionProfile } from "@/lib/auth/guards";
import { demoUnits } from "@/lib/demo/mode";
import { fleetToday } from "@/lib/dates/fleet-date";
import { GET as unitsRoute } from "@/app/api/reports/units/route";
import { GET as dataRoute } from "@/app/api/reports/[kind]/route";
import type { ReportPayload } from "@/lib/reports/report-payload";
import type { UnitChoice } from "@/lib/reports/units-response";

const profile = (role: "owner" | "staff", accountStatus = "approved") => vi.mocked(getSessionProfile).mockResolvedValue({ role, accountStatus } as Awaited<ReturnType<typeof getSessionProfile>>);
const month = fleetToday().slice(0, 7);
const year = fleetToday().slice(0, 4);
const data = (kind: string, query: string) => dataRoute(new Request(`http://localhost/api/reports/${kind}?${query}`), { params: Promise.resolve({ kind }) });
const units = (query: string) => unitsRoute(new Request(`http://localhost/api/reports/units?${query}`));
const errorOf = async (response: Response) => (await response.json() as { error: { code: string; message: string } }).error;

beforeEach(() => { profile("owner"); });

describe("GET /api/reports/units", () => {
  it("refuses a signed-out user, an unapproved user, and staff", async () => {
    vi.mocked(getSessionProfile).mockResolvedValue(null);
    expect((await units(`kind=monthly&month=${month}`)).status).toBe(401);
    profile("owner", "pending");
    expect((await units(`kind=monthly&month=${month}`)).status).toBe(403);
    profile("staff");
    const staff = await units(`kind=monthly&month=${month}`);
    expect(staff.status).toBe(403);
    expect((await errorOf(staff)).message).toBe("Only the owner can download reports.");
  });

  it("rejects an unknown kind and a bad period", async () => {
    expect((await units(`kind=daily&month=${month}`)).status).toBe(400);
    const bad = await units("kind=monthly&month=2026-13");
    expect(bad.status).toBe(400);
    expect((await errorOf(bad)).message).toBe("Choose a valid month.");
    expect((await units("kind=weekly&date=nope")).status).toBe(400);
    expect((await units("kind=yearly&year=1900")).status).toBe(400);
  });

  it("lists the non-archived units in natural order and leaves out an archived unit with no records", async () => {
    const response = await units(`kind=monthly&month=${month}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { units: list } = await response.json() as { units: UnitChoice[] };
    const names = list.map((unit) => unit.name);
    expect(names).toContain("ROLNET-2");
    expect(names.indexOf("ROLNET-2")).toBeLessThan(names.indexOf("ROLNET-10"));
    expect(names).not.toContain(demoUnits.find((unit) => unit.archived)!.name);
    expect(list.every((unit) => !unit.archived)).toBe(true);
  });

  it("answers every period type", async () => {
    expect((await units(`kind=weekly&date=${fleetToday()}`)).status).toBe(200);
    expect((await units(`kind=yearly&year=${year}`)).status).toBe(200);
  });
});

describe("GET /api/reports/{kind}", () => {
  it("applies the same guard and period checks", async () => {
    profile("staff");
    expect((await data("monthly", `month=${month}`)).status).toBe(403);
    profile("owner");
    expect((await data("daily", `month=${month}`)).status).toBe(400);
    expect((await errorOf(await data("monthly", "month=bad"))).message).toBe("Choose a valid month.");
    expect((await errorOf(await data("weekly", "scope=all"))).message).toBe("Choose a valid date.");
    expect((await errorOf(await data("monthly", `month=${month}&scope=everything`))).code).toBe("INVALID_QUERY");
    expect((await errorOf(await data("monthly", `month=${month}&scope=unit`))).message).toBe("Choose the unit to report on.");
    expect((await errorOf(await data("monthly", `month=${month}&scope=unit&unitId=nope`))).message).toBe("The selected unit is not valid. Choose the unit again.");
  });

  it("returns the data for every unit with the all-units file name", async () => {
    const response = await data("monthly", `month=${month}`);
    expect(response.status).toBe(200);
    const payload = await response.json() as ReportPayload;
    expect(payload).toMatchObject({ kind: "monthly", key: month, scope: "all", fileName: `rolnet-monthly-${month}-all-units.xlsx` });
    expect(payload.units.length).toBeGreaterThan(3);
    expect(payload.daily).toBeDefined();
    expect(payload.yearly).toBeUndefined();
  });

  it("accepts the old fleet scope as all units", async () => {
    expect((await (await data("monthly", `month=${month}&scope=fleet`)).json() as ReportPayload).scope).toBe("all");
  });

  it("returns one unit's data for a single unit", async () => {
    const first = demoUnits[0];
    const payload = await (await data("monthly", `month=${month}&scope=unit&unitId=${first.id}`)).json() as ReportPayload;
    expect(payload.scope).toBe("unit");
    expect(payload.units).toEqual([{ id: first.id, name: first.name }]);
    expect(payload.fileName).toBe(`rolnet-monthly-${month}-${first.name}.xlsx`);
    expect(Object.keys(payload.daily ?? {}).every((id) => id === first.id)).toBe(true);
  });

  it("returns 404 for a unit that has no report for the period", async () => {
    const archived = demoUnits.find((unit) => unit.archived)!;
    const response = await data("monthly", `month=${month}&scope=unit&unitId=${archived.id}`);
    expect(response.status).toBe(404);
    expect((await errorOf(response)).message).toBe("That unit has no report for this period. Choose another unit.");
    expect((await data("monthly", `month=${month}&scope=unit&unitId=00000000-0000-4000-8000-00000000ffff`)).status).toBe(404);
  });

  it("returns yearly months instead of daily rows, and the Monday for a weekly report", async () => {
    const yearly = await (await data("yearly", `year=${year}`)).json() as ReportPayload;
    expect(yearly.fileName).toBe(`rolnet-yearly-${year}-all-units.xlsx`);
    expect(yearly.daily).toBeUndefined();
    expect(Object.values(yearly.yearly ?? {})[0].months).toHaveLength(12);
    const weekly = await (await data("weekly", "date=2026-10-28")).json() as ReportPayload;
    expect(weekly.key).toBe("2026-10-26");
    expect(weekly.fileName).toBe("rolnet-weekly-2026-10-26-all-units.xlsx");
  });

  it("returns an empty period as a normal report", async () => {
    const response = await data("monthly", "month=2020-01");
    expect(response.status).toBe(200);
    expect(Object.keys((await response.json() as ReportPayload).daily ?? {})).toHaveLength(0);
  });
});
