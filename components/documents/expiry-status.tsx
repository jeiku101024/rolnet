import { StatusBadge } from "@/components/ui/feedback";
import { fleetToday } from "@/lib/dates/fleet-date";

// Status is derived from the fleet's calendar date (Asia/Manila, FR-025), computed when the page
// renders on the server, so it does not depend on the viewer's device clock or time zone.
function daysBetween(fromIsoDate: string, toIsoDate: string) {
  return Math.round((Date.parse(`${toIsoDate}T00:00:00Z`) - Date.parse(`${fromIsoDate}T00:00:00Z`)) / 86400000);
}

export function ExpiryStatus({ expiresOn, today = fleetToday() }: { expiresOn: string; today?: string }) {
  const days = daysBetween(today, expiresOn);
  const label = days < 0 ? "Expired" : days <= 7 ? "Due within 7 days" : days <= 30 ? "Due within 30 days" : "Valid";
  return <StatusBadge label={label} tone={days < 0 ? "danger" : days <= 30 ? "warning" : "success"} />;
}
