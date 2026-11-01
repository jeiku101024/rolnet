"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DateControl } from "@/components/ui/date-control";
import { AssignmentCard } from "@/components/units/assignment-card";
import { unitsDailyHref } from "@/lib/units/view-params";
import type { AssignmentBoard } from "@/lib/units/assignment-board";

/** Daily assignment view: one card per unit for the selected date (feature 010, User Stories 1, 2, 4). */
export function AssignmentView({ board, isOwner }: { board: AssignmentBoard; isOwner: boolean }) {
  const router = useRouter();
  const [navigating, startTransition] = useTransition();
  const goTo = (date: string) => startTransition(() => router.push(unitsDailyHref(date), { scroll: false }));

  return <TooltipProvider>
    <div className="grid gap-4" aria-busy={navigating}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateControl date={board.date} today={board.today} onChange={goTo} allowFuture />
        <p role="status" className="text-body-sm text-muted">
          <span className="font-data font-bold text-ink">{board.assigned} of {board.assignable}</span> units assigned
          {navigating ? <span className="ml-3">Loading…</span> : null}
        </p>
      </div>
      <Progress value={board.assignable ? Math.round((board.assigned / board.assignable) * 100) : 0} aria-label="Units assigned" />

      {board.cards.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 desk:grid-cols-4">
        {board.cards.map((card) => <AssignmentCard key={card.kind === "saved" || card.kind === "locked" ? `${card.key}:${card.updatedAt}:${card.kind}` : `${card.key}:${card.kind}`} card={card} date={board.date} today={board.today} isOwner={isOwner} />)}
      </div> : <p className="rounded-md border border-rule bg-surface px-4 py-8 text-center font-semibold text-ink">{isOwner ? "No units to assign. Add a unit in List view." : "No units to assign."}</p>}
    </div>
  </TooltipProvider>;
}
