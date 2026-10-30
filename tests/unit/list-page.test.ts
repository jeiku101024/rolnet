import { describe, expect, it } from "vitest";
import { fetchListPage, finishListPage, listHref, pageRows, parseListPage, rangeLabel } from "@/lib/pagination/list-page";

describe("list paging (feature 006)", () => {
  it("treats anything but a whole number of at least 1 as page 1", () => {
    for (const page of ["0", "-2", "abc", "2.5", "", undefined]) expect(parseListPage({ page }).page).toBe(1);
    expect(parseListPage({ page: "3" })).toMatchObject({ page: 3, from: 20, to: 29 });
    expect(parseListPage({ page: ["4", "5"] }).page).toBe(4);
  });

  it("reads prefixed params and trims and cuts the search text", () => {
    expect(parseListPage({ assignments_page: "2", assignments_q: "  juan " }, "assignments_")).toMatchObject({ page: 2, q: "juan" });
    expect(parseListPage({ q: "   " }).q).toBe("");
    expect(parseListPage({ q: "x".repeat(150) }).q).toHaveLength(100);
  });

  it("labels ranges in plain language", () => {
    expect(rangeLabel(0, 1)).toBe("0 records");
    expect(rangeLabel(1, 1)).toBe("1–1 of 1 record");
    expect(rangeLabel(10, 1)).toBe("1–10 of 10 records");
    expect(rangeLabel(11, 2)).toBe("11–11 of 11 records");
    expect(rangeLabel(87, 2)).toBe("11–20 of 87 records");
  });

  it("clamps a page past the end to the last page", () => {
    expect(finishListPage(87, 999)).toMatchObject({ page: 9, lastPage: 9 });
    expect(finishListPage(0, 3)).toMatchObject({ page: 1, lastPage: 1, rangeLabel: "0 records" });
  });

  it("keeps other params, drops page 1, and restarts paging when the search changes", () => {
    const params = { page: "3", q: "old", documents_page: "2", tab: "x" };
    expect(listHref("/units/1", params, { page: 4 })).toBe("/units/1?page=4&q=old&documents_page=2&tab=x");
    expect(listHref("/units/1", params, { page: 1 })).toBe("/units/1?q=old&documents_page=2&tab=x");
    expect(listHref("/units/1", params, { q: "new" })).toBe("/units/1?q=new&documents_page=2&tab=x");
    expect(listHref("/units/1", params, { documents_q: "or" })).toBe("/units/1?page=3&q=old&tab=x&documents_q=or");
    expect(listHref("/drivers", {}, { q: "" })).toBe("/drivers");
  });

  it("pages and searches rows in memory", () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ name: `Driver ${index + 1}` }));
    const page3 = pageRows(rows, parseListPage({ page: "3" }), (row) => row.name);
    expect(page3.rows.map((row) => row.name)).toEqual(["Driver 21", "Driver 22", "Driver 23", "Driver 24", "Driver 25"]);
    expect(page3.rangeLabel).toBe("21–25 of 25 records");
    const found = pageRows(rows, parseListPage({ q: "driver 2", page: "2" }), (row) => row.name);
    expect(found.total).toBe(7);
    expect(found.page).toBe(1);
  });

  it("re-reads the last page when the requested page no longer exists", async () => {
    const calls: number[] = [];
    const result = await fetchListPage(parseListPage({ page: "5" }), async (from) => { calls.push(from); return { data: from === 10 ? [{ id: "x" }] : [], count: 11 }; });
    expect(calls).toEqual([40, 10]);
    expect(result).toMatchObject({ page: 2, lastPage: 2, rows: [{ id: "x" }] });
  });
});
