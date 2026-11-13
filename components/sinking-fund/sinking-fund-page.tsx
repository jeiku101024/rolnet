"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { listHref, type SearchParams } from "@/lib/pagination/list-page";
import { pageContext } from "@/lib/navigation/page-context";
import type { SfPageData } from "@/lib/sinking-fund/queries";
import type { SfPageParams } from "@/lib/sinking-fund/url-state";
import type { SfDistribution, SfLedgerRow, SfLoan, SfParticipantSummary } from "@/lib/sinking-fund/types";
import { ViewToggle } from "@/components/sinking-fund/view-toggle";
import { AddParticipantDialog } from "@/components/sinking-fund/dialogs/add-participant-dialog";
import { AddTransactionDialog, type TransactionDialogInitial } from "@/components/sinking-fund/dialogs/add-transaction-dialog";
import { ChangeInterestPartDialog } from "@/components/sinking-fund/dialogs/change-interest-part-dialog";
import { LoanWithdrawalDialog } from "@/components/sinking-fund/dialogs/loan-withdrawal-dialog";
import { DistributeDialog } from "@/components/sinking-fund/dialogs/distribute-dialog";
import { DistributionHistoryDialog } from "@/components/sinking-fund/dialogs/distribution-history-dialog";
import { FundSettingsDialog } from "@/components/sinking-fund/dialogs/fund-settings-dialog";
import { VoidDialog, type VoidTarget } from "@/components/sinking-fund/dialogs/void-dialog";
import { ArchiveDialog, EditNameDialog } from "@/components/sinking-fund/dialogs/participant-dialogs";
import { ParticipantDetailSheet } from "@/components/sinking-fund/participant-detail-sheet";
import { TransactionsView } from "@/components/sinking-fund/transactions-view";
import { TopView } from "@/components/sinking-fund/top-view";
import { ParticipantsView } from "@/components/sinking-fund/participants-view";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate } from "@/lib/sinking-fund/format";
import { sfTypeLabels } from "@/lib/sinking-fund/types";

type Dialog =
  | { kind: "add-participant" }
  | { kind: "add-transaction"; initial?: TransactionDialogInitial }
  | { kind: "change-interest"; payment: SfLedgerRow }
  | { kind: "loan-withdrawal"; loan: SfLoan }
  | { kind: "distribute" }
  | { kind: "history" }
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
  viewParticipant: (participantId: string) => void;
};

const Context = createContext<SfActions | null>(null);

export function useSfActions() {
  const value = useContext(Context);
  if (!value) throw new Error("useSfActions must be used inside SinkingFundPage");
  return value;
}

/** Primary actions of every view's toolbar (spec section 2): "+ Add participant" and "+ Add transaction". */
export function PrimaryActions() {
  const actions = useSfActions();
  return <div className="flex flex-wrap items-center gap-2">
    <Button type="button" variant="outline" onClick={actions.addParticipant}><Plus aria-hidden="true" size={16} />Add participant</Button>
    <Button type="button" onClick={() => actions.addTransaction()}><Plus aria-hidden="true" size={16} />Add transaction</Button>
  </div>;
}

/** The client shell of /sinking-fund: header, view toggle, the active view, and every dialog. */
export function SinkingFundPage({ data, params, searchParams, isOwner }: { data: SfPageData; params: SfPageParams; searchParams: SearchParams; isOwner: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [dialog, setDialog] = useState<Dialog | null>(null);
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
      if (row.type === "interest_share") {
        const distribution = data.distributions.find((item) => item.id === row.distribution_id);
        if (distribution) setDialog({ kind: "void", target: voidTargetForDistribution(distribution) });
        return;
      }
      setDialog({ kind: "void", target: { kind: "transaction", id: row.id, updatedAt: row.updated_at, summary: `${sfTypeLabels[row.type]} · ${row.participant_name} · ${formatListDate(row.tx_date)} · ${formatPesos(row.amount_centavos)}` } });
    },
    rename: (participant) => setDialog({ kind: "rename", participant }),
    archive: (participant) => setDialog({ kind: "archive", participant }),
    viewParticipant: (participantId) => router.push(listHref(pathname, searchParams, { detail: participantId, hn: null }), { scroll: false }),
  }), [data, isOwner, params, pathname, router, searchParams]);

  const participantFor = (id: string) => data.participants.find((item) => item.participant_id === id);
  const detail = data.detail;

  return <Context.Provider value={actions}>
    <TooltipProvider>
      <section className="workspace">
        <PageHeader eyebrow={pageContext.sinkingFund.eyebrow} title={pageContext.sinkingFund.title}
          action={isOwner ? <Button type="button" variant="outline" onClick={() => setDialog({ kind: "settings" })}><Settings aria-hidden="true" size={16} />Fund settings</Button> : null} />
        <div className="mt-8 grid gap-6">
          <ViewToggle view={params.view} searchParams={searchParams} />
          {params.view === "transactions" ? <TransactionsView /> : params.view === "top" ? <TopView /> : <ParticipantsView />}
        </div>
      </section>

      {detail ? <ParticipantDetailSheet detail={detail} /> : null}

      {dialog?.kind === "add-participant" ? <AddParticipantDialog drivers={data.drivers} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "add-transaction" ? <AddTransactionDialog participants={data.participants} openLoans={data.openLoans} prefill={data.prefill} isOwner={isOwner} today={data.today} initial={dialog.initial} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "change-interest" ? <ChangeInterestPartDialog payment={dialog.payment} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "loan-withdrawal" ? <LoanWithdrawalDialog loan={dialog.loan} participantName={participantFor(dialog.loan.participant_id)?.name ?? ""} savingsCentavos={participantFor(dialog.loan.participant_id)?.savings_centavos ?? 0} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "distribute" ? <DistributeDialog participants={data.participants} availableCentavos={data.summary.interest_available_centavos} today={data.today} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "history" ? <DistributionHistoryDialog distributions={data.distributions} isOwner={isOwner} onVoid={(distribution) => setDialog({ kind: "void", target: voidTargetForDistribution(distribution) })} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "settings" ? <FundSettingsDialog prefill={data.prefill} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "void" ? <VoidDialog target={dialog.target} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "rename" ? <EditNameDialog participant={dialog.participant} open onOpenChange={(open) => !open && close()} /> : null}
      {dialog?.kind === "archive" ? <ArchiveDialog participant={dialog.participant} open onOpenChange={(open) => !open && close()} /> : null}
    </TooltipProvider>
  </Context.Provider>;
}

function voidTargetForDistribution(distribution: SfDistribution): VoidTarget {
  return { kind: "distribution", id: distribution.id, updatedAt: distribution.updated_at, summary: `Distribution on ${formatListDate(distribution.dist_date)} · ${formatPesos(distribution.total_distributed_centavos)} to ${distribution.participant_count} participants` };
}

export function OwnerOnlyNote({ children }: { children: ReactNode }) {
  return <span title="Owner only">{children}</span>;
}
