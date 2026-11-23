---

description: "Task list for the participant loans redesign"
---

# Tasks: Participant Loans Redesign

**Input**: Design documents from `/specs/022-participant-loans-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/loans-section.md, quickstart.md

**Tests**: Included. The repo's definition of done requires lint, typecheck and tests to pass. Helper rules get Vitest unit tests; the section gets Playwright (demo mode) coverage.

**Organization**: Grouped by user story. US1, US2 and US3 all live in one new client component, so their tasks run in order inside `components/sinking-fund/participant-loans.tsx`; tasks marked [P] touch different files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task serves (US1, US2, US3)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Read model and data the section needs. No schema change.

- [X] T001 Add the `SfLoanPayment` type (`id`, `loan_id`, `tx_date`, `amount_centavos`, `interest_part_centavos`, `principal_part_centavos`, all money as integer centavos) to `lib/sinking-fund/types.ts` per data-model.md
- [X] T002 Add `payments: SfLoanPayment[]` (oldest first) to `SfParticipantPageData` in `lib/sinking-fund/queries.ts`, and fill it in `loadParticipantPage`: database branch reads `sf_ledger_v` where `participant_id = id`, `type = 'payment'`, `voided_at is null` (drop any row whose `loan_id` is null), selecting `id, loan_id, tx_date, amount_centavos, interest_part_centavos, principal_part_centavos`, ordered by `tx_date` then `created_at`, run in the existing `Promise.all`; demo branch builds the same rows from `ledgerRows(demoSfData, today)` filtered to this participant's non-voided payments
- [X] T003 [P] Add optional `amountCentavos?: number` to `TransactionDialogInitial` in `components/sinking-fund/dialogs/add-transaction-dialog.tsx` and seed `amountText` from it (use the existing centavo-to-input formatting in `lib/money/centavos.ts`; do not format by hand); the form's validation and the server remain unchanged
- [X] T004 [P] In `lib/sinking-fund/demo-data.ts` give the existing participant Hugo Dela Cruz (no savings and no loans today) a many-loans history, added after the year-end close block so the stored distribution figures do not change: 5 open loans (one overdue, one with a part payment), 8 paid loans and 1 withdrawn loan spread over two calendar years (some dated more than 400 days ago). Build them as integer centavos with the existing `loan` and `payment` helpers. Then run `corepack pnpm test` and the existing sinking-fund e2e spec to confirm no fund-level count or total assertion broke, and change an expected value only where Hugo's new loans legitimately change it

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure rules every story renders. Must finish before any story.

**CRITICAL**: US1, US2 and US3 all depend on this module.

- [X] T005 Create `lib/sinking-fund/loan-list.ts` exporting, with the exact rules in data-model.md "Derived in the browser": `splitLoans(loans)` (active = `status === "open"`, closed = `paid` or `withdrawn`), `sortActive(loans)` (overdue first, then `due_date` ascending, then `loan_date` ascending), `sortClosed(loans)` (`loan_date` descending), `daysLeft(dueDate, today)` and `dueText(days)` ("Overdue by N days", "Due today", "1 day left", "N days left"; `soon` flag at 7 days or fewer), `activeSummary(loans)` (count, total `balance_centavos`, overdue count), `percentPaid(loan)` (`round((interest_paid + principal_paid) / amount_due * 100)`, 0 when amount due is 0), `barShares(loan)` (interest and principal shares of `amount_due_centavos`), `paymentsByLoan(payments)`, `closedYears(loans)` (years newest first), `closedView(loans, year, page)` (filter by year, page size constant `closedPageSize = 5`, clamp page to `1..lastPage`, return rows plus a `ListPageState`-shaped `{ page, lastPage, total, rangeLabel }`, plus `repaidCentavos` = sum of `amount_due_centavos` of `paid` loans in the filter). No floating-point money: percent is display only
- [X] T006 [P] Create `tests/unit/sinking-fund-loan-list.test.ts` covering: active/closed split; urgency order with an overdue loan, equal due dates and mixed statuses; `dueText` for -34, 0, 1, 7, 22 days; summary totals and overdue count; `percentPaid` including amount due 0; closed ordering; year list and filter; paging of 14 loans into 3 pages of 5, page clamped past the end, year change returning page 1; `repaidCentavos` excluding withdrawn loans; a zero balance and rounding never produce a displayed balance below 0

**Checkpoint**: `corepack pnpm exec vitest run tests/unit/sinking-fund-loan-list.test.ts` passes.

---

## Phase 3: User Story 1 - Scan a participant's open loans at a glance (Priority: P1) MVP

**Goal**: Compact, urgency-ordered active loan rows with a summary, replacing the tall cards.

**Independent Test**: Open a participant with five active loans (one overdue) at 360 px; all rows and the summary are visible, the overdue loan is first and distinct, and the summary matches.

- [X] T007 [US1] Create `components/sinking-fund/participant-loans.tsx` ("use client") exporting `ParticipantLoans({ loans, payments, today, isOwner })`: section `data-testid="sf-loans"`, heading "Loans", summary chips (`sf-loans-summary`: active count, `formatPesos` of total to pay, overdue count only when above 0), and "No loans yet." when `loans` is empty (no tabs). Render the **Active** tab content only for now: one `<button data-testid="sf-loan-row">` per active loan from `sortActive`, with status tag (reuse `LoanStatusTag` from `components/sinking-fund/type-tag.tsx` with `overdue ? "overdue" : status`), loan date (`formatListDate`) with `formatPesos(principal)`, `formatPesos(balance)` of `formatPesos(amount_due)` with the two-segment bar (violet interest, ok principal, widths through a CSS variable, no arbitrary class sizes), due text and due date, chevron. Overdue rows get a left rule in the danger token plus the tag and text. Layout wraps to two lines at 360 px with no horizontal scroll. Rows are not expandable yet. Paid and withdrawn loans are not shown until the Paid and closed tab exists (T013), so US1 and US2 must not be merged without US3
- [X] T008 [US1] In `components/sinking-fund/participant-page.tsx` replace the `<section aria-label="Loans">` card list with `<ParticipantLoans loans={loans} payments={data.payments} today={shared.today} isOwner={isOwner} />` and remove the `openLoan` helper and any import (`LoanStatusTag`, `formatListDate`, parts of `useSfActions`) that becomes unused; lint confirms nothing is left over
- [X] T009 [US1] Update `tests/e2e/sinking-fund.spec.ts`: replace the `sf-detail-loan` assertion with checks that `sf-loans-summary` and at least one `sf-loan-row` are visible on the participant page, that rows are ordered with overdue first when present, and that the page has no horizontal scroll at 360 px (`scrollWidth <= clientWidth`)

**Checkpoint**: US1 works alone: compact rows, summary and ordering.

---

## Phase 4: User Story 2 - Open a loan to see the details and act on it (Priority: P1)

**Goal**: Expand one loan at a time to the full breakdown, payments and actions, including Pay full balance.

**Independent Test**: Tap a row; every figure from the old card, the payment list and the actions are present; Add payment and Pay full balance open the dialog on that loan; tapping another row collapses the first.

- [X] T010 [US2] In `components/sinking-fund/participant-loans.tsx` add expansion state (one expanded loan id per tab; all rows start collapsed, tapping a row expands it and collapses any other, and tapping an expanded row collapses it; keep the id only if the loan is still in the tab after a refresh) with `aria-expanded` and `aria-controls` on each row and a detail region `data-testid="sf-loan-detail"` showing: `principal + interest = amount due` (all via `formatPesos`), legend "Interest paid X of Y", "Principal paid X of Y", "N% paid" (`percentPaid`), due date, and the payment list (`sf-loan-payment`: date, amount, interest part, principal part from `paymentsByLoan`) or "No payments yet."
- [X] T011 [US2] In the detail region add actions using `useSfActions()` from `components/sinking-fund/sinking-fund-shell.tsx`: **Add payment** (`sf-loan-add-payment`) calls `addTransaction({ participantId: loan.participant_id, type: "payment", loanId: loan.id })`; **Pay full balance (₱X)** (`sf-loan-pay-full`, only when `balance_centavos > 0`) adds `amountCentavos: loan.balance_centavos`; **Mark as withdrawal** (`sf-loan-withdraw`) on overdue loans: owner calls `loanWithdrawal(openLoan)` where `openLoan` comes from `data.openLoans`, staff gets a disabled button titled "Owner only" (labels exactly as the current card). Buttons use 44 px touch targets and the existing `Button` variants
- [X] T012 [US2] Extend `tests/e2e/sinking-fund.spec.ts`: tap a row and assert the breakdown, legend and payment list; tap a second row and assert the first collapses (`aria-expanded`); Add payment opens the Add transaction dialog with the participant and loan selected; Pay full balance opens it with the amount equal to the loan balance; save a payment and assert the row and summary update without a manual reload (FR-016); staff sees Mark as withdrawal disabled on an overdue loan

**Checkpoint**: US1 and US2 together replace everything the old card did.

---

## Phase 5: User Story 3 - Keep paid and closed loans out of the way (Priority: P2)

**Goal**: A Paid and closed tab with 5 loans per page, page controls and a year filter.

**Independent Test**: With 14 closed loans over 2 years, the tab shows 5 rows and 3 pages; page 2 shows the next 5; picking a year filters, returns to page 1 and updates the repaid total.

- [X] T013 [US3] In `components/sinking-fund/participant-loans.tsx` add the tablist (`role="tablist"`, tabs "Active (n)" and "Paid and closed (n)" with `role="tab"` and `aria-selected`, panel `role="tabpanel"`), defaulting to Active, hiding the tabs when there are no loans. Closed tab: header "N loans, ₱X repaid" from `closedView`, a "Year" select (`sf-loans-year`, "All years" first, `closedYears`) that resets the page to 1, rows with status (Paid or Withdrawn via `LoanStatusTag`), loan date, `formatPesos(amount_due)`, "Paid off {date}" or "Closed {date}" (`withdrawn_on`), and expansion: "repaid in full" or "paid X of Y; Z closed as withdrawal on {date}". Render the shared `Pagination` from `components/ui/pagination.tsx` with `onPage` (pass `pathname` and `searchParams` for its href props) and the 5-per-page state from `closedView`. Empty messages: "No active loans." and "No paid or closed loans yet."
- [X] T014 [US3] Extend `tests/e2e/sinking-fund.spec.ts`: switch to the Paid and closed tab and assert at most 5 rows, the page controls when there are more than 5 loans, that going to page 2 shows different rows, that choosing a year returns to page 1 and changes the count, that the empty states appear for a participant with no closed loans (use Hugo Dela Cruz's demo loans from T004: 9 closed loans over two years give 2 pages)

**Checkpoint**: All three stories work independently and together.

---

## Phase 6: Polish and Cross-Cutting Concerns

- [ ] T015 [P] Verify dark theme and keyboard use on the section: tabs and rows reachable with Tab and toggled with Enter or Space, overdue and status readable without color, bar legend present; fix token usage in `components/sinking-fund/participant-loans.tsx` if any hex color or arbitrary size slipped in (`grep` for `#` colors and `[` size classes)
- [X] T016 [P] Check for leftovers: no remaining reference to the removed `sf-detail-loan` test id or the old card markup in `components/`, `tests/` and `docs/`
- [ ] T017 Run `corepack pnpm typecheck`, `corepack pnpm exec eslint` on the changed files, `corepack pnpm test`, and `corepack pnpm test:e2e tests/e2e/sinking-fund.spec.ts` (demo mode; the e2e run needs the :3000 live server stopped or a free port, ask the user first)
- [ ] T018 Run the quickstart walkthrough at desktop width and at 360 px, owner then staff, in light and dark theme (or hand it to the user), then mark the checklist verified and record any deviations in `specs/022-participant-loans-redesign/checklists/requirements.md`

---

## Dependencies and Execution Order

- **Phase 1** first. T001 before T002; T003 and T004 are independent ([P]).
- **Phase 2** needs T001. T005 before T006's assertions can pass (the test file can be written alongside).
- **US1 (Phase 3)** needs Phase 2, T002 and T004 (the e2e checks use Hugo Dela Cruz's loans). **US2 (Phase 4)** needs US1 (same component) and T003. **US3 (Phase 5)** needs US1; it can follow US2 or precede it, but both edit `participant-loans.tsx`, so do them one after the other.
- **Polish** after the stories.

## Parallel Opportunities

- T003 (dialog prop) and T004 (demo data) run alongside T001 and T002.
- T006 (unit tests) runs alongside T005 once the function signatures are fixed.
- T015 and T016 run in parallel after US3.

## Implementation Strategy

1. **Build order**: Phases 1 and 2, then US1, US2, US3. US1 alone fixes the readability complaint but is not shippable: it drops the old card's actions (until US2) and hides paid and withdrawn loans (until US3).
2. **Release**: US1, US2 and US3 together, then polish and verification.
3. Commit per phase checkpoint if the user asks; nothing is committed automatically.
