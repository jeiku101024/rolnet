import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { dashboardMonthSchema } from "@/lib/validation/dashboard";
import { demoDocuments, demoDrivers, demoExpenses, demoMode, demoRemittances, demoUnits } from "@/lib/demo/mode";

export async function getDashboard(month: string) {
  await requirePermission("view_dashboard");
  const m = dashboardMonthSchema.parse(month);
  if (demoMode) {
    return { summary: demoUnits.map((u) => ({ unit_id: u.id, body_number: u.body_number, remittance_paid_centavos: 18000, total_expense_centavos: 185000 })), expiry: demoDocuments.map((d) => ({ ...d, bucket: "due_30" })), maintenance: [], balances: [], recent: { remittances: demoRemittances, units: demoUnits, expenses: demoExpenses, maintenance: [], documents: demoDocuments, drivers: demoDrivers } };
  }
  const s = await createSupabaseServerClient();
  const asOf = new Date().toISOString().slice(0, 10);
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
  return { summary, expiry, maintenance, balances, recent: { remittances, units, expenses, maintenance, documents, drivers } };
}
