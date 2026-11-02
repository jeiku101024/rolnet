import { describe, expect, it } from "vitest";
import { loadMoreHref, parseTabParams, tabHref, visibleTabs } from "@/lib/drivers/tab-params";

describe("profile tab params (feature 012, FR-020, FR-021)", () => {
  it("defaults to Assignments with 8 rows", () => {
    expect(parseTabParams({}, true)).toEqual({ tab: "assignments", rows: 8 });
  });

  it("falls back to Assignments for unknown tabs and for Documents without owner access", () => {
    expect(parseTabParams({ tab: "secret" }, true).tab).toBe("assignments");
    expect(parseTabParams({ tab: "documents" }, false).tab).toBe("assignments");
    expect(parseTabParams({ tab: "documents" }, true).tab).toBe("documents");
    expect(visibleTabs(false).map((tab) => tab.value)).not.toContain("documents");
  });

  it("keeps rows in steps of 8 between 8 and 200", () => {
    expect(parseTabParams({ rows: "16" }, true).rows).toBe(16);
    expect(parseTabParams({ rows: "10" }, true).rows).toBe(16);
    expect(parseTabParams({ rows: "3" }, true).rows).toBe(8);
    expect(parseTabParams({ rows: "abc" }, true).rows).toBe(8);
    expect(parseTabParams({ rows: "9999" }, true).rows).toBe(200);
  });

  it("builds Load more and tab links", () => {
    expect(loadMoreHref("/drivers/d1", { tab: "absences" }, 8)).toBe("/drivers/d1?tab=absences&rows=16");
    expect(tabHref("/drivers/d1", { tab: "absences", rows: "16" }, "remittances")).toBe("/drivers/d1?tab=remittances");
    expect(tabHref("/drivers/d1", { tab: "absences" }, "assignments")).toBe("/drivers/d1");
  });
});
