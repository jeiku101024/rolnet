---

description: "Task list for feature 009: Remittance Financials and XLSX Reports"
---

# Tasks: Remittance Financials and XLSX Reports

**Input**: Design documents from `specs/009-remittance-financials-reports/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. CLAUDE.md requires lint, typecheck, and tests to pass for every task, plus pgTAP coverage for schema changes. Write each story's tests first and confirm they fail.

**Organization**: Tasks are grouped by user story so each story can be built, tested, and demonstrated on its own.

**Hard rules for every task** (CLAUDE.md and constitution 1.1.0):
- Money is integer centavos (`bigint` in SQL), parsed and formatted only through `lib/money/centavos.ts`. The only place pesos appear is XLSX cell values (`centavos / 100`).
- Schema changes go only in the new migration `supabase/migrations/20261031000100_remittance_financials.sql`, with pgTAP coverage. Never edit a pushed migration. New SQL functions get no EXECUTE for `anon` or `authenticated`.
- **Pushing to rolnet-dev and running pgTAP there needs the user's explicit approval** (local Supabase can't run). Ask before T006.
- No new npm packages. Use tokens only in components (no hex or arbitrary sizes); the workbook colours are data in `lib/reports/xlsx.ts`, not UI. Every screen must work at 360 px.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1 to US4)

---

## Phase 1: Setup

- [X] T001 Create and switch to branch `009-remittance-financials-reports` from `main`, and confirm `.specify/feature.json` points to `specs/009-remittance-financials-reports`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The stored Allowance and Deposit, the no-overpayment rule, the shared formula, and the removal of "Credit". Every story depends on these.

**⚠️ CRITICAL**: No user story work starts until this phase is complete

- [X] T002 Write the pgTAP test `supabase/tests/constraints/270_remittance_financials.sql` (research R1 to R3, data-model.md). It must check that:
  - A new remittance gets `allowance_centavos = 4000` and `deposit_centavos = -4000`.
  - Payments of 10000, then 8000, give a deposit of 6000, then 14000. Voiding the 8000 (`correct_remittance_payment`) gives 6000 again.
  - A payment that would make the total paid exceed `amount_due_centavos` fails with SQLSTATE `23514`, and its message contains "Payment can't exceed the rental of ₱180.00. At most ₱80.00 more can be recorded."
  - Restoring a voided payment that would exceed the rental also fails.
  - A remittance that is already overpaid (insert its payments with the trigger disabled inside the test) rejects any new payment.
  - Updating `allowance_centavos` fails, and writing a direct `deposit_centavos = 999` is overwritten with the formula.
  - **Backfill invariants** (pgTAP runs after the migration, so there is no "before" to seed): no remittance has `allowance_centavos <> 4000`, and no remittance has `deposit_centavos <> coalesce(active payments total, 0) - allowance_centavos`. Check that `updated_at` was left unchanged with the before/after snapshot in T006, not here.
  - `remittances_service_date_idx` exists.
  - `remittances_set_deposit()` and `remittance_payments_sync_deposit()` have no EXECUTE for `anon` or `authenticated`.
- [X] T003 [P] Write the pgTAP test `supabase/tests/rls/200_remittance_financials_rls.sql`. Staff can add a payment within the rental through RLS. A staff or owner `update remittances set deposit_centavos = …, allowance_centavos = …` can't leave a value other than the formula and 4000.
- [X] T004 Write the migration `supabase/migrations/20261031000100_remittance_financials.sql` exactly as data-model.md describes. In order, it must:
  - (a) add `allowance_centavos bigint not null default 4000 check (allowance_centavos >= 0)` and `deposit_centavos bigint not null default -4000`;
  - (b) (dropped during implementation: the rate 4000 is inlined in `remittances_set_deposit`, because an invoker trigger would need `authenticated` EXECUTE on a helper);
  - (c) run the backfill with `remittances_audit_fields`, `remittances_business_audit`, and `remittances_lock_financial_facts` disabled, then re-enabled: `allowance_centavos = 4000` and `deposit_centavos = coalesce(active payments total, 0) - 4000` for every row;
  - (d) replace `lock_remittance_financial_facts()` so it also rejects `allowance_centavos` changes (keep its existing message, adding "allowance");
  - (e) add `remittances_set_deposit()` (`security invoker`, `set search_path = public`) and a BEFORE INSERT OR UPDATE trigger named `remittances_set_deposit`. On insert it sets allowance to the rate, and every time it sets `deposit = active paid - allowance`;
  - (f) replace `validate_remittance_payment()`, keeping its existing `security definer` and `set search_path = public` (it does no writes, and only reads the parent). On insert, restore, or amount change, it locks the parent with `for update` and checks `others + new.amount_centavos <= amount_due_centavos`. If not, it raises 23514 with the R3 message, formatted with `to_char(x / 100.0, 'FM999,999,990.00')`;
  - (g) add `remittance_payments_sync_deposit()` (`security invoker`, `set search_path = public`, so the parent update runs under the caller's RLS, such as `remittances_operational_update_policy` for staff) and an AFTER INSERT OR UPDATE trigger on `remittance_payments` that touches the parent (and the old parent if it changed);
  - (h) create `remittances_service_date_idx on public.remittances (service_date) where deleted_at is null`;
  - (i) `revoke all on function … from public, anon, authenticated` for the three new functions.
- [X] T005 (Not needed: `types/database.ts` is a small hand-written file without remittance table types; row types live beside each query.) Hand-add `allowance_centavos: number` and `deposit_centavos: number` (Row, plus optional in Insert and Update) to `public.Tables.remittances` in `types/database.ts`, in the generator's format, so typecheck passes before the linked regeneration in T006
- [X] T006 **(Ask the user first.)** Before pushing, record `select count(*), max(updated_at), sum(extract(epoch from updated_at)) from remittances` and the count of remittance rows in the business audit table. Push the migration to rolnet-dev (`corepack pnpm exec supabase db push --linked`), then run the same queries again: all values must be unchanged (FR-016). Run T002 and T003 plus the existing `030_remittances.sql`, `140_remittance_facts_locked_rls.sql`, `210_driver_outstanding_balances.sql`, and `220_monthly_report_reconciliation.sql` (as updated in T037) through the rollback wrapper (`supabase db query --linked -f`, with pgTAP created inside the transaction and a final `raise exception`). Don't regenerate `types/database.ts`: it is hand-written and exports `AppRole` and other app types (see T005). Record the TAP results in `specs/009-remittance-financials-reports/validation.md`
- [X] T007 [P] Write `tests/unit/financials.test.ts` for `lib/remittances/financials.ts`:
  - `depositFor(18000) = 14000`, `depositFor(10000) = 6000`, `depositFor(0) = -4000`
  - `exceedsRental(18001, 18000)` is true and `exceedsRental(18000, 18000)` is false
  - `overRentalMessage(18000)` is `"Payment can't exceed the rental of ₱180.00"`
  - `ALLOWANCE_CENTAVOS` is 4000
- [X] T008 [P] Implement `lib/remittances/financials.ts` (`ALLOWANCE_CENTAVOS = 4000`, `depositFor(paid, allowance = ALLOWANCE_CENTAVOS)`, `exceedsRental(paid, rental)`, `overRentalMessage(rental)`, all integer centavos) so T007 passes
- [X] T009 [P] Drop `credit` from `lib/remittances/totals.ts`, so it returns `{ paid, balance: max(due - paid, 0) }`. Change `components/remittances/balance-badge.tsx` to `BalanceBadge({ balance })`, which reads "Paid" (success) when balance is 0 and "Owes ₱X" (warning) otherwise. Update every caller (`daily-card.tsx`, `remittances-list.tsx`, `app/(operations)/remittances/[id]/page.tsx`) and remove the "Credit (overpaid)" label there (FR-008)
- [X] T010 [P] Create `components/remittances/money-text.tsx`: `MoneyText({ centavos })` renders `formatPesos(Math.abs(centavos))` with a leading "−" and `text-danger` when negative, and plain text otherwise (FR-013, FR-015)
- [X] T011 Add `allowance_centavos: 4000` and `deposit_centavos: paid - 4000` to each entry of `demoRemittances` in `lib/demo/mode.ts`. **Add** new `demoExpenses` entries so each week of the current month has at least one expense, so the demo reports have data. Don't change or move the existing entries: `tests/e2e/list-sort-filter.spec.ts` expects the ₱550 and ₱350 rows. If the new entries change that spec's expected counts, update its counts only. Make sure existing e2e demo assumptions still hold (30 remittances, ROLNET-1 saved today)
- [X] T038 (Added while running T006.) Add `supabase/migrations/20261031000200_payment_check_after_approval.sql`: `validate_remittance_payment()` returns early for a signed-in caller who isn't approved, so RLS rejects them with 42501 instead of the over-rental message (which would reveal the rental and paid amount). Cover it in `supabase/tests/rls/200_remittance_financials_rls.sql`
- [X] T037 Update the existing tests that rely on overpayment and credit (they fail once T004 and T009 land):
  - `supabase/tests/constraints/210_driver_outstanding_balances.sql`: wrap the overpaid driver Y's payment insert (18,000 + 2,000) in `alter table public.remittance_payments disable trigger remittance_payments_validate;` … `enable trigger remittance_payments_validate;`, so the legacy-overpaid case ("a settled driver with an overpayment is not listed") is kept. Leave the other payments under the trigger.
  - `supabase/tests/constraints/220_monthly_report_reconciliation.sql`: do the same around unit A's July 1 payments (10,000 + 10,000 on 18,000, "credit 2,000"). The `monthly_report` SQL function and its expected arrays stay unchanged.
  - `tests/unit/convergence-ui-helpers.test.ts`: rename the case to "shows a balance when underpaid and Paid when fully paid", drop `credit` from the expected objects, and expect a legacy overpaid total (20000 on 18000) to give `{ paid: 20000, balance: 0 }`.

**Checkpoint**: The database owns the formula and the overpayment rule. Credit is gone. The shared helpers are tested.

---

## Phase 3: User Story 1 - See Allowance and Deposit while recording (Priority: P1) 🎯 MVP

**Goal**: Cards say "Rental", show a live Allowance and Deposit breakdown, block payments above the rental, and keep the saved figures when locked.

**Independent Test**: On a ₱180 card, type 100 to see Deposit ₱60.00, save it, then edit it to 180 to see Deposit ₱140.00. Typing 200 is blocked.

### Tests for User Story 1 ⚠️

- [X] T012 [P] [US1] Extend `tests/unit/daily-card.test.tsx`:
  - The figure label is "Rental" and "Due" no longer appears.
  - Typing 180, 100, or 0, or leaving the field empty, shows "Allowance ₱40.00" and "Deposit ₱140.00", "₱60.00", or "−₱40.00" (red, `text-danger`) before saving.
  - Switching to Overnight / overtime with 250 typed shows Deposit ₱210.00. Switching back to Returned shows "Payment can't exceed the rental of ₱180.00", and Save doesn't call the action.
  - Invalid text shows Deposit "—", and so does an amount above the rental (typing 200 on a ₱180 card shows "—" next to the error).
  - A locked card shows its saved `allowanceCentavos` and `depositCentavos`.
  - After Edit remittance and typing 180, the breakdown is live.
  - There's no "Credit" badge for any amount.
- [X] T013 [P] [US1] Extend `tests/unit/daily-board.test.ts`: saved cards carry `allowanceCentavos` and `depositCentavos` from the row

### Implementation for User Story 1

- [X] T014 [US1] In `lib/remittances/daily-board.ts`, add `allowanceCentavos` and `depositCentavos` to `SavedCard` and `DailyRows.remittances[]` (`allowance_centavos`, `deposit_centavos`). In `lib/remittances/daily-query.ts`, select them in the live query and map them in the demo branch, so T013 passes
- [X] T015 [US1] In `app/actions/remittances.ts`, after the last write, `saveDailyRemittance` and `editDailyRemittance` re-select `updated_at, deposit_centavos` and return `{ …, updatedAt, depositCentavos }` (research R12). Remove the old credit wording. Let the database's over-rental message (23514) pass through unchanged: check that `databaseFailure` in `lib/actions/errors.ts` returns it as-is, with a unit test case in `tests/unit/action-errors.test.ts`
- [X] T016 [US1] Update `components/remittances/daily-card.tsx` following `contracts/ui-changes.md`:
  - Rename "Due" to "Rental".
  - Add the `<dl>` breakdown (Allowance and Deposit, via `MoneyText`) between Notes and the action row. It's live from the typed amount and disposition while unrecorded or editing, and shows saved values when locked. Show "—" for invalid text.
  - Block above-rental amounts with `overRentalMessage(rental)` on input and on save.
  - Show Deposit "—" while the amount exceeds the rental (FR-011).
  - Pass the returned `depositCentavos` into `onSaved`, and call `BalanceBadge({ balance })`.

  This makes T012 pass.
- [X] T017 [US1] On the details page `app/(operations)/remittances/[id]/page.tsx` and in `components/forms/remittance-detail-forms.tsx`:
  - Rename "Due" to "Rental", and add Allowance and Deposit (with `MoneyText`) to the summary.
  - Change the payment hint to "Balance: ₱X. Payments can't exceed the rental."
  - Block amounts above the balance client-side with the same message, before calling `addRemittancePayment`.

**Checkpoint**: Recording shows correct, live figures that match what's saved. This is the MVP.

---

## Phase 4: User Story 2 - Review Rental, Allowance and Deposit in the history (Priority: P1)

**Goal**: List view shows Date, Unit / driver, Disposition, Rental, Paid, Balance, Allowance, Deposit, with red negatives.

**Independent Test**: List view's headers match that order, and a ₱0-paid row shows Allowance ₱40.00 and Deposit −₱40.00 in red.

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] Create `tests/e2e/remittance-financials.spec.ts` with a List view block (demo, 360 px and 1280 px):
  - The `thead th` text equals `["Date","Unit / driver","Disposition","Rental","Paid","Balance","Allowance","Deposit"]`.
  - A row with ₱100 paid on ₱180 shows "Owes ₱80.00", "₱40.00", and "₱60.00".
  - No "Credit" text appears.
  - A negative deposit cell has a computed colour of `rgb(163, 63, 59)` (danger) and starts with "−".

### Implementation for User Story 2

- [X] T019 [US2] In `components/remittances/remittances-list.tsx`, add `allowance_centavos, deposit_centavos` to the select. Set the headers to the FR-014 order ("Due" becomes "Rental"), render the Allowance and Deposit cells with `font-data` and `MoneyText`, and use `BalanceBadge({ balance })`. Update the demo row mapping to match. This makes the T018 List view block pass

**Checkpoint**: The history matches the cards, and existing rows show backfilled values.

---

## Phase 5: User Story 3 - Download a Weekly or Monthly XLSX report (Priority: P2)

**Goal**: The Reports page offers Weekly and Monthly .xlsx downloads (fleet or one unit) in the client's layout, with live formulas. The CSV is removed.

**Independent Test**: Download January's Monthly report. The week subtotals equal their rows, Net = Allowance − Expenses, the GRAND TOTAL equals the sum of the subtotals, and editing a Deposit cell updates both.

### Tests for User Story 3 ⚠️

- [X] T020 [P] [US3] Write `tests/unit/report-periods.test.ts` for `lib/reports/periods.ts`:
  - `weekRange("2025-01-29")` is `{ from: "2025-01-27", to: "2025-02-02" }`.
  - `weekOfMonth` gives 1 for Jan 1 to 5 2025, 2 for Jan 6, and 5 for Jan 27 to 31.
  - The weekly label for the week of Mon 27 Jan is 5, and for a week starting Mon 30 Dec 2024 it is 6 (December 2024 starts on a Sunday, so that is its sixth week).
  - `monthWeeks("2025-01")` gives 5 weeks, cut at Jan 1 and Jan 31. `monthWeeks` for February 2026 (starting on a Sunday) gives a 1-day Week 1.
  - Leap February 2028 has 29 days.
  - `days()` labels Mon…Sun and Jan…Dec.
  - Dates more than 10 years from today, and impossible dates, are rejected.
  - The default periods come from `fleetToday()` (Asia/Manila): with the clock mocked to 2025-01-31 17:00 UTC (Feb 1 in Manila), the default month is `2025-02` and the default week starts Mon 27 Jan (FR-020).
- [X] T021 [P] [US3] Write `tests/unit/xlsx-writer.test.ts` for `lib/reports/xlsx.ts`. Parse the output's stored zip in the test with a 30-line reader and check:
  - Each entry's CRC-32 matches.
  - The parts `[Content_Types].xml`, `xl/workbook.xml` (with `fullCalcOnLoad="1"`), `xl/styles.xml`, and `xl/worksheets/sheet1.xml` are present.
  - The sheet has `<pane ySplit="1" topLeftCell="A2" state="frozen"/>` and `<cols>` widths.
  - Formula cells carry both `<f>` and a cached `<v>`. Strings are inline. XML special characters are escaped.
  - Each style key maps to an `xf` with the R5 fills (`1F3864`, `D9E1F2`), font colours (`FFFFFF`, `00B050`), thick borders, and the number formats `#,##0;[Red]-#,##0`, `#,##0.00;[Red]-#,##0.00`, and `#,##0;[Red]-#,##0;"-"`.
- [X] T022 [P] [US3] Write `tests/unit/report-layout.test.ts` for the weekly and monthly builders in `lib/reports/report-layout.ts`, using fixed rows:
  - The header cells are in FR-024 order.
  - One row per remittance with Allowance 40. A day with no remittance has a row with only Week, Day, Month, and Year.
  - Week blocks contain "Week N Subtotal" with `=SUM(D…)`, `=SUM(E…)`, `=SUM(F…)`.
  - "Expenses:" carries the week's value, "Allowance:" is `=F{subtotal}`, and "Net:" is `=D{allow}-D{exp}`.
  - The monthly GRAND TOTAL sums the subtotal rows (`=D{s1}+D{s2}…`) and has the thick-border styles.
  - The weekly report has one block and no GRAND TOTAL, and its rows crossing into the next month show their own Month and Year.
  - The cached values equal the TS sums, and a negative Net is negative.
  - Column widths are at least the longest text length plus 2.
  - With a `unitName` ("ROLNET-1"), the sheet name is "Monthly - ROLNET-1". A unit name longer than 31 characters or containing `[]:*?/\` is cleaned and truncated (FR-023).
  - Optional (SC-005): building a monthly sheet and the workbook bytes from 31 × 50 synthetic rows finishes in under 1 s.
- [X] T023 [P] [US3] Add to `tests/e2e/remittance-financials.spec.ts` a Reports block (demo):
  - The page shows Report (Weekly / Monthly / Yearly), the period pickers, and Scope (Whole fleet / One unit, with the unit list including "(retired)").
  - Downloading Weekly and Monthly saves `rolnet-weekly-<monday>.xlsx` and `rolnet-monthly-<YYYY-MM>.xlsx`.
  - Unzipping the download in the test shows header row "Week, Day, Driver, Rental, Deposit, Allowance, Month, Year" and a `SUM(` formula.
  - With Scope "One unit" and a demo unit chosen, the Monthly download is named `rolnet-monthly-<YYYY-MM>-<unit>.xlsx`, its sheet name includes the unit, and its Driver cells contain only that unit's drivers (FR-021, FR-023).
  - No CSV option remains.

### Implementation for User Story 3

- [X] T024 [P] [US3] Implement `lib/reports/periods.ts` (`weekRange`, `monthRange`, `yearRange`, `weekOfMonth`, `weeklyLabel(monday)`, `monthWeeks(month)`, `days(from, to)`, `validatePeriod`, all on YYYY-MM-DD strings using `addDays`) so T020 passes
- [X] T025 [P] [US3] Implement `lib/reports/xlsx.ts` following research R4 and R5:
  - The `Cell` and `Sheet` types and the `StyleKey` set (`header`, `body`, `bodyGreen`, `subtotal`, `italicLine`, `netLine`, `grandTop`, `grandBottom`, `grandLine`, `grandItalic`, plus number and decimal variants).
  - The styles.xml builder, the sheet XML with inline strings, frozen row 1, `<cols>`, and formulas with cached values.
  - The STORE zip with CRC-32, returning a `Uint8Array`.

  This makes T021 pass.
- [X] T026 [US3] Implement `lib/reports/report-data.ts`:
  - `loadReportData(supabase | null, { from, to, unitId })` pages remittances (`service_date, amount_due_centavos, allowance_centavos, deposit_centavos, created_at, drivers(full_name)`, active rows, in range, optionally `unit_id`, ordered by `service_date, created_at`) and expenses (`expense_date, amount_centavos`, active rows, in range, optionally `unit_id`), using `.range()` in steps of 1,000 until a short page.
  - It returns `{ remittances, expensesByDate }`, with a demo branch built from `demoRemittances` and `demoExpenses`.
  - `loadReportUnits(supabase | null)` returns every unit where `deleted_at is null`, with `label` "ROLNET-1 (T-001)", plus " (retired)" when `status = 'retired'`.
- [X] T027 [US3] Implement the weekly and monthly builders in `lib/reports/report-layout.ts` (`weeklySheet(data, monday, unitName?)` and `monthlySheet(data, month, unitName?)`), producing exactly the cells, formulas, and styles in `contracts/report-sheets.md`. Pesos are `centavos / 100`, and centavos cells use the decimal format. This makes T022 pass
- [X] T028 [US3] Create the route handler `app/api/reports/[kind]/route.ts` following `contracts/reports-http.md`:
  - Run `connection()` outside the try, then the session, approval, and `export_reports` checks.
  - Validate `kind`, `date`, `month`, or `year`, plus `scope` and `unitId`, returning 400, 401, 403, or 404 with the contract's messages.
  - Load the data, build the sheet, and respond with the xlsx bytes, the content type, `content-disposition` (with file names per the contract, the unit name made filename-safe), and `cache-control: no-store`.
  - Weekly and Monthly here; Yearly is added in T032.
- [X] T029 [US3] Remove the CSV report: delete `app/api/reports/monthly/route.ts`, `lib/reports/monthly-csv.ts`, and `tests/unit/monthly-report.test.ts`. Leave the `monthly_report` SQL function and its pgTAP untouched
- [X] T030 [US3] Rewrite `components/forms/report-export-form.tsx` and `app/(owner)/reports/page.tsx` following `contracts/reports-http.md`:
  - The page reads units through `loadReportUnits`, and its description becomes "Download Weekly, Monthly or Yearly reports as Excel files for the whole fleet or one unit."
  - The form has Report (`SegmentedToggle` from 640 px, a `Select` below), the period inputs (a date for Weekly with the "Covers Mon … – Sun …" helper text, month and year selects, a year select), and Scope (Whole fleet / One unit with the unit select).
  - **Download .xlsx** fetches `/api/reports/{kind}?…`, saves the blob under the `content-disposition` name, and shows the errors from the contract.
  - It works at 360 px.

  This makes the T023 Weekly and Monthly parts pass.

**Checkpoint**: The Weekly and Monthly XLSX downloads work for the fleet and for one unit, and the CSV is gone.

---

## Phase 6: User Story 4 - Download a Yearly XLSX report (Priority: P2)

**Goal**: The Yearly sheet has twelve months, a Year Subtotal, Expenses, Allowance, and Net, then a GRAND TOTAL block, with zeros shown as "-".

**Independent Test**: With data only in January, the Yearly report shows January's totals, "-" for February to December, and a correct Year Subtotal and Net.

### Tests for User Story 4 ⚠️

- [X] T031 [P] [US4] Extend `tests/unit/report-layout.test.ts` with `yearlySheet`:
  - The headers are Year, Month, Rental, Deposit, Allowance.
  - Rows 2 to 13 run Jan to Dec, with Year and Month green, empty months as 0 in the `"-"` zero format, and Allowance as ₱40 × remittances.
  - Row 14 is `=SUM(C2:C13)`, and so on. Rows 15 to 17 are Expenses (a value), Allowance (`=E14`), and Net (`=C16-C15`). Rows 18 to 21 are the GRAND TOTAL lines with the thick top and bottom borders.
  - Extend `tests/e2e/remittance-financials.spec.ts` so a Yearly download saves `rolnet-yearly-<YYYY>.xlsx` with those headers.

### Implementation for User Story 4

- [X] T032 [US4] Implement `yearlySheet(data, year, unitName?)` in `lib/reports/report-layout.ts` following `contracts/report-sheets.md`, and add `yearly` to `app/api/reports/[kind]/route.ts` (the full calendar year in range, monthly totals by `service_date` month, and year expenses). This makes T031 pass

**Checkpoint**: All four stories work.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 [P] In `docs/DEVELOPMENT.md`, update the business rules:
  - Rental (formerly Due), Allowance ₱40 stored per remittance and fixed at save, and Deposit = paid − allowance (may be negative, kept by the database).
  - No payment above the rental (enforced in the database), and existing overpaid records stay as they are.
  - The Reports page's Weekly, Monthly, and Yearly XLSX downloads (fleet or one unit), which replace the CSV.

  Remove mentions of the monthly CSV.
- [X] T034 [P] Search `docs/` (for example `docs/DEVELOPMENT.md` and `docs/TECH-STACK-AND-SETUP.md`) for wording that describes remittance "Credit", overpayment, or a "Due" label, and update it to Rental and no credit. Leave `specs/001-*` to `specs/008-*` unchanged, because they are historical records
- [X] T035 Run `corepack pnpm lint`, `typecheck`, `test`, `check`, and `build:vinext`, then Playwright against a demo build on :3100 (`tests/e2e/remittance-financials.spec.ts`, `remittances-daily-view.spec.ts`, `list-sort-filter.spec.ts`, `paged-lists.spec.ts`), and fix any failures. After building, restore `next-env.d.ts` and remove the stale `.next/types` if the builds leave mismatched route types (as in feature 008)
- [ ] T036 Walk through `quickstart.md` steps 1 to 9 against rolnet-dev (only with the user's approval) at 360 px and desktop. Open each XLSX in Excel or Google Sheets, check the formatting against the client's screenshots and that the formulas recalculate, compare one month's totals with List view and the Expenses page (SC-004), time a full-year fleet download (SC-005, under 10 s), and record the results, including a plain-language review of the new messages, in `specs/009-remittance-financials-reports/validation.md`

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001)** comes first.
- **Foundational (Phase 2)**:
  - T002 and T003 (the tests) come before T004 (the migration).
  - T005 needs T004, and T006 needs T004, T005, and the **user's approval**.
  - T007 and T008, T009, T010, and T011 can run in parallel with the database tasks.
  - T037 (added after analysis, so its ID is out of order) goes with T004 and T009: its pgTAP edits must be in place before T006 runs them, and its unit-test edit lands with T009.
  - The phase blocks every story. Typecheck-dependent code only needs T005; the database-backed checks need T006.
- **US1 (Phase 3)**: needs T005 and T008 to T011.
- **US2 (Phase 4)**: needs T005, T009, T010, and T011, but not US1.
- **US3 (Phase 5)**: needs T005 and T011. T020 to T025 can start right after Phase 2. It doesn't need US1 or US2, because reports read the stored columns.
- **US4 (Phase 6)**: needs US3's writer, data loader, route, and form (T024 to T030).
- **Polish (Phase 7)**: after the stories you plan to ship.

### Story completion order

```text
Setup → Foundational ─┬─▶ US1 (MVP)
                      ├─▶ US2
                      └─▶ US3 ──▶ US4
                                    └──▶ Polish
```

### Same-file sequencing (not [P])

- `lib/reports/report-layout.ts`: T027 → T032
- `app/api/reports/[kind]/route.ts`: T028 → T032
- `tests/unit/report-layout.test.ts`: T022 → T031
- `tests/e2e/remittance-financials.spec.ts`: T018 → T023 → T031
- `components/remittances/daily-card.tsx`: T009 → T016
- `lib/remittances/totals.ts` and `tests/unit/convergence-ui-helpers.test.ts`: T009 with T037
- `components/remittances/remittances-list.tsx`: T009 → T019
- `app/(operations)/remittances/[id]/page.tsx`: T009 → T017

---

## Parallel Examples

```text
# Phase 2, after T001:
Task: "T002 pgTAP 270_remittance_financials.sql"
Task: "T003 pgTAP 200_remittance_financials_rls.sql"
Task: "T007 tests/unit/financials.test.ts"
Task: "T010 components/remittances/money-text.tsx"

# US3 groundwork, after Phase 2:
Task: "T020 tests/unit/report-periods.test.ts"
Task: "T021 tests/unit/xlsx-writer.test.ts"
Task: "T024 lib/reports/periods.ts"
Task: "T025 lib/reports/xlsx.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1)

1. Setup, then Foundational. Ask the user before T006.
2. US1: the card's Rental label, live breakdown, and over-rental block.
3. **Stop and validate**: T012 and T013, plus quickstart steps 1 to 4.

### Incremental delivery

1. US1 and US2 ship together as "Financials in the app" (both P1).
2. US3 and US4 ship together as "XLSX reports". The CSV is removed only in US3 (T029), together with the new downloads, so a report is always available.
3. Polish: docs, the full check suite, and validation.

---

## Notes

- Commit after each task or logical group, on `009-remittance-financials-reports` only.
- Never edit `20261031000100_remittance_financials.sql` after it's pushed to rolnet-dev. A fix goes in a new migration.
