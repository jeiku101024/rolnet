# Research: Report Deposit From Payments

All decisions come from reading the current code and migrations. No NEEDS CLARIFICATION items remain.

## R1. Where the right Deposit already exists

- **Decision**: Use `remittances.deposit_centavos`. Migration `20261103000300_restore_payments_deposit_rule.sql` restored the rule "non-voided payments minus allowance", made the trigger `remittances_set_deposit` recalculate it from `remittance_payments` (ignoring rows with `deleted_at`), and backfilled every record. Payment inserts, voids and updates touch the parent row (`20261031000100`, lines 122 to 124), so the stored figure never lags.
- **Rationale**: It is exactly what the Daily card and List view show, so the report matches by reading the same column. No new calculation to keep in sync.
- **Alternatives**: Summing payments in the app (duplicates the rule, needs a payments read for every remittance); a new SQL function for the daily reports (unneeded).

## R2. History of the rule

- `20261103000100_report_deposit_rule.sql` (feature 014) made the stored deposit Rental minus Allowance so the app matched the report; `20261103000300` reversed that after the owner decided the app should follow payments. The report code (`report-layout.ts`) was never updated, which is the defect: it still writes `Rental - Allowance`. The old migrations stay as they are.

## R3. Daily reports (Weekly and Monthly)

- **Decision**: `loadDailyData` adds `deposit_centavos` to its select and embeds non-deleted payments: `remittance_payments(paid_at, amount_centavos)` filtered with `.is("remittance_payments.deleted_at", null)`. Demo mode reads `deposit_centavos` from the demo rows (they carry it) and has no `paid_at`.
- **Rationale**: One read per page, same ordering and paging as today. A separate payments query would need an `in (...)` list of thousands of ids.
- **Alternatives**: A second paged read of payments by date range (payments by `paid_at` do not map cleanly to the remittances of the range).

## R4. Yearly report

- **Decision**: A new migration `20261119000200_report_month_deposits.sql` does `drop function public.report_unit_month_totals(date, date)` and recreates it with the same body plus `sum(deposit_centavos)::bigint as deposit_centavos` in the remittance CTE and result. Keep `security invoker`, `stable`, `set search_path = public`; restore `revoke all ... from public, anon, authenticated` and `grant execute ... to authenticated`.
- **Rationale**: `create or replace function` cannot change the output columns. Existing tests and the TypeScript caller use columns by name, so appending one is compatible. The function stays `security invoker`, so row-level security still limits what a caller sees.
- **Alternatives**: A second function for deposits (two calls per report); computing yearly deposit in the app from daily rows (about 36,500 rows, which the original design rejected).

## R5. Late payment notes

- **Decision**: A payment is late when `fleetDate(paid_at) > service_date`. The fleet date uses the fleet time zone (`NEXT_PUBLIC_FLEET_TIMEZONE`, default Asia/Manila), the same helper `fleetToday` uses. Text: `Received later: ₱180.00 on Nov 22` for one payment; `Received later: 3 payments, ₱540.00 (last Nov 22)` for several (count, total, latest date), because the daily rows have a fixed height and the cell does not wrap. Amounts via `formatPesos`, dates via `formatShortDate`.
- **Rationale**: Matches the spec example and the app's date wording. A payment at 23:30 Manila time stays on its own day.
- **Alternatives**: UTC dates (wrong around midnight in Manila); including all payments in the note (the spec asks only for late ones).
- **Not late**: payments dated on or before the service date, including same-day payments (clarified in the spec's assumptions).

## R6. Sheet layout with the Notes column

- **Decision**: Add a sixth column "Notes" after Allowance on the Weekly and Monthly unit sheets: header `headText`, cells `text` style, width 44. `headerRows` already derives its merges from the header count, so the title and subtitle merges widen to `A1:F1`, `A2:F2`. Subtotal and grand-total rows get a blank `subAmount` or `grandAmount` cell in column F so the shaded band is continuous. The Expenses, Allowance and Net lines stay in columns A to C.
- **Rationale**: Keeps the existing columns and their order untouched (FR-009) and adds the one requested column. Print stays one page wide because the sheet is scaled to fit width.
- **Alternatives**: A cell comment (the owner chose a column); a footnote line (the owner chose a column).

## R7. Formulas versus values

- **Decision**: Daily and yearly-month Deposit cells become plain numbers. All subtotals, grand totals, yearly subtotals, summary links and Net stay live formulas with cached values.
- **Rationale**: Deposit is now recorded data (payments minus allowance). It cannot be a formula of Rental and Allowance on the same row without lying about unpaid days.
- **Alternatives**: A hidden Paid column feeding the formula (extra column, out of scope); keeping the formula and showing the wrong figure (the defect).

## R8. Summary sheet

- **Decision**: No structural change. `UnitTotals.depositCentavos` is now the sum of Deposit values, so the "All units" figures, which link to each unit sheet's total cell, follow automatically. Only the explanatory note lines change (the text that says "Deposit = Rental - Allowance, whatever was paid that day").

## R9. Regression tests

- **Decision**: `report-mocks.test.ts` keeps comparing the generated files with the six mock workbooks, with an explicit allow-list of differences: the Notes column (widths, merges, column F cells), Deposit cells being plain numbers, and the Deposit note lines. The 019 golden fixture is refreshed in one commit after the unit tests pass, recording the new hashes.
- **Rationale**: The mocks encode the old rule; deviations must be named so nothing else drifts silently.

## R10. Fixtures and mock data

- The mock-data fixture (`tests/fixtures/reports/mock-data.json`) has rental and allowance only. Test helpers set `depositCentavos = rental - allowance` (paid in full) so cached values still equal the mocks. New tests add unpaid, part-paid and late-paid cases.
