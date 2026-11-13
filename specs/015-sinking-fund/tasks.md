---
description: "Task list for feature 015: Sinking Fund"
---

# Tasks: Sinking Fund

**Input**: Design documents from `specs/015-sinking-fund/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. CLAUDE.md requires lint, typecheck, and tests to pass for every task, and every
schema change needs pgTAP coverage. Worked examples A and B are encoded in both Vitest and pgTAP.

**Organization**: Phase 1 setup, Phase 2 the whole database layer plus the TypeScript rules twin and the
page shell (everything the stories share), then one phase per user story from spec.md in priority order.
US1–US4 are the P1 stories; US1–US3 together are the smallest useful slice (see MVP below).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 Participants · US2 Deposits and ledger list · US3 Loans and payments · US4 Owner interest part · US5 Distribution · US6 Overdue and loan Withdrawal · US7 Transactions view (summary, filters) · US8 Top participants · US9 Participants view and detail · US10 Void, archive, settings, rename · US11 Savings withdrawal

## Hard rules for every task (CLAUDE.md, constitution 1.1.0)

- **Free tier**: no new npm dependencies or services; icons from `lucide-react`; charts are plain SVG.
- **Money**: integer centavos (`bigint`). Parse and format only with `lib/money/centavos.ts`.
- **Soft delete only**: nothing is hard-deleted; ledger rows are voided, participants archived.
- **Migrations**: new files only, each with pgTAP in `supabase/tests/`. Never edit a pushed migration.
  All three sinking-fund migrations stay unapplied and unpushed until T020 passes locally on review; ask
  the owner before applying anything to `rolnet-dev` or running pgTAP (no local Supabase).
- **Functions**: start with no EXECUTE for `anon`/`authenticated`; grant `authenticated` explicitly in the
  same migration only for functions the app calls; `security definer` functions check the caller
  (`is_approved_user()` or `require_owner()`) first.
- **Types**: `types/database.ts` is hand-maintained; add enums, tables, views, and functions by hand.
- **UI**: shadcn `base-nova` parts in `components/ui/`, tokens from `app/globals.css`, no hex colors or
  arbitrary sizes, every screen works at 360 px, tags combine icon, text, and color. `DESIGN.md` wins on UI.
- **Next.js**: read the relevant guide in `node_modules/next/dist/docs/` before writing the page, search
  params handling, and Server Actions (AGENTS.md).
- **Done** = `corepack pnpm lint`, `typecheck`, `test` pass (plus pgTAP when schema changed, with owner OK).

---

## Phase 1: Setup

- [x] T001 [P] Add the owner-only `manage_fund` permission to `Permission` and the `owner` list in `lib/permissions/roles.ts` (staff do not get it); extend the roles unit test in `tests/unit/` that lists permissions, if one exists
- [x] T002 [P] Add `sinkingFund: { title: "Sinking fund", eyebrow: "Savings and loans", description: "Track savings, loans at 5% interest, and the shared interest fund." }` to `lib/navigation/page-context.ts`
- [x] T003 Add the navigation destination in `lib/navigation/items.ts`: id `sinkingFund`, label from `pageContext.sinkingFund.title`, href `/sinking-fund`, icon `PiggyBank` from `lucide-react`, group `operations`, order 3, access `approved`, `matchDescendants: true`; shift Documents to order 4 and Reports to order 5 (depends on T002)
- [x] T004 [P] Add nav tests: update `tests/unit/` navigation tests (and `tests/e2e/app-navigation.spec.ts`) so "Sinking fund" appears after Expenses for owner and staff, with the same active and hover state
- [x] T005 [P] Create `lib/sinking-fund/types.ts` with the shared TypeScript types: `SfTransactionType` (`deposit | loan | payment | loan_withdrawal | savings_withdrawal | interest_share`), `SfParticipant`, `SfTransaction`, `SfLoan`, `SfDistribution`, `SfView` (`transactions | top | participants`)
- [x] T006 [P] Create `lib/sinking-fund/messages.ts` with the exact toast and error copy from spec sections 5–10 and 15 (for example "Participant added", "Loan recorded. To pay ₱2,100 by Dec 3", "Savings withdrawal recorded", "Only the owner can do this.") plus `formatLoanToast`/`formatPaymentToast` helpers

**Checkpoint**: nav item visible; the route does not exist yet (T040 adds it).

---

## Phase 2: Foundational (blocks every user story)

**Database layer (one place, applied once)**

- [x] T010 Write `supabase/migrations/20261113000100_sinking_fund_tables.sql`: enums `sf_transaction_type`, `sf_interest_set_by`, `sf_prefill`; tables `sf_participants`, `sf_transactions`, `sf_distributions`, `sf_settings` exactly per [data-model.md](data-model.md) (all money `bigint` centavos; `sf_transactions.amount_centavos > 0`; `interest_rate_bp = 500`; `interest_centavos = amount_centavos * interest_rate_bp / 10000`; `amount_due_centavos = amount_centavos + interest_centavos`; payment `principal_part_centavos = amount_centavos - interest_part_centavos` with `interest_part_centavos` between 0 and `amount_centavos`; per-type check constraints for which columns are set; `void_reason` 3–300 chars when `voided_at` is set; `notes` max 500); unique index on `name_key` where `archived_at is null and deleted_at is null`; unique `driver_id` where not null and `deleted_at is null`; indexes `(participant_id, tx_date)` and `(type, tx_date)` where `voided_at is null`, plus `(loan_id)` and `(distribution_id)`; `set_audit_fields`, `reject_hard_delete`, and `audit_business_change` triggers on all four tables; `create or replace` `audit_business_change` to add a `when tg_table_name = 'sf_settings' then '00000000-0000-0000-0000-000000000002'::uuid` branch beside the existing `fleet_settings` one (required: `sf_settings.id` is `smallint`, and the function casts `id` to uuid, which would fail), keeping every other branch unchanged; RLS enabled with `select` policies for `is_approved_user()` only and no write policies; seed `sf_settings` (`default_interest_prefill = 'first'`, `timezone = 'Asia/Manila'`); views `sf_loans_v` and `sf_ledger_v` as `security_invoker`
- [x] T011 Write `supabase/migrations/20261113000200_sinking_fund_rules.sql` part 1 (validators, not granted): `sf_constants()`, `sf_today()`, `sf_peso(bigint)`, `sf_lock()` (advisory xact lock `hashtext('sinking_fund')`), `sf_loan_due_date(date)` (add one month, clamp to last day), `sf_allowed_interest(p_loan, p_amount, p_exclude_payment)` returning `(min, max)` (min = `max(0, amount - unpaid_principal)`, max = `min(amount, unpaid_interest)`, both from the loan's other non-voided payments), `sf_assert_participant_timeline(uuid)` and `sf_assert_fund_timeline()` (order: date, credits before debits, `created_at`; raise `P0001` naming the date and the amount available, e.g. "Ana only had ₱1,000.00 on Nov 5, 2026."), `sf_assert_loan(uuid)` (interest paid between 0 and interest, principal paid between 0 and principal, payment dates not before the loan date, balance 0 implies both fully paid); depends on T010
- [x] T012 Same file as T011, part 2 (write functions for participants, deposits, loans, payments): `sf_add_participant`, `sf_rename_participant`, `sf_record_deposit`, `sf_record_loan` (amount a positive multiple of 10,000 centavos, within savings on its date), `sf_record_payment` (owner interest part within range stored as `owner`; non-owner part ignored and the default from `sf_settings` stored as `default`; amount at most the balance), per [contracts/sql-functions.md](contracts/sql-functions.md); each takes `sf_lock()` first, checks `is_approved_user()`, rejects future dates against `sf_today()`, takes an idempotency key, re-runs the validators; depends on T011
- [x] T013 Same file, part 3 (owner functions): `sf_archive_participant`, `sf_mark_loan_withdrawal`, `sf_change_interest_part`, `sf_record_savings_withdrawal`, `sf_distribute_interest`, `sf_void_transaction`, `sf_void_distribution`, `sf_set_default_prefill`, each calling `public.require_owner()` first, with the void rules table from [data-model.md](data-model.md) and `write_audit_event(..., 'reverse', reason)` on voids; depends on T012
- [x] T014 Same file, part 4 (grants): `revoke all ... from public, anon, authenticated` then `grant execute ... to authenticated` for exactly the write functions in the contract and `sf_allowed_interest_range` (granted wrapper that checks `is_approved_user()`); validators stay ungranted
- [x] T015 Write `supabase/migrations/20261113000300_sinking_fund_reads.sql`: invoker `stable` functions `sf_savings_at`, `sf_fund_summary`, `sf_participant_summaries`, `sf_ranking`, `sf_monthly_flows`, `sf_distribution_history` per the contract, granted to `authenticated`
- [x] T016 [P] Write `supabase/tests/constraints/410_sinking_fund_tables.sql`: constraint violations per type, centavo rules (loan multiple of 10,000, interest and amount-due math), unique active name (case-insensitive) and unique driver link, archived name reuse, audit rows written on insert and update for all four tables (including an `sf_settings` update via `sf_set_default_prefill` writing one audit event with the fixed uuid and old and new values), existing audit triggers on other tables still working, hard delete rejected, derived views `sf_loans_v` and `sf_ledger_v`
- [x] T017 [P] Write `supabase/tests/constraints/420_sinking_fund_rules.sql`: worked example A (steps 1–4a and 4b) and worked example B with the exact numbers from the spec, allowed interest range edges, default prefill first and last for non-owner payments, back-dating (Ana, Nov 5, ₱3,000 blocked and ₱800 allowed), same-day credit-before-debit ordering, concurrent-safe checks where testable, savings withdrawal, loan Withdrawal (overdue only, savings unchanged), every void rule row, distribution of ₱100.00 among 3 (₱33.33 each, ₱0.01 remainder) and its void
- [x] T018 [P] Write `supabase/tests/constraints/430_sinking_fund_reads.sql`: summary totals, expected interest, participant summaries, ranking (savings as of period end and deposits in range, archived excluded), monthly flows
- [x] T019 [P] Write `supabase/tests/rls/100_sinking_fund_rls.sql`: anon cannot read or call anything; staff can read and call staff functions but every owner function raises `42501`; owner can call all; no direct insert, update, or delete on any `sf_` table for any role; `has_function_privilege` assertions for each grant in T014 and none on validators
- [x] T020 Ask the owner for permission, then run T016–T019 and the full existing pgTAP suite against `rolnet-dev` through the rollback wrapper; fix failures in the migrations (not yet pushed); apply the migrations only after the owner agrees

**TypeScript rules twin and shared app plumbing**

- [x] T021 [P] Create `lib/sinking-fund/rules.ts`: constants (rate 500 bp, step 10,000 centavos, term one month), `loanInterest`, `loanAmountDue`, `loanDueDate` (clamp to month end), `allowedInterestRange`, `defaultInterestPart(prefill, range)`, `splitPayment`, `loanState` (paid, unpaid, balance, status, overdue), distribution `shareOf(available, n)` with remainder; pure functions on centavo integers
- [x] T022 [P] Create `lib/sinking-fund/ledger.ts`: savings delta per type, `foldSavings`, `fundAt`, `findNegativeDate(participantRows)` and `findNegativeFundDate(rows, distributions)` using the SQL ordering (date, credits first, created order) and returning the date and available amount for messages
- [x] T023 [P] Write `tests/unit/sinking-fund-rules.test.ts` and `tests/unit/sinking-fund-ledger.test.ts`: worked examples A, B and the withdrawal variant as fixtures, due-date clamping (Jan 31 to Feb 28, leap year), allowed range edges, back-dating cases from the quickstart, share and remainder math
- [x] T024 [P] Create `lib/sinking-fund/rankings.ts` (standard competition ranking 1, 1, 3, tie order by name, zero amounts last, week Monday-to-Sunday and month period math, previous and next, no future periods) and `tests/unit/sinking-fund-rankings.test.ts`
- [x] T025 [P] Create `lib/sinking-fund/url-state.ts` (parse and build `view`, `q`, `type`, `participant`, `from`, `to`, `loan_status`, `sort`, `dir`, `n`, `rank`, `period`, `at`, `psort`, `detail`, `hn` per [contracts/page-and-urls.md](contracts/page-and-urls.md); unknown values fall back to defaults) and `tests/unit/sinking-fund-url-state.test.ts`
- [x] T026 [P] Create `lib/validation/sinking-fund.ts` zod schemas for every action input in [contracts/server-actions.md](contracts/server-actions.md) (amounts through `parsePositiveCentavos`, loan multiple of 10,000 with the exact message "Loans must be in steps of ₱100 (₱100, ₱200, ₱300...).", date not after `fleetToday()`, void reason 3–300 characters, notes max 500, participant name 1–120 trimmed) and `tests/unit/sinking-fund-validation.test.ts`
- [x] T027 Hand-edit `types/database.ts`: add the three enums, the four tables (Row, Insert, Update), the two views, and every function signature from T011–T015
- [x] T028 Create `app/actions/sinking-fund.ts` scaffold with the shared helper that maps SQL error codes (`42501`, `P0002`, `P0001`, `23505`, `23514`) to `ActionError` codes and messages, a `requireOwnerAction()` that uses `requirePermission("manage_fund")`, a demo-mode guard throwing `DEMO_MODE` ("Demo mode doesn't save changes. Sign in to the live app to change the sinking fund."), and `revalidatePath("/sinking-fund")`; each story adds its own actions below
- [x] T029 [P] Create `lib/sinking-fund/demo-data.ts`: a seeded demo ledger (about 8 participants, 2 linked to demo drivers, at least 30 non-voided transactions so "Load more" shows after 25 rows, deposits, open, paid, overdue, and withdrawn loans, payments with different interest parts, one distribution) built through `ledger.ts`, plus exported selectors that mirror the SQL read functions (summaries, ranking, monthly flows); add `tests/unit/sinking-fund-demo-data.test.ts` checking no timeline goes negative
- [x] T030 Create `lib/sinking-fund/queries.ts`: server data loaders for the page (participants, ledger list with filters and `n`, fund summary, participant summaries, ranking, monthly flows, distribution history, participant detail with loans and history), each switching between Supabase calls and the demo selectors on `demoMode`

**Page shell**

- [x] T040 Create `app/(operations)/sinking-fund/page.tsx` and `loading.tsx`: `requireApprovedSession`, parse params with `url-state.ts`, load data for the active view only, render `PageHeader` (eyebrow "Savings and loans", title "Sinking fund"), pass `isOwner` down
- [x] T041 [P] Create `components/sinking-fund/view-toggle.tsx` (`SegmentedToggle` labelled "Sinking fund views": Transactions | Top participants | Participants; soft `router.replace` keeping other params appropriate to the view, `scroll: false`)
- [x] T042 [P] Create `components/sinking-fund/sinking-fund-page.tsx` client shell: header actions (owner-only "Fund settings" gear, wired in US10), toolbar with "+ Add participant" and "+ Add transaction" (primary), dialog state, toast hookup
- [x] T043 [P] Create `components/sinking-fund/type-tag.tsx` and `loan-status-tag.tsx`: icon, text, and color for Deposit (`ArrowDownToLine`, green), Loan (`HandCoins`, amber), Payment (`ReceiptText`, blue), Withdrawal (`DoorOpen`, red), Savings withdrawal (`Banknote`, orange), Interest share (`Coins`, purple) and statuses Open, Overdue, Paid, Withdrawn, using existing tokens only
- [x] T044 [P] Create `components/sinking-fund/money.tsx` helpers if `components/remittances/money-text.tsx` cannot be reused; otherwise reuse it and skip

**Checkpoint**: `corepack pnpm typecheck` and unit tests pass; `/sinking-fund` renders an empty shell in demo mode.

---

## Phase 3: User Story 1 - Open the page and add participants (P1)

**Goal**: Reach the page from the nav and add participants by name or by importing a driver.

**Independent Test**: Open `/sinking-fund`, add one participant by name and one by importing a driver, try a duplicate name; both appear with 0 savings and the second shows a "Driver" tag.

- [x] T050 [P] [US1] Write `tests/e2e/sinking-fund.spec.ts` section "participants" (demo mode: nav item opens the page, `?view=top` and `?view=participants` open directly, add dialog fields, duplicate-name inline error, Escape closes, 360 px no horizontal scroll)
- [x] T051 [P] [US1] Create `components/sinking-fund/dialogs/add-participant-dialog.tsx`: modal "Add participant" with "Import from drivers" (searchable dropdown of drivers not already participants, with Clear that unlinks and keeps the typed name), Name* (inline error "A participant named [name] already exists."), Notes; `react-hook-form` plus zod, keyboard accessible
- [x] T052 [US1] Add `addParticipant` to `app/actions/sinking-fund.ts` calling `sf_add_participant`, returning "Participant added"; and the loader in `lib/sinking-fund/queries.ts` for available drivers (drivers not already linked, not deleted)
- [x] T053 [US1] Wire the toolbar button in `components/sinking-fund/sinking-fund-page.tsx`, refresh views after save, show the toast
- [ ] T054 [P] [US1] Add a unit test for the dialog (duplicate name error rendering, driver import fills name and Clear keeps it) in `tests/unit/sinking-fund-add-participant.test.tsx`

**Checkpoint**: US1 works end to end; lint, typecheck, tests pass.

---

## Phase 4: User Story 2 - Record deposits and see savings (P1)

**Goal**: Record deposits; savings update everywhere; a basic ledger list shows them.

**Independent Test**: Add a ₱10,000 deposit; preview, toast, list row, and participant savings all show ₱10,000.00.

- [x] T060 [P] [US2] Write e2e section "deposits" in `tests/e2e/sinking-fund.spec.ts`: deposit preview "New total savings: ₱10,000.00", toast "Deposit recorded", future date and amount 0 blocked inline
- [x] T061 [US2] Create `components/sinking-fund/dialogs/add-transaction-dialog.tsx`: modal "Add transaction" with Participant* (searchable, active only, shows Total savings and Balance to pay below), Type* three-option control (Deposit | Loan | Payment), Date* (default today, no future), Amount*, Notes, `type`-specific part slots; deposit part shows "New total savings: ₱X" using `ledger.ts`; closes on Escape, traps focus, prefill props for participant and type
- [x] T062 [US2] Add `recordDeposit` to `app/actions/sinking-fund.ts` (idempotency key from the form) returning "Deposit recorded"
- [x] T063 [P] [US2] Create `components/sinking-fund/transactions-view.tsx` and `transaction-row.tsx`: list with columns Date | Participant | Type | Amount | Details | menu (card layout under 640 px), default newest first, amount signs (deposit "+"), deposit details "Savings after: ₱X", empty state "No transactions yet. Add a participant, then record their first deposit.", "Load more" link growing `n` by 25 from the first 25 rows; other types render their details in later stories
- [x] T064 [US2] Extend `lib/sinking-fund/queries.ts` to load the ledger list from `sf_ledger_v` with `n` limit and sort, and compute "Savings after" per row
- [x] T065 [US2] Mount the Transactions view in `app/(operations)/sinking-fund/page.tsx` and `components/sinking-fund/sinking-fund-page.tsx`; refresh after save

**Checkpoint**: US1 and US2 work together; deposits visible in the list.

---

## Phase 5: User Story 3 - Borrow from own savings and repay (P1)

**Goal**: Loans with interest tag and due date; payments with default interest parts; balance tracking.

**Independent Test**: Reproduce worked example A steps 1–4a through the UI.

- [x] T070 [P] [US3] Write e2e section "loans and payments" in `tests/e2e/sinking-fund.spec.ts`: loan preview "5% interest (₱100) · To pay: ₱2,100 · Due [date]", ₱150 and above-savings errors, quick-pick chips only within available savings, payment as staff with default interest part, "Pay full balance", Payment disabled with "No open loans", two-loan dropdown order
- [x] T071 [US3] Add the Loan part to `add-transaction-dialog.tsx` (or `components/sinking-fund/dialogs/loan-fields.tsx`): "Available to borrow: ₱X", amount stepping by ₱100, errors "Loans must be in steps of ₱100 (₱100, ₱200, ₱300...)." and "Loan cannot be higher than total savings (₱X).", chips ₱500, ₱1,000, ₱2,000, ₱5,000, the live tag, "New total savings: ₱X", and the date-aware message from `ledger.ts` for back-dated loans
- [x] T072 [US3] Add the Payment part (`components/sinking-fund/dialogs/payment-fields.tsx`): Loan* dropdown of the participant's open and overdue loans ("[loan date] · Due ₱[amount due] · Balance ₱[balance]", oldest first and preselected), error "Payment cannot be higher than the balance (₱X)." and "Pay full balance" link, the date field's minimum set to the chosen loan's date with the inline error "Payment date cannot be before the loan date ([date])." (client check in the dialog; the server enforces it too), read-only "Interest part" for non-owners showing the default with the hint "The owner can change this later.", preview "₱100 to the Interest fund · ₱400 back to savings · Balance after: ₱1,600" and "Loan fully paid"
- [x] T073 [US3] Add `recordLoan` and `recordPayment` to `app/actions/sinking-fund.ts` with the toasts "Loan recorded. To pay ₱2,100 by Dec 3", "Payment recorded. Balance ₱1,600", "Payment recorded. Loan fully paid"; the action drops the interest part for non-owners
- [x] T074 [P] [US3] Extend `transaction-row.tsx` details for Loan ("5% interest (₱100) · To pay ₱2,100 · Due Dec 3", status tag, "Balance ₱X", "Interest collected ₱X of ₱100") and Payment ("For loan on [date] · ₱100 interest to fund · ₱400 to savings · Balance after ₱1,600" or "Loan fully paid"); amount signs and formats per spec section 11
- [x] T075 [US3] Add row menu `components/sinking-fund/transaction-row-menu.tsx` with "View participant" and, on loans, "Add payment" (opens the dialog with Payment and that loan selected); owner actions are added in later stories
- [x] T076 [P] [US3] Load loan state per participant for the dialog in `lib/sinking-fund/queries.ts` (open loans with balance, unpaid interest and principal, savings, balance to pay)

**Checkpoint**: Worked example A passes through the UI; lint, typecheck, tests, and pgTAP (with owner OK) pass.

---

## Phase 6: User Story 4 - Owner controls the interest part (P1)

**Goal**: Owner sets the interest part when recording a payment and changes it later.

**Independent Test**: Reproduce worked example B as the owner; change step 1's interest part; confirm totals and the audit entry; confirm out-of-range is blocked.

- [x] T080 [P] [US4] Write e2e section "interest part" in `tests/e2e/sinking-fund.spec.ts` (owner editable field with "Allowed: ₱0 to ₱100", "None" and "All unpaid interest" buttons, out-of-range error, re-prefill until edited, staff sees read-only)
- [x] T081 [US4] Make the Interest part editable for the owner in `payment-fields.tsx`: prefill from the default setting, re-prefill on amount or loan change until edited, "Unpaid interest: ₱X" beside it, "Allowed: ₱X to ₱Y", error "Interest part must be between ₱X and ₱Y for this payment.", quick buttons "None" (minimum) and "All unpaid interest" (maximum); read the range through `sf_allowed_interest_range` or `rules.ts`
- [x] T082 [US4] Create `components/sinking-fund/dialogs/change-interest-part-dialog.tsx`: payment summary (date, amount, current parts), loan interest, interest paid by other payments, unpaid principal, field with the allowed range, effect preview ("Interest fund +₱100 · Total savings -₱100"), blocking explanation when savings or the fund would go negative
- [x] T083 [US4] Add `changeInterestPart` to `app/actions/sinking-fund.ts` (`manage_fund`) returning "Interest part updated"; add "Change interest part" (owner only, hidden for payments on withdrawn loans, "Owner only" tooltip otherwise) to `transaction-row-menu.tsx`
- [ ] T084 [P] [US4] Surface the audit entry: confirm `audit_business_change` rows for `sf_transactions` show old and new interest part on the Audit page; add the entity label for `sf_transactions`, `sf_participants`, `sf_distributions`, `sf_settings` to `lib/pagination/search-specs.ts` (`auditActionLabels` neighbors) if audit lists need labels

**Checkpoint**: P1 stories (US1–US4) complete. MVP stop point.

---

## Phase 7: User Story 5 - Distribute the Interest fund (P2)

**Goal**: Owner distributes the fund in equal shares; shares added to savings.

**Independent Test**: With ₱100 in the fund and three active participants: "Each participant gets ₱33.33" and "₱0.01 stays in the fund."; confirm; verify savings, fund, history, audit.

- [x] T090 [P] [US5] Write e2e section "distribution" in `tests/e2e/sinking-fund.spec.ts` (demo mode renders the card and modal math; Distribute button hidden for staff; remainder text)
- [x] T091 [P] [US5] Create `components/sinking-fund/interest-fund-card.tsx`: "Interest fund ₱X", "Collected ₱X all time · Distributed ₱X", "Expected ₱X from open loans", owner-only "Distribute" button, "View history" link, optional December reminder "Year end is near. Distribute the interest fund?"
- [x] T092 [US5] Create `components/sinking-fund/dialogs/distribute-dialog.tsx`: title "Distribute interest", available amount, checklist of active participants all ticked, live "Each participant gets ₱X" and "₱0.01 stays in the fund." using `shareOf`, Date (default today, no future), Notes, buttons "Cancel" and "Distribute ₱X"; cannot confirm with nothing available or nobody ticked
- [x] T093 [US5] Add `distributeInterest` to `app/actions/sinking-fund.ts` (`manage_fund`) with the toast "₱X distributed to N participants. Shares added to their savings."
- [x] T094 [P] [US5] Create `components/sinking-fund/dialogs/distribution-history-dialog.tsx` (date, total, per participant, number of participants, voided marker, owner "Void distribution" wired in US10) and its loader in `queries.ts`
- [x] T095 [US5] Add Interest share row rendering to `transaction-row.tsx` ("Share of ₱X distributed on [date] (N participants) · added to savings", "+" amount)

**Checkpoint**: US5 independently testable.

---

## Phase 8: User Story 6 - Overdue loans and loan Withdrawal (P2)

**Goal**: Overdue tags everywhere; owner closes an overdue loan without changing savings.

**Independent Test**: Past-due loan with a partial payment shows Overdue; owner marks withdrawal; savings unchanged; the record text appears.

- [x] T100 [P] [US6] Write e2e section "withdrawal" in `tests/e2e/sinking-fund.spec.ts` (overdue tag and card pill from demo data; menu action only on overdue loans; owner-only tooltip for staff)
- [x] T101 [US6] Create `components/sinking-fund/dialogs/loan-withdrawal-dialog.tsx`: "Mark this loan as withdrawal?" with rows Participant, Loan date, Principal, Amount due, Paid so far (interest and principal), Unpaid principal, Unpaid interest (to be waived), "Total savings after: ₱X (unchanged)", the explanatory text, "Cancel" and red "Mark as withdrawal"
- [x] T102 [US6] Add `markLoanWithdrawal` to `app/actions/sinking-fund.ts` (`manage_fund`) returning "Loan closed as withdrawal. Savings unchanged."; add "Mark as withdrawal" to the row menu for overdue loans (owner only)
- [x] T103 [P] [US6] Add Withdrawal row rendering ("Loan on [date] closed. ₱1,600 unpaid (₱X interest waived). Savings unchanged.", amount with the word "closed" and no sign) and the Withdrawn loan record text "Paid ₱500 of ₱2,100. ₱1,600 closed as withdrawal on [date]." in `transaction-row.tsx`

**Checkpoint**: US6 independently testable.

---

## Phase 9: User Story 7 - Transactions view: summary, filters, sort (P2)

**Goal**: Complete the Transactions view.

**Independent Test**: With all types present: five summary cards, filters with chips and "Clear all", search, sort, "Load more" after 25.

- [x] T110 [P] [US7] Write e2e section "transactions view" in `tests/e2e/sinking-fund.spec.ts` (five cards, filter chips, Clear all, sort by amount, Load more after 25 using enough demo rows)
- [x] T111 [P] [US7] Create `components/sinking-fund/summary-strip.tsx` with the five Transactions cards (Total savings, Loans outstanding with "N open", Balance to collect, Payments received following the date filter, Interest fund) and the Participants-view variant (Total savings, Total loans, Balance to collect, Interest fund, Participants count) using `interest-fund-card`
- [x] T112 [US7] Add a `sinkingFund` spec to `lib/pagination/list-control-specs.ts` and `lib/pagination/search-specs.ts` (filters Type, Participant, Date range, Loan status; search participant name or notes; sort date and amount) and use `parseControls`/`applyFilters`/`applySort` in `queries.ts`
- [x] T113 [US7] Add the toolbar to `transactions-view.tsx`: search, Filters, active chips with "Clear all", "+ Add participant" and "+ Add transaction" beside Filters
- [x] T114 [P] [US7] Load the summary through `sf_fund_summary(from, to)` in `queries.ts` and render notes as a tooltip or second line in `transaction-row.tsx`

**Checkpoint**: US7 independently testable.

---

## Phase 10: User Story 8 - Top participants (P3)

**Goal**: Ranking by Total savings or Deposits for All time, Monthly, Weekly.

**Independent Test**: Ties share rank and trophy; month and week arrows work; zero rows last.

- [x] T120 [P] [US8] Write e2e section "top participants" in `tests/e2e/sinking-fund.spec.ts` (default rank and period, month and week arrows, trophy labels "1st place" and so on, row click opens detail)
- [x] T121 [US8] Create `components/sinking-fund/top-view.tsx`: Rank by and Period segmented controls with arrows ("November 2026", Monday-to-Sunday weeks, no future), ranked rows with rank number, `Trophy` icons (gold, silver, bronze tokens, `aria-label` "1st place", "2nd place", "3rd place"), name with Driver tag, amount, thin relative bar, larger tinted top-3 cards, zero-amount rows last behind "Show all" above 10, archived excluded
- [x] T122 [US8] Load `sf_ranking` in `queries.ts` and apply `rankings.ts` for ties and order; mirror with demo selectors; row click sets `detail`

**Checkpoint**: US8 independently testable.

---

## Phase 11: User Story 9 - Participants view, charts, detail (P3)

**Goal**: Overview totals, charts with table alternatives, participant cards, detail sheet.

**Independent Test**: Totals, both charts and tables, card grid 4/2/1, search, sort, detail sheet contents.

- [x] T130 [P] [US9] Write e2e section "participants view" in `tests/e2e/sinking-fund.spec.ts` (cards per row at desktop, tablet, 360 px; View as table toggles; detail sheet opens from a card and closes)
- [x] T131 [P] [US9] Create `components/sinking-fund/charts/donut-chart.tsx` (SVG, top 5 plus "Others", legend with names and amounts, patterns plus labels so color is not the only cue) and `charts/monthly-bars.tsx` (grouped Deposits, Loans, Payments for the last 6 months with legend), and `charts/chart-table.tsx` (the "View as table" alternative using `components/ui/table`) with `tests/unit/sinking-fund-charts.test.tsx`
- [x] T132 [P] [US9] Create `components/sinking-fund/participant-card.tsx`: name, Driver tag, "Overdue" pill, Total savings (largest), Total loans, Balance to pay, "Last transaction: [date]", "Add transaction" button (prefilled), 3-dot menu "View details", "Edit name", "Archive" (wired in US10)
- [x] T133 [US9] Create `components/sinking-fund/participants-view.tsx`: summary strip, the two charts side by side on desktop and stacked on mobile, search field, sort control (Highest savings, Name A to Z, Highest balance to pay), grid `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`, empty state "No participants yet. Add your first participant."
- [x] T134 [US9] Create `components/sinking-fund/participant-detail-sheet.tsx` (`components/ui/sheet`): three figures, interest shares received, loans list with principal, interest, amount due, interest paid, principal paid, balance, due date, status and actions ("Add payment", "Mark as withdrawal", "Change interest part" for owner), history newest first with "Load more" (`hn`), "Add transaction" prefilled; opened by `detail` param
- [x] T135 [US9] Load `sf_participant_summaries`, `sf_monthly_flows`, and detail data in `queries.ts` and demo selectors

**Checkpoint**: US9 independently testable.

---

## Phase 12: User Story 10 - Void, archive, settings, rename (P3)

**Goal**: Owner corrections and management.

**Independent Test**: Void each type including blocked cases; archive with and without savings or open loans; rename a linked participant; change Fund settings.

- [x] T140 [P] [US10] Write e2e section "corrections" in `tests/e2e/sinking-fund.spec.ts` (void confirmation requires a reason, voided rows struck through with "Voided", Owner-only tooltips for staff, Fund settings dialog and read-only constants)
- [x] T141 [P] [US10] Create `components/sinking-fund/dialogs/void-dialog.tsx` (`alert-dialog`, required reason 3–300 characters) and add "Void transaction" (owner) to the row menu, with "Void distribution" for interest shares and surfaced blocked-void messages from the server
- [x] T142 [P] [US10] Create `components/sinking-fund/dialogs/fund-settings-dialog.tsx`: title "Fund settings", radio "Take interest first" (default) and "Take interest last" with help text "This only pre-fills the payment form and is used for payments recorded by others. You decide the interest part of each payment, and can change it later.", read-only Interest rate 5%, Loan steps ₱100, Loan term 1 month, toast "Fund settings saved."; wire the owner-only gear button in `sinking-fund-page.tsx`
- [x] T143 [P] [US10] Create `components/sinking-fund/dialogs/edit-name-dialog.tsx` (confirmation when the participant is driver-linked: the link will be removed) and `archive-dialog.tsx` (disabled with the reason when savings are above 0 or loans are open)
- [x] T144 [US10] Add `voidTransaction`, `voidDistribution`, `saveFundSettings`, `renameParticipant`, `archiveParticipant` to `app/actions/sinking-fund.ts` with the toasts in the contract; wire the card menu items and the distribution history void
- [x] T145 [US10] Render voided rows (strikethrough text and "Voided" tag) in `transaction-row.tsx` and exclude voided rows from totals in the demo selectors

**Checkpoint**: US10 independently testable.

---

## Phase 13: User Story 11 - Savings withdrawal (P2)

**Goal**: Owner pays savings back out; enables archiving a leaving participant.

**Independent Test**: Deposit ₱5,000, withdraw ₱2,000 then ₱3,000, savings reach ₱0, archive succeeds; non-owner blocked.

- [x] T150 [P] [US11] Write e2e section "savings withdrawal" in `tests/e2e/sinking-fund.spec.ts` (owner action in card menu, detail, and Type control; error "Withdrawal cannot be higher than total savings (₱X)."; staff sees Owner only)
- [x] T151 [US11] Create `components/sinking-fund/dialogs/savings-withdrawal-dialog.tsx`: participant, date (no future), amount, notes, "Savings after: ₱X" preview, the exact error text, toast "Savings withdrawal recorded"
- [x] T152 [US11] Add `recordSavingsWithdrawal` to `app/actions/sinking-fund.ts` (`manage_fund`); add "Withdraw savings" to the participant card menu, detail sheet, and the owner-only Type option in `add-transaction-dialog.tsx`
- [x] T153 [P] [US11] Add Savings withdrawal row rendering (orange tag via `type-tag.tsx`, "-" amount, "Savings after: ₱X") in `transaction-row.tsx` and include the type in the Type filter options

**Checkpoint**: US11 independently testable.

---

## Phase 14: Polish and cross-cutting

- [ ] T160 [P] Accessibility pass for every dialog and the sheet: focus trap, Escape, labelled controls, `aria-label` on trophies, chart tables, tooltips on disabled owner-only actions; extend `tests/e2e/accessibility-mobile.spec.ts` to cover `/sinking-fund` views and dialogs at 360 px
- [x] T161 [P] Check every screen at 360 px (no horizontal scroll) and confirm no hex colors or arbitrary sizes were added under `components/sinking-fund/`
- [x] T162 [P] Add a short "Sinking fund" section to `docs/DEVELOPMENT.md`: rules summary, centavo storage, owner-only actions, how to run the new pgTAP files and Vitest tests
- [x] T163 Run `corepack pnpm lint`, `typecheck`, `test`, `test:e2e`, `check`, and `build:vinext`; fix anything the vinext check flags in the new route
- [ ] T164 With the owner's OK, run the full pgTAP suite against `rolnet-dev` (all four new files plus every existing file) and the quickstart scenarios 1–6 on the live dev server at :3000; record results in `specs/015-sinking-fund/quickstart.md` notes if anything differs
- [ ] T165 Run `/speckit-analyze` for cross-artifact consistency before opening the PR

---

## Dependencies and execution order

- Phase 1 (T001–T006) has no prerequisites; T003 needs T002.
- Phase 2 blocks every story. Inside it: T010 → T011 → T012 → T013 → T014 (one migration file, sequential) and T015 after T010; T016–T019 after their migrations (T020 needs owner approval); T021–T026, T029 are independent of SQL and can run beside it; T027 after T014/T015; T028 after T026/T027; T030 after T027/T029; T040 after T030; T041–T044 after T005.
- Stories after Phase 2: US1 → US2 → US3 → US4 are sequential (each extends the add-transaction dialog and list). US5, US6, US7, US8, US9, US10, US11 each need only Phase 2 plus the pieces of US2/US3 they extend (US5 needs the list rows from US2; US6 needs loans from US3; US9 detail is reused by US8 row clicks, so build T134 before T122's click wiring or stub it). US11 can start after US2.
- Within a story: e2e test task first (it can be written before the code), then components, then actions.
- Polish after all chosen stories; T164 and T165 last.

### Parallel opportunities

- Phase 1: T001, T002, T004, T005, T006 together.
- Phase 2: T016–T019 together once migrations exist; T021–T026 and T029 together while migrations are written; T041–T044 together.
- Per story: the `[P]` e2e task, dialog component, and row-rendering tasks touch different files.
- After US4, US5, US6, US7, US8, US9, US11 can be split among people or sessions; avoid two writers on `transaction-row.tsx`, `transaction-row-menu.tsx`, `app/actions/sinking-fund.ts`, or `add-transaction-dialog.tsx` at once.

## Implementation strategy

- **MVP**: Phases 1–2 plus US1, US2, US3, US4 (all P1). That delivers participants, deposits, loans, payments, and owner-controlled interest, with the list. Distribution, withdrawals, and corrections follow.
- **Increment order after MVP**: US11 (so participants can leave), US5 (distribute), US6 (overdue and write-off), US7 (full list controls), US10 (corrections), then US8 and US9 (views and charts).
- **Safety**: all three migrations are written and reviewed before any is applied; apply once after T020 passes, then do not edit them (fixes become new migrations).
- Commit per phase or story on branch `015-sinking-fund` once the owner asks.

## Implementation notes (2026-11-13)

Done and verified here: lint, typecheck, Vitest (the one failure in a full run, `purge-document-files`, is a
load-related timeout that passes on its own), `vinext check`, `build:vinext`, and 12 Playwright tests in demo
mode at 360 px.

**pgTAP (T020, done 2026-11-13, owner approved):** the four new files were dry-run with the migrations prepended
(one rolled-back transaction each), two bugs were fixed in the unpushed migrations (the ledger view's window sums
were `numeric`, now `bigint`; the archive check now names open loans first), then the three migrations were pushed
to `rolnet-dev` and the files re-run against the real schema: 410 18/18, 420 86/86, 430 18/18, rls/100 27/27.
The full existing pgTAP suite was not re-run (only `080_business_audit`, `rls/001_foundation_rls`, and
`110_delete_restore`, which pass); the new migrations only add objects.

**Left open:** T054 (dialog unit test; the e2e spec covers the same behavior), T084 (check the Audit page against
real data), T160 (extend the accessibility e2e), T164 (quickstart walkthrough on the live :3000 server), T165.

**Deviations from the task text:**
- T010: `sf_settings.id` is a fixed uuid (not a smallint), so the shared `audit_business_change` function is not
  touched. The ledger view also carries `loan_status`, `loan_balance_centavos`, `loan_interest_paid_centavos`,
  `loan_paid_centavos` and `loan_withdrawn_on` for the list's Details column and the Loan status filter.
- T011/T014: `sf_today()` is granted to `authenticated` (the invoker views call it). The read functions are
  `security definer` with an approval check, because invoker functions cannot call the ungranted savings helpers.
- T013: `sf_mark_loan_withdrawal` takes the expected balance, not an updated_at (payments do not change the loan row).
- T042/T061/T071/T072/T081/T151: the Add transaction dialog is one file and also serves Savings withdrawal (an
  owner-only type), so there is no separate savings-withdrawal, payment-fields, or loan-fields file. The tags (T043)
  are in `type-tag.tsx`, the charts (T131) in `charts/charts.tsx`, the card (T132) inside `participants-view.tsx`,
  and the row menu (T075) inside `transaction-row.tsx`.
- T112: the Transactions search is done in `queries.ts` (participant name and notes), not through a `search-specs` entry.
- T141/T143: the void, rename, and archive dialogs use the standard dialog (they need a text field), not `alert-dialog`.
- Added design tokens (violet, orange, gold, silver, bronze) to `app/globals.css` and `DESIGN.md`.
