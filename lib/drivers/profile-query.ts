import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { addDays, fleetTimeZone, fleetToday } from "@/lib/dates/fleet-date";
import { one } from "@/lib/supabase/embed";
import { remittanceTotals } from "@/lib/remittances/totals";
import { demoAbsenceConfirmations, demoDocuments, demoDriverAbsences, demoDrivers, demoRemittances, demoRoleChanges, demoUnitAssignmentsDaily, demoUnits } from "@/lib/demo/mode";
import type { Absence, StaleSettings } from "@/lib/drivers/absences";
import { absenceColumns, loadStaleSettings } from "@/lib/drivers/list-query";
import { roleOn, type RoleChange } from "@/lib/drivers/role-on";
import type { ProfileTab } from "@/lib/drivers/tab-params";
import type { DocumentRow } from "@/components/documents/document-list";
import type { DriverKind } from "@/types/database";

// Feature 012 (US5): everything the single-column driver profile shows. Only the active tab's rows
// are read, up to the requested count plus one to know whether more exist (research R11).

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type UnitEmbed = { name: string | null; body_number: string } | { name: string | null; body_number: string }[] | null;

export interface ProfileDriver { id: string; full_name: string; driver_kind: DriverKind; license_number: string; license_expiry_date: string; phone: string; address: string | null; notes: string | null; is_active: boolean; created_at: string; updated_at: string }
export type ProfileAbsence = Absence & { lastCheckedAt: string | null };
export interface AssignmentRow { id: string; date: string; unitId: string; unitName: string; role: DriverKind }
export interface RemittanceRow { id: string; date: string; unitName: string; rentalCentavos: number; paidCentavos: number; balanceCentavos: number; role: DriverKind }
export interface RoleRow { id: string; date: string; change: string; by: string; at: string }

export type TabRows =
  | { tab: "assignments"; rows: AssignmentRow[] }
  | { tab: "remittances"; rows: RemittanceRow[] }
  | { tab: "roles"; rows: RoleRow[] }
  | { tab: "absences"; rows: ProfileAbsence[] }
  | { tab: "documents"; rows: DocumentRow[] };

export interface DriverProfile {
  driver: ProfileDriver;
  absences: ProfileAbsence[];
  settings: StaleSettings;
  todayUnit: { id: string; name: string } | null;
  lastAssignmentDate: string | null;
  remittances30: number;
  balanceCentavos: number;
  tabRows: TabRows;
  hasMore: boolean;
}

const roleName = (role: DriverKind) => (role === "backup" ? "Backup" : "Primary");
const unitName = (embed: UnitEmbed) => { const unit = one(embed); return unit?.name || unit?.body_number || "Unit"; };

/** Null when the driver doesn't exist or is archived. `supabase` null reads demo data. */
export async function loadDriverProfile(supabase: Supabase | null, id: string, today: string, tab: ProfileTab, rows: number): Promise<DriverProfile | null> {
  return supabase ? loadLive(supabase, id, today, tab, rows) : loadDemo(id, today, tab, rows);
}

function balances(remittances: { amount_due_centavos: number; payments: { amount_centavos: number }[] }[]) {
  return remittances.reduce((sum, row) => sum + remittanceTotals(Number(row.amount_due_centavos), row.payments).balance, 0);
}

async function loadLive(supabase: Supabase, id: string, today: string, tab: ProfileTab, rows: number): Promise<DriverProfile | null> {
  const { data: driver, error } = await supabase.from("drivers").select("id, full_name, driver_kind, license_number, license_expiry_date, phone, address, notes, is_active, created_at, updated_at").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!driver) return null;
  const [absences, confirmations, todayAssignment, lastAssignment, remittances, roleChanges, settings] = await Promise.all([
    supabase.from("driver_absences").select(absenceColumns).eq("driver_id", id).is("deleted_at", null).order("start_date", { ascending: false }),
    supabase.from("driver_absence_confirmations").select("absence_id, confirmed_at, driver_absences!inner(driver_id)").eq("driver_absences.driver_id", id).is("deleted_at", null).order("confirmed_at", { ascending: false }),
    supabase.from("unit_assignments").select("unit_id, units(name, body_number)").eq("driver_id", id).eq("service_date", today).is("deleted_at", null).maybeSingle(),
    supabase.from("unit_assignments").select("service_date").eq("driver_id", id).lte("service_date", today).is("deleted_at", null).order("service_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("remittances").select("id, service_date, amount_due_centavos, units(name, body_number), remittance_payments(amount_centavos, deleted_at)").eq("driver_id", id).is("deleted_at", null).order("service_date", { ascending: false }),
    supabase.from("driver_role_changes").select("id, driver_id, from_role, to_role, changed_by, changed_at").eq("driver_id", id).is("deleted_at", null).order("changed_at"),
    loadStaleSettings(supabase),
  ]);
  for (const result of [absences, confirmations, todayAssignment, lastAssignment, remittances, roleChanges]) if (result.error) throw result.error;
  const changes = (roleChanges.data ?? []) as RoleChange[];
  const kind = driver.driver_kind as DriverKind;
  const lastChecked = new Map<string, string>();
  for (const row of confirmations.data ?? []) if (!lastChecked.has(row.absence_id as string)) lastChecked.set(row.absence_id as string, row.confirmed_at as string);
  const profileAbsences = ((absences.data ?? []) as Absence[]).map((absence) => ({ ...absence, lastCheckedAt: lastChecked.get(absence.id) ?? null }));
  const remittanceRows = (remittances.data ?? []).map((row) => {
    const payments = ((row.remittance_payments as { amount_centavos: number; deleted_at: string | null }[] | null) ?? []).filter((payment) => !payment.deleted_at);
    return { id: row.id as string, date: row.service_date as string, unitName: unitName(row.units as UnitEmbed), amount_due_centavos: Number(row.amount_due_centavos), payments };
  });

  let tabRows: TabRows;
  let total = 0;
  if (tab === "assignments") {
    const { data, error: tabError, count } = await supabase.from("unit_assignments").select("id, service_date, unit_id, units(name, body_number)", { count: "exact" }).eq("driver_id", id).is("deleted_at", null).order("service_date", { ascending: false }).range(0, rows - 1);
    if (tabError) throw tabError;
    total = count ?? 0;
    tabRows = { tab, rows: (data ?? []).map((row) => ({ id: row.id as string, date: row.service_date as string, unitId: row.unit_id as string, unitName: unitName(row.units as UnitEmbed), role: roleOn(changes, kind, row.service_date as string) })) };
  } else if (tab === "documents") {
    const { data, error: tabError, count } = await supabase.from("documents").select("id, document_type, expires_on, lifecycle_status, document_number", { count: "exact" }).eq("driver_id", id).is("deleted_at", null).order("lifecycle_status").order("expires_on", { ascending: false }).range(0, rows - 1);
    if (tabError) throw tabError;
    total = count ?? 0;
    tabRows = { tab, rows: (data ?? []) as DocumentRow[] };
  } else {
    ({ tabRows, total } = await sharedTab(supabase, tab, rows, { remittanceRows, profileAbsences, changes, kind }));
  }

  const unit = todayAssignment.data;
  return {
    driver: { ...driver, driver_kind: kind } as ProfileDriver,
    absences: profileAbsences,
    settings,
    todayUnit: unit ? { id: unit.unit_id as string, name: unitName(unit.units as UnitEmbed) } : null,
    lastAssignmentDate: (lastAssignment.data?.service_date as string | undefined) ?? null,
    remittances30: remittanceRows.filter((row) => row.date >= addDays(today, -29) && row.date <= today).length,
    balanceCentavos: balances(remittanceRows),
    tabRows,
    hasMore: total > rows,
  };
}

/** Tabs built from rows already loaded for the summary (remittances, role history, absences). */
async function sharedTab(supabase: Supabase | null, tab: "remittances" | "roles" | "absences", rows: number, source: {
  remittanceRows: { id: string; date: string; unitName: string; amount_due_centavos: number; payments: { amount_centavos: number }[] }[];
  profileAbsences: ProfileAbsence[];
  changes: RoleChange[];
  kind: DriverKind;
}): Promise<{ tabRows: TabRows; total: number }> {
  if (tab === "remittances") {
    return {
      total: source.remittanceRows.length,
      tabRows: { tab, rows: source.remittanceRows.slice(0, rows).map((row) => {
        const totals = remittanceTotals(row.amount_due_centavos, row.payments);
        return { id: row.id, date: row.date, unitName: row.unitName, rentalCentavos: row.amount_due_centavos, paidCentavos: totals.paid, balanceCentavos: totals.balance, role: roleOn(source.changes, source.kind, row.date) };
      }) },
    };
  }
  if (tab === "absences") return { total: source.profileAbsences.length, tabRows: { tab, rows: source.profileAbsences.slice(0, rows) } };
  const newest = [...source.changes].reverse();
  const shown = newest.slice(0, rows);
  const names = await actorNames(supabase, shown.map((change) => change.changed_by));
  const time = new Intl.DateTimeFormat("en-PH", { timeZone: fleetTimeZone(), hour: "numeric", minute: "2-digit" });
  return {
    total: newest.length,
    tabRows: { tab, rows: shown.map((change) => ({ id: change.id, date: fleetToday(new Date(change.changed_at)), change: `${roleName(change.from_role)} → ${roleName(change.to_role)}`, by: names(change.changed_by), at: time.format(new Date(change.changed_at)) })) },
  };
}

// Actor ids reference auth.users, so names come from profiles separately.
async function actorNames(supabase: Supabase | null, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!supabase) return () => "Demo Owner";
  const { data } = unique.length ? await supabase.from("profiles").select("user_id, display_name").in("user_id", unique) : { data: [] };
  return (userId: string) => (data ?? []).find((profile) => profile.user_id === userId)?.display_name ?? "Staff member";
}

async function loadDemo(id: string, today: string, tab: ProfileTab, rows: number): Promise<DriverProfile | null> {
  const driver = demoDrivers.find((row) => row.id === id);
  if (!driver) return null;
  const kind = driver.driver_kind as DriverKind;
  const changes = demoRoleChanges.filter((change) => change.driver_id === id) as RoleChange[];
  const profileAbsences = demoDriverAbsences.filter((absence) => absence.driver_id === id)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map((absence) => ({ ...absence, lastCheckedAt: demoAbsenceConfirmations.filter((row) => row.absence_id === absence.id).map((row) => row.confirmed_at).sort().pop() ?? null }));
  const assignments = demoUnitAssignmentsDaily.filter((row) => row.driver_id === id).sort((a, b) => b.service_date.localeCompare(a.service_date));
  const unitOf = (unitId: string) => demoUnits.find((unit) => unit.id === unitId)?.name ?? "Unit";
  const remittanceRows = demoRemittances.filter((row) => row.driver_id === id).map((row) => ({ id: row.id, date: row.service_date, unitName: unitOf(row.unit_id), amount_due_centavos: row.amount_due_centavos, payments: row.remittance_payments }));
  const todayRow = assignments.find((row) => row.service_date === today);
  let tabRows: TabRows;
  let total: number;
  if (tab === "assignments") {
    total = assignments.length;
    tabRows = { tab, rows: assignments.slice(0, rows).map((row) => ({ id: row.id, date: row.service_date, unitId: row.unit_id, unitName: unitOf(row.unit_id), role: roleOn(changes, kind, row.service_date) })) };
  } else if (tab === "documents") {
    const documents = demoDocuments.filter((doc) => doc.driver_id === id);
    total = documents.length;
    tabRows = { tab, rows: documents.slice(0, rows) };
  } else {
    ({ tabRows, total } = await sharedTab(null, tab, rows, { remittanceRows, profileAbsences, changes, kind }));
  }
  return {
    driver: { id: driver.id, full_name: driver.full_name, driver_kind: kind, license_number: driver.license_number, license_expiry_date: driver.license_expiry_date, phone: driver.phone, address: driver.address, notes: driver.notes, is_active: driver.is_active, created_at: driver.created_at, updated_at: driver.updated_at },
    absences: profileAbsences,
    settings: { amber: 14, red: 30, snooze: 7 },
    todayUnit: todayRow ? { id: todayRow.unit_id, name: unitOf(todayRow.unit_id) } : null,
    lastAssignmentDate: assignments.find((row) => row.service_date <= today)?.service_date ?? null,
    remittances30: remittanceRows.filter((row) => row.date >= addDays(today, -29) && row.date <= today).length,
    balanceCentavos: balances(remittanceRows),
    tabRows,
    hasMore: total > rows,
  };
}
