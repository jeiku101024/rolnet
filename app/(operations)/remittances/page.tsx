import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fleetToday } from "@/lib/dates/fleet-date";
import { demoMode } from "@/lib/demo/mode";
import { hasPermission } from "@/lib/permissions/roles";
import type { SearchParams } from "@/lib/pagination/list-page";
import { parseRemittancesView } from "@/lib/remittances/view-params";
import { loadDailyRows } from "@/lib/remittances/daily-query";
import { buildDailyBoard } from "@/lib/remittances/daily-board";
import { PageHeader } from "@/components/ui/page-header";
import { UnsavedGuardProvider } from "@/components/remittances/unsaved-guard";
import { ViewToggle } from "@/components/remittances/view-toggle";
import { DailyView } from "@/components/remittances/daily-view";
import { RemittancesList } from "@/components/remittances/remittances-list";

// Feature 008: Daily view (recording and corrections, one card per unit for a date) is the default;
// List view (`?view=list`) is the read-only history.
export default async function RemittancesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const params = await searchParams;
  const today = fleetToday();
  const { view, date } = parseRemittancesView(params, today);
  const isOwner = hasPermission(profile.role, "manage_master_data");
  const board = view === "daily" ? buildDailyBoard({ date, today, rows: await loadDailyRows(demoMode ? null : await createSupabaseServerClient(), date, isOwner), isOwner }) : null;
  return <UnsavedGuardProvider>
    <section className="workspace">
      <PageHeader eyebrow="Daily income" title="Remittances" description="Returned units are ₱180. Bring-home/overtime days are ₱300 total." action={<ViewToggle view={view} />} />
      <div className="mt-8 min-w-0">{board ? <DailyView key={board.date} board={board} isOwner={isOwner} /> : <RemittancesList profile={profile} searchParams={params} />}</div>
    </section>
  </UnsavedGuardProvider>;
}
