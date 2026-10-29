import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoMode, demoUnits } from "@/lib/demo/mode";
import { ReportExportForm } from "@/components/forms/report-export-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function ReportsPage() {
  await requirePermission("export_reports");
  const s = demoMode ? null : await createSupabaseServerClient();
  const { data: units } = s ? await s.from("units").select("id, body_number, plate_number").is("deleted_at", null).order("body_number") : { data: demoUnits };
  return <section className="workspace"><PageHeader eyebrow="Monthly reporting" title="Reports" description="Download a reconciled monthly CSV summary for bookkeeping. Amounts are in centavos." /><div className="mt-8 max-w-xl border-t border-rule pt-5"><ReportExportForm units={units ?? []} /></div></section>;
}
