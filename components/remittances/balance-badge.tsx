import { formatPesos } from "@/lib/money/centavos";
import { StatusBadge } from "@/components/ui/feedback";

/** Shows what a remittance still owes, or "Paid" (FR-008: there is no credit). */
export function BalanceBadge({ balance }: { balance: number }) {
  return <StatusBadge label={balance ? `Owes ${formatPesos(balance)}` : "Paid"} tone={balance ? "warning" : "success"} />;
}
