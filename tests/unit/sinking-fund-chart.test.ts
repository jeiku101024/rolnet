import { describe, expect, it } from "vitest";
import { hasNoActivity, monthLabelPlan } from "@/lib/sinking-fund/chart";

const months = (count: number) => Array.from({ length: count }, (_, index) => `2026-${String(index + 1).padStart(2, "0")}-01`);

describe("monthly chart labels", () => {
  it("labels every month for up to six months", () => {
    const plan = monthLabelPlan(months(6));
    expect(plan.map((item) => item.label)).toEqual(["Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26"]);
  });

  it("labels every other month beyond six, always including the latest", () => {
    const plan = monthLabelPlan(months(9));
    expect(plan.map((item) => item.label)).toEqual(["Jan 26", null, "Mar 26", null, "May 26", null, "Jul 26", null, "Sep 26"]);
    expect(plan.at(-1)?.label).toBe("Sep 26");
  });

  it("keeps a month with no label in the plan so its bars and tick are still drawn", () => {
    expect(monthLabelPlan(months(8))).toHaveLength(8);
  });

  it("knows when there is no activity at all", () => {
    expect(hasNoActivity([{ deposits_centavos: 0, loans_centavos: 0, payments_centavos: 0 }])).toBe(true);
    expect(hasNoActivity([{ deposits_centavos: 0, loans_centavos: 0, payments_centavos: 1 }])).toBe(false);
    expect(hasNoActivity([])).toBe(true);
  });
});
