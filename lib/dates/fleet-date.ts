export function fleetTimeZone() {
  return process.env.NEXT_PUBLIC_FLEET_TIMEZONE || "Asia/Manila";
}

export function fleetToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fleetTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function monthStart(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must use YYYY-MM format");
  return `${month}-01`;
}

/** Adds whole days to a YYYY-MM-DD calendar date (no time zone involved). */
export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** True when a YYYY-MM-DD date is after `today` (both are plain calendar dates). */
export function isAfterToday(date: string, today: string) {
  return date > today;
}

/** "Friday, October 30, 2026" for a YYYY-MM-DD calendar date (feature 008, FR-005). */
export function formatLongDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** "Oct 28" for a YYYY-MM-DD calendar date (feature 008, FR-025). */
export function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** The fleet time zone's UTC offset at an instant, as "+08:00". */
function fleetOffset(instant: Date) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: fleetTimeZone(), timeZoneName: "longOffset" }).formatToParts(instant).find((item) => item.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-]\d{2}):?(\d{2})?/.exec(part);
  return match ? `${match[1]}:${match[2] ?? "00"}` : "+00:00";
}

/**
 * When a payment entered from a Daily view card was received (feature 008, FR-020a): now on
 * today's card, otherwise noon of the card's date in the fleet time zone, so monthly totals that
 * bucket by payment date count it on that date.
 */
export function paymentTimestampFor(date: string, now = new Date()) {
  if (date === fleetToday(now)) return now.toISOString();
  return `${date}T12:00:00${fleetOffset(new Date(`${date}T12:00:00Z`))}`;
}
