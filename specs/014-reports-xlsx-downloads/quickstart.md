# Quickstart: validating Reports XLSX Downloads

How to prove the feature works end to end. Layout details live in
[contracts/workbook-layout.md](contracts/workbook-layout.md); endpoints in
[contracts/reports-http.md](contracts/reports-http.md).

## Prerequisites

- Branch `014-reports-xlsx-downloads`, dependencies installed (`corepack pnpm install`).
- Local Supabase is not available on this machine. The migration and pgTAP run against **rolnet-dev**
  with the rollback wrapper, and only after the owner approves it for this feature.
- Excel (desktop) for the open/print checks; a phone for the preview check.

## 1. Automated gates

```bash
corepack pnpm lint
```

```bash
corepack pnpm typecheck
```

```bash
corepack pnpm test
```

Expected: all pass, including

- `report-layout.test.ts`: the spec's worked examples (October 2026 rows 5–59 and formulas; week of
  Oct 26 – Nov 1 rows 5–15; yearly rows 5–24; summary links), a 6-week month (November 2026 starts on
  a Sunday), a week across years (Dec 28, 2026 – Jan 3, 2027), legacy duplicate rows, and an empty period.
- `sheet-names.test.ts`: forbidden characters, apostrophes, 31-character cut, duplicates, "All units",
  natural order rolnet-1, rolnet-2, … rolnet-10, file-name cleaning.
- `report-mocks.test.ts`: generated workbooks from the mock data equal all six mocks (styles, values,
  formulas, merges, widths, heights ±0.5, panes, tab colours, hyperlinks, print setup).
- `report-benchmark.test.ts`: a 100-unit all-units monthly workbook is generated within the budget.
- `financials.test.ts`: deposit = rental − allowance.

## 2. Database (after approval, against rolnet-dev)

Apply `supabase/migrations/20261103000100_report_deposit_rule.sql` and
`supabase/migrations/20261103000200_report_unit_month_totals.sql`, then run
`supabase/tests/constraints/390_report_deposit_rule.sql`, `supabase/tests/constraints/400_report_unit_month_totals.sql`,
and `supabase/tests/rls/250_report_month_totals_rls.sql`
plus the full pgTAP suite through the rollback wrapper. Expected:

- Every remittance's `deposit_centavos = amount_due_centavos − allowance_centavos`, including ones with
  partial or no payments; adding or voiding a payment leaves the deposit unchanged but moves `updated_at`.
- The backfill wrote no `business_audit` rows and did not change `updated_by`.
- `report_unit_month_totals` returns the right sums, excludes deleted rows, is not executable by `anon`,
  and returns nothing for users RLS hides the rows from.

Spot check before/after on two known records with partial payments (old deposit = payments − 40,
new = rental − 40).

## 3. Manual: the Reports page at 360 px

Start the demo build (`demo` config in `.claude/launch.json`, port 3100) and open `/reports` at 360 px.

1. Monthly → October 2026 → All units → Download. A loading label shows, then
   `rolnet-monthly-2026-10-all-units.xlsx` downloads.
2. Single unit → the dropdown lists units in order rolnet-1, rolnet-2, … rolnet-10; pick one →
   `rolnet-monthly-2026-10-rolnet-1.xlsx`.
3. Weekly → pick 2026-10-28 → hint reads "Oct 26 – Nov 1, 2026" → file `rolnet-weekly-2026-10-26-all-units.xlsx`.
4. Yearly → 2026 → `rolnet-yearly-2026-all-units.xlsx`.
5. Stop the network (devtools offline) and Download → error message with Retry; go online and Retry →
   download succeeds.
6. No horizontal scrolling at any step.

## 4. Manual: the files

For each of the six type/scope combinations:

1. Open in Excel desktop: no repair prompt, no `#REF!`/`#NAME?`, tabs in the expected order and
   colours; clicking a unit name on "All units" jumps to that sheet.
2. File → Print: one A4 portrait page per sheet, margins labelled "Narrow", table centered; unit sheets
   repeat rows 1–4.
3. Change one Rental cell: its Deposit, the block subtotal, Net, GRAND TOTAL, and the summary row update.
4. Open the same file from Gmail or Google Drive preview on a phone: all totals show numbers.
5. Cross-check: the weekly rows for Oct 26–31 equal those rows in the October monthly report; the
   yearly October row equals the October monthly GRAND TOTAL for that unit.

## 5. Production check (after deploy)

Download Monthly / All units with about 100 units on the deployed app, on a phone as well as a computer.
Expected: the file is saved in ≤ 10 s, and the data request (`/api/reports/monthly?…`) shows well under the
plan's CPU limit in Workers observability with no "exceeded CPU" (error 1102). The workbook itself is built
in the browser (research R4).

## 6. Remittances consistency

On a Returned card with Rental ₱180.00, type 100: the breakdown shows Allowance ₱40.00 and Deposit
₱140.00. List view and the detail page show ₱140.00 for that record after saving.
