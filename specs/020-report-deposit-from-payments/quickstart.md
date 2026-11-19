# Quickstart: validating Report Deposit From Payments

## Prerequisites

- Feature 019 committed and branch `020-report-deposit-from-payments` cut from it.
- `corepack pnpm install`
- Demo mode for download checks: `NEXT_PUBLIC_DEMO_MODE=true` (run it on a server other than the live `:3000` one, because Next allows one dev server per folder).
- For the database function: the new migration applied to the dev database and pgTAP run (ask the owner first; there is no local Supabase).

## Automated checks

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm check
corepack pnpm test:e2e
```

Expected: all pass. New or changed unit tests cover Deposit from data (unpaid, part-paid, paid, over-time), late-payment note text and the fleet-date boundary, the Notes column and widened bands, totals and Net, the summary figures and note lines, the yearly months, the payload fallback for old shapes, the mock comparison with its named differences, and the refreshed golden hashes.

## Manual scenarios

1. **The reported case.** For a unit with a returned, unpaid remittance (Rental ₱180, Allowance ₱40), download the Monthly report for that unit. The row shows Rental ₱180.00, Allowance ₱40.00 and Deposit -₱40.00 in red, matching the Daily card (Payment received ₱0.00, Deposit -₱40.00).
2. **Part and full payment.** A remittance with ₱100 paid shows Deposit ₱60.00. One paid in full shows ₱140.00.
3. **Subtotals and Net.** The week subtotal and grand total Deposit equal the sum of the rows above. Net still equals Allowance minus Expenses.
4. **List view match.** For the same month and unit, add up the Deposit column of the Remittances List view: it equals the unit sheet's Deposit total, the All units row, and (for the year) that month's row on the Yearly sheet.
5. **Late payment.** Record a ₱180 payment today for a remittance dated earlier. Download the report: the earlier row's Deposit includes it and its Notes cell reads `Received later: ₱180.00 on <today>`. A same-day payment has no note.
6. **Voided payment.** Void or lower a payment as the owner; download again: Deposit follows the payments that still count and the note for a voided late payment is gone.
7. **Yearly and summary.** Download the Yearly report: month Deposit cells are numbers, subtotal and grand total are sums, and the All units summary agrees with the unit sheets. The explanatory notes describe the new rule.
8. **Layout.** In Excel print preview the Weekly and Monthly sheets are A4 portrait, Narrow margins, one page wide, with the extra Notes column inside the width; the title band spans all six columns.
9. **Unchanged parts.** File names, sheet order, fonts, colors and number formats match the previous files; Yearly and the summary have no Notes column.
10. **Performance.** The Yearly report for the full demo fleet and a 100-unit synthetic fleet is ready in about the same time as before (the benchmark test in `tests/unit/report-benchmark.test.ts` still passes).
