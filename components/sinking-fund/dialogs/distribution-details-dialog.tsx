"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { getDistributionDetails } from "@/app/actions/sinking-fund";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { VoidedTag } from "@/components/sinking-fund/type-tag";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate } from "@/lib/sinking-fund/format";
import type { SfDistribution, SfDistributionDetail } from "@/lib/sinking-fund/types";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; detail: SfDistributionDetail };

/**
 * One distribution (feature 016, owner only): the Sinking fund total for the year, and every participant who took
 * part with the ended total savings saved at the time and the share they received, highest first. Each participant is a
 * stacked row so it reads at 360 px without sideways scrolling. "Download Excel" saves the same table.
 */
export function DistributionDetailsDialog({ distribution, onVoid, open, onOpenChange }: { distribution: SfDistribution; onVoid: (distribution: SfDistribution) => void; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getDistributionDetails({ id: distribution.id })
      .then((result) => { if (live) setState(result.ok ? { status: "ready", detail: result.data } : { status: "error", message: result.message }); })
      .catch(() => { if (live) setState({ status: "error", message: "The details could not be loaded. Try again." }); });
    return () => { live = false; };
  }, [distribution.id, attempt]);

  const detail = state.status === "ready" ? state.detail : null;
  const rows = detail?.rows ?? [];
  const missing = rows.some((row) => row.ended_total_centavos === null);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent fixedHeader title={`Distribution ${distribution.year}`} description={<span className="flex flex-wrap items-center gap-2">{formatListDate(distribution.dist_date)}{distribution.voided_at ? <VoidedTag /> : null}</span>}>
      {distribution.voided_at && distribution.void_reason ? <p className="text-body-sm text-muted">Voided: {distribution.void_reason}</p> : null}

      <dl className="grid grid-cols-2 gap-3" data-testid="sf-dist-figures">
        <div className="col-span-2 rounded-md bg-canvas p-3">
          <dt className="text-label font-bold text-muted">Sinking fund total for the year</dt>
          <dd className="font-data text-xl font-bold" data-testid="sf-dist-year-total">{detail ? detail.totals.ended_total_centavos === null ? "Not recorded" : formatPesos(detail.totals.ended_total_centavos) : "…"}</dd>
        </div>
        <div><dt className="text-label font-bold text-muted">Interest fund distributed</dt><dd className="font-data font-semibold">{formatPesos(distribution.total_distributed_centavos)}</dd></div>
        <div><dt className="text-label font-bold text-muted">Stayed in the fund</dt><dd className="font-data font-semibold">{formatPesos(distribution.remainder_centavos)}</dd></div>
        <div><dt className="text-label font-bold text-muted">Participants</dt><dd className="font-semibold">{distribution.participant_count} took part</dd></div>
        <div><dt className="text-label font-bold text-muted">Received a share</dt><dd className="font-semibold">{distribution.share_count}</dd></div>
      </dl>
      {distribution.notes ? <p className="text-body-sm">{distribution.notes}</p> : null}

      <section aria-label="Participants" className="grid gap-2">
        <h3 className="text-body font-bold">Participants</h3>
        {state.status === "loading" ? <p className="text-body-sm text-muted" role="status">Loading details…</p> : null}
        {state.status === "error" ? <div className="grid gap-2" role="alert">
          <p className="text-body-sm text-danger">{state.message}</p>
          <div><Button type="button" variant="outline" onClick={() => { setState({ status: "loading" }); setAttempt((count) => count + 1); }}>Try again</Button></div>
        </div> : null}
        {detail ? <>
          <ol className="grid border-t border-rule" data-testid="sf-dist-rows">
            {rows.map((row, index) => <li key={row.participant_id} className="grid gap-1 border-b border-rule py-3 text-body-sm" data-testid="sf-dist-row">
              <p className="font-semibold"><span className="font-data text-muted">{index + 1}.</span> {row.participant_name}</p>
              <dl className="grid grid-cols-2 gap-x-3">
                <div><dt className="text-label text-muted">Ended total savings</dt><dd className="font-data font-semibold">{row.ended_total_centavos === null ? "Not recorded" : formatPesos(row.ended_total_centavos)}</dd></div>
                <div><dt className="text-label text-muted">Distributed share</dt><dd className="font-data font-semibold">{formatPesos(row.share_centavos)}</dd></div>
              </dl>
            </li>)}
            <li className="grid gap-1 py-3 text-body-sm font-bold" data-testid="sf-dist-totals">
              <p>Total</p>
              <dl className="grid grid-cols-2 gap-x-3">
                <div><dt className="text-label font-normal text-muted">Ended total savings</dt><dd className="font-data">{detail.totals.ended_total_centavos === null ? "Not recorded" : formatPesos(detail.totals.ended_total_centavos)}</dd></div>
                <div><dt className="text-label font-normal text-muted">Distributed share</dt><dd className="font-data">{formatPesos(detail.totals.share_centavos)}</dd></div>
              </dl>
            </li>
          </ol>
          {missing ? <p className="text-label text-muted">This distribution was made before ended totals were saved, so only the shares are known.</p> : null}
        </> : null}
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        {!distribution.voided_at ? <Button type="button" variant="outline" onClick={() => onVoid(distribution)}>Void distribution</Button> : null}
        <a className="touch-target inline-flex items-center gap-2 rounded-md bg-brand px-4 text-body-sm font-semibold text-surface hover:bg-brand-dark"
          href={`/api/sinking-fund/distributions/${distribution.id}/xlsx`} download>
          <Download aria-hidden="true" size={16} />Download Excel
        </a>
      </div>
    </DialogContent>
  </Dialog>;
}
