import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { dashboardMonthSchema } from "@/lib/validation/dashboard";
import { fleetToday } from "@/lib/dates/fleet-date";
import { tirePositionLabels } from "@/lib/validation/maintenance";
import { demoDocuments, demoDrivers, demoExpenses, demoMode, demoRemittances, demoUnits } from "@/lib/demo/mode";

export async function getDashboard(month: string) {
  await requirePermission("view_dashboard");
  const m = dashboardMonthSchema.parse(month);
  if (demoMode) {
    return { summary: demoUnits.map((u) => ({ unit_id: u.id, body_number: u.body_number, remittance_paid_centavos: 18000, total_expense_centavos: 185000, net_income_centavos: 18000 - 185000 })), expiry: demoDocuments.map((d) => ({ ...d, bucket: "due_30" })), maintenance: [], balances: [], recent: { remittances: demoRemittances, units: demoUnits, expenses: demoExpenses, maintenance: [], documents: demoDocuments, drivers: demoDrivers } };
  }
  const s = await createSupabaseServerClient();
  const asOf = fleetToday();
  const [{ data: summary }, { data: expiry }, { data: maintenance }, { data: balances }, { data: remittances }, { data: units }, { data: expenses }, { data: documents }, { data: drivers }] = await Promise.all([
    s.rpc("dashboard_monthly_unit_summary", { month_start: `${m}-01` }),
    s.rpc("expiring_documents", { as_of: asOf }),
    s.rpc("due_maintenance", { as_of: asOf }),
    s.rpc("driver_outstanding_balances", { as_of: asOf }),
    s.from("remittances").select("id,service_date,amount_due_centavos,disposition,units(body_number),drivers(full_name),remittance_payments(amount_centavos)").is("deleted_at", null).order("service_date", { ascending: false }).limit(5),
    s.from("units").select("id,body_number,plate_number,make_model,status,current_mileage").is("deleted_at", null).order("updated_at", { ascending: false }).limit(5),
    s.from("expenses").select("id,expense_date,amount_centavos,receipt_object_path,units(body_number),expense_categories(name)").is("deleted_at", null).order("expense_date", { ascending: false }).limit(5),
    s.from("documents").select("id,document_type,expires_on,lifecycle_status").is("deleted_at", null).order("expires_on").limit(5),
    s.from("drivers").select("id,full_name,driver_kind,license_expiry_date,is_active").is("deleted_at", null).order("updated_at", { ascending: false }).limit(5),
  ]);
  const dueItems = await describeDueItems(s, (maintenance ?? []) as DueRow[]);
  return { summary, expiry, maintenance: dueItems, balances, recent: { remittances, units, expenses, maintenance: dueItems, documents, drivers } };
}

type DueRow = { item_type: string; item_id: string; unit_id: string; due_date: string | null; due_mileage: number | null };
export type DueMaintenanceItem = DueRow & { item_name: string; body_number: string; current_mileage: number | null };

/**
 * due_maintenance() returns ids only; add the part name or tire position and the unit's body
 * number and mileage so the panel can say what is due, where, and why (FR-027, T141).
 */
async function describeDueItems(s: Awaited<ReturnType<typeof createSupabaseServerClient>>, rows: DueRow[]): Promise<DueMaintenanceItem[]> {
  if (!rows.length) return [];
  const partIds = rows.filter((row) => row.item_type === "part").map((row) => row.item_id);
  const tireIds = rows.filter((row) => row.item_type === "tire").map((row) => row.item_id);
  const unitIds = [...new Set(rows.map((row) => row.unit_id))];
  const [{ data: parts }, { data: tires }, { data: units }] = await Promise.all([
    partIds.length ? s.from("part_replacements").select("id, part_name").in("id", partIds) : Promise.resolve({ data: [] as { id: string; part_name: string }[] }),
    tireIds.length ? s.from("tire_installations").select("id, position, brand").in("id", tireIds) : Promise.resolve({ data: [] as { id: string; position: string; brand: string }[] }),
    s.from("units").select("id, body_number, current_mileage").in("id", unitIds),
  ]);
  return rows.map((row) => {
    const unit = (units ?? []).find((item) => item.id === row.unit_id);
    const part = (parts ?? []).find((item) => item.id === row.item_id);
    const tire = (tires ?? []).find((item) => item.id === row.item_id);
    const itemName = part ? part.part_name : tire ? `${tirePositionLabels[tire.position] ?? tire.position} tire (${tire.brand})` : row.item_type;
    return { ...row, item_name: itemName, body_number: unit?.body_number ?? "?", current_mileage: unit?.current_mileage ?? null };
  });
}
