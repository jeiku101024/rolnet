import { describe, expect, it } from "vitest";
import { buildUnitFolders, filterAndSortFolders, filterLicenses, licensePaneCount, unitPaneCount } from "@/lib/documents/tree";
import { buildDocumentsPage, type PageDocument } from "@/lib/documents/page-query";
import { highlightParts, matchDocument } from "@/lib/documents/search";
import { documentStatus } from "@/lib/documents/status";

const today = "2026-11-02";
const units = [
  { id: "u1", name: "ROLNET-1", bodyNumber: "T-001" },
  { id: "u2", name: "ROLNET-2", bodyNumber: "T-002" },
  { id: "u3", name: "Bravo", bodyNumber: "T-003" },
  { id: "u4", name: "ROLNET-10", bodyNumber: "T-010" },
];
let n = 0;
function doc(unitId: string | null, documentType: string, expiresOn: string, extra: Partial<PageDocument> = {}): PageDocument {
  n += 1;
  const holderName = units.find((unit) => unit.id === unitId)?.name ?? "Juan Dela Cruz";
  return { id: `d${n}`, documentType, unitId, driverId: unitId ? null : "drv1", holderName, documentNumber: `NO-${n}`, issuedOn: null, expiresOn, fileName: `file-${n}.pdf`, mimeType: "application/pdf", status: documentStatus(expiresOn, today), ...extra };
}
const docs = [
  doc("u1", "or_cr", "2026-10-30"),
  doc("u1", "insurance", "2026-11-05"),
  doc("u1", "mtop_franchise", "2027-05-01"),
  doc("u2", "or_cr", "2026-11-20", { documentNumber: null }),
  doc("u3", "insurance", "2026-12-15"),
];
const folders = buildUnitFolders(units, docs);
const view = (query = "", extra: Partial<Parameters<typeof filterAndSortFolders>[0]> = {}) => filterAndSortFolders({ folders, query, types: [], statuses: [], sort: "expiry", ...extra });

describe("unit folder tree (feature 013, US1)", () => {
  it("has one folder per unit, empty ones included, with expired and due counts", () => {
    expect(folders.map((folder) => [folder.unitName, folder.count, folder.expiredCount, folder.dueCount])).toEqual([
      ["ROLNET-1", 3, 1, 1], ["ROLNET-2", 1, 0, 0], ["Bravo", 1, 0, 0], ["ROLNET-10", 0, 0, 0],
    ]);
    expect(unitPaneCount(folders)).toBe("5 documents · 4 units");
    expect(unitPaneCount(buildUnitFolders([units[0]], [docs[0]]))).toBe("1 document · 1 unit");
  });
  it("leaves archived units out because the page data only has active units", () => {
    const page = buildDocumentsPage({ today, now: new Date("2026-11-02T02:00:00Z"), current: [{ id: "x", document_type: "or_cr", unit_id: "archived", driver_id: null, document_number: null, issued_on: null, expires_on: "2027-01-01", mime_type: "application/pdf", file_name: null, created_at: "2026-10-01T00:00:00Z" }], units, drivers: [], reverted: [], names: {}, purgeOverdue: false });
    expect(page.unitDocs).toEqual([]);
  });
});

describe("search, filters and sort (feature 013, US4)", () => {
  it("shows a folder whose name matches with all its documents, expanded, and counts results", () => {
    const result = view("bra");
    expect(result.folders.map((folder) => [folder.unitName, folder.shown.length, folder.nameMatch])).toEqual([["Bravo", 1, true]]);
    expect(result.summary).toBe("1 result in 1 folder");
    expect(result.searching).toBe(true);
  });
  it("shows only matching documents when the folder name doesn't match", () => {
    const result = view("2026-11");
    expect(result.folders.map((folder) => [folder.unitName, folder.shown.map((d) => d.expiresOn)])).toEqual([["ROLNET-1", ["2026-11-05"]], ["ROLNET-2", ["2026-11-20"]]]);
    expect(result.summary).toBe("2 results in 2 folders");
  });
  it("matches status text, type labels and file names", () => {
    expect(view("expired").results).toBe(1);
    expect(view("mtop").results).toBe(1);
    expect(view("file-4").folders.map((folder) => folder.unitName)).toEqual(["ROLNET-2"]);
    expect(view("zzz").summary).toBe("No documents match.");
  });
  it("shows an empty folder during a search only when its name matches", () => {
    expect(view("rolnet-10").folders.map((folder) => [folder.unitName, folder.shown.length])).toEqual([["ROLNET-10", 0]]);
    expect(view("").folders.some((folder) => folder.unitName === "ROLNET-10")).toBe(true);
  });
  it("hides folders with nothing passing the filters, empty ones included, and combines OR within and AND across filters", () => {
    const result = view("", { statuses: ["expired", "due"] });
    expect(result.folders.map((folder) => [folder.unitName, folder.shown.length])).toEqual([["ROLNET-1", 2]]);
    expect(result.summary).toBe("2 results in 1 folder");
    expect(view("", { statuses: ["expired", "due"], types: ["insurance"] }).results).toBe(1);
    expect(view("rolnet-10", { types: ["or_cr"] }).folders).toEqual([]);
  });
  it("combines search with filters", () => {
    expect(view("rolnet", { types: ["or_cr"] }).results).toBe(2);
  });
  it("orders folders by their earliest or latest visible expiry, with empty folders last", () => {
    expect(view().folders.map((folder) => folder.unitName)).toEqual(["ROLNET-1", "ROLNET-2", "Bravo", "ROLNET-10"]);
    expect(view("", { sort: "expiry-desc" }).folders.map((folder) => folder.unitName)).toEqual(["ROLNET-1", "Bravo", "ROLNET-2", "ROLNET-10"]);
    expect(view("", { sort: "expiry-desc" }).folders[0].shown.map((d) => d.expiresOn)).toEqual(["2027-05-01", "2026-11-05", "2026-10-30"]);
  });
  it("orders folders A to Z by unit name for the name and type sorts", () => {
    expect(view("", { sort: "name" }).folders.map((folder) => folder.unitName)).toEqual(["Bravo", "ROLNET-1", "ROLNET-2", "ROLNET-10"]);
    expect(view("", { sort: "type" }).folders[1].shown.map((d) => d.documentType)).toEqual(["insurance", "mtop_franchise", "or_cr"]);
  });
  it("searches and filters the driver list on its own", () => {
    const licenses = [doc(null, "driver_license", "2026-10-01", { holderName: "Juan Dela Cruz" }), doc(null, "driver_license", "2027-01-01", { holderName: "Ana Bautista", driverId: "drv2" })];
    expect(filterLicenses(licenses, "", [], "name").rows.map((row) => row.holderName)).toEqual(["Ana Bautista", "Juan Dela Cruz"]);
    expect(filterLicenses(licenses, "expired", [], "expiry")).toMatchObject({ summary: "1 result" });
    expect(filterLicenses(licenses, "", ["valid"], "expiry").rows.map((row) => row.holderName)).toEqual(["Ana Bautista"]);
    expect(filterLicenses(licenses, "nobody", [], "expiry")).toEqual({ rows: [], summary: null });
    expect(licensePaneCount(licenses)).toBe("2 licenses · 2 drivers");
  });
  it("splits text for highlighting every match", () => {
    expect(highlightParts("ROLNET-1 rolnet", "rol")).toEqual([{ text: "ROL", match: true }, { text: "NET-1 ", match: false }, { text: "rol", match: true }, { text: "net", match: false }]);
    expect(matchDocument(docs[3], "no number")).toBe(false);
  });
  it("filters 100 units and 400 documents fast enough for live search (SC-005)", () => {
    const bigUnits = Array.from({ length: 100 }, (_, index) => ({ id: `bu${index}`, name: `ROLNET-${index + 1}`, bodyNumber: `T-${index}` }));
    const bigDocs = Array.from({ length: 400 }, (_, index) => ({ ...docs[index % docs.length], id: `bd${index}`, unitId: `bu${index % 100}`, holderName: `ROLNET-${(index % 100) + 1}` }));
    const bigFolders = buildUnitFolders(bigUnits, bigDocs);
    const times: number[] = [];
    for (let run = 0; run < 50; run += 1) {
      const started = performance.now();
      filterAndSortFolders({ folders: bigFolders, query: ["rol", "2026-11", "expired", "net-5", ""][run % 5], types: run % 2 ? ["or_cr"] : [], statuses: [], sort: "expiry" });
      times.push(performance.now() - started);
    }
    times.sort((a, b) => a - b);
    expect(times[25]).toBeLessThan(16);
  });
});
