import { describe, expect, it } from "vitest";
import { parseSfParams, viewHref } from "@/lib/sinking-fund/url-state";

describe("sinking fund URL state", () => {
  it("defaults to the Transactions view", () => {
    expect(parseSfParams({})).toMatchObject({ view: "transactions", n: 25, rank: "savings", period: "all", psort: "savings", hn: 10, q: "" });
  });

  it("reads each view and ignores unknown values", () => {
    expect(parseSfParams({ view: "top" }).view).toBe("top");
    expect(parseSfParams({ view: "participants" }).view).toBe("participants");
    expect(parseSfParams({ view: "nope", rank: "x", period: "year", psort: "z" })).toMatchObject({ view: "transactions", rank: "savings", period: "all", psort: "savings" });
  });

  it("grows the row limit in steps of 25 and the history in steps of 10", () => {
    expect(parseSfParams({ n: "50" }).n).toBe(50);
    expect(parseSfParams({ n: "30" }).n).toBe(50);
    expect(parseSfParams({ n: "-4" }).n).toBe(25);
    expect(parseSfParams({ n: "abc" }).n).toBe(25);
    expect(parseSfParams({ hn: "20" }).hn).toBe(20);
    expect(parseSfParams({ n: "999999" }).n).toBe(1000);
  });

  it("accepts only a valid participant id for the detail sheet", () => {
    expect(parseSfParams({ detail: "00000000-0000-4000-8000-000000000001" }).detail).toBe("00000000-0000-4000-8000-000000000001");
    expect(parseSfParams({ detail: "not-an-id" }).detail).toBeUndefined();
  });

  it("builds view links that keep only that view's parameters", () => {
    expect(viewHref("/sinking-fund", { q: "ana", type: "loan" }, "transactions")).toBe("/sinking-fund?q=ana&type=loan");
    expect(viewHref("/sinking-fund", { q: "ana", type: "loan" }, "top")).toBe("/sinking-fund?view=top");
    expect(viewHref("/sinking-fund", { view: "top", rank: "deposits", period: "month" }, "top")).toBe("/sinking-fund?view=top&rank=deposits&period=month");
    expect(viewHref("/sinking-fund", { detail: "00000000-0000-4000-8000-000000000001" }, "participants")).toBe("/sinking-fund?view=participants&detail=00000000-0000-4000-8000-000000000001");
  });
});
