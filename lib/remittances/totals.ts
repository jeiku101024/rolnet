/** Paid, balance and credit for one remittance (data model: balance and credit are never negative). */
export function remittanceTotals(dueCentavos: number, payments: { amount_centavos: number }[] | null | undefined) {
  const paid = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount_centavos), 0);
  return { paid, balance: Math.max(dueCentavos - paid, 0), credit: Math.max(paid - dueCentavos, 0) };
}
