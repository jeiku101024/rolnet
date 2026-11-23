import { describe, expect, it } from "vitest";
import { parseListPage } from "@/lib/pagination/list-page";
import { parseSfParams, participantHref, safeReturn, viewHref } from "@/lib/sinking-fund/url-state";

const id = "00000000-0000-4000-8000-000000000001";

describe("sinking fund URL state", () => {
  it("defaults to the Transactions view", () => {
    expect(parseSfParams({})).toMatchObject({ view: "transactions", rank: "savings", period: "all", psort: "savings", q: "" });
  });

  it("reads each view and ignores unknown values", () => {
    expect(parseSfParams({ view: "top" }).view).toBe("top");
    expect(parseSfParams({ view: "participants" }).view).toBe("participants");
    expect(parseSfParams({ view: "nope", rank: "x", period: "year", psort: "z" })).toMatchObject({ view: "transactions", rank: "savings", period: "all", psort: "savings" });
  });

  it("no longer reads a row limit and pages the list with `page`", () => {
    expect(parseSfParams({ n: "50" })).not.toHaveProperty("n");
    expect(parseListPage({ page: "3" }).page).toBe(3);
    expect(parseListPage({ page: "0" }).page).toBe(1);
    expect(parseListPage({ page: "abc" }).page).toBe(1);
  });

  it("accepts only a valid participant id for the legacy detail link", () => {
    expect(parseSfParams({ detail: id }).detail).toBe(id);
    expect(parseSfParams({ detail: "not-an-id" }).detail).toBeUndefined();
  });

  it("builds view links that keep only that view's parameters", () => {
    expect(viewHref("/sinking-fund", { q: "ana", type: "loan", page: "3" }, "transactions")).toBe("/sinking-fund?q=ana&type=loan");
    expect(viewHref("/sinking-fund", { q: "ana", type: "loan" }, "top")).toBe("/sinking-fund?view=top");
    expect(viewHref("/sinking-fund", { view: "top", rank: "deposits", period: "month" }, "top")).toBe("/sinking-fund?view=top&rank=deposits&period=month");
  });

  it("builds a participant link that remembers where it was opened from", () => {
    expect(participantHref(id)).toBe(`/sinking-fund/participants/${id}`);
    expect(participantHref(id, "?view=participants&q=ana")).toBe(`/sinking-fund/participants/${id}?return=%2Fsinking-fund%3Fview%3Dparticipants%26q%3Dana`);
  });

  it("sends Back only to an address inside /sinking-fund", () => {
    expect(safeReturn("/sinking-fund?view=participants&q=ana")).toBe("/sinking-fund?view=participants&q=ana");
    expect(safeReturn("/sinking-fund")).toBe("/sinking-fund");
    for (const bad of [undefined, "", "https://evil.test", "//evil.test", "/sinking-fundx", "/units"]) expect(safeReturn(bad)).toBe("/sinking-fund?view=participants");
  });

  it("reads the participant history page, search, and sort like the main list", () => {
    const request = parseListPage({ page: "2", q: `  ${"x".repeat(150)} ` });
    expect(request.page).toBe(2);
    expect(request.q).toHaveLength(100);
  });
});
