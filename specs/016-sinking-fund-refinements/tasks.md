---

description: "Task list for Sinking Fund Refinements (feature 016)"
---

# Tasks: Sinking Fund Refinements

**Input**: Design documents from `/specs/016-sinking-fund-refinements/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. The plan and quickstart require Vitest, pgTAP, and Playwright coverage, and the project rule is that a task is done only when lint, typecheck, and tests pass (plus the pgTAP suite when the schema changes).

**Organization**: Grouped by user story so each can be built and checked on its own. Story numbers follow spec.md: US1 proportional distribution and year-end close (P1), US2 distribution history, details, and Excel (P1), US3 divider lines (P2), US4 participant pop-up (P2), US5 chart (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US5 (story phases only)
- Paths are from the repository root. Commands always use `corepack pnpm`.

## Rules every task must respect (CLAUDE.md, constitution)

- Money is integer centavos; format and parse only with `lib/money/centavos.ts`.
- Schema, functions, RLS change only through **new** files in `supabase/migrations/`, never an edited pushed migration. pgTAP files live in `supabase/tests/constraints/` and `supabase/tests/rls/` (existing sinking fund files: `410`, `420`, `430`, `100_sinking_fund_rls.sql`).
- New `public` functions start with no EXECUTE for `anon` or `authenticated`; grant `authenticated` explicitly only where the app calls them; `security definer` functions call `require_owner()`.
- pgTAP runs against `rolnet-dev` through the rollback wrapper; **ask the owner before running it** (no local Supabase).
- `types/database.ts` is hand-maintained: add the enum value, table, and function types by hand; do not regenerate.
- UI: shadcn `base-nova` components, tokens from `app/globals.css`, no hex colors or arbitrary sizes in components, works at 360 px.
- Read the relevant guide in `node_modules/next/dist/docs/` before changing the route handler (this Next.js has breaking changes).

---

## Phase 1: Setup

**Purpose**: Confirm the starting point so the later migrations and tests land on a known state.

- [X] T001 Create the `016-sinking-fund-refinements` branch from the current `015-sinking-fund` tip only after the owner agrees (the working tree has uncommitted search-bar changes; do not commit or move them). If the owner prefers, keep working on the current branch and note it in the task log.
- [X] T002 [P] Read the route-handler and caching pages in `node_modules/next/dist/docs/` and write a short note in your task log on what applies to a `GET` route handler that reads the session and returns binary data; T031 uses that note.
- [X] T003 [P] Run `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm test` and record the baseline (all must pass before any change). Then, after asking the owner to stop their `:3000` dev server (one `next dev` per folder, and it runs on real data), start the `demo-dev` entry from `.claude/launch.json` (port 3200) and run `PLAYWRIGHT_BASE_URL=http://localhost:3200 corepack pnpm exec playwright test tests/e2e/sinking-fund.spec.ts --project=mobile`; record which cases already fail, if any; stop the demo server and restart `:3000` afterwards. Use the same recipe for every e2e run in this list.

---

## Phase 2: Foundational (blocks every user story that touches money or history)

**Purpose**: The database shape and shared types that US1 and US2 both need. US3, US4, and US5 do not depend on this phase and can start right after Phase 1.

- [X] T004 Create `supabase/migrations/20261114000100_sf_cycle_close_enum.sql` containing only `alter type public.sf_transaction_type add value 'cycle_close';` with a header comment naming feature 016 and why it is a separate file (a new enum value cannot be used in the transaction that adds it).
- [X] T005 Create `supabase/migrations/20261114000200_sf_proportional_distribution.sql` (part 1: structure). Follow data-model.md exactly: (a) `alter table public.sf_distributions alter column per_participant_centavos drop not null`; keep `> 0` when set; (b) drop and recreate `sf_distributions_total` as `per_participant_centavos is null or total_distributed_centavos = per_participant_centavos * participant_count` and `sf_distributions_remainder` as `remainder_centavos = available_before_centavos - total_distributed_centavos and remainder_centavos >= 0` plus, when `per_participant_centavos` is set, `remainder_centavos < participant_count`; (c) drop and recreate `sf_transactions_shape` adding the case `cycle_close` = `loan_id is null and distribution_id is not null and interest_rate_bp is null and interest_centavos is null and amount_due_centavos is null and due_date is null and interest_part_centavos is null and principal_part_centavos is null and interest_set_by is null and interest_waived_centavos is null` (keep every existing case); (d) create `public.sf_distribution_participants` with columns `distribution_id uuid` (FK `sf_distributions(id)`), `participant_id uuid` (FK `sf_participants(id)`), `participant_name text`, `savings_before_centavos bigint check (>= 0)`, `share_centavos bigint check (>= 0)`, `ended_total_centavos bigint`, `created_at timestamptz not null default now()`, `created_by uuid references auth.users(id)`, `updated_at timestamptz not null default now()`, `updated_by uuid references auth.users(id)`, `deleted_at timestamptz`, `deleted_by uuid references auth.users(id)`, primary key `(distribution_id, participant_id)`, check `ended_total_centavos = savings_before_centavos + share_centavos`, index on `(distribution_id)`; (e) enable RLS with one `select` policy using `public.is_owner()` and no insert/update/delete policy; revoke all from `anon` and `authenticated` then `grant select ... to authenticated`; (f) replace `public.sf_savings_delta` adding `when 'cycle_close' then -t.amount_centavos`. Use a function replacer if you script the edit (JS `String.replace` turns `$$` into `$`).
- [X] T006 Extend `supabase/migrations/20261114000200_sf_proportional_distribution.sql` (part 2: timeline rule). Implemented as a `before insert` trigger instead (deposits never run the timeline check): create `public.sf_guard_closed_cycle()` and trigger `sf_transactions_closed_cycle` (spec FR-049) that raises `'%s''s year was closed on %s. Use a later date.'` (participant name, `sf_date_text(date)`) when any non-voided row of that participant, other than rows of type `cycle_close` and `interest_share` that belong to the latest non-voided close's distribution, has `tx_date <= latest cycle_close tx_date`. Keep `security definer`, `set search_path = public`, and the existing grants.
- [X] T007 [P] Update `types/database.ts` by hand: add `cycle_close` to the `sf_transaction_type` enum, add the `sf_distribution_participants` table row/insert/update types, make `per_participant_centavos` nullable on `sf_distributions`, and add the new function signatures from [contracts/sql-functions.md](contracts/sql-functions.md) (`sf_distribute_interest` with `p_expected_total`, `sf_distribution_details`, new `sf_distribution_history` columns, `cycle_start` on `sf_fund_summary`).
- [X] T008 [P] Update `lib/sinking-fund/types.ts`: add `cycle_close` to `SfTransactionType` and `sfTypeLabels` ("Year-end close"); `SfDistribution` gains `per_participant_centavos: number | null`, `share_count: number`, `year: number`; add `SfDistributionRow` (`participant_id`, `participant_name`, `savings_before_centavos: number | null`, `share_centavos`, `ended_total_centavos: number | null`) and `SfDistributionDetail` (`distribution`, `rows`, `totals: { ended_total_centavos: number | null; share_centavos: number }`); `SfFundSummary` gains `cycle_start: string | null`.
- [X] T009 [P] Update `components/sinking-fund/type-tag.tsx` so `cycle_close` renders "Year-end close" with the existing neutral tag style and an icon plus text (colour is never the only cue).

**Checkpoint**: migrations 1 and 2 (structure) exist, types compile (`corepack pnpm typecheck`). Do not push or run the migrations until T012 and T018 are also in the file and the owner approves.

---

## Phase 3: User Story 1 - Proportional distribution and year-end close (Priority: P1) 🎯 MVP

**Goal**: The owner distributes the Interest fund in proportion to ticked participants' savings; the distribution closes the year (ended totals saved, ticked participants back to ₱0.00) and is blocked while a ticked participant has an unpaid loan.

**Independent Test**: With a ₱300 fund and savings ₱1,000 / ₱2,000 / ₱3,000, the Distribute dialog shows ₱50.00 / ₱100.00 / ₱150.00; after confirming, those participants show ₱0.00 savings, loans, balance, and payments, earlier transactions remain, and unticked participants are unchanged. A participant with an Open or Overdue loan blocks confirmation.

### Tests for User Story 1 (write first, they must fail before the implementation)

- [X] T010 [P] [US1] Add Vitest cases in `tests/unit/sinking-fund-rules.test.ts` for the new `proportionalShares(availableCentavos, participants)` helper: ₱300 with 1,000/2,000/3,000 pesos → 5000/10000/15000 centavos, remainder 0; ₱100 with three equal savings → 3333 each, remainder 1; a ₱0-savings participant gets 0; overall savings 0 returns zero shares; shares plus remainder always equal the fund; large amounts do not overflow (use `BigInt` internally if needed).
- [X] T011 [P] [US1] Add `supabase/tests/constraints/440_sf_proportional_distribution.sql` (pgTAP, follow the style of `420_sinking_fund_rules.sql`) covering contract cases 1 to 8 and 11 to 14 in [contracts/sql-functions.md](contracts/sql-functions.md): proportional shares and snapshot rows; floor and remainder; unticked participant unchanged; ticked ₱0 participant has a snapshot row and no ledger rows; Open and Overdue loans block, paid and withdrawn loans do not; stale `p_expected_total` rejected and matching accepted; same `p_key` twice returns one distribution; owner-only (staff and anon denied); date before last activity rejected; a later transaction dated on or before the close rejected; void allowed without later activity and restores savings, blocked with later activity, both distribution and close rows voided; constraint checks (`cycle_close` shape, `ended = before + share`, remainder rules); no EXECUTE for `anon`; payments received and interest collected count only after the cycle start; void guards (cases 13 and 14 in the contract): a `cycle_close` row cannot be voided alone, a pre-close transaction of a closed participant cannot be voided, a post-close one can, and `sf_distribution_participants` has the full business-row columns.
- [X] T012 [P] [US1] Add Playwright cases to `tests/e2e/sinking-fund.spec.ts` (demo mode) for the Distribute dialog: shares shown per participant and no "Each participant gets" text; unticking changes shares live; a participant with an unpaid loan is flagged and confirm is disabled; the close-the-year warning is visible; after a close a deposit dated on or before the close date is rejected with the "year was closed" message; at a 360 px viewport nothing scrolls sideways.

### Implementation for User Story 1

- [X] T013 [US1] Extend `supabase/migrations/20261114000200_sf_proportional_distribution.sql` (part 3: distribute). `drop function public.sf_distribute_interest(date, uuid[], text, uuid)` and create `public.sf_distribute_interest(p_date date, p_participants uuid[], p_notes text, p_key uuid, p_expected_total bigint default null) returns uuid` as `security definer`, `set search_path = public`, calling `require_owner()` and `sf_lock()` first. Implement validation rules 1 to 7 from data-model.md in order: idempotent return on `p_key`; `sf_check_date`; at least one ticked participant ("Tick at least one participant."); all active ("Only active participants can receive a share."); date not before any ticked participant's latest non-voided transaction date (spec FR-048; message "The distribution date cannot be before %s, when %s last had activity."); no ticked participant with an Open or Overdue loan (list every offender: "%s still has an unpaid loan. Pay it or mark it as a withdrawal first."); `available := sf_fund_total(p_date) > 0` ("There is no interest to distribute on this date."); overall savings above 0 ("No ticked participant has savings."); per-participant `share_i := floor(available * savings_i / overall)` using `numeric` for the product then cast to `bigint`; total above 0 ("%s is too little to share."); if `p_expected_total is not null and p_expected_total <> total` raise "The figures changed. Review them and confirm again.". Then insert the distribution (`per_participant_centavos` null, `participant_count` = ticked count, `total_distributed_centavos`, `remainder_centavos = available - total`), one `sf_distribution_participants` row per ticked participant (name, `savings_before_centavos`, `share_centavos`, `ended_total_centavos`), one `interest_share` ledger row per share above 0, one `cycle_close` ledger row per ended total above 0 (`amount_centavos` = ended total, `tx_date` = `p_date`, `distribution_id` set); run `sf_assert_participant_timeline` for each ticked participant and `sf_assert_fund_timeline()`; call `write_audit_event('sf_distributions', id, 'insert', jsonb_build_object(...))` with the share list and closed totals. Revoke all from `public, anon, authenticated` on the new signature, then `grant execute ... to authenticated`.
- [X] T014 [US1] Extend the same migration (part 4: void and cards). Replace `public.sf_void_distribution(uuid, text, timestamptz)` so it also voids the distribution's `cycle_close` rows, and first raises "This distribution cannot be voided because %s has new transactions since it." when any participant in `sf_distribution_participants` for it has a non-voided transaction whose `created_at` is later than the distribution's `created_at` and that is not one of the distribution's own rows. Replace `sf_fund_summary` (add `cycle_start date` as the last returned column; `payments_received` and `interest_collected` count only `tx_date > cycle_start` when a cycle start exists, still honouring `p_from`/`p_to`), `sf_participant_summaries` (unchanged columns; `last_transaction_date` unchanged), and `sf_ranking` (when `p_rank_by = 'deposits'` and `p_start is null`, start after the cycle start). The cycle start is `(select max(dist_date) from sf_distributions where voided_at is null)`. Also replace `public.sf_void_transaction(uuid, text, timestamptz)` (keep its signature, grants, and existing rules) so it raises "A year-end close is voided with its distribution. Void the distribution instead." for rows of type `cycle_close`, and raises "%s's year was closed on %s. Void the distribution first." when the row belongs to a participant with a non-voided `cycle_close` and its `tx_date` is on or before that close date (spec FR-050). Keep every existing grant and revoke pattern; re-run `revoke`/`grant` for any signature you recreate.
- [X] T015 [P] [US1] Implement `proportionalShares(availableCentavos: number, participants: { id: string; savingsCentavos: number }[])` in `lib/sinking-fund/rules.ts` returning `{ shares: Map<string, number>, total: number, remainder: number, overall: number }` with floor math identical to T013 (multiply first, then divide, `BigInt` for the product); remove `shareOf` and update its test in `tests/unit/sinking-fund-rules.test.ts`. Money handling stays integer centavos.
- [X] T016 [US1] Update `lib/validation/sinking-fund.ts` `distributeSchema`: add `expectedTotalCentavos: z.number().int().min(1)` and cap `participantIds` at 200; keep `date`, `notes`, `idempotencyKey`. Update the matching input type in `app/actions/sinking-fund.ts`.
- [X] T017 [US1] Update `distributeInterest` in `app/actions/sinking-fund.ts`: pass `p_expected_total: input.expectedTotalCentavos`, return `{ distributionId, totalCentavos, participants, shareCount, remainderCentavos }` (read the distribution row after the call for the counts), keep owner-only and the `DEMO_MODE` guard, `revalidatePath("/sinking-fund")`. In `lib/sinking-fund/messages.ts` change `formatDistributionToast(totalCentavos, shareCount)` to `₱X distributed to N participants. Year closed. Everyone starts again from ₱0.00.` where N is the number who received a share (spec US1 scenario 6), and update `tests/unit/sinking-fund-messages.test.ts` and add the blocked-by-loan and changed-figures strings used by the dialog.
- [X] T018 [US1] Rewrite `components/sinking-fund/dialogs/distribute-dialog.tsx` per [contracts/ui-changes.md](contracts/ui-changes.md): list each participant with checkbox, name, savings, and live share from `proportionalShares`; flag rows with an Open or Overdue loan ("Has an unpaid loan") using `data.openLoans` passed in as a prop (add the prop in `sinking-fund-page.tsx`); show "No savings, no share"; summary of Available, Overall savings (ticked), Total shares, and the remainder; the always-visible close-the-year warning; confirm button "Distribute and close the year · ₱X" disabled for any flagged ticked participant, zero total, or pending; send `expectedTotalCentavos`; on the "figures changed" failure keep the dialog open and show the message. Remove "Each participant gets" and the equal-share description.
- [X] T019 [US1] Mirror the rules in demo mode: in `lib/sinking-fund/aggregate.ts` add `cycle_close` to the savings fold (`-amount`), compute the cycle start, apply it to payments received, interest collected, and the deposits ranking default; in `lib/sinking-fund/demo-data.ts` add a past distribution with snapshot rows and the matching `interest_share` and `cycle_close` rows so the Distribute and Transactions views have realistic data; extend `tests/unit/sinking-fund-ledger.test.ts` and `tests/unit/sinking-fund-demo-data.test.ts` with cases for the cycle start and a closed participant at ₱0.00.
- [X] T020 [US1] Show the new row type in `components/sinking-fund/transaction-row.tsx` and `components/sinking-fund/transactions-view.tsx` (label "Year-end close", amount shown as a debit, no void button of its own: it is voided with its distribution, and the server also rejects voiding it alone (T014); update the interest-share void routing in `sinking-fund-page.tsx` `voidRow` so a `cycle_close` row also opens the distribution void dialog).
- [X] T021 [US1] Update `components/sinking-fund/dialogs/void-dialog.tsx` summary text for distributions (no per-participant amount) and surface the new "has new transactions since it" failure message as plain text.
- [X] T022 [US1] Update `docs/DEVELOPMENT.md` Sinking fund section: proportional sharing formula, the year-end close and reset, the unpaid-loan block, the cycle start rule, and the new row type; note that feature 015's equal-share text is superseded by feature 016.
- [X] T023 [US1] Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, and the sinking fund e2e spec in demo mode; fix failures. Ask the owner before running the pgTAP suite (`corepack pnpm exec supabase test db` is not available locally; use the rollback wrapper against `rolnet-dev`), then run the **whole** suite, not only `440_...`.

**Checkpoint**: US1 is complete and testable alone: shares, reset, loan block, void rule, demo parity.

---

## Phase 4: User Story 2 - Distribution history, details, and Excel download (Priority: P1)

**Goal**: The owner opens "View history", picks a distribution, sees participants sorted highest to lowest with ended total savings and share, the Sinking fund total for the year, and downloads an A4 one-page Excel file.

**Independent Test**: Make two distributions, open "View history", open each, check order, totals, and the year total, download the Excel file, and confirm one A4 page with narrow margins. Staff see none of it.

### Tests for User Story 2 (write first)

- [X] T024 [P] [US2] Add `supabase/tests/rls/110_sf_distribution_rls.sql` (pgTAP) checking that `sf_distribution_participants` is selectable by the owner only and that `sf_distribution_history()` and `sf_distribution_details(uuid)` raise for staff and are not executable by `anon`; add contract cases 9 and 10 (legacy distribution without snapshot rows returns `ended_total_centavos` null; ordering highest first, ties by name, nulls last) to `supabase/tests/constraints/440_sf_proportional_distribution.sql`.
- [X] T025 [P] [US2] Add `tests/unit/sinking-fund-distribution-workbook.test.ts` for `buildDistributionWorkbook`: row order highest to lowest with ties by name and legacy rows last, totals row sums, "Not recorded" cells, voided title suffix, a 50-participant case (one sheet, 50 data rows plus totals), and a check on the generated sheet XML for `paperSize="9"`, `orientation="portrait"`, `fitToWidth="1"`, `fitToHeight="1"`, `fitToPage="1"`, and the narrow margins (left and right 0.25).
- [X] T026 [P] [US2] Add Playwright cases to `tests/e2e/sinking-fund.spec.ts` (demo mode): "View history" lists distributions newest first with year and "N received a share"; clicking one opens details with the Sinking fund total for the year and a table sorted highest to lowest; "Download Excel" returns a file (check the response status, content type, and file name pattern); staff sees no "View history" and the route returns 403; at 360 px the details table has no sideways scroll.

### Implementation for User Story 2

- [X] T027 [US2] Extend `supabase/migrations/20261114000200_sf_proportional_distribution.sql` (part 5: reads). Replace `public.sf_distribution_history()` with the owner-only version and columns from [contracts/sql-functions.md](contracts/sql-functions.md) (`year`, `share_count` from snapshot rows with `share_centavos > 0` or, for legacy rows, from `interest_share` rows; `participant_count`), calling `require_owner()` first; create `public.sf_distribution_details(p_id uuid)` (owner only) returning one row per participant sorted by `ended_total_centavos desc nulls last, participant_name asc`, using snapshot rows and, for legacy distributions, `interest_share` rows with `ended_total_centavos` and `savings_before_centavos` null. Both `security definer`, `set search_path = public`, revoke from `public, anon, authenticated`, grant execute to `authenticated`. Since the function signature of `sf_distribution_history` changes (new columns), `drop function` the old one first.
- [X] T028 [P] [US2] Create `lib/sinking-fund/distribution-workbook.ts` exporting `buildDistributionWorkbook(detail: SfDistributionDetail): SheetModel` per [contracts/excel-layout.md](contracts/excel-layout.md): columns A to D with widths 7, 34, 22, 20; the four-row title block; header row; sorted participant rows; totals row; pesos from centavos with the writer's `AMOUNT_FORMAT`; "Not recorded" text for missing ended totals; the voided suffix; notes cut to 120 characters. Reuse styles and types from `lib/reports/xlsx.ts` and `lib/reports/sheet-names.ts` conventions. No new dependency.
- [X] T029 [US2] Update `lib/sinking-fund/queries.ts`: `loadSfPageData` loads `distributions` through `sf_distribution_history` only when the caller is the owner (empty array for staff); add `loadDistributionDetail(supabase, id)` returning `SfDistributionDetail | null` (calls `sf_distribution_details`, computes totals), with a demo-mode branch reading from `demo-data.ts` (extend demo data with snapshot rows if T019 did not already).
- [X] T030 [US2] Add `getDistributionDetails({ id })` to `app/actions/sinking-fund.ts` (owner only, `FORBIDDEN` for staff, `NOT_FOUND` when no rows) per [contracts/server-actions-and-routes.md](contracts/server-actions-and-routes.md); validate `id` with a Zod uuid.
- [X] T031 [US2] Create `app/api/sinking-fund/distributions/[id]/xlsx/route.ts`: `GET` handler that calls `connection()`, checks the session with the same guard pattern as `lib/reports/http.ts` (401, 403 `ACCOUNT_NOT_APPROVED`, 403 `FORBIDDEN` with "Only the owner can download this."), validates the uuid (400 `INVALID_QUERY`), loads details (404 `NOT_FOUND`), builds the file with `workbookBytes([buildDistributionWorkbook(detail)], title)` and returns it with the XLSX content type, `Content-Disposition: attachment; filename="rolnet-sinking-fund-{year}-{YYYY-MM-DD}.xlsx"`, and `Cache-Control: no-store`; 500 `UNEXPECTED` with a plain message and a server log. Apply the notes from T002.
- [X] T032 [P] [US2] Create `components/sinking-fund/dialogs/distribution-details-dialog.tsx` per [contracts/ui-changes.md](contracts/ui-changes.md): header with year and date and voided tag and reason; key figures (Sinking fund total for the year, Interest fund distributed, Stayed in the fund, Participants); participants table sorted as received with a totals row, stacked rows at 360 px with no sideways scroll; "Download Excel" link to the route (`download` attribute); "Void distribution" for active distributions (opens the existing void dialog); a one-line "Not recorded" explanation for legacy rows; loading and error states ("The details could not be loaded. Try again.").
- [X] T033 [US2] Rewrite `components/sinking-fund/dialogs/distribution-history-dialog.tsx`: each distribution is a full-width button (min 44 px) showing date, year, total distributed, "N received a share", and a Voided tag; clicking opens the details dialog (new `{ kind: "distribution-details", id }` dialog case in `components/sinking-fund/sinking-fund-page.tsx`); update the description text to "Each distribution shares the Interest fund by savings and closes the year."; empty state "No distributions yet."; remove the per-row void button (it moves into the details dialog). Hide the "View history" control for staff where it is rendered (the Interest fund card in `components/sinking-fund/summary-strip.tsx`).
- [X] T034 [US2] Update docs: add the distribution history, details, and Excel download to `docs/DEVELOPMENT.md` (owner-only, route path, one A4 page, narrow margins).
- [ ] T035 [US2] Run lint, typecheck, Vitest, the sinking fund e2e spec, then (with the owner's approval) the whole pgTAP suite; open a generated file in Excel or LibreOffice and confirm Print Preview shows one A4 page, narrow margins, and the same rows and order as the screen; record the result in `specs/016-sinking-fund-refinements/quickstart.md` under scenario 4.

**Checkpoint**: US1 and US2 together deliver the client's money change and the record that replaces the totals after the reset.

---

## Phase 5: User Story 3 - Remove the stray divider lines (Priority: P2)

**Goal**: No stray line above list toolbars or below pagination footers on any page.

**Independent Test**: Visit every page in the quickstart checklist at 360 px and desktop width; none shows the lines; row dividers and card outlines remain.

(No dependency on Phases 2 to 4; can run in parallel with them.)

- [X] T036 [P] [US3] Add a Playwright spec `tests/e2e/dividers.spec.ts` (demo mode) that visits Units, Drivers, Remittances, Expenses, Audit, Documents, Reports, Settings → Staff, and the three Sinking fund views at 360 px and 1280 px and asserts that `.data-region` has no top or bottom border width (`getComputedStyle(...).borderTopWidth === "0px"` and `borderBottomWidth === "0px"`) and that no horizontal scrollbar appears. It must fail before T037.
- [X] T037 [US3] In `app/globals.css` remove `border-block: 1px solid var(--token-rule);` from `.data-region` (line near `.data-region { min-width: 0; ... }`), keeping `background`, `overflow`, and the card's own outline and radius; check `form.data-region` still shows its full border and padding.
- [X] T038 [US3] Review every use of the class and every list page: `components/ui/data-table.tsx`, `components/sinking-fund/transactions-view.tsx`, `components/ui/local-table.tsx`, `components/ui/paged-list.tsx` (toolbar `border-b` stays as the line between toolbar and rows), `components/ui/pagination.tsx`, `.section-rule`, `.table-rule`, `app/(owner)` and `app/(operations)` pages. Walk through the divider table in `specs/016-sinking-fund-refinements/quickstart.md`, take a 360 px and a desktop screenshot of each page, fill the table (toolbar line gone, footer line gone, notes), and fix any second source of the same line by changing the shared style, not by hiding it per page.
- [X] T039 [US3] Re-run `tests/e2e/dividers.spec.ts` and the existing list specs (`tests/e2e/paged-lists.spec.ts`, `tests/e2e/list-sort-filter.spec.ts`, `tests/e2e/drivers-list.spec.ts`) in demo mode; run lint and typecheck.

**Checkpoint**: the divider checklist in quickstart.md is filled in and the spec passes.

---

## Phase 6: User Story 4 - Participant details in a centered pop-up (Priority: P2)

**Goal**: A participant opens in a centered pop-up styled like Add transaction, with no sideways scroll; closing it does not reload or redraw the page behind it.

**Independent Test**: At 360 px open a participant with loans and a long history; everything fits without sideways scroll; close with the button, Escape, and a tap outside; the page keeps its scroll position, search, sort, and filters and makes no page request.

(No dependency on Phases 2 to 4.)

- [X] T040 [P] [US4] Add Playwright cases to `tests/e2e/sinking-fund.spec.ts` (demo mode): the pop-up opens centered with the title, tags, four figures, buttons, Loans, and History; at 360 px `document.scrollingElement.scrollWidth <= clientWidth` and the dialog body has no horizontal overflow; closing by button, Escape, and outside tap leaves scroll position, search text, and sort unchanged and triggers no navigation request (assert via `page.on("request")` that no document or RSC request is made on close); Add transaction opened from the pop-up returns to the pop-up afterwards.
- [X] T041 [US4] Add `getParticipantDetail({ participantId, historyCount })` to `app/actions/sinking-fund.ts` (approved users, read-only, no revalidation) returning the participant summary, loans, history rows, and `historyTotal` using the queries currently in `lib/sinking-fund/queries.ts` (lines that read `sf_loans_v` and `sf_ledger_v`); extract the shared loader into a function in `queries.ts` used by both the action and the page loader.
- [X] T042 [US4] Create `components/sinking-fund/participant-detail-dialog.tsx` replacing `participant-detail-sheet.tsx`: use `Dialog`/`DialogContent` from `components/ui/dialog.tsx` like the Add transaction dialog (`max-w-lg`, fixed title row with the close button, body `max-h` with vertical scroll only, no horizontal scroll); keep the content and actions of the sheet (name, Driver and Overdue tags, Total savings, Total loans, Balance to pay, Interest shares received, Add transaction, Withdraw savings for owners, Loans with Add payment and Mark as withdrawal, History with Load more as a button that calls the action again with a larger `historyCount`); make the history rows wrap (date, type tag, amount, note on its own wrapping line; no fixed widths); show "Loading details…" while the action runs and "The details could not be loaded. Try again." on failure. Delete `participant-detail-sheet.tsx` once nothing imports it.
- [X] T043 [US4] Update `components/sinking-fund/sinking-fund-page.tsx`: hold the open participant in client state (`{ kind: "participant", id }` dialog case), `viewParticipant` sets the state and writes `detail` with `window.history.replaceState` (no `router.push`); closing sets the state to null and removes `detail` and `hn` with `replaceState` (no `router.replace`) and returns focus to the opener; on first load read `params.detail` once to open the pop-up; after a write, refetch the pop-up's data when `data` changes. Remove the server-side `data.detail` use for the pop-up and the `detail`/`hn` handling that triggered re-renders; update `loadSfPageData` and `url-state.ts` so the params still parse but no longer drive a server fetch of the detail.
- [X] T044 [US4] Keep the nested dialogs working: opening Add transaction, loan withdrawal, or change interest from the pop-up stacks above it and returns to it after closing; check focus order and Escape closing only the top dialog. Update any component that imported `ParticipantDetailSheet` (`participants-view.tsx`, `top-view.tsx`, `transactions-view.tsx` row clicks) to call `viewParticipant`.
- [X] T045 [US4] Run lint, typecheck, Vitest, and the sinking fund e2e spec; also check the pop-up at 360 px by hand (quickstart scenario 7) and record the result.

**Checkpoint**: the pop-up works and closing causes no page redraw.

---

## Phase 7: User Story 5 - Readable monthly chart (Priority: P3)

**Goal**: The "Deposits, loans, and payments" chart has clearly readable month labels and three distinct series that can be told apart without color.

**Independent Test**: With data in several months, every label is readable, the three series are distinguishable by color and by pattern, labels do not overlap at 360 px, and "View as table" still works.

(No dependency on Phases 2 to 4.)

- [X] T046 [P] [US5] Add tests: a Vitest case in `tests/unit/sinking-fund-demo-data.test.ts` (or a new `tests/unit/sinking-fund-chart.test.ts`) for a pure `monthLabelPlan(months, width)` helper (all labels up to six months, every other label beyond; narrow width returns the two-line "Nov" and year form); and a Playwright case in `tests/e2e/sinking-fund.spec.ts` that checks the month label elements use the high-contrast fill class, are at least 11 SVG units tall, do not overlap at 360 px (compare bounding boxes), that the computed label color against the card background has a contrast ratio of at least 4.5:1, and that the legend lists Deposits, Loans, and Payments with matching swatches.
- [X] T047 [US5] If a token is missing, add a high-contrast text token or series tokens in `app/globals.css` (not hex values in components) and document it in `DESIGN.md`; otherwise reuse `ok`, `warn`, `info` at their strong shade. Keep light and dark contrast for text at the app's standard.
- [X] T048 [US5] Update `components/sinking-fund/charts/charts.tsx` `MonthlyBars`: month labels at font size 11 with `fill-ink`, the helper from T046 deciding labels and the narrow two-line form; series colors from tokens plus SVG `<pattern>` fills (solid for Deposits, hatch for Loans, dots for Payments) defined once inside the SVG, legend swatches drawn with the same patterns; empty months keep a baseline tick and their label; no-data state shows "No activity in these months yet."; keep the `<title>` tooltips and "View as table". Check `SavingsDonut` colors against the new series tokens so the page stays consistent (FR-030).
- [X] T049 [US5] Run lint, typecheck, Vitest, and the sinking fund e2e spec; view the chart at 360 px and desktop width, in demo mode with data in several months and with no data, and record the result (quickstart scenario 8).

**Checkpoint**: the chart is readable and the series are distinguishable without color.

---

## Phase 8: Polish and cross-cutting

- [X] T050 [P] Search the repository for remaining equal-share wording ("each participant gets", "equal", "shares the Interest fund equally") in `components/`, `lib/`, `docs/`, and `app/`, and fix any that still describe equal sharing (feature 015's spec files are left as history).
- [X] T051 [P] Review `.claude/` agent or help text, `README`, and `docs/DEVELOPMENT.md` for the Sinking fund section so setup and commands are accurate; add the new route and the new tests to the test list in the docs.
- [ ] T052 Run the full gate: `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm test:e2e` in demo mode, and, with the owner's approval, the whole pgTAP suite through the rollback wrapper; fix every failure.
- [ ] T053 Walk through [quickstart.md](quickstart.md) scenarios 1 to 9 at a 360 px viewport (Playwright or the browser pane) and tick the divider table; note anything that did not pass and why.
- [X] T054 Constitution re-check against [plan.md](plan.md): integer centavos only, timestamps and actor ids on new rows, no hard deletes, one transaction per distribution with an audit event, 360 px acceptance, no new dependency. Record the result in the plan's Constitution Check section.
- [ ] T055 Plain-language review with the owner (spec SC-007): on a phone, show the Distribute dialog, the distribution details with the Excel download, and the participant pop-up, plus the three date rules (spec FR-048 to FR-050), and write down whether they agree the sharing is fair, the pop-up is easier than the side panel, and the date rules are acceptable.
- [X] T056 With the owner's approval, push the two migrations to `rolnet-dev` (never edit them after they are pushed) and re-run the manual scenarios there; then commit the work on the `016` branch in small commits and open the PR (enable auto-merge as per the project memory only after the owner agrees).

---

## Dependencies and execution order

### Phase dependencies

- **Phase 1 Setup**: no dependencies.
- **Phase 2 Foundational**: after Phase 1. Blocks US1 and US2 (both use the new table, enum value, and types). US3, US4, and US5 do not use it.
- **US1 (P1)** after Phase 2. **US2 (P1)** after Phase 2 and after T013 (it reads the snapshot rows that the distribute function writes); T024 to T026 tests can be written earlier but need T013 to pass.
- **US3, US4, US5**: after Phase 1 only; independent of each other and of US1 and US2 except that all of `tests/e2e/sinking-fund.spec.ts` edits should be merged one at a time (same file).
- **Polish (Phase 8)**: after all stories you intend to ship.

### Within each story

Tests first (they fail), then SQL, then types and helpers, then actions and routes, then components, then demo data and docs, then the verification task.

### Same-file ordering (no [P] between these)

- `supabase/migrations/20261114000200_sf_proportional_distribution.sql`: T005, T006, T013, T014, T027 in that order.
- `tests/e2e/sinking-fund.spec.ts`: T012, T026, T040, T046.
- `app/actions/sinking-fund.ts`: T016/T017, T030, T041.
- `components/sinking-fund/sinking-fund-page.tsx`: T018 (prop), T020, T033, T043.
- `lib/sinking-fund/queries.ts`: T029, T041.
- `docs/DEVELOPMENT.md`: T022, T034, T050, T051.

### Parallel examples

```text
After Phase 1:   US3 (T036 to T039), US4 (T040 to T045), US5 (T046 to T049) can proceed in parallel
                 with Phase 2, each by a different person or session.
Phase 2:         T007, T008, T009 in parallel once T005 is written.
US1 tests:       T010, T011, T012 in parallel.
US1 build:       T015 (rules.ts) in parallel with T013 and T014 (SQL).
US2 build:       T028 (workbook builder) in parallel with T027 (SQL) and T032 (details dialog).
```

## Implementation strategy

1. **MVP** = Phase 1, Phase 2, and US1 (T001 to T023): the client's rule change works end to end (proportional shares, reset, loan block, void rule). Do not release US1 alone to production, because after the reset the owner has no screen to read ended totals; ship US1 and US2 together (the two P1 stories).
2. Add US2 (T024 to T035), then validate scenarios 1 to 6 of the quickstart.
3. Deliver US3, US4, US5 in any order; each is a visual change that can ship by itself.
4. Finish with Phase 8, the pgTAP run, and the push to `rolnet-dev` after the owner approves.

## Notes

- 56 tasks: Setup 3, Foundational 6, US1 14, US2 12, US3 4, US4 6, US5 4, Polish 7.
- Keep each commit to one task or a few closely related ones; run lint and typecheck before each commit.
- If a task reveals that a contract or the data model is wrong, change the document first, then the code.
