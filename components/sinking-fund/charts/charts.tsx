"use client";

import { useState, type ReactNode } from "react";
import { Table2, ChartPie } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPesos } from "@/lib/money/centavos";
import { formatMonth } from "@/lib/sinking-fund/format";
import type { SfMonthlyFlow, SfParticipantSummary } from "@/lib/sinking-fund/types";

/**
 * Dependency-free SVG charts (research R8). Every chart has a "View as table" alternative and shows its values
 * as text in a legend or table, so colour is never the only way to read it.
 */

function ChartFrame({ title, chart, table }: { title: string; chart: ReactNode; table: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return <section className="grid content-start gap-3 rounded-md border border-rule bg-surface p-4" aria-label={title}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-section-title font-bold text-ink">{title}</h2>
      <button type="button" aria-pressed={asTable} onClick={() => setAsTable((current) => !current)}
        className="touch-target inline-flex items-center gap-2 rounded-md border border-control-border bg-surface px-3 text-body-sm font-semibold hover:bg-brand-soft aria-pressed:border-brand aria-pressed:bg-brand-soft">
        {asTable ? <ChartPie aria-hidden="true" size={16} /> : <Table2 aria-hidden="true" size={16} />}{asTable ? "View as chart" : "View as table"}
      </button>
    </div>
    {asTable ? table : chart}
  </section>;
}

const donutColors = ["stroke-brand-dark", "stroke-info", "stroke-ok", "stroke-warn", "stroke-violet", "stroke-silver"];
const swatchColors = ["bg-brand-dark", "bg-info", "bg-ok", "bg-warn", "bg-violet", "bg-silver"];

export type DonutSlice = { label: string; centavos: number };

/** Share of total savings by participant: the top 5 plus "Others" (spec section 13). */
export function donutSlices(participants: readonly SfParticipantSummary[]): DonutSlice[] {
  const sorted = participants.filter((item) => item.savings_centavos > 0).sort((a, b) => b.savings_centavos - a.savings_centavos || a.name.localeCompare(b.name));
  const top = sorted.slice(0, 5).map((item) => ({ label: item.name, centavos: item.savings_centavos }));
  const others = sorted.slice(5).reduce((sum, item) => sum + item.savings_centavos, 0);
  return others > 0 ? [...top, { label: "Others", centavos: others }] : top;
}

export function SavingsDonut({ participants }: { participants: readonly SfParticipantSummary[] }) {
  const slices = donutSlices(participants);
  const total = slices.reduce((sum, slice) => sum + slice.centavos, 0);
  // Each slice starts where the previous one ended (cumulative share before it).
  const starts = slices.map((_, index) => slices.slice(0, index).reduce((sum, item) => sum + (total ? (item.centavos / total) * 100 : 0), 0));
  const empty = <p className="py-8 text-center text-body-sm text-muted">No savings yet.</p>;
  const chart = total === 0 ? empty : <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
    <svg viewBox="0 0 42 42" role="img" aria-label="Share of total savings by participant" className="mx-auto size-40">
      <circle cx="21" cy="21" r="15.915" fill="none" className="stroke-rule" strokeWidth="6" />
      {slices.map((slice, index) => {
        const percent = (slice.centavos / total) * 100;
        return <circle key={slice.label} cx="21" cy="21" r="15.915" fill="none" className={donutColors[index % donutColors.length]} strokeWidth="6"
          strokeDasharray={`${percent} ${100 - percent}`} strokeDashoffset={25 - starts[index]} />;
      })}
    </svg>
    <ul className="grid gap-2 text-body-sm">
      {slices.map((slice, index) => <li key={slice.label} className="flex items-center gap-2">
        <span aria-hidden="true" className={`size-3 shrink-0 rounded-sm ${swatchColors[index % swatchColors.length]}`} />
        <span className="min-w-0 flex-1 truncate">{slice.label}</span>
        <span className="font-data">{formatPesos(slice.centavos)}</span>
        <span className="w-12 text-right text-muted">{Math.round((slice.centavos / total) * 100)}%</span>
      </li>)}
    </ul>
  </div>;
  const table = <Table><TableHeader><TableRow><TableHead>Participant</TableHead><TableHead className="text-right">Savings</TableHead><TableHead className="text-right">Share</TableHead></TableRow></TableHeader>
    <TableBody>{slices.map((slice) => <TableRow key={slice.label}><TableCell>{slice.label}</TableCell><TableCell className="text-right font-data">{formatPesos(slice.centavos)}</TableCell><TableCell className="text-right">{total ? Math.round((slice.centavos / total) * 100) : 0}%</TableCell></TableRow>)}</TableBody></Table>;
  return <ChartFrame title="Savings by participant" chart={chart} table={total === 0 ? empty : table} />;
}

const barSeries = [
  { key: "deposits_centavos", label: "Deposits", className: "fill-ok", swatch: "bg-ok" },
  { key: "loans_centavos", label: "Loans", className: "fill-warn", swatch: "bg-warn" },
  { key: "payments_centavos", label: "Payments", className: "fill-info", swatch: "bg-info" },
] as const;

/** Deposits, Loans, and Payments per month for the last 6 months, as grouped bars with a legend. */
export function MonthlyBars({ flows }: { flows: readonly SfMonthlyFlow[] }) {
  const max = Math.max(1, ...flows.flatMap((flow) => barSeries.map((series) => flow[series.key])));
  const groupWidth = 360 / Math.max(flows.length, 1);
  const chart = <div className="grid gap-3">
    <svg viewBox="0 0 360 170" role="img" aria-label="Deposits, loans, and payments per month" className="w-full">
      <line x1="0" y1="140" x2="360" y2="140" className="stroke-rule" strokeWidth="1" />
      {flows.map((flow, index) => {
        const x0 = index * groupWidth + groupWidth * 0.15;
        const barWidth = (groupWidth * 0.7) / 3;
        return <g key={flow.month}>
          {barSeries.map((series, seriesIndex) => {
            const height = (flow[series.key] / max) * 130;
            return <rect key={series.key} x={x0 + seriesIndex * barWidth} y={140 - height} width={barWidth - 1} height={height} className={series.className}><title>{`${series.label} ${formatMonth(flow.month)}: ${formatPesos(flow[series.key])}`}</title></rect>;
          })}
          <text x={index * groupWidth + groupWidth / 2} y="158" textAnchor="middle" className="fill-muted" fontSize="9">{formatMonth(flow.month)}</text>
        </g>;
      })}
    </svg>
    <ul className="flex flex-wrap gap-4 text-body-sm">{barSeries.map((series) => <li key={series.key} className="flex items-center gap-2"><span aria-hidden="true" className={`size-3 rounded-sm ${series.swatch}`} />{series.label}</li>)}</ul>
  </div>;
  const table = <Table><TableHeader><TableRow><TableHead>Month</TableHead>{barSeries.map((series) => <TableHead key={series.key} className="text-right">{series.label}</TableHead>)}</TableRow></TableHeader>
    <TableBody>{flows.map((flow) => <TableRow key={flow.month}><TableCell>{formatMonth(flow.month)}</TableCell>{barSeries.map((series) => <TableCell key={series.key} className="text-right font-data">{formatPesos(flow[series.key])}</TableCell>)}</TableRow>)}</TableBody></Table>;
  return <ChartFrame title="Deposits, loans, and payments" chart={chart} table={table} />;
}
