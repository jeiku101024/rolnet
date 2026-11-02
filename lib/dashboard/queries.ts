import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { dashboardMonthSchema } from "@/lib/validation/dashboard";
import { addDays, fleetToday } from "@/lib/dates/fleet-date";
import { one } from "@/lib/supabase/embed";
import { remittanceTotals } from "@/lib/remittances/totals";
import { covers } from "@/lib/drivers/absences";
import { demoDocuments, demoDriverAbsences, demoDrivers, demoExpenses, demoInRepairSince, demoMode, demoRemittances, demoUnitAssignmentsDaily, demoUnits } from "@/lib/demo/mode";
import { documentsDueHref } from "@/lib/documents/url-state";
import {
  dailyCollections, daysBetween, monthTotals, orderExpiringDocuments, orderExtradors, orderInRepair, orderUnpaidBalances, toPanel, unitIncomeBars,
  type ExtradorItem, type FleetStats, type InRepairUnitItem, type SummaryRow,
} from "@/lib/dashboard/ordering";

type Item = Record<string, unknown>;
export type RecentKind = "remittances" | "expenses" | "documents";

const manilaDate = (timestamp: string) => fleetToday(new Date(timestamp));

/**
 * Everything the dashboard shows, in its four bands (contracts/dashboard.md):
 * attention → fleet status → this month → recent activity.
 */
export async function getDashboard(month: string) {
  await requirePermission("view_dashboard");
  const m = dashboardMonthSchema.parse(month);
  const today = fleetToday();
  return demoMode ? demoDashboard(m, today) : liveDashboard(m, today);
}

export type DashboardData = Awaited<ReturnType<typeof liveDashboard>>;

async function liveDashboard(m: string, today: string) {
  const s = await createSupabaseServerClient();
  // Payments from the day before the month starts, so every fleet-local day of the month is covered.
  const paymentsFrom = `${addDays(`${m}-01`, -1)}T00:00:00Z`;
  const [summary, expiry, balances, units, backups, payments, remittances, expenses, documents] = await Promise.all([
    s.rpc("dashboard_monthly_unit_summary", { month_start: `${m}-01` }),
    s.rpc("expiring_documents", { as_of: today }),
    s.rpc("driver_outstanding_balances", { as_of: today }),
    s.from("units").select("id, body_number, plate_number, status").eq("archived", false).is("deleted_at", null),
    s.from("drivers").select("id, full_name, phone").eq("driver_kind", "backup").eq("is_active", true).is("deleted_at", null),
    s.from("remittance_payments").select("paid_at, amount_centavos").is("deleted_at", null).gte("paid_at", paymentsFrom),
    s.from("remittances").select("id, service_date, amount_due_centavos, disposition, units(body_number), drivers(full_name), remittance_payments(amount_centavos)").is("deleted_at", null).order("service_date", { ascending: false }).order("created_at", { ascending: false }).limit(5),
    s.from("expenses").select("id, expense_date, amount_centavos, receipt_object_path, category, custom_category, units(body_number)").is("deleted_at", null).order("expense_date", { ascending: false }).order("created_at", { ascending: false }).limit(5),
    s.from("documents").select("id, document_type, expires_on, lifecycle_status, created_at, unit_id, driver_id").is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
  ]);

  const unitRows = units.data ?? [];
  const inRepairUnits = unitRows.filter((unit) => unit.status === "in_repair");
  const backupIds = (backups.data ?? []).map((driver) => driver.id);
  const expiryRows = (expiry.data ?? []) as { id: string; document_type: string; unit_id: string | null; driver_id: string | null; expires_on: string; bucket: string }[];
  const holderDriverIds = [...new Set(expiryRows.map((row) => row.driver_id).filter((id): id is string => Boolean(id)))];

  const [repairEvents, assignments, holderDrivers, absences] = await Promise.all([
    inRepairUnits.length ? s.from("audit_events").select("entity_id, occurred_at").eq("entity_type", "units").in("entity_id", inRepairUnits.map((unit) => unit.id)).eq("changed_fields->after->>status", "in_repair").order("occurred_at", { ascending: false }) : Promise.resolve({ data: [] as { entity_id: string; occurred_at: string }[] }),
    // Feature 010: a backup driver's unit today is their saved daily assignment.
    backupIds.length ? s.from("unit_assignments").select("driver_id, unit_id, units(body_number)").in("driver_id", backupIds).eq("service_date", today).is("deleted_at", null) : Promise.resolve({ data: [] as { driver_id: string; unit_id: string; assignment_type: string; starts_on: string; ends_on: string | null; units: unknown }[] }),
    holderDriverIds.length ? s.from("drivers").select("id, full_name").in("id", holderDriverIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    // Feature 012 (FR-064): backup drivers absent today are left out.
    backupIds.length ? s.from("driver_absences").select("driver_id, start_date, end_date, cancelled_at, ended_early_on").in("driver_id", backupIds).is("deleted_at", null).is("cancelled_at", null).lte("start_date", today).or(`end_date.is.null,end_date.gte.${today}`) : Promise.resolve({ data: [] as { driver_id: string; start_date: string; end_date: string | null; cancelled_at: string | null; ended_early_on: string | null }[] }),
  ]);
  const absentToday = new Set((absences.data ?? []).filter((absence) => covers(absence, today)).map((absence) => absence.driver_id));

  const bodyOf = (unitId: string | null) => unitRows.find((unit) => unit.id === unitId)?.body_number;
  const holderLabel = (row: { unit_id: string | null; driver_id: string | null }) => row.unit_id ? `Body ${bodyOf(row.unit_id) ?? "?"}` : (holderDrivers.data ?? []).find((driver) => driver.id === row.driver_id)?.full_name ?? "Driver";
  const since = (unitId: string) => (repairEvents.data ?? []).find((event) => event.entity_id === unitId)?.occurred_at ?? null;

  const extradors: ExtradorItem[] = (backups.data ?? []).filter((driver) => !absentToday.has(driver.id)).map((driver) => {
    const assignment = (assignments.data ?? []).find((row) => row.driver_id === driver.id);
    return { driverId: driver.id, fullName: driver.full_name, phone: driver.phone, currentUnit: assignment ? { unitId: assignment.unit_id as string, bodyNumber: one(assignment.units as { body_number: string } | null)?.body_number ?? "?" } : null, assignmentType: assignment ? "backup" as const : null };
  });
  const inRepair: InRepairUnitItem[] = inRepairUnits.map((unit) => { const at = since(unit.id); return { unitId: unit.id, bodyNumber: unit.body_number, plateNumber: unit.plate_number, inRepairSince: at, daysInRepair: at ? Math.max(0, daysBetween(manilaDate(at), today)) : null }; });

  return assemble({
    m, today,
    summary: (summary.data ?? []) as SummaryRow[],
    expiry: expiryRows.map((row) => ({ ...row, holderLabel: holderLabel(row) })),
    balances: balances.data ?? [],
    units: unitRows,
    extradors, inRepair,
    payments: payments.data ?? [],
    recent: {
      remittances: (remittances.data ?? []) as Item[],
      expenses: (expenses.data ?? []) as Item[],
      documents: (documents.data ?? []).map((doc) => ({ ...doc, holderLabel: holderLabel(doc) })) as Item[],
    },
  });
}

function assemble(input: {
  m: string; today: string; summary: SummaryRow[]; expiry: { id: string; document_type: string; expires_on: string; bucket: string; holderLabel: string }[];
  balances: { driver_id: string; driver_name: string; outstanding_centavos: number; unpaid_remittance_count: number | null; first_unpaid_service_date: string | null }[];
  units: { status: string }[]; extradors: ExtradorItem[]; inRepair: InRepairUnitItem[]; payments: { paid_at: string; amount_centavos: number }[]; recent: Record<RecentKind, Item[]>;
}) {
  const stats: FleetStats = {
    ...monthTotals(input.summary),
    unitsActive: input.units.filter((unit) => unit.status === "active").length,
    unitsInRepair: input.units.filter((unit) => unit.status === "in_repair").length,
    documentsDue: input.expiry.length,
  };
  return {
    month: input.m,
    attention: {
      documents: toPanel(orderExpiringDocuments(input.expiry, input.today), documentsDueHref),
      balances: toPanel(orderUnpaidBalances(input.balances), "/remittances?view=list&balance=unpaid"),
    },
    status: {
      extradors: toPanel(orderExtradors(input.extradors), "/drivers?kind=backup"),
      inRepair: toPanel(orderInRepair(input.inRepair), "/units?status=in_repair"),
    },
    stats,
    unitBars: unitIncomeBars(input.summary),
    daily: dailyCollections(input.payments, input.m, input.today, manilaDate),
    recent: input.recent,
  };
}

/** Demo mode: the same shape, built from the demo rows in `lib/demo/mode.ts`. */
function demoDashboard(m: string, today: string) {
  const inMonth = (date: string) => date.startsWith(m);
  const summary: SummaryRow[] = demoUnits.map((unit) => {
    const paid = demoRemittances.filter((r) => r.unit_id === unit.id && inMonth(r.service_date)).reduce((sum, r) => sum + remittanceTotals(r.amount_due_centavos, r.remittance_payments).paid, 0);
    const spent = demoExpenses.filter((e) => one(e.units)?.body_number === unit.body_number && inMonth(e.expense_date)).reduce((sum, e) => sum + e.amount_centavos, 0);
    return { unit_id: unit.id, body_number: unit.body_number, remittance_paid_centavos: paid, total_expense_centavos: spent, net_income_centavos: paid - spent };
  });
  const limit = addDays(today, 7);
  const holderLabel = (doc: { unit_id: string | null; driver_id: string | null }) => doc.unit_id ? `Body ${demoUnits.find((unit) => unit.id === doc.unit_id)?.body_number ?? "?"}` : demoDrivers.find((driver) => driver.id === doc.driver_id)?.full_name ?? "Driver";
  const expiry = demoDocuments.filter((doc) => doc.expires_on <= limit).map((doc) => ({ ...doc, bucket: doc.expires_on < today ? "expired" : "due_7", holderLabel: holderLabel(doc) }));
  const balances = demoDrivers.map((driver) => {
    const unpaid = demoRemittances.filter((r) => r.driver_id === driver.id).map((r) => ({ r, balance: remittanceTotals(r.amount_due_centavos, r.remittance_payments).balance })).filter((x) => x.balance > 0);
    return { driver_id: driver.id, driver_name: driver.full_name, outstanding_centavos: unpaid.reduce((sum, x) => sum + x.balance, 0), unpaid_remittance_count: unpaid.length, first_unpaid_service_date: unpaid.map((x) => x.r.service_date).sort()[0] ?? null };
  });
  const extradors: ExtradorItem[] = demoDrivers.filter((driver) => driver.driver_kind === "backup" && driver.is_active && !demoDriverAbsences.some((absence) => absence.driver_id === driver.id && covers(absence, today))).map((driver) => {
    const assignment = demoUnitAssignmentsDaily.find((row) => row.driver_id === driver.id && row.service_date === today);
    return { driverId: driver.id, fullName: driver.full_name, phone: driver.phone, currentUnit: assignment ? { unitId: assignment.unit_id, bodyNumber: demoUnits.find((unit) => unit.id === assignment.unit_id)?.body_number ?? "?" } : null, assignmentType: assignment ? "backup" : null };
  });
  const inRepair: InRepairUnitItem[] = demoUnits.filter((unit) => unit.status === "in_repair").map((unit) => { const at = demoInRepairSince[unit.id] ?? null; return { unitId: unit.id, bodyNumber: unit.body_number, plateNumber: unit.plate_number, inRepairSince: at, daysInRepair: at ? daysBetween(manilaDate(at), today) : null }; });
  const payments = demoRemittances.map((r) => ({ paid_at: `${r.service_date}T04:00:00Z`, amount_centavos: remittanceTotals(r.amount_due_centavos, r.remittance_payments).paid }));
  return assemble({
    m, today, summary, expiry, balances, units: demoUnits.filter((unit) => !unit.archived), extradors, inRepair, payments,
    recent: {
      remittances: demoRemittances.slice(0, 5) as Item[],
      expenses: demoExpenses.slice(0, 5) as Item[],
      documents: [...demoDocuments].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5).map((doc) => ({ ...doc, holderLabel: holderLabel(doc) })) as Item[],
    },
  });
}
