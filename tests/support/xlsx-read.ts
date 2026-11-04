// Feature 014 (research R14): reads .xlsx files for tests. It unzips (stored or deflated entries, using the
// central directory so data-descriptor zips from LibreOffice work too) and turns each worksheet into plain
// data: values, formulas, resolved styles, merges, widths, heights, panes, links and print setup. Parsing uses
// regular expressions only, so no XML library is needed. No imports from the app, so it can run anywhere.

import { inflateRawSync } from "node:zlib";

export interface ResolvedStyle {
  fontName: string | null;
  size: number | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string | null;
  fill: string | null;
  top: string | null;
  bottom: string | null;
  horizontal: string | null;
  vertical: string | null;
  indent: number;
  wrap: boolean;
  numFmt: string;
}

export interface ReadCell { value: string | number | null; formula: string | null; style: ResolvedStyle }

export interface ReadSheet {
  name: string;
  tabColor: string | null;
  /** Width per 1-based column index. */
  widths: Map<number, number>;
  /** ht per 1-based row, with whether the file marks it as a custom height. */
  rowHeights: Map<number, { height: number; custom: boolean }>;
  merges: string[];
  freeze: { topLeftCell: string; xSplit: number; ySplit: number } | null;
  /** Cell ref to location (the part after "#"). */
  hyperlinks: Map<string, string>;
  margins: Record<string, string> | null;
  pageSetup: Record<string, string> | null;
  printOptions: Record<string, string> | null;
  fitToPage: boolean;
  /** The _xlnm.Print_Titles defined name scoped to this sheet, e.g. "DHDMM1!$1:$4". */
  printTitles: string | null;
  cells: Map<string, ReadCell>;
}

export interface ReadWorkbook { sheets: ReadSheet[]; partNames: string[]; calcFullOnLoad: boolean }

const decoder = new TextDecoder();

export function unzip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error("Not a zip file");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const parts = new Map<string, Uint8Array>();
  for (let index = 0; index < count; index++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error("Bad central directory");
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + compressed);
    if (method === 0) parts.set(name, raw);
    else if (method === 8) parts.set(name, new Uint8Array(inflateRawSync(raw)));
    else throw new Error(`Unsupported zip method ${method}`);
    at += 46 + nameLength + extraLength + commentLength;
  }
  return parts;
}

function decodeEntities(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function attrs(tag: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of (tag ?? "").matchAll(/([\w:]+)="([^"]*)"/g)) result[match[1]] = decodeEntities(match[2]);
  return result;
}

const truthy = (value: string | undefined) => value === "1" || value === "true";
const flag = (xml: string, tag: string) => {
  const match = new RegExp(`<${tag}(\\s[^>]*)?/?>`).exec(xml);
  return Boolean(match) && (attrs(match![1]).val === undefined || truthy(attrs(match![1]).val));
};
const colorOf = (xml: string) => {
  const match = /<color\s([^>]*?)\/?>/.exec(xml) ?? /<(?:fgColor)\s([^>]*?)\/?>/.exec(xml);
  if (!match) return null;
  const a = attrs(match[1]);
  if (a.rgb) return a.rgb.length === 8 ? a.rgb.slice(2).toUpperCase() : a.rgb.toUpperCase();
  if (a.theme) return `theme:${a.theme}`;
  if (a.indexed) return `indexed:${a.indexed}`;
  return null;
};

const builtinFormats: Record<number, string> = { 0: "General", 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 14: "m/d/yyyy" };

/** Makes equivalent number-format spellings from Excel and LibreOffice compare equal. */
export function normaliseNumFmt(code: string) {
  return code.replace(/\[RED\]/g, "[Red]").replace(/\\(.)/g, "$1").replace(/"([^"]*)"/g, "$1");
}

function readStyles(xml: string) {
  const formats = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt\s([^>]*?)\/>/g)) { const a = attrs(m[1]); formats.set(Number(a.numFmtId), a.formatCode); }
  const section = (name: string) => new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml)?.[1] ?? "";
  const fonts = [...section("fonts").matchAll(/<font(?:\s[^>]*)?>([\s\S]*?)<\/font>/g)].map((m) => ({
    name: attrs(/<name\s([^>]*?)\/?>/.exec(m[1])?.[1]).val ?? null,
    size: /<sz\s([^>]*?)\/?>/.test(m[1]) ? Number(attrs(/<sz\s([^>]*?)\/?>/.exec(m[1])?.[1]).val) : null,
    bold: flag(m[1], "b"),
    italic: flag(m[1], "i"),
    underline: /<u(\s[^>]*)?\/?>/.test(m[1]) && (attrs(/<u(\s[^>]*)?\/?>/.exec(m[1])?.[1]).val ?? "single") !== "none",
    color: colorOf(m[1]),
  }));
  const fills = [...section("fills").matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((m) => {
    const pattern = attrs(/<patternFill\s([^>]*?)\/?>/.exec(m[1])?.[1]).patternType;
    return pattern === "solid" ? colorOf(/<fgColor[^>]*\/?>/.exec(m[1])?.[0] ?? "") : null;
  });
  const borders = [...section("borders").matchAll(/<border(?:\s[^>]*)?>([\s\S]*?)<\/border>/g)].map((m) => {
    const side = (name: string) => {
      const match = new RegExp(`<${name}(?:\\s+([^>]*?))?(?:/>|>([\\s\\S]*?)</${name}>)`).exec(m[1]);
      const style = attrs(match?.[1]).style;
      return style ? `${style}:${colorOf(match?.[2] ?? "") ?? "auto"}` : null;
    };
    return { top: side("top"), bottom: side("bottom") };
  });
  const xfBlock = section("cellXfs");
  const xfs = [...xfBlock.matchAll(/<xf\s([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g)].map((m) => {
    const a = attrs(m[1]);
    const alignment = attrs(/<alignment\s([^>]*?)\/?>/.exec(m[2] ?? "")?.[1]);
    const font = fonts[Number(a.fontId ?? 0)] ?? fonts[0];
    const numFmtId = Number(a.numFmtId ?? 0);
    const horizontal = alignment.horizontal && alignment.horizontal !== "general" ? alignment.horizontal : null;
    const style: ResolvedStyle = {
      fontName: font?.name ?? null,
      size: font?.size ?? null,
      bold: font?.bold ?? false,
      italic: font?.italic ?? false,
      underline: font?.underline ?? false,
      color: font?.color ?? null,
      fill: fills[Number(a.fillId ?? 0)] ?? null,
      top: borders[Number(a.borderId ?? 0)]?.top ?? null,
      bottom: borders[Number(a.borderId ?? 0)]?.bottom ?? null,
      horizontal,
      vertical: alignment.vertical ?? null,
      indent: Number(alignment.indent ?? 0),
      wrap: truthy(alignment.wrapText),
      numFmt: normaliseNumFmt(formats.get(numFmtId) ?? builtinFormats[numFmtId] ?? "General"),
    };
    return style;
  });
  return xfs;
}

function readSharedStrings(xml: string | undefined) {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decodeEntities([...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
}

function columnIndex(ref: string) {
  let n = 0;
  for (const ch of /^[A-Z]+/.exec(ref)![0]) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

export function readWorkbook(bytes: Uint8Array): ReadWorkbook {
  const parts = unzip(bytes);
  const text = (name: string) => { const part = parts.get(name); return part ? decoder.decode(part) : undefined; };
  const workbook = text("xl/workbook.xml")!;
  const rels = new Map<string, string>();
  for (const m of text("xl/_rels/workbook.xml.rels")!.matchAll(/<Relationship\s([^>]*?)\/>/g)) { const a = attrs(m[1]); rels.set(a.Id, a.Target); }
  const styles = readStyles(text("xl/styles.xml")!);
  const shared = readSharedStrings(text("xl/sharedStrings.xml"));
  const definedNames = [...workbook.matchAll(/<definedName\s([^>]*?)>([^<]*)<\/definedName>/g)].map((m): Record<string, string> => ({ ...attrs(m[1]), value: decodeEntities(m[2]) }));

  const sheets: ReadSheet[] = [...workbook.matchAll(/<sheet\s([^>]*?)\/>/g)].map((m, index) => {
    const a = attrs(m[1]);
    const target = rels.get(a["r:id"])!;
    const xml = text(target.startsWith("/") ? target.slice(1) : `xl/${target}`)!;
    const widths = new Map<number, number>();
    for (const c of xml.matchAll(/<col\s([^>]*?)\/>/g)) { const ca = attrs(c[1]); for (let i = Number(ca.min); i <= Number(ca.max); i++) widths.set(i, Number(ca.width)); }
    const rowHeights = new Map<number, { height: number; custom: boolean }>();
    const cells = new Map<string, ReadCell>();
    for (const r of xml.matchAll(/<row\s([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const ra = attrs(r[1]);
      if (ra.ht) rowHeights.set(Number(ra.r), { height: Number(ra.ht), custom: truthy(ra.customHeight) });
      for (const c of (r[2] ?? "").matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ca = attrs(c[1]);
        const body = c[2] ?? "";
        const formula = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(body)?.[1];
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value: string | number | null = null;
        if (ca.t === "inlineStr") value = decodeEntities([...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
        else if (raw !== undefined) value = ca.t === "s" ? shared[Number(raw)] : ca.t === "str" || ca.t === "e" ? decodeEntities(raw) : Number(raw);
        cells.set(ca.r, { value, formula: formula === undefined ? null : decodeEntities(formula), style: styles[Number(ca.s ?? 0)] ?? styles[0] });
      }
    }
    const pane = /<pane\s([^>]*?)\/>/.exec(xml);
    const pa = attrs(pane?.[1]);
    const hyperlinks = new Map<string, string>();
    for (const h of xml.matchAll(/<hyperlink\s([^>]*?)\/>/g)) { const ha = attrs(h[1]); if (ha.location) hyperlinks.set(ha.ref, ha.location); }
    const tag = (name: string) => { const t = new RegExp(`<${name}\\s([^>]*?)\\/>`).exec(xml); return t ? attrs(t[1]) : null; };
    return {
      name: a.name,
      tabColor: attrs(/<tabColor\s([^>]*?)\/>/.exec(xml)?.[1]).rgb?.slice(-6).toUpperCase() ?? null,
      widths,
      rowHeights,
      merges: [...xml.matchAll(/<mergeCell\s([^>]*?)\/>/g)].map((x) => attrs(x[1]).ref),
      freeze: pane && pa.state === "frozen" ? { topLeftCell: pa.topLeftCell, xSplit: Number(pa.xSplit ?? 0), ySplit: Number(pa.ySplit ?? 0) } : null,
      hyperlinks,
      margins: tag("pageMargins"),
      pageSetup: tag("pageSetup"),
      printOptions: tag("printOptions"),
      fitToPage: truthy(attrs(/<pageSetUpPr\s([^>]*?)\/>/.exec(xml)?.[1]).fitToPage),
      printTitles: definedNames.find((d) => d.name === "_xlnm.Print_Titles" && Number(d.localSheetId) === index)?.value ?? null,
      cells,
    };
  });
  return { sheets, partNames: [...parts.keys()], calcFullOnLoad: truthy(attrs(/<calcPr\s([^>]*?)\/>/.exec(workbook)?.[1]).fullCalcOnLoad) };
}

export { columnIndex };
