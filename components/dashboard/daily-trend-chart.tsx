import { formatPesos } from "@/lib/money/centavos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyCollection } from "@/lib/dashboard/ordering";

/**
 * Payments received per day this month (US5, FR-023), as an inline SVG column chart. The same
 * figures are given as text (total, best day, days with nothing collected) for screen readers.
 */
export function DailyTrendChart({ days, monthLabel }: { days: DailyCollection[]; monthLabel: string }) {
  const total = days.reduce((sum, day) => sum + day.collectedCentavos, 0);
  const best = days.reduce<DailyCollection | null>((top, day) => (!top || day.collectedCentavos > top.collectedCentavos ? day : top), null);
  const emptyDays = days.filter((day) => day.collectedCentavos === 0).length;
  const width = Math.max(days.length, 1) * 10;
  const summary = total ? `${formatPesos(total)} collected in ${monthLabel}. Best day ${best?.date}: ${formatPesos(best?.collectedCentavos ?? 0)}. ${emptyDays} ${emptyDays === 1 ? "day" : "days"} with nothing collected.` : "";
  return <Card className="min-w-0">
    <CardHeader><CardTitle><h3 className="text-section-title font-bold">Daily collections</h3></CardTitle><p className="text-body-sm text-muted">{monthLabel}, payments received each day.</p></CardHeader>
    <CardContent>
      {total ? <figure>
        <p className="font-data text-section-title font-bold">{formatPesos(total)}</p>
        <svg className="mt-3 h-32 w-full text-brand" viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" role="img" aria-label={summary}>
          <line x1="0" y1="100" x2={width} y2="100" className="stroke-rule" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {days.map((day, index) => <rect key={day.date} x={index * 10 + 1} width="8" y={100 - day.heightPct} height={day.heightPct} className="fill-current"><title>{`${day.date}: ${formatPesos(day.collectedCentavos)}`}</title></rect>)}
        </svg>
        <figcaption className="mt-1 flex justify-between font-data text-label text-muted"><span>{days[0]?.date}</span><span>{days.at(-1)?.date}</span></figcaption>
        <p className="mt-2 text-body-sm text-muted">Best day {best?.date}: <span className="font-data text-ink">{formatPesos(best?.collectedCentavos ?? 0)}</span>. {emptyDays} {emptyDays === 1 ? "day" : "days"} with nothing collected.</p>
      </figure> : <p className="py-2 text-body-sm text-muted">No payments received this month yet.</p>}
    </CardContent>
  </Card>;
}
