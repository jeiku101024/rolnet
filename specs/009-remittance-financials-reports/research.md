# Research: Remittance Financials and XLSX Reports

Each entry gives a decision, why it was chosen, and the alternatives considered.

## R1. Keeping Deposit equal to the payments: database triggers

- **Decision**: Add two columns to `remittances`:
  - `allowance_centavos bigint not null default 4000`, which must be at least 0
  - `deposit_centavos bigint not null default -4000`

  Then add two triggers:
  - **A `remittances` BEFORE INSERT OR UPDATE trigger** `remittances_set_deposit`. It sets `new.deposit_centavos := coalesce(active payments total, 0) - new.allowance_centavos`, so a client can never write a wrong deposit. On insert it also forces `new.allowance_centavos := 4000`, inlined in the trigger (a helper function would need `authenticated` EXECUTE, because the trigger runs as the caller). It matches `ALLOWANCE_CENTAVOS` in `lib/remittances/financials.ts`.
  - **A `remittance_payments` AFTER INSERT OR UPDATE trigger** `remittance_payments_sync_deposit`. Soft deletes are updates, and hard deletes are already rejected. It runs `update remittances set deposit_centavos = deposit_centavos where id = new.remittance_id`, which re-runs the BEFORE trigger. It also covers an `old.remittance_id` that differs.

  Both new trigger functions are `security invoker`, so the parent update runs under the caller's RLS (staff use `remittances_operational_update_policy`). `validate_remittance_payment()` keeps its existing `security definer`.

  Extend `lock_remittance_financial_facts()` so `allowance_centavos` can't change after insert, except in the migration's backfill (R2).

  **Accepted edge case:** voiding a payment on a reversed remittance may not refresh that remittance's stored deposit if the caller's RLS hides reversed rows from the touch update. It is harmless, because reversed remittances are excluded from the Daily view, List view totals, and reports.
- **Rationale**: Payments are written from four places: the Daily view actions, the details page's `addRemittancePayment`, the API's `POST /remittances/{id}/payments` (generic `createRow`), and `correct_remittance_payment`. Only the database sees all of them, and the trigger runs inside the payment's own transaction, so payment and deposit are always atomic (constitution III). Recalculating in the BEFORE trigger, instead of adding a delta, means the stored value is always the formula's result, even after a missed event.
- **Alternatives**: A view or generated column, which isn't possible because the deposit depends on another table, and the spec wants it stored. Computing it in app actions would miss the API and RPC paths. A delta update (`deposit += amount`) is fragile with restores and voids.

## R2. Backfill without rewriting history

- **Decision**: The migration adds the columns, then backfills:
  - `alter table remittances disable trigger remittances_audit_fields`
  - `alter table remittances disable trigger remittances_business_audit`
  - `alter table remittances disable trigger remittances_lock_financial_facts`
  - `update remittances r set allowance_centavos = 4000, deposit_centavos = coalesce(p.total, 0) - 4000 from (…active payment totals…)`, for every row including reversed ones, so the figures stay consistent if one is restored
  - re-enable all three, then create the new deposit triggers

  It all runs inside the migration's transaction.
- **Rationale**: FR-016 says nothing else changes. With the triggers enabled, every row would get a new `updated_at` and `updated_by = null`, plus an audit event per row, which would hide real history. Disabling triggers by name inside one transaction is atomic and leaves the no-hard-delete trigger alone.
- **Alternatives**: Running the update with all triggers on, which pollutes `updated_at` and audit. `session_replication_role = replica`, which disables every trigger and needs elevated rights.

## R3. No payment above the rental: checked in the database, with legacy overpayments kept

- **Decision**: Replace `validate_remittance_payment()`. On INSERT, and on an UPDATE that restores a voided payment or changes its amount, it locks the parent with `select … from remittances where id = new.remittance_id and deleted_at is null for update` and sums the other active payments. If `others + new.amount_centavos > amount_due_centavos` it raises `23514` with a ready-to-show message: `Payment can't exceed the rental of ₱180.00. At most ₱80.00 more can be recorded.` (amounts via `to_char(x / 100.0, 'FM999,999,990.00')`). Existing overpaid records keep their payments, and any new payment on them fails because `others` already exceeds the rental. The app shows the message as-is (`databaseFailure` passes our own 23514 messages through).
- **Client checks**:
  - The Daily view card blocks before calling, with "Payment can't exceed the rental of ₱180.00" (FR-007).
  - The details page's payment form checks `amount ≤ balance` with the same message.
  - The Zod schemas add no rental-aware rule, because the database is the authority.
- **Rationale**: Same reasoning as R1, and the row lock stops two concurrent payments from both passing the check.
- **Alternatives**: A check constraint, which can't see other rows. App-only validation, which the API path bypasses.

## R4. XLSX generation: an in-repo writer

- **Decision**: `lib/reports/xlsx.ts` turns a small sheet model (`{ name, columns: { width }[], frozenRows, rows: Cell[][], merges? }`, where each `Cell` is `{ value: number | string | null, formula?: string, style: StyleKey }`) into an .xlsx file. The file holds:
  - `[Content_Types].xml`
  - `_rels/.rels`
  - `xl/workbook.xml` with `<calcPr fullCalcOnLoad="1"/>`
  - `xl/_rels/workbook.xml.rels`
  - `xl/styles.xml`, with fixed fonts, fills, borders, number formats, and cellXfs per `StyleKey`
  - `xl/worksheets/sheet1.xml`, with `<sheetViews>` holding a frozen pane at A2, `<cols>` widths, and inline strings `t="inlineStr"`, so there's no shared-strings part
  - `docProps/app.xml` and `docProps/core.xml`

  These are zipped with the STORE method: local headers, a central directory, and CRC-32 from a 256-entry table, all as `Uint8Array`. Formula cells carry both `<f>` and a cached `<v>` computed in TS, so previews that don't recalculate (mobile viewers, email) still show totals.
- **Rationale**: About 250 lines, no dependency, and only Web APIs, so it runs in the Cloudflare Worker and in Vitest. Every client formatting rule maps directly to a style. Excel, LibreOffice, Google Sheets, and Numbers all accept stored (uncompressed) zip entries, and the files stay small (a year is about 4,400 rows, a few hundred KB).
- **Alternatives**: ExcelJS, which is feature-complete but large and depends on Node `stream`, `Buffer`, and `jszip`, so it adds Worker bundle and compat risk. SheetJS Community Edition, whose free build doesn't write styles. `write-excel-file`, which lacks the needed border styles and cached formula values. A client-side generation path, which moves money logic into the browser and duplicates the server queries.

## R5. Number formats and styles

- **Decision**: These number formats are used:

  | Used for | Format |
  |----------|--------|
  | Weekly and Monthly whole pesos | `#,##0;[Red]-#,##0` |
  | Amounts with centavos (chosen per cell when `value % 1 !== 0`; formula cells follow their cached value) | `#,##0.00;[Red]-#,##0.00` |
  | Yearly | `#,##0;[Red]-#,##0;"-"` (zero shows "-") |

  On the yearly sheet, an empty month writes `0` with that format, so its formulas still sum. The style keys are:

  - `header`: bold white on fill `1F3864` (dark blue), centred, thin borders
  - `body`: thin light-grey borders
  - `bodyGreen`: font `00B050` for Month and Year
  - `subtotal`: bold on fill `D9E1F2` (light blue)
  - `italicLine`: italic
  - `netLine`: bold
  - `grandTop`: bold with a thick black top border
  - `grandBottom`: bold with a thick black bottom border
  - `grandLine`: bold, or bold italic for the GRAND TOTAL's Expenses and Allowance lines, matching the screenshot

  Column widths are in characters, with the content length checked by a unit test: Week 7, Day 16, Driver 18, numbers 12, Month 8, Year 8, and on the yearly sheet Year 8, Month 16, numbers 12.
- **Rationale**: These match the screenshots and FR-033 to FR-038. `[Red]` with a minus gives "minus sign in red" without conditional formatting. The colours are workbook values, not UI tokens, so DESIGN.md's no-hex rule (for components) doesn't apply. They live as named constants in `xlsx.ts`.

## R6. Periods, week numbers, and day rows

- **Decision**: `lib/reports/periods.ts` provides:
  - `weekRange(date)`: Monday to Sunday containing the date, using UTC calendar arithmetic on YYYY-MM-DD strings.
  - `monthRange(year, month)` and `yearRange(year)`.
  - `weekOfMonth(date)`: 1 plus the number of Mondays after the 1st and up to the date, so Week 1 runs from the 1st to the first Sunday.
  - The weekly label is `weekOfMonth(monday)` (clarified 2026-10-31).
  - `days(range)`: every date in a range with `{ date, dayLabel: Mon..Sun, monthLabel: Jan..Dec, year }`.

  Service and expense dates are plain calendar dates, so ranges compare strings, and the fleet time zone only sets "today" for the default picker values (`fleetToday()`). Inputs are validated as real dates within 10 years of today.
- **Rationale**: Pure and exhaustively unit-testable (month starts on each weekday, leap years, weeks crossing months and years).

## R7. Loading report data

- **Decision**: `lib/reports/report-data.ts` runs two queries for a `{ from, to, unitId | null }`:
  - **Remittances**: `select service_date, amount_due_centavos, allowance_centavos, deposit_centavos, drivers(full_name)`, active rows only, in the date range, optionally for one unit, ordered by `service_date` and `created_at`, and read in pages of 1,000 with `.range()` until a short page.
  - **Expenses**: `select expense_date, amount_centavos`, active rows in the range, optionally for one unit, also paged.

  Totals are summed in TS by day, week, and month. Demo mode reads `demoRemittances` and `demoExpenses`. The unit list comes from `units` where `deleted_at is null` (all statuses, retired labelled).
- **Rationale**: PostgREST caps responses at `max_rows = 1000`, and a year of fleet data is about 4,400 rows. The new partial index `remittances_service_date_idx (service_date) where deleted_at is null` serves both range scans. Two flat queries are simpler than a new RPC and need no new grants.

## R8. Sheet layout and formulas

- **Decision**: `lib/reports/report-layout.ts` builds the sheet model from the days, rows, and expense totals. The exact cells are in `contracts/report-sheets.md`. Formulas reference cell ranges, written in A1 style by a helper:
  - Week subtotal: `=SUM(D{first}:D{last})`, and likewise for E and F.
  - Expenses: a value.
  - Allowance line: `=F{subtotalRow}`.
  - Net: `=D{allowanceRow}-D{expensesRow}`.
  - Grand total: `=D{s1}+D{s2}+…` over the subtotal rows (not one SUM over all rows, which would double-count subtotals). Its Expenses is `=D{e1}+D{e2}+…` over the week expense cells, its Allowance is `=F{grandRow}`, and its Net is `=D{gAllow}-D{gExp}`.
  - The yearly sheet works the same way with columns C, D, E.

  Cached values are computed by the same builder.
- **Rationale**: Live formulas keep the sheet editable (FR-037), and summing subtotal cells keeps the grand total right if the owner edits a row.

## R9. Card breakdown and validation in the UI

- **Decision**: `lib/remittances/financials.ts` provides:
  - `ALLOWANCE_CENTAVOS = 4000`
  - `depositFor(paidCentavos, allowance = ALLOWANCE_CENTAVOS)`
  - `exceedsRental(paid, rental)`
  - `overRentalMessage(rental)`, which reads "Payment can't exceed the rental of ₱180.00"

  The card computes from the typed text on every change (an empty field counts as 0, an invalid amount shows "—") and the disposition, and shows the saved values when locked. `MoneyText` renders `formatPesos` of the absolute value with a leading "−" and `text-danger` when negative.
- **Rationale**: One formula is shared by the card, List view, demo data, and the report cached values, and it is unit-tested against the database's.

## R10. Removing credit and the CSV

- **Decision**: Remove the following:
  - **`BalanceBadge`**: the `credit` prop goes; it shows "Paid" when the balance is 0 or less.
  - **`remittanceTotals`**: keeps `paid` and `balance` and drops `credit`.
  - **Details page**: the "Credit (overpaid)" label and the "Paying more is kept as credit" hint go.
  - **CSV report**: delete `app/api/reports/monthly/route.ts`, `lib/reports/monthly-csv.ts`, `tests/unit/monthly-report.test.ts`, and the old form logic. The `monthly_report` SQL function and its pgTAP stay untouched (dropping it would be an unrelated schema change).
- **Rationale**: FR-008 and FR-039.

## R11. Types and database tests without a local database

- **Decision**:
  - Regenerate `types/database.ts` with `corepack pnpm exec supabase gen types typescript --linked > types/database.ts` once the migration is applied to rolnet-dev. Until then, hand-add the two columns in the generator's format so typecheck passes.
  - Run pgTAP through the existing rolnet-dev rollback wrapper (`supabase db query --linked -f`, with pgTAP created inside the transaction and a final `raise exception` to roll back).
  - **Pushing the migration to rolnet-dev and running pgTAP there needs your explicit approval** (project memory: the 007 approval doesn't carry over).
- **Rationale**: Local Supabase can't run on this laptop (no WSL or Hyper-V).

## R12. Fresh `updated_at` after payment writes

- **Decision**: Because a payment now updates its remittance's row (R1), `saveDailyRemittance` and `editDailyRemittance` re-select `updated_at, deposit_centavos` after their last write and return them. Otherwise the card's next notes edit would be rejected as stale.
- **Rationale**: This keeps feature 008's stale-record check meaningful. A payment by someone else still makes a pending notes edit stale, which is correct.
