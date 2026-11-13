"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { DriverTag } from "@/components/sinking-fund/type-tag";
import { PrimaryActions, useSfActions } from "@/components/sinking-fund/sinking-fund-page";
import { listHref } from "@/lib/pagination/list-page";
import { formatPesos } from "@/lib/money/centavos";
import { placeLabel, rankRows, trophyFor, type RankPeriod } from "@/lib/sinking-fund/rankings";
import type { RankBy } from "@/lib/sinking-fund/url-state";

const trophyStyle = {
  gold: { icon: "text-gold", tint: "bg-gold-soft" },
  silver: { icon: "text-silver", tint: "bg-silver-soft" },
  bronze: { icon: "text-bronze", tint: "bg-bronze-soft" },
} as const;

const showAllAfter = 10;

/** The Top participants view (spec section 12): rank by savings or deposits for all time, a month, or a week. */
export function TopView() {
  const { data, params, searchParams, viewParticipant } = useSfActions();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const period = data.period!;
  const ranked = rankRows(data.ranking ?? []);
  const top = ranked[0]?.amount_centavos ?? 0;
  const positive = ranked.filter((row) => row.rank > 0);
  const zeros = ranked.filter((row) => row.rank === 0);
  const shownZeros = showAll || zeros.length + positive.length <= showAllAfter ? zeros : zeros.slice(0, Math.max(0, showAllAfter - positive.length));

  const go = (changes: Record<string, string | null>) => startTransition(() => router.replace(listHref(pathname, searchParams, changes), { scroll: false }));
  const switchPeriod = (next: RankPeriod) => go({ period: next === "all" ? null : next, at: null });

  return <div className="grid gap-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedToggle label="Rank by" value={params.rank} options={[{ value: "savings", label: "Total savings" }, { value: "deposits", label: "Deposits" }]} onChange={(next: RankBy) => go({ rank: next === "savings" ? null : next })} />
        <SegmentedToggle label="Period" value={params.period} options={[{ value: "all", label: "All time" }, { value: "month", label: "Monthly" }, { value: "week", label: "Weekly" }]} onChange={switchPeriod} />
      </div>
      <PrimaryActions />
    </div>

    {params.period !== "all" ? <div className="flex items-center gap-2" role="group" aria-label="Choose period">
      <button type="button" className="touch-target inline-flex w-11 items-center justify-center rounded-md border border-control-border bg-surface hover:bg-brand-soft" aria-label="Previous period" onClick={() => go({ at: period.previous })}><ChevronLeft aria-hidden="true" size={18} /></button>
      <p className="min-w-40 text-center font-semibold" role="status">{period.label}</p>
      <button type="button" className="touch-target inline-flex w-11 items-center justify-center rounded-md border border-control-border bg-surface hover:bg-brand-soft disabled:opacity-40" aria-label="Next period" disabled={!period.next} onClick={() => go({ at: period.next })}><ChevronRight aria-hidden="true" size={18} /></button>
    </div> : null}

    {ranked.length === 0 ? <EmptyState title="No participants yet. Add your first participant." /> : <ol className="grid gap-2" aria-label="Ranking">
      {[...positive, ...shownZeros].map((row) => {
        const trophy = trophyFor(row.rank);
        const style = trophy ? trophyStyle[trophy] : null;
        const width = top > 0 ? Math.max(2, Math.round((row.amount_centavos / top) * 100)) : 0;
        return <li key={row.participant_id}>
          <button type="button" onClick={() => viewParticipant(row.participant_id)}
            className={`grid w-full gap-2 rounded-md border border-rule px-3 text-left hover:border-brand ${style ? `${style.tint} py-4` : "bg-surface py-3"}`} data-testid="sf-rank-row">
            <span className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-center font-data font-bold">{row.rank > 0 ? row.rank : "–"}</span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 font-semibold">
                {trophy ? <Trophy aria-label={placeLabel(row.rank)} role="img" size={20} className={style!.icon} /> : null}
                <span className="truncate">{row.name}</span>
                {row.driver_id ? <DriverTag /> : null}
              </span>
              <span className="font-data font-bold">{formatPesos(row.amount_centavos)}</span>
            </span>
            <span className="ml-11 block h-1.5 rounded-sm bg-rule" aria-hidden="true"><span className="block h-1.5 rounded-sm bg-brand-dark" style={{ width: `${width}%` }} /></span>
          </button>
        </li>;
      })}
    </ol>}
    {!showAll && shownZeros.length < zeros.length ? <button type="button" className="touch-target w-fit text-body-sm font-semibold text-brand-dark underline" onClick={() => setShowAll(true)}>Show all ({ranked.length})</button> : null}
  </div>;
}
