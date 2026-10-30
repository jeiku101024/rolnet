"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { DailyCard, type CardView } from "@/components/remittances/daily-card";
import { DateControl } from "@/components/remittances/date-control";
import { useUnsavedGuard } from "@/components/remittances/unsaved-guard";
import { formatPesos } from "@/lib/money/centavos";
import { fleetToday } from "@/lib/dates/fleet-date";
import { dailyHref } from "@/lib/remittances/view-params";
import type { DailyBoard, SavedCard } from "@/lib/remittances/daily-board";

/** How often an open Daily view checks whether the fleet's calendar day has changed (FR-030). */
const dayCheckInterval = 30_000;

/** Daily view: one card per scheduled unit for the selected date (feature 008, User Stories 1–3). */
export function DailyView({ board, isOwner }: { board: DailyBoard; isOwner: boolean }) {
  const router = useRouter();
  const { setGuard } = useUnsavedGuard();
  const [navigating, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Record<string, CardView>>({});
  const dirty = useRef(new Set<string>());
  const [dirtyCount, setDirtyCount] = useState(0);
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [newDay, setNewDay] = useState<string | null>(null);

  const cards = board.cards.map((card) => overrides[card.key] ?? card);
  const recorded = cards.filter((card) => card.kind === "saved").length;
  const countable = cards.filter((card) => card.kind === "saved" || card.kind === "unrecorded").length;
  const received = cards.reduce((sum, card) => sum + (card.kind === "saved" ? card.receivedCentavos : 0), 0);

  const onDirty = useCallback((key: string, isDirty: boolean) => {
    const set = dirty.current;
    if (isDirty === set.has(key)) return;
    if (isDirty) set.add(key); else set.delete(key);
    setDirtyCount(set.size);
  }, []);

  // Every way out of this date asks first while a card has unsaved entries (FR-031).
  const guard = useCallback((go: () => void) => {
    if (dirty.current.size) setLeave(() => go); else go();
  }, []);
  useEffect(() => { setGuard(guard); return () => setGuard(null); }, [guard, setGuard]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current.size) { event.preventDefault(); event.returnValue = ""; } };
    // The App Router has no event to block a route change, so same-origin link clicks are caught here.
    const linkClick = (event: MouseEvent) => {
      if (!dirty.current.size || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      setLeave(() => () => router.push(`${url.pathname}${url.search}${url.hash}`));
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", linkClick, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", linkClick, true); };
  }, [router]);

  // Midnight rollover: keep the open date and cards, and offer to switch (FR-030).
  useEffect(() => {
    if (board.date !== board.today) return;
    const check = () => { const now = fleetToday(); if (now !== board.today) setNewDay(now); };
    const timer = setInterval(check, dayCheckInterval);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, [board.date, board.today]);

  const goTo = (date: string) => guard(() => startTransition(() => router.push(dailyHref(date), { scroll: false })));
  const onSaved = useCallback((card: SavedCard & { notice?: string }) => setOverrides((previous) => ({ ...previous, [card.key]: card })), []);
  const onReload = useCallback((key: string) => {
    setOverrides((previous) => { const next = { ...previous }; delete next[key]; return next; });
    router.refresh();
  }, [router]);

  return <TooltipProvider>
    <div className="grid gap-4" aria-busy={navigating}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateControl date={board.date} today={board.today} onChange={goTo} />
        <p role="status" className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-muted">
          <span><span className="font-data font-bold text-ink">{recorded} of {countable}</span> recorded</span>
          <span><span className="font-data font-bold text-ink">{formatPesos(received)}</span> received</span>
          {navigating ? <span>Loading…</span> : null}
        </p>
      </div>
      <Progress value={countable ? Math.round((recorded / countable) * 100) : 0} aria-label="Recorded" />

      {newDay ? <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rule bg-brand-soft p-3 text-body-sm text-brand-dark">
        <p>It&apos;s now a new day. Switch to today?</p>
        <Button type="button" variant="outline" onClick={() => goTo(newDay)}>Switch to today</Button>
      </div> : null}

      {cards.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 desk:grid-cols-4">
        {cards.map((card) => <DailyCard key={card.kind === "saved" ? `${card.key}:${card.updatedAt}:${card.receivedCentavos}` : card.key} card={card} date={board.date} isToday={board.isToday} isOwner={isOwner} freeDrivers={board.freeDrivers} onSaved={onSaved} onDirty={onDirty} onReload={onReload} />)}
      </div> : <p className="rounded-md border border-rule bg-surface px-4 py-8 text-center font-semibold text-ink">No units scheduled for this date.</p>}
    </div>

    <AlertDialog open={leave !== null} onOpenChange={(open) => { if (!open) setLeave(null); }}>
      <AlertDialogContent title={`You have unsaved changes on ${dirtyCount} ${dirtyCount === 1 ? "card" : "cards"}. Leave without saving?`}>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" />}>Stay</AlertDialogClose>
          <Button type="button" onClick={() => { const go = leave; setLeave(null); dirty.current.clear(); setDirtyCount(0); go?.(); }}>Leave</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </TooltipProvider>;
}
