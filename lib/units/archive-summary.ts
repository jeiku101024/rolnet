import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoAuditEvents, demoDocuments, demoExpenses, demoRemittances, demoUnitAssignmentsDaily, demoUnits } from "@/lib/demo/mode";
import { currentDriversOn, type TodayDriver } from "@/lib/assignments/current-drivers";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface ArchiveSummary {
  todayDriver: TodayDriver | null;
  assignments: number;
  remittances: number;
  expenses: number;
  documents: number;
  auditEntries: number;
}

/**
 * What is tied to a unit, for the archive confirmation (feature 010, FR-033): today's driver and
 * head-only counts. "Assignment records" are active daily assignments; the retired primary and
 * backup records aren't counted.
 */
export async function loadArchiveSummary(supabase: Supabase | null, unitId: string, today: string): Promise<ArchiveSummary> {
  if (!supabase) {
    const unitIndex = demoUnits.findIndex((unit) => unit.id === unitId);
    return {
      todayDriver: (await currentDriversOn(null, [unitId], today)).get(unitId) ?? null,
      assignments: demoUnitAssignmentsDaily.filter((row) => row.unit_id === unitId).length,
      remittances: unitIndex >= 0 && unitIndex < 3 ? demoRemittances.filter((_, index) => index % 3 === unitIndex).length : 0,
      expenses: demoExpenses.filter((row) => row.unit_id === unitId).length,
      documents: demoDocuments.filter((row) => row.unit_id === unitId).length,
      auditEntries: demoAuditEvents.filter((row) => row.entity_type === "units").length,
    };
  }
  const count = (table: "unit_assignments" | "remittances" | "expenses" | "documents") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("unit_id", unitId).is("deleted_at", null);
  const [drivers, assignments, remittances, expenses, documents, audit] = await Promise.all([
    currentDriversOn(supabase, [unitId], today),
    count("unit_assignments"),
    count("remittances"),
    count("expenses"),
    count("documents"),
    supabase.from("audit_events").select("id", { count: "exact", head: true }).eq("entity_type", "units").eq("entity_id", unitId),
  ]);
  for (const result of [assignments, remittances, expenses, documents, audit]) if (result.error) throw result.error;
  return {
    todayDriver: drivers.get(unitId) ?? null,
    assignments: assignments.count ?? 0,
    remittances: remittances.count ?? 0,
    expenses: expenses.count ?? 0,
    documents: documents.count ?? 0,
    auditEntries: audit.count ?? 0,
  };
}
