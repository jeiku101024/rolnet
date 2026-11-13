"use client";

import { markLoanWithdrawal } from "@/app/actions/sinking-fund";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ValidationSummary } from "@/components/ui/form-field";
import { useSfSubmit } from "@/components/sinking-fund/form-kit";
import { formatPesos } from "@/lib/money/centavos";
import { formatListDate } from "@/lib/sinking-fund/format";
import { sfMessages } from "@/lib/sinking-fund/messages";
import type { SfLoan } from "@/lib/sinking-fund/types";

/** "Mark this loan as withdrawal?" (spec section 8), owner only, overdue loans only. Savings do not change. */
export function LoanWithdrawalDialog({ loan, participantName, savingsCentavos, open, onOpenChange }: { loan: SfLoan; participantName: string; savingsCentavos: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useSfSubmit(() => onOpenChange(false));
  const rows: [string, string][] = [
    ["Participant", participantName],
    ["Loan date", formatListDate(loan.loan_date)],
    ["Principal", formatPesos(loan.principal_centavos)],
    ["Amount due", formatPesos(loan.amount_due_centavos)],
    ["Paid so far", `${formatPesos(loan.interest_paid_centavos)} interest · ${formatPesos(loan.principal_paid_centavos)} principal`],
    ["Unpaid principal", formatPesos(loan.unpaid_principal_centavos)],
    ["Unpaid interest (to be waived)", formatPesos(loan.unpaid_interest_centavos)],
    ["Total savings after", `${formatPesos(savingsCentavos)} (unchanged)`],
  ];
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title="Mark this loan as withdrawal?" description="The loan is closed. The unpaid principal stays withdrawn from savings, and the unpaid interest is waived.">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-sm">
        {rows.map(([label, value]) => <div key={label} className="contents"><dt className="text-muted">{label}</dt><dd className="text-right">{value}</dd></div>)}
      </dl>
      <ValidationSummary message={form.failure} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button type="button" variant="destructive" disabled={form.pending}
          onClick={() => form.submit(() => markLoanWithdrawal({ loanId: loan.id, expectedBalanceCentavos: loan.balance_centavos }), () => sfMessages.loanClosed)}>
          {form.pending ? "Saving…" : "Mark as withdrawal"}
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}
