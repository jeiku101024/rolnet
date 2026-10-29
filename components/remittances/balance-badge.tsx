import { formatPesos } from "@/lib/money/centavos";
import { StatusBadge } from "@/components/ui/feedback";

/** Shows what a remittance still owes, or the credit when it was overpaid (FR-015). */
export function BalanceBadge({ balance, credit }: { balance: number; credit: number }) {
  if (credit) return <StatusBadge label={`Credit ${formatPesos(credit)}`} tone="success" />;
  return <StatusBadge label={balance ? `Owes ${formatPesos(balance)}` : "Paid"} tone={balance ? "warning" : "success"} />;
}
