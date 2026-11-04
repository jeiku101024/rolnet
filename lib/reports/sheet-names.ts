// Feature 014 (research R7, R8): tab order, sheet names, and file-name parts for the report workbooks.

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Natural order by name ("rolnet-2" before "rolnet-10"), ties by id (research R8). */
export function sortUnits<T extends { id: string; name: string }>(units: T[]): T[] {
  return [...units].sort((a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const maxLength = 31;

function clean(name: string) {
  const cleaned = name.replace(/[:\\/?*[\]]/g, "-").replace(/^['\s]+|['\s]+$/g, "");
  return cleaned || "Unit";
}

/** Cuts the base so the suffix still fits inside Excel's 31 characters. */
function withSuffix(base: string, suffix: string) {
  return base.slice(0, maxLength - suffix.length).replace(/['\s]+$/g, "") + suffix;
}

/**
 * Excel sheet names for the units, in the order given (spec FR-012). Forbidden characters become "-",
 * apostrophes and spaces at the ends are trimmed, names are cut to 31 characters, "All units" is taken by
 * the summary sheet, and duplicates (compared ignoring letter case, as Excel does) get " (2)", " (3)"…
 */
export function sheetNames(names: string[]): string[] {
  const used = new Set<string>(["all units"]);
  return names.map((original) => {
    let name = clean(original).slice(0, maxLength).replace(/['\s]+$/g, "") || "Unit";
    if (name.toLowerCase() === "all units") name = withSuffix(name, " (unit)");
    let candidate = name;
    for (let copy = 2; used.has(candidate.toLowerCase()); copy++) candidate = withSuffix(name, ` (${copy})`);
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

/** The unit part of a file name: forbidden characters removed, spaces become "-" (spec FR-006). */
export function fileNamePart(name: string) {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return cleaned || "unit";
}
