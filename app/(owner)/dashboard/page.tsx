import { Suspense } from "react";
import { connection } from "next/server";
import { requirePermission } from "@/lib/auth/guards";
import { getDashboard } from "@/lib/dashboard/queries";
import { fleetToday } from "@/lib/dates/fleet-date";
import { MonthlyUnitSummary } from "@/components/dashboard/monthly-unit-summary";
import { ExpiringSoonPanel } from "@/components/dashboard/expiring-soon-panel";
import { DueMaintenancePanel } from "@/components/dashboard/due-maintenance-panel";
import { UnpaidBalancesPanel } from "@/components/dashboard/unpaid-balances-panel";
import { RecentDataGlimpse } from "@/components/dashboard/recent-data-glimpse";
import { PageHeader } from "@/components/ui/page-header";

function DashboardFallback() { return <section className="workspace"><PageHeader eyebrow="Fleet overview" title="Dashboard" description="Loading the latest fleet records…" /><div className="mt-8 grid gap-4" aria-hidden="true"><div className="h-24 animate-pulse bg-brand-soft" /><div className="h-32 animate-pulse bg-surface" /></div></section>; }

async function DashboardContent() {
  await requirePermission("view_dashboard"); await connection();
  const month = fleetToday().slice(0, 7); const data = await getDashboard(month);
  return <section className="workspace"><PageHeader eyebrow="Fleet overview" title="Dashboard" description="A live read of the records that need attention and the work completed most recently." /><div className="mt-8 workspace-grid-wide"><div className="space-y-8"><MonthlyUnitSummary rows={data.summary ?? []} /><div className="workspace-grid-wide"><ExpiringSoonPanel items={data.expiry ?? []} /><DueMaintenancePanel items={data.maintenance ?? []} today={fleetToday()} /></div><UnpaidBalancesPanel items={data.balances ?? []} /></div><div className="grid min-w-0 gap-5 xl:grid-cols-2">{(["remittances", "units", "expenses", "maintenance", "documents", "drivers"] as const).map((kind) => <RecentDataGlimpse key={kind} kind={kind} items={(data.recent?.[kind] ?? []) as Record<string, unknown>[]} />)}</div></div></section>;
}

export default function DashboardPage() { return <Suspense fallback={<DashboardFallback />}><DashboardContent /></Suspense>; }
