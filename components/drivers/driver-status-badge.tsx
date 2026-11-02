import { CalendarDays, Moon, TriangleAlert } from "lucide-react";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/feedback";
import { statusTodayLabels, type StatusToday } from "@/lib/drivers/absences";
import type { StatusLine } from "@/lib/drivers/list-board";

const badge: Record<StatusToday, { tone: StatusBadgeTone; icon?: typeof Moon }> = {
  active: { tone: "success" },
  day_off: { tone: "info", icon: Moon },
  on_leave: { tone: "info", icon: CalendarDays },
  inactive: { tone: "muted" },
};

/**
 * Status today with its small second lines (feature 012, FR-006, FR-007, FR-052): the leave's end
 * date, "open-ended", "open-ended · checked", or the stale warning; then the next scheduled absence.
 */
export function DriverStatusBadge({ status, line, next }: { status: StatusToday; line?: StatusLine | null; next?: string | null }) {
  const style = badge[status];
  return <div className="grid justify-items-start gap-1">
    <StatusBadge label={statusTodayLabels[status]} tone={style.tone} icon={style.icon} />
    {line ? line.kind === "stale"
      ? <span className={`inline-flex items-center gap-1 text-label font-semibold ${line.level === "red" ? "text-danger" : "text-warn"}`}><TriangleAlert aria-hidden="true" size={12} />{line.text}</span>
      : <span className="text-label text-muted">{line.text}</span> : null}
    {next ? <span className="text-label text-muted">{next}</span> : null}
  </div>;
}
