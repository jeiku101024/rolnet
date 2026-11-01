import { describe, expect, it } from "vitest";
import { formatMonth, monthlyAllowanceBlocks, windowStart } from "@/lib/units/monthly-allowance";

const today = "2026-11-01";

describe("monthlyAllowanceBlocks (feature 010, FR-041)", () => {
  it("covers the 12 calendar months ending with the current one", () => {
    expect(windowStart(today)).toBe("2025-12");
    expect(windowStart("2026-12-31")).toBe("2026-01");
  });

  it("totals allowance and expenses per month, newest first, with the net", () => {
    const blocks = monthlyAllowanceBlocks(
      [{ service_date: "2026-10-01", allowance_centavos: 4000 }, { service_date: "2026-10-02", allowance_centavos: 4000 }, { service_date: "2026-11-01", allowance_centavos: 4000 }],
      [{ expense_date: "2026-10-15", amount_centavos: 10000 }],
      today,
    );
    expect(blocks.map((block) => block.month)).toEqual(["2026-11", "2026-10"]);
    expect(blocks[1]).toMatchObject({ allowanceCentavos: 8000, expensesCentavos: 10000, netCentavos: -2000, allowanceWidth: 80, expensesWidth: 100 });
    expect(blocks[0]).toMatchObject({ allowanceCentavos: 4000, expensesCentavos: 0, netCentavos: 4000, allowanceWidth: 100, expensesWidth: 0 });
  });

  it("skips months with no activity and anything outside the window", () => {
    const blocks = monthlyAllowanceBlocks(
      [{ service_date: "2025-11-30", allowance_centavos: 4000 }, { service_date: "2026-12-01", allowance_centavos: 4000 }],
      [{ expense_date: "2025-12-01", amount_centavos: 500 }],
      today,
    );
    expect(blocks.map((block) => block.month)).toEqual(["2025-12"]);
  });

  it("returns nothing when there is no activity", () => {
    expect(monthlyAllowanceBlocks([], [], today)).toEqual([]);
  });

  it("names the month", () => {
    expect(formatMonth("2026-11")).toBe("November 2026");
  });
});
