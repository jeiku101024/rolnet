import { addDays } from "@/lib/dates/fleet-date";

/**
 * Quick date choices for a list's date range (feature 006, User Story 8). Each one is a from/to
 * pair of fleet dates ending today, so choosing one only writes `from` and `to` to the URL.
 */
export interface DatePreset { value: string; label: string; from: string; to: string }

/** Monday of the week that contains an ISO date. */
function weekStart(isoDate: string) {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return addDays(isoDate, -((day + 6) % 7));
}

export function datePresets(today: string): DatePreset[] {
  const yesterday = addDays(today, -1);
  return [
    { value: "today", label: "Today", from: today, to: today },
    { value: "yesterday", label: "Yesterday", from: yesterday, to: yesterday },
    { value: "week", label: "This week", from: weekStart(today), to: today },
    { value: "month", label: "This month", from: `${today.slice(0, 8)}01`, to: today },
  ];
}

/** The preset a from/to pair matches, if any. */
export function matchingPreset(from: string | undefined, to: string | undefined, today: string) {
  return datePresets(today).find((preset) => preset.from === from && preset.to === to);
}

const shortDate = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const shortDateYear = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Oct 30", or "Oct 30, 2025" outside the current year. */
export function formatShortDate(isoDate: string, today: string) {
  return (isoDate.slice(0, 4) === today.slice(0, 4) ? shortDate : shortDateYear).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Words for the current range: "Any date", "This month", "Oct 1 – Oct 15", "From Oct 1", "Until Oct 15". */
export function rangeText(from: string | undefined, to: string | undefined, today: string) {
  if (!from && !to) return "Any date";
  const preset = matchingPreset(from, to, today);
  if (preset) return preset.label;
  if (from && to) return from === to ? formatShortDate(from, today) : `${formatShortDate(from, today)} – ${formatShortDate(to, today)}`;
  return from ? `From ${formatShortDate(from, today)}` : `Until ${formatShortDate(to!, today)}`;
}
