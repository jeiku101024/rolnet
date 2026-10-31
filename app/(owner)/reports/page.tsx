import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoMode, demoRemittances } from "@/lib/demo/mode";
import { fleetToday } from "@/lib/dates/fleet-date";
import { loadReportUnits } from "@/lib/reports/report-data";
import { ReportExportForm } from "@/components/forms/report-export-form";
import { PageHeader } from "@/components/ui/page-header";

/** Years offered: from the earliest recorded remittance (or ten years back) to this year. */
function yearChoices(earliest: string | null) {
  const thisYear = Number(fleetToday().slice(0, 4));
  const first = earliest ? Math.max(Number(earliest.slice(0, 4)), thisYear - 10) : thisYear - 10;
  return Array.from({ length: thisYear - first + 1 }, (_, index) => thisYear - index);
}

export default async function ReportsPage() {
  await requirePermission("export_reports");
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const [units, earliest] = await Promise.all([
    loadReportUnits(supabase),
    supabase
      ? supabase.from("remittances").select("service_date").is("deleted_at", null).order("service_date").limit(1).maybeSingle().then(({ data }) => (data?.service_date as string | undefined) ?? null)
      : Promise.resolve(demoRemittances.map((row) => row.service_date).sort()[0] ?? null),
  ]);
  return <section className="workspace">
    <PageHeader eyebrow="Reporting" title="Reports" description="Download Weekly, Monthly or Yearly reports as Excel files for the whole fleet or one unit." />
    <div className="mt-8 max-w-xl border-t border-rule pt-5"><ReportExportForm units={units} years={yearChoices(earliest)} /></div>
  </section>;
}
