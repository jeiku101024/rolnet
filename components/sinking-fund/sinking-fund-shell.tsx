"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DownloadReportButton } from "@/components/reports/download-report-button";
import { StandingsDownloadForm } from "@/components/reports/standings-download-form";
import type { SearchParams } from "@/lib/pagination/list-page";
import type { SfPageData } from "@/lib/sinking-fund/queries";
import type { SfPageParams } from "@/lib/sinking-fund/url-state";
import type { SfDistribution, SfLedgerRow, SfLoan, SfParticipantSummary } from "@/lib/sinking-fund/types";
import { AddParticipantDialog } from "@/components/sinking-fund/dialogs/add-participant-dialog";
import { AddTransactionDialog, type TransactionDialogInitial } from "@/components/sinking-fund/dialogs/add-transaction-dialog";
import { ChangeInterestPartDialog } from "@/components/sinking-fund/dialogs/change-interest-part-dialog";
import { LoanWithdrawalDialog } from "@/components/sinking-fund/dialogs/loan-withdrawal-dialog";
import { DistributeDialog } from "@/components/sinking-fund/dialogs/distribute-dialog";
import { DistributionHistoryDialog } from "@/components/sinking-fund/dialogs/distribution-history-dialog";
import { DistributionDetailsDialog } from "@/components/sinking-fund/dialogs/distribution-details-dialog";
import { FundSettingsDialog } from "@/components/sinking-fund/dialogs/fund-settings-dialog";
import { VoidDialog, type VoidTarget } from "@/components/sinking-fund/dialogs/void-dialog";
import { ArchiveDialog, EditNameDialog } from "@/components/sinking-fund/dialogs/participant-dialogs";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate } from "@/lib/sinking-fund/format";
import { sfTypeLabels } from "@/lib/sinking-fund/types";
import { participantHref } from "@/lib/sinking-fund/url-state";

export type SfDialog =
  | { kind: "add-participant" }
  | { kind: "add-transaction"; initial?: TransactionDialogInitial }
  | { kind: "change-interest"; payment: SfLedgerRow }
  | { kind: "loan-withdrawal"; loan: SfLoan }
  | { kind: "distribute" }
  | { kind: "history" }
  | { kind: "distribution-details"; distribution: SfDistribution }
  | { kind: "settings" }
  | { kind: "void"; target: VoidTarget }
  | { kind: "rename"; participant: SfParticipantSummary }
  | { kind: "archive"; participant: SfParticipantSummary };

export type SfActions = {
  isOwner: boolean;
  data: SfPageData;
  params: SfPageParams;
  searchParams: SearchParams;
  addParticipant: () => void;
  addTransaction: (initial?: TransactionDialogInitial) => void;
  changeInterest: (payment: SfLedgerRow) => void;
  loanWithdrawal: (loan: SfLoan) => void;
  distribute: () => void;
  history: () => void;
  voidRow: (row: SfLedgerRow) => void;
  rename: (participant: SfParticipantSummary) => void;
  archive: (participant: SfParticipantSummary) => void;
  openSettings: () => void;
  /** Opens the participant's own page; Back returns to the screen the owner came from (feature 021). */
  viewParticipant: (participantId: string) => void;
};

const Context = createContext<SfActions | null>(null);

export function useSfActions() {
  const value = useContext(Context);
  if (!value) throw new Error("useSfActions must be used inside SinkingFundShell");
  return value;
}

/** Primary actions of every view's toolbar (spec section 2): "+ Add participant" and "+ Add transaction". */
export function PrimaryActions() {
  const actions = useSfActions();
  return <div className="flex flex-wrap items-center gap-2">
    <Button type="button" variant="outline" onClick={actions.addParticipant}><Plus aria-hidden="true" size={16} />Add participant</Button>
    <Button type="button" onClick={() => actions.addTransaction()}><Plus aria-hidden="true" size={16} />Add transaction</Button>
    {actions.isOwner ? <DownloadReportButton label="Download monthly standings" title="Monthly standings"><StandingsDownloadForm years={actions.data.standingsYears} /></DownloadReportButton> : null}
  </div>;
}

export function voidTargetForDistribution(distribution: SfDistribution): VoidTarget {
  return { kind: "distribution", id: distribution.id, updatedAt: distribution.updated_at, summary: `Distribution on ${formatListDate(distribution.dist_date)} · ${formatPesos(distribution.total_distributed_centavos)} shared by savings among ${distribution.participant_count} participant${distribution.participant_count === 1 ? "" : "s"}` };
}

/**
 * The actions and dialogs every Sinking fund screen shares (feature 021): /sinking-fund and a participant's own page both
 * render inside it, so Add transaction, Withdraw, Void, and the loan dialogs behave the same on each.
 */
export function SinkingFundShell({ data, params, searchParams, isOwner, children }: { data: SfPageData; params: SfPageParams; searchParams: SearchParams; isOwner: boolean; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [dialog, setDialog] = useState<SfDialog | null>(null);
  const close = () => setDialog(null);

  const actions = useMemo<SfActions>(() => ({
    isOwner, data, params, searchParams,
    addParticipant: () => setDialog({ kind: "add-participant" }),
    addTransaction: (initial) => setDialog({ kind: "add-transaction", initial }),
    changeInterest: (payment) => setDialog({ kind: "change-interest", payment }),
    loanWithdrawal: (loan) => setDialog({ kind: "loan-withdrawal", loan }),
    distribute: () => setDialog({ kind: "distribute" }),
    history: () => setDialog({ kind: "history" }),
    voidRow: (row) => {
      if (row.type === "interest_share" || row.type === "cycle_close") {
        const distribution = data.distributions.find((item) => item.id === row.distribution_id);
        if (distribution) setDialog({ kind: "void", target: voidTargetForDistribution(distribution) });
        return;
      }
      setDialog({ kind: "void", target: { kind: "transaction", id: row.id, updatedAt: row.updated_at, summary: `${sfTypeLabels[row.type]} · ${row.participant_name} · ${formatListDate(row.tx_date)} · ${formatPesos(row.amount_centavos)}` } });
    },
    rename: (participant) => setDialog({ kind: "rename", participant }),
    archive: (participant) => setDialog({ kind: "archive", participant }),
    openSettings: () => setDialog({ kind: "settings" }),
    viewParticipant: (id) => {
      const query = typeof window === "undefined" ? "" : window.location.search;
      router.push(participantHref(id, pathname === "/sinking-fund" ? query : ""));
    },
  }), [data, isOwner, params, searchParams, router, pathname]);

  const participantFor = (id: string) => data.participants.find((item) => item.participant_id === id);

  return <Context.Provider value={actions}>
    <TooltipProvider>
      {children}
      {dialog?.kind === "add-participant" ? <AddParticipantDialog drivers={data.drivers} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "add-transaction" ? <AddTransactionDialog participants={data.participants} openLoans={data.openLoans} prefill={data.prefill} isOwner={isOwner} today={data.today} initial={dialog.initial} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "change-interest" ? <ChangeInterestPartDialog payment={dialog.payment} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "loan-withdrawal" ? <LoanWithdrawalDialog loan={dialog.loan} participantName={participantFor(dialog.loan.participant_id)?.name ?? ""} savingsCentavos={participantFor(dialog.loan.participant_id)?.savings_centavos ?? 0} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "distribute" ? <DistributeDialog participants={data.participants} openLoans={data.openLoans} availableCentavos={data.summary.interest_available_centavos} today={data.today} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "history" ? <DistributionHistoryDialog distributions={data.distributions} onOpenDetails={(distribution) => setDialog({ kind: "distribution-details", distribution })} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "distribution-details" ? <DistributionDetailsDialog distribution={dialog.distribution} onVoid={(distribution) => setDialog({ kind: "void", target: voidTargetForDistribution(distribution) })} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "settings" ? <FundSettingsDialog prefill={data.prefill} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "void" ? <VoidDialog target={dialog.target} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "rename" ? <EditNameDialog participant={dialog.participant} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "archive" ? <ArchiveDialog participant={dialog.participant} open onOpenChange={(open) => !open && close()} /> : null}
    </TooltipProvider>
  </Context.Provider>;
}
