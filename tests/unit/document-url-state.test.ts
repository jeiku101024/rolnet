import { describe, expect, it } from "vitest";
import { parseDocumentsParams, serializeDocumentsParams } from "@/lib/documents/url-state";

describe("documents page address (feature 013, FR-009a)", () => {
  it("round-trips search, filters, sort and the open document", () => {
    const query = "?sort=name&usearch=rolnet&utype=or_cr,insurance&ustatus=expired,due&dsearch=juan&dstatus=valid&doc=00000000-0000-4000-8000-000000000061";
    const state = parseDocumentsParams(new URLSearchParams(query));
    expect(state).toEqual({ sort: "name", usearch: "rolnet", utype: ["or_cr", "insurance"], ustatus: ["expired", "due"], dsearch: "juan", dstatus: ["valid"], doc: "00000000-0000-4000-8000-000000000061", upage: 1 });
    expect(serializeDocumentsParams(state)).toBe(query);
  });
  it("drops unknown values and leaves defaults out", () => {
    const state = parseDocumentsParams({ sort: "bogus", utype: "driver_license,or_cr,nope", ustatus: "late", doc: "not-a-uuid" });
    expect(state).toMatchObject({ sort: "expiry", utype: ["or_cr"], ustatus: [], doc: null });
    expect(serializeDocumentsParams(state)).toBe("?utype=or_cr");
  });
  it("keeps the folder page, dropping invalid ones", () => {
    expect(parseDocumentsParams({ upage: "3" }).upage).toBe(3);
    expect(parseDocumentsParams({ upage: "0" }).upage).toBe(1);
    expect(parseDocumentsParams({ upage: "x" }).upage).toBe(1);
    expect(serializeDocumentsParams({ ...parseDocumentsParams({}), upage: 2 })).toBe("?upage=2");
  });
  it("maps the old dashboard link to Expired and Due in both panes", () => {
    expect(parseDocumentsParams({ expiry: "due" })).toMatchObject({ ustatus: ["expired", "due"], dstatus: ["expired", "due"] });
  });
});
