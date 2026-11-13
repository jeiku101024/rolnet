"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { VoidedTag } from "@/components/sinking-fund/type-tag";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate } from "@/lib/sinking-fund/format";
import type { SfDistribution } from "@/lib/sinking-fund/types";

/** "View history" on the Interest fund card: past distributions (date, total, per participant, how many). */
export function DistributionHistoryDialog({ distributions, isOwner, onVoid, open, onOpenChange }: { distributions: SfDistribution[]; isOwner: boolean; onVoid: (distribution: SfDistribution) => void; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title="Distribution history" description="Each distribution shares the Interest fund equally and adds the shares to savings.">
      {distributions.length === 0 ? <p className="text-body-sm text-muted">No distributions yet.</p> : <ul className="grid divide-y divide-rule">
        {distributions.map((distribution) => <li key={distribution.id} className="grid gap-1 py-3 text-body-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{formatListDate(distribution.dist_date)}{distribution.voided_at ? <> <VoidedTag /></> : null}</span>
            <span className={distribution.voided_at ? "line-through" : undefined}>{formatPesos(distribution.total_distributed_centavos)}</span>
          </div>
          <p className="text-muted">{formatPesos(distribution.per_participant_centavos)} each to {distribution.participant_count} participant{distribution.participant_count === 1 ? "" : "s"}{distribution.remainder_centavos ? ` · ${formatPesos(distribution.remainder_centavos)} stayed in the fund` : ""}</p>
          {distribution.notes ? <p>{distribution.notes}</p> : null}
          {distribution.voided_at && distribution.void_reason ? <p className="text-muted">Voided: {distribution.void_reason}</p> : null}
          {isOwner && !distribution.voided_at ? <div><Button type="button" variant="outline" onClick={() => onVoid(distribution)}>Void distribution</Button></div> : null}
        </li>)}
      </ul>}
    </DialogContent>
  </Dialog>;
}
