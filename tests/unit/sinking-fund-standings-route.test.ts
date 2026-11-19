import { beforeEach, describe, expect, it, vi } from "vitest";

// Feature 019 (contracts/sinking-fund-standings.md): the standings download route, in demo mode.

vi.mock("next/server", async () => ({ ...(await vi.importActual<typeof import("next/server")>("next/server")), connection: async () => undefined }));
vi.mock("@/lib/auth/guards", () => ({ getSessionProfile: vi.fn() }));
vi.mock("@/lib/demo/mode", async () => ({ ...(await vi.importActual<typeof import("@/lib/demo/mode")>("@/lib/demo/mode")), demoMode: true }));

import { getSessionProfile } from "@/lib/auth/guards";
import { fleetToday } from "@/lib/dates/fleet-date";
import { GET } from "@/app/api/sinking-fund/standings/route";
import { readWorkbook } from "@/tests/support/xlsx-read";

const profile = (role: "owner" | "staff", accountStatus = "approved") => vi.mocked(getSessionProfile).mockResolvedValue({ role, accountStatus } as Awaited<ReturnType<typeof getSessionProfile>>);
const month = fleetToday().slice(0, 7);
const call = (query: string) => GET(new Request(`http://localhost/api/sinking-fund/standings?${query}`));
const errorOf = async (response: Response) => (await response.json() as { error: { code: string; message: string } }).error;

beforeEach(() => { profile("owner"); });

describe("GET /api/sinking-fund/standings", () => {
  it("refuses signed-out, unapproved and staff callers", async () => {
    vi.mocked(getSessionProfile).mockResolvedValue(null);
    expect((await call(`month=${month}`)).status).toBe(401);
    profile("owner", "pending");
    expect((await call(`month=${month}`)).status).toBe(403);
    profile("staff");
    const staff = await call(`month=${month}`);
    expect(staff.status).toBe(403);
    expect((await errorOf(staff)).message).toBe("Only the owner can download this.");
  });

  it("rejects a missing, malformed, future or very old month", async () => {
    for (const query of ["", "month=2026-13", "month=nope", `month=${Number(month.slice(0, 4)) + 1}-01`, "month=2001-01"]) {
      const response = await call(query);
      expect(response.status).toBe(400);
      expect((await errorOf(response)).message).toBe("Choose a valid month.");
    }
  });

  it("returns the workbook for the owner with the file name and no caching", async () => {
    const response = await call(`month=${month}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="rolnet-sinking-fund-standings-${month}.xlsx"`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const workbook = readWorkbook(new Uint8Array(await response.arrayBuffer()));
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(["Standings"]);
    const names = [...workbook.sheets[0].cells].filter(([ref]) => /^B\d+$/.test(ref)).map(([, cell]) => cell.value);
    expect(names).toContain("Ana Reyes");
    expect(names).not.toContain("Iris Ortiz");
  });

  it("builds a past month as of its last day", async () => {
    const response = await call(`month=${Number(month.slice(0, 4)) - 1}-01`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(`rolnet-sinking-fund-standings-${Number(month.slice(0, 4)) - 1}-01.xlsx`);
  });

  it("builds the file quickly", async () => {
    const started = performance.now();
    const response = await call(`month=${month}`);
    await response.arrayBuffer();
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
