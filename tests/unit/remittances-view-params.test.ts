import { describe, expect, it } from "vitest";
import { dailyHref, listViewHref, parseRemittancesView } from "@/lib/remittances/view-params";

const today = "2026-10-30";

describe("parseRemittancesView (feature 008, FR-001a, FR-002)", () => {
  it("opens Daily view on today with no parameters", () => {
    expect(parseRemittancesView({}, today)).toEqual({ view: "daily", date: today });
  });

  it("keeps a valid past date", () => {
    expect(parseRemittancesView({ date: "2026-10-28" }, today)).toEqual({ view: "daily", date: "2026-10-28" });
  });

  it("falls back to today for a future, invalid or impossible date", () => {
    for (const date of ["2026-10-31", "2099-01-01", "garbage", "2026-02-30", ""]) {
      expect(parseRemittancesView({ date }, today)).toEqual({ view: "daily", date: today });
    }
  });

  it("shows List view when asked", () => {
    expect(parseRemittancesView({ view: "list" }, today).view).toBe("list");
  });

  it("shows List view for old links that carry list-only parameters", () => {
    for (const param of ["q", "page", "sort", "from", "to", "unit", "driver", "disposition", "balance"]) {
      expect(parseRemittancesView({ [param]: "x" }, today).view).toBe("list");
    }
  });

  it("lets an explicit daily view win over list parameters", () => {
    expect(parseRemittancesView({ view: "daily", q: "x" }, today).view).toBe("daily");
  });
});

describe("remittances hrefs", () => {
  it("builds Daily view and List view addresses", () => {
    expect(dailyHref()).toBe("/remittances");
    expect(dailyHref("2026-10-28")).toBe("/remittances?date=2026-10-28");
    expect(listViewHref()).toBe("/remittances?view=list");
  });
});
