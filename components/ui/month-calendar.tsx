"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays } from "@/lib/dates/fleet-date";

// Feature 008 (FR-006, FR-007, research R6): one month as an accessible grid with month navigation.
// Days after `max` can't be picked. No date library: calendar dates are YYYY-MM-DD strings.

const monthTitle = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const monthOf = (iso: string) => iso.slice(0, 7);
const firstOf = (month: string) => `${month}-01`;

function shiftMonth(month: string, by: number) {
  const date = utc(firstOf(month));
  date.setUTCMonth(date.getUTCMonth() + by);
  return date.toISOString().slice(0, 7);
}

function clampDay(iso: string, month: string) {
  const day = Math.min(Number(iso.slice(8, 10)), new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate());
  return `${month}-${String(day).padStart(2, "0")}`;
}

function weeksOf(month: string) {
  let day = addDays(firstOf(month), -utc(firstOf(month)).getUTCDay());
  const weeks: string[][] = [];
  do {
    const week: string[] = [];
    for (let index = 0; index < 7; index += 1) { week.push(day); day = addDays(day, 1); }
    weeks.push(week);
  } while (monthOf(day) === month);
  return weeks;
}

export function MonthCalendar({ value, max, onSelect }: { value: string; max: string; onSelect: (date: string) => void }) {
  const [month, setMonth] = useState(monthOf(value));
  const [focused, setFocused] = useState(value);
  const grid = useRef<HTMLTableElement>(null);
  const moved = useRef(false);
  const titleId = `calendar-title-${month}`;

  useEffect(() => {
    if (!moved.current) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
  }, [focused, month]);

  function focusDay(next: string) {
    moved.current = true;
    setFocused(next);
    if (monthOf(next) !== month) setMonth(monthOf(next));
  }

  function onKeyDown(event: KeyboardEvent) {
    const weekday = utc(focused).getUTCDay();
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -weekday),
      End: () => addDays(focused, 6 - weekday),
      PageUp: () => clampDay(focused, shiftMonth(monthOf(focused), -1)),
      PageDown: () => clampDay(focused, shiftMonth(monthOf(focused), 1)),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    focusDay(move());
  }

  const nextDisabled = firstOf(shiftMonth(month, 1)) > max;
  const navButton = "touch-target inline-flex w-11 items-center justify-center rounded-md text-ink hover:bg-brand-soft disabled:opacity-40";

  return <div className="grid gap-2">
    <div className="flex items-center justify-between gap-2">
      <button type="button" className={navButton} aria-label="Previous month" onClick={() => { moved.current = false; setMonth(shiftMonth(month, -1)); }}><ChevronLeft aria-hidden="true" size={18} /></button>
      <p id={titleId} className="text-body-sm font-bold text-ink" aria-live="polite">{monthTitle.format(utc(firstOf(month)))}</p>
      <button type="button" className={navButton} aria-label="Next month" disabled={nextDisabled} onClick={() => { moved.current = false; setMonth(shiftMonth(month, 1)); }}><ChevronRight aria-hidden="true" size={18} /></button>
    </div>
    <table ref={grid} role="grid" aria-labelledby={titleId} className="border-collapse text-center" onKeyDown={onKeyDown}>
      <thead><tr>{weekdays.map((day, index) => <th key={day} scope="col" abbr={weekdayNames[index]} className="h-8 text-label font-semibold text-muted">{day}</th>)}</tr></thead>
      <tbody>{weeksOf(month).map((week) => <tr key={week[0]}>{week.map((day) => {
        const outside = monthOf(day) !== month;
        const disabled = day > max;
        const selected = day === value;
        const tabbable = monthOf(focused) === month ? day === focused : day === firstOf(month);
        return <td key={day} role="gridcell" aria-selected={selected} className="p-0.5">
          {outside ? null : <button type="button" data-day={day} tabIndex={tabbable ? 0 : -1} aria-disabled={disabled || undefined} aria-label={dayLabel.format(utc(day))}
            className={`touch-target w-11 rounded-md font-data text-body-sm ${selected ? "bg-brand-soft font-bold text-brand-dark" : "text-ink hover:bg-brand-soft"} ${disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent" : ""}`}
            onClick={() => { if (!disabled) onSelect(day); }}>
            {Number(day.slice(8, 10))}
          </button>}
        </td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}
