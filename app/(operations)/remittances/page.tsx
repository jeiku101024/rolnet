import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fleetToday } from "@/lib/dates/fleet-date";
import { demoMode, demoRemittances } from "@/lib/demo/mode";
import { hasPermission } from "@/lib/permissions/roles";
import { yearChoices } from "@/lib/reports/download-years";
import type { SearchParams } from "@/lib/pagination/list-page";
import { parseRemittancesView } from "@/lib/remittances/view-params";
import { loadDailyRows } from "@/lib/remittances/daily-query";
import { buildDailyBoard } from "@/lib/remittances/daily-board";
import { PageHeader } from "@/components/ui/page-header";
import { UnsavedGuardProvider } from "@/components/remittances/unsaved-guard";
import { ViewToggle } from "@/components/remittances/view-toggle";
import { DailyView } from "@/components/remittances/daily-view";
import { RemittancesList } from "@/components/remittances/remittances-list";
import { DownloadReportButton } from "@/components/reports/download-report-button";
import { ReportExportForm } from "@/components/forms/report-export-form";

async function earliestServiceDate() {
  if (demoMode) return demoRemittances.map((row) => row.service_date).sort()[0] ?? null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("remittances").select("service_date").is("deleted_at", null).order("service_date").limit(1).maybeSingle();
  return (data?.service_date as string | undefined) ?? null;
}

// Feature 008: Daily view (recording and corrections, one card per unit for a date) is the default;
// List view (`?view=list`) is the read-only history.
export default async function RemittancesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const params = await searchParams;
  const today = fleetToday();
  const { view, date } = parseRemittancesView(params, today);
  const isOwner = hasPermission(profile.role, "manage_master_data");
  // Feature 019: the download overlay replaces the Reports page, for the users who could use it. The year choices run from
  // the earliest recorded remittance, as the old page's did.
  const canExport = hasPermission(profile.role, "export_reports");
  const reportButton = canExport ? <DownloadReportButton title="Download report"><ReportExportForm years={yearChoices(await earliestServiceDate())} /></DownloadReportButton> : null;
  const board = view === "daily" ? buildDailyBoard({ date, today, rows: await loadDailyRows(demoMode ? null : await createSupabaseServerClient(), date) }) : null;
  return <UnsavedGuardProvider>
    <section className="workspace">
      <PageHeader eyebrow="Daily income" title="Remittances" description="Returned units are ₱180. Bring-home/overtime days are ₱300 total." action={<ViewToggle view={view} />} />
      <div className="mt-8 min-w-0">{board ? <DailyView key={board.date} board={board} isOwner={isOwner} reportButton={reportButton} /> : <RemittancesList profile={profile} searchParams={params} reportButton={reportButton} />}</div>
    </section>
  </UnsavedGuardProvider>;
}
