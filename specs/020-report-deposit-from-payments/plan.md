# Implementation Plan: Report Deposit From Payments

**Branch**: `020-report-deposit-from-payments` (to be cut after feature 019 is committed) | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/020-report-deposit-from-payments/spec.md`

## Summary

Make the Weekly, Monthly and Yearly remittance workbooks show the Deposit the app already stores (payments received minus allowance) instead of recomputing Rental minus Allowance, and add a "Notes" column to the Weekly and Monthly unit sheets that records payments received after the service date. Approach (see [research.md](research.md)): the database already keeps `remittances.deposit_centavos` up to date from non-voided payments (migration `20261103000300`), so the daily reports only need to read it; the yearly report needs one new database function version that also sums it per month. Daily Deposit cells become plain numbers (they are recorded data, no longer derivable from the sheet's own columns), subtotals, grand totals, the yearly rows and the All units summary stay live sums. Late payments come from the payments that are embedded in the same remittance read, so no extra request is made. No new dependency.

## Technical Context

**Language/Version**: TypeScript 5, React 19.3, Next.js 16.4.6 (App Router, Cache Components)

**Primary Dependencies**: Existing only: the in-house `.xlsx` writer (`lib/reports/xlsx.ts`), Supabase client. No new packages.

**Storage**: Supabase Postgres. One new migration replaces the read function `report_unit_month_totals(date, date)` with a version that also returns `deposit_centavos`. No table or column changes.

**Testing**: Vitest (layout, summary, payload, mock comparison, late-note helper), pgTAP for the function

**Target Platform**: Mobile-first web; Cloudflare Workers build via vinext; workbooks are built in the browser

**Project Type**: Single Next.js web application (monolith)

**Performance Goals**: Yearly report for about 100 units no slower than today (still one paged function call); Weekly and Monthly still one remittance read per page of 1,000 rows

**Constraints**: Free tier; money stays integer centavos until written as pesos; everything about the workbooks other than Deposit and the Notes column stays as it is

**Scale/Scope**: About 100 units, up to about 3,100 remittances in a month, one function row per unit and month in a year

## Constitution Check

*GATE: passes before research and again after design.*

| Principle | Result |
|-----------|--------|
| I. Free tier | Pass. No new service or dependency. |
| II. Monolith | Pass. One SQL function version and report code. |
| III. Data integrity | Pass. Read-only. Deposit is the stored, trigger-maintained figure (payments minus allowance); money stays integer centavos; voided payments and deleted remittances are excluded by that rule and by the existing filters. |
| IV. Mobile-first | Not affected (files, not screens). |
| V. Compliance documents | Not applicable. |
| Workflow gates | The function change ships in a new migration with pgTAP; EXECUTE is revoked from `public`, `anon`, `authenticated` and granted to `authenticated` again, because the app calls it. The function stays `security invoker`, so row-level security still decides what a caller sees. A pushed migration is never edited. |

No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/020-report-deposit-from-payments/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── report-data.md
│   └── workbook-layout.md
└── tasks.md            # created later by /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/20261119000200_report_month_deposits.sql   # NEW: drop + recreate report_unit_month_totals with deposit_centavos
└── tests/constraints/460_report_month_deposits.sql       # NEW: pgTAP (plus re-check of 400 and rls/250, unchanged)
types/database.ts                                         # report_unit_month_totals Returns gains deposit_centavos
lib/reports/
├── late-payments.ts            # NEW: fleet-date comparison and the "Received later: ..." note text
├── report-data.ts              # read deposit and embedded payments; yearly reads deposit_centavos
├── report-layout.ts            # Deposit from data, new Notes column, sums of deposits, totals
├── summary-sheet.ts            # Deposit note text; figures already come from unit totals
├── report-payload.ts           # payload types carry the new fields (no logic change)
└── build-report.ts             # no change expected (confirm)
tests/
├── unit/                       # layout, summary, late-payments, payload, mock comparison updated
├── fixtures/report-golden.json # refreshed once, for the intended differences only
└── e2e/remittance-financials.spec.ts   # report download assertions that read Deposit cells
docs/DEVELOPMENT.md             # Reports section: Deposit rule and Notes column
```

**Structure Decision**: Single Next.js project; the change stays inside `lib/reports`, one migration, and tests. No component or route changes: the downloads still go through the existing routes and the browser-side builder.

## Design Notes

1. **Where Deposit comes from.** `remittances.deposit_centavos` is maintained by trigger as non-voided payments minus allowance and backfilled by migration `20261103000300`. It is what the Daily card and List view show, so reading it makes FR-006 (reports equal the List view) true by construction.
2. **Weekly and Monthly read.** `loadDailyData` selects `deposit_centavos` and embeds the remittance's non-deleted payments (`paid_at`, `amount_centavos`) in the same query; a second query would need thousands of ids. Demo mode uses the demo rows' `deposit_centavos` and has no `paid_at`, so demo reports show no notes.
3. **Late payments.** A payment is late when its fleet-time-zone date is after the remittance's service date. `late-payments.ts` turns the list into text such as `Received later: ₱180.00 on Nov 22` for one payment, or `Received later: 3 payments, ₱540.00 (last Nov 22)` for several, so the text always fits the fixed-height cell. Dates use the fleet time zone through the existing `fleetToday`-style helper, so a payment taken at 23:30 Manila time is not mistaken for the next UTC day.
4. **Yearly read.** A new migration drops and recreates `report_unit_month_totals` adding `deposit_centavos = sum(remittances.deposit_centavos)` per unit and month. `create or replace` cannot change a function's return columns, so the old signature is dropped first. Existing callers read columns by name, so they keep working. Grants and `security invoker` are restored.
5. **Layout.** Weekly and Monthly unit sheets go from 5 to 6 columns: a "Notes" column after Allowance, text style, left aligned, about 44 wide. The title band and subtitle merges widen to six columns (the header builder already derives them from the header count). Subtotal and grand-total rows shade the sixth cell in the band style, with no value. Yearly and the summary sheet keep their columns.
6. **Formulas.** Daily and yearly month Deposit cells are values (they were `C-E` / `B-D` formulas). Every subtotal, grand total, summary link and Net stays a live formula with cached value. This is the one place the "live formulas" convention narrows: a cell that holds recorded data cannot be a formula of the sheet's own columns.
7. **Totals.** Block totals add the Deposit values; `depositCentavos` in `UnitTotals` is the sum instead of `rental - allowance`; Net is still Allowance minus Expenses.
8. **Summary notes.** The note lines that say "Deposit = Rental - Allowance" are replaced with the new rule in plain words.
9. **Regression tests.** `report-mocks.test.ts` compares the generated files with the client's six mock workbooks. It gets a short, explicit list of expected differences (the Notes column, plain-number Deposit cells, the Deposit note text) and keeps comparing everything else. The 019 golden hashes are refreshed once, after the unit tests show only the intended differences.

## Risks and Notes

- The `depositOf` fallback (Rental minus Allowance when a payload lacks `depositCentavos`) is a transition guard only, for an old cached browser bundle after a deploy; every current payload carries the real deposit.
- Implementation is blocked until feature 019 is committed and branch 020 is cut from it.

- Dropping and recreating a function in production needs a new pushed migration and the owner's go-ahead to run pgTAP (project rule). Between drop and create nothing can call it, because both run in one migration transaction.
- The stored deposit is the reference. If any record's stored deposit were wrong, the report would repeat it; the backfill in `20261103000300` corrected every record and the trigger keeps it right.
- Weekly and Monthly now embed payments, so each page of 1,000 rows is a little larger. A month for 100 units is about 3,100 rows with at most a few payments each.
- The e2e report tests assume demo data; their Deposit expectations must be checked against demo rows (deposit is payments minus 4000 there).

## Complexity Tracking

No constitution violations to justify.
