import { formatPesos } from "@/lib/money/centavos";

/** "Nov 3, 2026" for a YYYY-MM-DD calendar date (spec section 18: dates in lists). */
export function formatListDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** "Dec 3" for a YYYY-MM-DD calendar date. */
export function formatDayMonth(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** "Nov 2026" for a YYYY-MM-DD calendar date, used for chart axes. */
export function formatMonth(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "2-digit" }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** A centavo amount as the text a person would type into an amount box: 2000, 150.5, 99.99. */
export function pesoText(centavos: number) {
  if (centavos % 100 === 0) return String(centavos / 100);
  return (centavos / 100).toFixed(2).replace(/0$/, "");
}

/** "+₱500.00", "-₱2,000.00" for the Amount column. */
export function signedPesos(centavos: number, sign: "+" | "-") {
  return `${sign}${formatPesos(centavos)}`;
}
