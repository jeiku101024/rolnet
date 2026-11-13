import { ArrowDownToLine, Banknote, CircleCheck, CircleDot, Coins, DoorOpen, HandCoins, Hourglass, ReceiptText, TriangleAlert, type LucideIcon } from "lucide-react";
import { sfTypeLabels, type SfTransactionType } from "@/lib/sinking-fund/types";

/** Type and status tags always combine icon, text, and colour (spec section 18; DESIGN.md). */

const typeStyles: Record<SfTransactionType, { icon: LucideIcon; className: string }> = {
  deposit: { icon: ArrowDownToLine, className: "bg-ok-soft text-ok" },
  loan: { icon: HandCoins, className: "bg-warn-soft text-warn" },
  payment: { icon: ReceiptText, className: "bg-info-soft text-info" },
  loan_withdrawal: { icon: DoorOpen, className: "bg-danger-soft text-danger" },
  savings_withdrawal: { icon: Banknote, className: "bg-orange-soft text-orange" },
  interest_share: { icon: Coins, className: "bg-violet-soft text-violet" },
};

export function TypeTag({ type }: { type: SfTransactionType }) {
  const { icon: Icon, className } = typeStyles[type];
  return <span className={`status-badge ${className}`}><Icon aria-hidden="true" size={14} />{sfTypeLabels[type]}</span>;
}

type LoanStatus = "open" | "overdue" | "paid" | "withdrawn";
const statusStyles: Record<LoanStatus, { label: string; icon: LucideIcon; className: string }> = {
  open: { label: "Open", icon: Hourglass, className: "bg-info-soft text-info" },
  overdue: { label: "Overdue", icon: TriangleAlert, className: "bg-danger-soft text-danger" },
  paid: { label: "Paid", icon: CircleCheck, className: "bg-ok-soft text-ok" },
  withdrawn: { label: "Withdrawn", icon: CircleDot, className: "bg-canvas text-muted" },
};

export function LoanStatusTag({ status }: { status: LoanStatus }) {
  const { label, icon: Icon, className } = statusStyles[status];
  return <span className={`status-badge ${className}`}><Icon aria-hidden="true" size={14} />{label}</span>;
}

/** A small "Driver" tag for participants linked to a driver record. */
export function DriverTag() {
  return <span className="status-badge bg-canvas text-muted">Driver</span>;
}

export function VoidedTag() {
  return <span className="status-badge bg-canvas text-muted">Voided</span>;
}
