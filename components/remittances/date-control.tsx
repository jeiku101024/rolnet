"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { addDays, formatLongDate } from "@/lib/dates/fleet-date";

const control = "touch-target inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-control-border bg-surface px-3 text-body-sm font-semibold text-ink hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface";

/** Previous day, a date button with a calendar, next day and Today (feature 008, FR-003 to FR-007). */
export function DateControl({ date, today, onChange }: { date: string; today: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const isToday = date === today;
  const long = formatLongDate(date);
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" className={`${control} w-11 px-0`} aria-label="Previous day" onClick={() => onChange(addDays(date, -1))}><ChevronLeft aria-hidden="true" size={18} /></button>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={`${control} min-w-0`} aria-label={`Choose date, ${long}`}>
        <CalendarDays aria-hidden="true" size={16} /><span className="truncate">{long}</span><ChevronDown aria-hidden="true" size={16} />
      </PopoverTrigger>
      <PopoverContent>
        <MonthCalendar value={date} max={today} onSelect={(day) => { setOpen(false); if (day !== date) onChange(day); }} />
      </PopoverContent>
    </Popover>
    <button type="button" className={`${control} w-11 px-0`} aria-label="Next day" disabled={isToday} onClick={() => onChange(addDays(date, 1))}><ChevronRight aria-hidden="true" size={18} /></button>
    <button type="button" className={control} disabled={isToday} onClick={() => onChange(today)}>Today</button>
    {isToday ? <span className="status-badge bg-info-soft text-info">Today</span> : null}
  </div>;
}
