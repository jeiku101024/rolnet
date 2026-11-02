import { listHref, type SearchParams } from "@/lib/pagination/list-page";

// Feature 012 (research R11): the profile's tab and row count live in the URL. Each tab shows 8 rows
// and "Load more" adds 8 at a time.

export type ProfileTab = "assignments" | "remittances" | "roles" | "absences" | "documents";
export const rowStep = 8;
const maxRows = 200;

export const profileTabs: { value: ProfileTab; label: string; ownerOnly?: boolean }[] = [
  { value: "assignments", label: "Assignments" },
  { value: "remittances", label: "Remittances" },
  { value: "roles", label: "Role history" },
  { value: "absences", label: "Absences" },
  { value: "documents", label: "Documents", ownerOnly: true },
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function visibleTabs(isOwner: boolean) {
  return profileTabs.filter((tab) => isOwner || !tab.ownerOnly);
}

/** The active tab (Assignments when missing or not allowed) and its row count (8 to 200, in steps of 8). */
export function parseTabParams(searchParams: SearchParams, isOwner: boolean): { tab: ProfileTab; rows: number } {
  const raw = first(searchParams.tab);
  const tab = visibleTabs(isOwner).find((option) => option.value === raw)?.value ?? "assignments";
  const asked = Number(first(searchParams.rows));
  const rows = Number.isFinite(asked) && asked > rowStep ? Math.min(maxRows, Math.ceil(asked / rowStep) * rowStep) : rowStep;
  return { tab, rows };
}

export function tabHref(pathname: string, searchParams: SearchParams, tab: ProfileTab) {
  return listHref(pathname, searchParams, { tab: tab === "assignments" ? null : tab, rows: null });
}

export function loadMoreHref(pathname: string, searchParams: SearchParams, rows: number) {
  return listHref(pathname, searchParams, { rows: rows + rowStep });
}
