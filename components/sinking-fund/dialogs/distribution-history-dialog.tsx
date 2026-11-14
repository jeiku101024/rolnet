"use client";

import { ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { VoidedTag } from "@/components/sinking-fund/type-tag";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate } from "@/lib/sinking-fund/format";
import type { SfDistribution } from "@/lib/sinking-fund/types";

/**
 * "View history" on the Interest fund card (owner only): every distribution, newest first. Each one opens its details
 * (ended total savings and share per participant, the Sinking fund total for the year, and the Excel download).
 */
export function DistributionHistoryDialog({ distributions, onOpenDetails, open, onOpenChange }: { distributions: SfDistribution[]; onOpenDetails: (distribution: SfDistribution) => void; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title="Distribution history" description="Each distribution shares the Interest fund by savings and closes the year. Tap one to see who got what.">
      {distributions.length === 0 ? <p className="text-body-sm text-muted">No distributions yet.</p> : <ul className="grid divide-y divide-rule" data-testid="sf-dist-history">
        {distributions.map((distribution) => <li key={distribution.id}>
          <button type="button" className="touch-target flex w-full items-center justify-between gap-3 py-3 text-left text-body-sm hover:bg-brand-soft" onClick={() => onOpenDetails(distribution)} data-testid="sf-dist-history-item">
            <span className="grid min-w-0 gap-0.5">
              <span className="flex flex-wrap items-center gap-2 font-semibold">{formatListDate(distribution.dist_date)} <span className="font-normal text-muted">· {distribution.year}</span>{distribution.voided_at ? <VoidedTag /> : null}</span>
              <span className="text-muted">{distribution.share_count} received a share{distribution.remainder_centavos ? ` · ${formatPesos(distribution.remainder_centavos)} stayed in the fund` : ""}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1"><span className={`font-data font-semibold ${distribution.voided_at ? "line-through" : ""}`}>{formatPesos(distribution.total_distributed_centavos)}</span><ChevronRight aria-hidden="true" size={16} className="text-muted" /></span>
          </button>
        </li>)}
      </ul>}
    </DialogContent>
  </Dialog>;
}
