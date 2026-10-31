/** Paid and balance for one remittance. Balance is never negative; payments can't exceed the rental (feature 009). */
export function remittanceTotals(dueCentavos: number, payments: { amount_centavos: number }[] | null | undefined) {
  const paid = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount_centavos), 0);
  return { paid, balance: Math.max(dueCentavos - paid, 0) };
}
