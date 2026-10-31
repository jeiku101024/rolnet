// Feature 009 (research R4, R5): a small .xlsx writer. It turns one sheet model into SpreadsheetML
// parts zipped with the STORE method, using only Web APIs so it runs in the Worker and in Vitest.
// The colours below are workbook data from the client's template, not UI tokens.

export type StyleKey = "header" | "body" | "bodyGreen" | "subtotal" | "italicLine" | "netLine" | "grandTop" | "grandBottom" | "grandLine" | "grandItalic";
/** `whole` and `decimal` for Weekly and Monthly; the `year` formats show zero as "-". */
export type NumberFormat = "general" | "whole" | "decimal" | "yearWhole" | "yearDecimal";

export interface Cell {
  value: number | string | null;
  /** Without the leading "=". `value` is the cached result. */
  formula?: string;
  style: StyleKey;
  format?: NumberFormat;
}

export interface Sheet {
  name: string;
  /** Column widths in characters. Row 1 is the header and is frozen. */
  columns: number[];
  rows: Cell[][];
}

const colours = { headerFill: "1F3864", subtotalFill: "D9E1F2", white: "FFFFFF", green: "00B050", black: "000000", grid: "BFBFBF" };

const formats: Record<NumberFormat, { id: number; code?: string }> = {
  general: { id: 0 },
  whole: { id: 164, code: "#,##0;[Red]-#,##0" },
  decimal: { id: 165, code: "#,##0.00;[Red]-#,##0.00" },
  yearWhole: { id: 166, code: '#,##0;[Red]-#,##0;"-"' },
  yearDecimal: { id: 167, code: '#,##0.00;[Red]-#,##0.00;"-"' },
};
const formatKeys = Object.keys(formats) as NumberFormat[];

// Fonts: 0 regular, 1 bold, 2 bold white, 3 green, 4 italic, 5 bold italic.
// Fills: 0 none, 1 gray125 (required by Excel), 2 dark blue, 3 light blue.
// Borders: 0 none, 1 thin grid, 2 thick black top, 3 thick black bottom.
const styles: Record<StyleKey, { font: number; fill: number; border: number; center?: boolean }> = {
  header: { font: 2, fill: 2, border: 1, center: true },
  body: { font: 0, fill: 0, border: 1 },
  bodyGreen: { font: 3, fill: 0, border: 1 },
  subtotal: { font: 1, fill: 3, border: 1 },
  italicLine: { font: 4, fill: 0, border: 0 },
  netLine: { font: 1, fill: 0, border: 0 },
  grandTop: { font: 1, fill: 0, border: 2 },
  grandBottom: { font: 1, fill: 0, border: 3 },
  grandLine: { font: 1, fill: 0, border: 0 },
  grandItalic: { font: 5, fill: 0, border: 0 },
};
const styleKeys = Object.keys(styles) as StyleKey[];

/** The cellXfs index for a style and number format (index 0 is Excel's default). */
export function styleIndex(style: StyleKey, format: NumberFormat = "general") {
  return 1 + styleKeys.indexOf(style) * formatKeys.length + formatKeys.indexOf(format);
}

export function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** "A" for 0, "B" for 1, … */
export function columnName(index: number) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** The text a cell shows, to size its column (FR-038). */
export function displayText(cell: Cell) {
  if (cell.value === null) return "";
  if (typeof cell.value === "string") return cell.value;
  const decimals = cell.format === "decimal" || cell.format === "yearDecimal" ? 2 : 0;
  if (cell.value === 0 && (cell.format === "yearWhole" || cell.format === "yearDecimal")) return "-";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(cell.value);
}

/** Each column at least its minimum, and its longest text plus 2. */
export function fitColumns(rows: Cell[][], minimums: number[]) {
  return minimums.map((minimum, index) => Math.max(minimum, ...rows.map((row) => (row[index] ? displayText(row[index]).length + 2 : 0))));
}

function stylesXml() {
  const numFmts = formatKeys.filter((key) => formats[key].code).map((key) => `<numFmt numFmtId="${formats[key].id}" formatCode="${escapeXml(formats[key].code!)}"/>`);
  const font = (extra = "") => `<font>${extra}<sz val="11"/><name val="Calibri"/><family val="2"/></font>`;
  const fonts = [font(), font("<b/>"), font(`<b/><color rgb="FF${colours.white}"/>`), font(`<color rgb="FF${colours.green}"/>`), font("<i/>"), font("<b/><i/>")];
  const solid = (rgb: string) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', solid(colours.headerFill), solid(colours.subtotalFill)];
  const side = (name: string, style?: string, rgb?: string) => (style ? `<${name} style="${style}"><color rgb="FF${rgb}"/></${name}>` : `<${name}/>`);
  const thin = (name: string) => side(name, "thin", colours.grid);
  const borders = [
    "<border><left/><right/><top/><bottom/><diagonal/></border>",
    `<border>${thin("left")}${thin("right")}${thin("top")}${thin("bottom")}<diagonal/></border>`,
    `<border><left/><right/>${side("top", "thick", colours.black)}<bottom/><diagonal/></border>`,
    `<border><left/><right/><top/>${side("bottom", "thick", colours.black)}<diagonal/></border>`,
  ];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  for (const key of styleKeys) {
    const style = styles[key];
    for (const format of formatKeys) {
      const align = style.center ? '<alignment horizontal="center" vertical="center"/>' : "";
      xfs.push(`<xf numFmtId="${formats[format].id}" fontId="${style.font}" fillId="${style.fill}" borderId="${style.border}" xfId="0"${format !== "general" ? ' applyNumberFormat="1"' : ""} applyFont="1" applyFill="1" applyBorder="1"${align ? ' applyAlignment="1">' + align + "</xf>" : "/>"}`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="${numFmts.length}">${numFmts.join("")}</numFmts><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function cellXml(cell: Cell, ref: string) {
  const s = styleIndex(cell.style, cell.format);
  if (cell.formula) return `<c r="${ref}" s="${s}"><f>${escapeXml(cell.formula)}</f>${cell.value === null ? "" : `<v>${escapeXml(String(cell.value))}</v>`}</c>`;
  if (cell.value === null) return `<c r="${ref}" s="${s}"/>`;
  if (typeof cell.value === "number") return `<c r="${ref}" s="${s}"><v>${cell.value}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
}

function sheetXml(sheet: Sheet) {
  const cols = sheet.columns.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const rows = sheet.rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => cellXml(cell, `${columnName(c)}${r + 1}`)).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`;
}

/** Excel sheet names: at most 31 characters, none of []:*?/\ (contracts/reports-http.md). */
export function safeSheetName(name: string) {
  return name.replace(/[[\]:*?/\\]/g, "").slice(0, 31).trim() || "Sheet1";
}

function parts(sheet: Sheet): [string, string][] {
  const xmlHead = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  return [
    ["[Content_Types].xml", `${xmlHead}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`],
    ["_rels/.rels", `${xmlHead}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`],
    ["docProps/app.xml", `${xmlHead}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>ROLNET</Application></Properties>`],
    ["docProps/core.xml", `${xmlHead}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(sheet.name)}</dc:title><dc:creator>ROLNET</dc:creator></cp:coreProperties>`],
    ["xl/workbook.xml", `${xmlHead}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(safeSheetName(sheet.name))}" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
    ["xl/_rels/workbook.xml.rels", `${xmlHead}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", stylesXml()],
    ["xl/worksheets/sheet1.xml", sheetXml(sheet)],
  ];
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A zip of stored (uncompressed) entries. Times are fixed at 1980-01-01 so output is repeatable. */
export function storeZip(files: [string, Uint8Array][]) {
  const encoder = new TextEncoder();
  const dosDate = (0 << 9) | (1 << 5) | 1;
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, dosDate, true); lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true); cv.setUint16(14, dosDate, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local, data);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, at); at += part.length; }
  return out;
}

/** The .xlsx bytes for one sheet. */
export function workbookBytes(sheet: Sheet) {
  const encoder = new TextEncoder();
  return storeZip(parts(sheet).map(([name, xml]) => [name, encoder.encode(xml)]));
}

export const xlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
