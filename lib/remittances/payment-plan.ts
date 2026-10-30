// Feature 008 (FR-027, research R5): what saving an edited card's "Payment received" total does.
// Raising it adds one payment for the difference (anyone); lowering it is an owner correction that
// voids the active payments and records the new total; staff cannot lower it.

export type PaymentChange =
  | { kind: "none" }
  | { kind: "add"; amountCentavos: number }
  | { kind: "replace"; targetCentavos: number }
  | { kind: "blocked" };

export function planPaymentChange({ currentCentavos, targetCentavos, isOwner }: { currentCentavos: number; targetCentavos: number; isOwner: boolean }): PaymentChange {
  if (!Number.isInteger(targetCentavos) || targetCentavos < 0) throw new Error("Enter an amount like 180 or 180.50.");
  if (targetCentavos === currentCentavos) return { kind: "none" };
  if (targetCentavos > currentCentavos) return { kind: "add", amountCentavos: targetCentavos - currentCentavos };
  return isOwner ? { kind: "replace", targetCentavos } : { kind: "blocked" };
}
