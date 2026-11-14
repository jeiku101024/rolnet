// Feature 014 (research R1, R3, R11): a small, dependency-free .xlsx writer for the report workbooks. It
// turns sheet models into SpreadsheetML parts and zips them with lib/reports/zip.ts, one sheet at a time.
// It uses only Web APIs, so it runs in the Cloudflare Worker and in Vitest. The colours below are workbook
// data from the client's template, not UI tokens.

import { buildZip, zipEntry, type ZipEntry } from "@/lib/reports/zip";

/** The amount format: thousands separators, negatives in red with a minus sign, zero shown as "-". */
export const AMOUNT_FORMAT = '#,##0;[Red]-#,##0;"-"';
/** Two decimals, zero shown as 0.00 (feature 016: the Sinking fund workbook shows centavos). */
export const CENTS_FORMAT = "#,##0.00;[Red]-#,##0.00;0.00";
export const DATE_FORMAT = 'ddd", "mmm d';
export const MONTH_FORMAT = "mmmm";

interface Border { style: "thin" | "medium"; color: string }
interface StyleDef {
  size: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color: string;
  fill?: string;
  top?: Border;
  bottom?: Border;
  h?: "left" | "right";
  v?: "center" | "top";
  indent?: number;
  wrap?: boolean;
  numFmt?: string;
}

const white = "FFFFFF";
const black = "000000";
const navy = "1F3864";
const blue = "2F5496";
const lightBlue = "D9E2F3";
const grey = "595959";
const green = "007A33";
const linkBlue = "0563C1";
const thin: Border = { style: "thin", color: "BFBFBF" };
const medium: Border = { style: "medium", color: black };

const body = { size: 10, color: black };
const head = { size: 10, bold: true, color: white, fill: blue, v: "center" as const };
const sub = { ...body, bold: true, fill: lightBlue };
const grand = { ...body, bold: true, top: medium, bottom: medium };

/** Every named cell style in the workbook layout (contracts/workbook-layout.md). */
export const styleDefs = {
  title: { size: 16, bold: true, color: white, fill: navy, h: "left", v: "center", indent: 1 },
  subtitle: { size: 11, bold: true, color: navy, fill: lightBlue, h: "left", v: "center", indent: 1 },
  headFirst: { ...head, h: "left", indent: 1 },
  headText: { ...head, h: "left" },
  headAmount: { ...head, h: "right" },
  date: { ...body, bottom: thin, h: "left", indent: 1, numFmt: DATE_FORMAT },
  month: { ...body, bottom: thin, h: "left", indent: 1, numFmt: MONTH_FORMAT },
  text: { ...body, bottom: thin, h: "left" },
  amount: { ...body, bottom: thin, h: "right", numFmt: AMOUNT_FORMAT },
  subLabel: { ...sub, h: "left", indent: 1 },
  subAmount: { ...sub, h: "right", numFmt: AMOUNT_FORMAT },
  lineLabelItalic: { ...body, italic: true, h: "left", indent: 2 },
  lineAmountItalic: { ...body, italic: true, h: "right", numFmt: AMOUNT_FORMAT },
  lineLabelBold: { ...body, bold: true, h: "left", indent: 2 },
  lineAmountBold: { ...body, bold: true, h: "right", numFmt: AMOUNT_FORMAT },
  grandLabel: { ...grand, h: "left", indent: 1 },
  grandAmount: { ...grand, h: "right", numFmt: AMOUNT_FORMAT },
  grandLineLabelItalic: { ...body, bold: true, italic: true, h: "left", indent: 2 },
  grandLineAmountItalic: { ...body, bold: true, italic: true, h: "right", numFmt: AMOUNT_FORMAT },
  amountCents: { ...body, bottom: thin, h: "right", numFmt: CENTS_FORMAT },
  subAmountCents: { ...sub, h: "right", numFmt: CENTS_FORMAT },
  grandAmountCents: { ...grand, h: "right", numFmt: CENTS_FORMAT },
  link: { ...body, color: linkBlue, underline: true, bottom: thin, h: "left", indent: 1 },
  linkAmount: { ...body, color: green, bottom: thin, h: "right", numFmt: AMOUNT_FORMAT },
  notesHead: { ...body, bold: true },
  note: { ...body, italic: true, color: grey, wrap: true, v: "top" },
} satisfies Record<string, StyleDef>;

export type StyleName = keyof typeof styleDefs;

export interface Cell {
  /** A number (pesos, or an Excel date serial), text, or null for an empty styled cell. */
  v: number | string | null;
  /** Without the leading "=". `v` is the cached result. */
  f?: string;
  s: StyleName;
}

export interface Row {
  /** Row height in points. Omit for the default. */
  h?: number;
  /** One entry per column from A; holes are skipped. */
  cells: (Cell | undefined)[];
}

export interface SheetModel {
  name: string;
  /** ARGB without the alpha, e.g. "1F3864". */
  tabColor: string;
  columns: number[];
  rows: Row[];
  merges: string[];
  /** Internal links: the cell and the sheet it jumps to (cell A1). */
  hyperlinks: { ref: string; sheet: string }[];
  /** Repeat rows 1:4 on every printed page. */
  printTitles: boolean;
}

export const xlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const columnNames: string[] = [];
/** "A" for 0, "B" for 1, … */
export function columnName(index: number) {
  if (!columnNames[index]) {
    let name = "";
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    columnNames[index] = name;
  }
  return columnNames[index];
}

export function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Hands out style indexes on first use and writes styles.xml once every sheet has been serialised. */
export class StyleRegistry {
  private fonts: string[] = [];
  private fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  private borders = ["<border><left/><right/><top/><bottom/><diagonal/></border>"];
  private formats = new Map<string, number>();
  private xfs: string[] = [];
  private byName = new Map<StyleName, number>();
  private pool = new Map<string, number>();

  constructor() {
    this.fonts.push(this.fontXml({ size: 10, color: black }));
    this.xfs.push('<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>');
  }

  private fontXml(def: StyleDef) {
    return `<font>${def.bold ? "<b/>" : ""}${def.italic ? "<i/>" : ""}${def.underline ? "<u/>" : ""}<sz val="${def.size}"/><color rgb="FF${def.color}"/><name val="Arial"/><family val="2"/></font>`;
  }

  private intern(list: string[], xml: string) {
    const found = list.indexOf(xml);
    if (found >= 0) return found;
    list.push(xml);
    return list.length - 1;
  }

  private borderXml(def: StyleDef) {
    const side = (name: string, border?: Border) => (border ? `<${name} style="${border.style}"><color rgb="FF${border.color}"/></${name}>` : `<${name}/>`);
    return `<border><left/><right/>${side("top", def.top)}${side("bottom", def.bottom)}<diagonal/></border>`;
  }

  index(name: StyleName): number {
    const known = this.byName.get(name);
    if (known !== undefined) return known;
    const def: StyleDef = styleDefs[name];
    const fontId = this.intern(this.fonts, this.fontXml(def));
    const fillId = def.fill ? this.intern(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${def.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const borderId = def.top || def.bottom ? this.intern(this.borders, this.borderXml(def)) : 0;
    let numFmtId = 0;
    if (def.numFmt) {
      if (!this.formats.has(def.numFmt)) this.formats.set(def.numFmt, 164 + this.formats.size);
      numFmtId = this.formats.get(def.numFmt)!;
    }
    const alignment = def.h || def.v || def.indent || def.wrap
      ? `<alignment${def.h ? ` horizontal="${def.h}"` : ""}${def.v ? ` vertical="${def.v}"` : ""}${def.indent ? ` indent="${def.indent}"` : ""}${def.wrap ? ' wrapText="1"' : ""}/>`
      : "";
    const xf = `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${alignment ? ` applyAlignment="1">${alignment}</xf>` : "/>"}`;
    const pooled = this.pool.get(xf);
    const id = pooled ?? this.xfs.push(xf) - 1;
    this.pool.set(xf, id);
    this.byName.set(name, id);
    return id;
  }

  xml() {
    const numFmts = [...this.formats].map(([code, id]) => `<numFmt numFmtId="${id}" formatCode="${escapeXml(code)}"/>`);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.join("")}</numFmts>` : ""}<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts><fills count="${this.fills.length}">${this.fills.join("")}</fills><borders count="${this.borders.length}">${this.borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}

function cellXml(cell: Cell, ref: string, styles: StyleRegistry) {
  const s = styles.index(cell.s);
  if (cell.f !== undefined) return `<c r="${ref}" s="${s}"><f>${escapeXml(cell.f)}</f>${cell.v === null ? "" : `<v>${escapeXml(String(cell.v))}</v>`}</c>`;
  if (cell.v === null) return `<c r="${ref}" s="${s}"/>`;
  if (typeof cell.v === "number") return `<c r="${ref}" s="${s}"><v>${cell.v}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.v)}</t></is></c>`;
}

/** One worksheet part. Child elements follow the SpreadsheetML schema order. */
export function sheetXml(sheet: SheetModel, styles: StyleRegistry, selected = false) {
  const out: string[] = [];
  const lastColumn = Math.max(sheet.columns.length, ...sheet.rows.map((row) => row.cells.length)) - 1;
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');
  out.push(`<sheetPr><tabColor rgb="FF${sheet.tabColor}"/><pageSetUpPr fitToPage="1"/></sheetPr>`);
  out.push(`<dimension ref="A1:${columnName(lastColumn)}${sheet.rows.length}"/>`);
  out.push(`<sheetViews><sheetView${selected ? ' tabSelected="1"' : ""} workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/></sheetView></sheetViews>`);
  out.push('<sheetFormatPr defaultRowHeight="15"/>');
  out.push(`<cols>${sheet.columns.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>`);
  out.push("<sheetData>");
  sheet.rows.forEach((row, r) => {
    const number = r + 1;
    out.push(`<row r="${number}"${row.h ? ` ht="${row.h}" customHeight="1"` : ""}>`);
    row.cells.forEach((cell, c) => { if (cell) out.push(cellXml(cell, `${columnName(c)}${number}`, styles)); });
    out.push("</row>");
  });
  out.push("</sheetData>");
  if (sheet.merges.length) out.push(`<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`);
  if (sheet.hyperlinks.length) out.push(`<hyperlinks>${sheet.hyperlinks.map((link) => `<hyperlink ref="${link.ref}" location="${escapeXml(sheetRef(link.sheet))}!A1" display="${escapeXml(link.sheet)}"/>`).join("")}</hyperlinks>`);
  out.push('<printOptions horizontalCentered="1"/>');
  out.push('<pageMargins left="0.25" right="0.25" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>');
  out.push('<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/>');
  out.push("</worksheet>");
  return out.join("");
}

/** A sheet name as used in formulas and links: quoted, with apostrophes doubled. */
export function sheetRef(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

const xmlHead = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/**
 * The .xlsx bytes for a workbook. Sheets are serialised and compressed one at a time, so the XML of the
 * whole workbook is never held at once (research R3). The first sheet is the one Excel opens on.
 */
export async function workbookBytes(sheets: Iterable<SheetModel> | AsyncIterable<SheetModel>, title = "ROLNET report"): Promise<Uint8Array> {
  const styles = new StyleRegistry();
  const sheetEntries: ZipEntry[] = [];
  const names: { name: string; printTitles: boolean }[] = [];
  for await (const sheet of sheets) {
    sheetEntries.push(await zipEntry(`xl/worksheets/sheet${names.length + 1}.xml`, sheetXml(sheet, styles, names.length === 0)));
    names.push({ name: sheet.name, printTitles: sheet.printTitles });
  }
  const sheetTags = names.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const definedNames = names.flatMap((sheet, index) => (sheet.printTitles ? [`<definedName name="_xlnm.Print_Titles" localSheetId="${index}">${escapeXml(sheetRef(sheet.name))}!$1:$4</definedName>`] : []));
  const sheetOverrides = names.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const sheetRels = names.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const entries = await Promise.all([
    zipEntry("[Content_Types].xml", `${xmlHead}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    zipEntry("_rels/.rels", `${xmlHead}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    zipEntry("docProps/app.xml", `${xmlHead}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>ROLNET</Application></Properties>`),
    zipEntry("docProps/core.xml", `${xmlHead}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(title)}</dc:title><dc:creator>ROLNET</dc:creator></cp:coreProperties>`),
    zipEntry("xl/workbook.xml", `${xmlHead}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheetTags}</sheets>${definedNames.length ? `<definedNames>${definedNames.join("")}</definedNames>` : ""}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`),
    zipEntry("xl/_rels/workbook.xml.rels", `${xmlHead}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    zipEntry("xl/styles.xml", styles.xml()),
  ]);
  return buildZip([...entries, ...sheetEntries]);
}
