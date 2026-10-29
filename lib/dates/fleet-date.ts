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
