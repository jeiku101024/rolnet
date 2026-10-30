import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { requirePermission } from "@/lib/auth/guards";
import { getDashboard } from "@/lib/dashboard/queries";
import { fleetToday } from "@/lib/dates/fleet-date";
import { AttentionPanels } from "@/components/dashboard/attention-panels";
import { ExtradorsPanel, InRepairPanel } from "@/components/dashboard/fleet-status-panels";
import { FleetStats } from "@/components/dashboard/fleet-stats";
import { UnitIncomeChart } from "@/components/dashboard/unit-income-chart";
import { DailyTrendChart } from "@/components/dashboard/daily-trend-chart";
import { RecentDataGlimpse, glimpseKinds } from "@/components/dashboard/recent-data-glimpse";
import { PageHeader } from "@/components/ui/page-header";
import { PhoneFold } from "@/components/dashboard/phone-fold";

const bands = ["Needs attention", "Fleet status", "This month", "Recent activity"] as const;

/** One dashboard band: a heading and its panels. Phones stack bands in this order (FR-026). */
function Band({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const id = `band-${title.toLowerCase().replaceAll(" ", "-")}`;
  return <section aria-labelledby={id} className="min-w-0"><div className="mb-4"><h2 id={id} className="text-section-title font-bold">{title}</h2><p className="text-body-sm text-muted">{description}</p></div>{children}</section>;
}

function monthLabelOf(month: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

function DashboardFallback() {
  return <section className="workspace"><PageHeader eyebrow="Fleet overview" title="Dashboard" description="Loading the latest fleet records…" /><div className="mt-8 grid gap-8" aria-hidden="true">{bands.map((band) => <div key={band} className="grid gap-4"><div className="h-6 w-40 animate-pulse rounded-sm bg-brand-soft" /><div className="h-32 animate-pulse rounded-md bg-surface" /></div>)}</div></section>;
}

async function DashboardContent() {
  await requirePermission("view_dashboard"); await connection();
  const month = fleetToday().slice(0, 7);
  const data = await getDashboard(month);
  const monthLabel = monthLabelOf(month);
  return <section className="workspace">
    <PageHeader eyebrow="Fleet overview" title="Dashboard" description="What needs action first, then who is on the road, this month’s figures, and the latest records." />
    <div className="mt-8 grid gap-8">
      <Band title={bands[0]} description="Expired documents, overdue maintenance and unpaid balances, most urgent first.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><AttentionPanels {...data.attention} /></div>
      </Band>
      <Band title={bands[1]} description="Who is covering today and which tricycles are off the road.">
        <div className="grid gap-4 md:grid-cols-2"><ExtradorsPanel panel={data.status.extradors} /><InRepairPanel panel={data.status.inRepair} /></div>
      </Band>
      <Band title={bands[2]} description={`${monthLabel} so far. Amounts match the monthly report.`}>
        <FleetStats stats={data.stats} monthLabel={monthLabel} />
        <div className="mt-4"><PhoneFold label="charts" hint="Daily collections, and collected vs expenses by unit"><div className="grid items-start gap-4 lg:grid-cols-2"><DailyTrendChart days={data.daily} monthLabel={monthLabel} /><UnitIncomeChart bars={data.unitBars} monthLabel={monthLabel} /></div></PhoneFold></div>
      </Band>
      <Band title={bands[3]} description="The newest records of each kind. Open a list to see everything.">
        <PhoneFold label="recent activity" hint="Remittances, expenses, maintenance work and documents"><div className="grid gap-4 md:grid-cols-2">{glimpseKinds.map((kind) => <RecentDataGlimpse key={kind} kind={kind} items={data.recent[kind]} />)}</div></PhoneFold>
      </Band>
    </div>
  </section>;
}

export default function DashboardPage() { return <Suspense fallback={<DashboardFallback />}><DashboardContent /></Suspense>; }
