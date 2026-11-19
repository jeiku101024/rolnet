import { beforeEach, describe, expect, it, vi } from "vitest";

// Feature 019 (contracts/expenses-month.md): the monthly Expenses data route, in demo mode.

vi.mock("next/server", async () => ({ ...(await vi.importActual<typeof import("next/server")>("next/server")), connection: async () => undefined }));
vi.mock("@/lib/auth/guards", () => ({ getSessionProfile: vi.fn() }));
vi.mock("@/lib/demo/mode", async () => ({ ...(await vi.importActual<typeof import("@/lib/demo/mode")>("@/lib/demo/mode")), demoMode: true }));

import { getSessionProfile } from "@/lib/auth/guards";
import { fleetToday } from "@/lib/dates/fleet-date";
import { GET } from "@/app/api/expenses/month/route";
import { buildExpensesWorkbook } from "@/lib/expenses/month-workbook";
import type { ExpensesMonthPayload } from "@/lib/expenses/month-data";

const profile = (role: "owner" | "staff", accountStatus = "approved") => vi.mocked(getSessionProfile).mockResolvedValue({ role, accountStatus } as Awaited<ReturnType<typeof getSessionProfile>>);
const month = fleetToday().slice(0, 7);
const call = (query: string) => GET(new Request(`http://localhost/api/expenses/month?${query}`));
const errorOf = async (response: Response) => (await response.json() as { error: { code: string; message: string } }).error;

beforeEach(() => { profile("owner"); });

describe("GET /api/expenses/month", () => {
  it("refuses signed-out and unapproved callers", async () => {
    vi.mocked(getSessionProfile).mockResolvedValue(null);
    expect((await call(`month=${month}`)).status).toBe(401);
    profile("staff", "pending");
    expect((await call(`month=${month}`)).status).toBe(403);
  });

  it("lets approved staff download, like the Expenses page", async () => {
    profile("staff");
    const response = await call(`month=${month}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects a missing, malformed, future or very old month", async () => {
    for (const query of ["", "month=2026-13", "month=x", `month=${Number(month.slice(0, 4)) + 1}-01`, "month=2001-01"]) {
      const response = await call(query);
      expect(response.status).toBe(400);
      expect((await errorOf(response)).message).toBe("Choose a valid month.");
    }
  });

  it("returns the payload and builds the workbook for 100 units and 2,000 expenses quickly", async () => {
    const response = await call(`month=${month}`);
    const payload = await response.json() as ExpensesMonthPayload;
    expect(payload.month).toBe(month);
    expect(payload.fileName).toBe(`rolnet-expenses-${month}.xlsx`);
    const units = Array.from({ length: 100 }, (_, index) => ({ id: `u${index}`, name: `ROLNET-${index + 1}` }));
    const expenses = Array.from({ length: 2000 }, (_, index) => ({ unitId: `u${index % 100}`, date: `${month}-${String((index % 27) + 1).padStart(2, "0")}`, category: "others", customCategory: "Fuel", replacedDate: null, amountCentavos: 12500, notes: "Paid at the shop" }));
    const started = performance.now();
    const bytes = await buildExpensesWorkbook({ ...payload, units, expenses });
    expect(bytes.length).toBeGreaterThan(1000);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
