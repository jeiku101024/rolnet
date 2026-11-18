# Tasks: Dashboard Refinements

**Input**: Design documents from `/specs/017-dashboard-refinements/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dashboard-ui.md, quickstart.md

**Tests**: Included. CLAUDE.md requires lint, typecheck and tests to pass before a task is done, and the plan names a unit test file and an e2e spec.

**Format**: `- [ ] [ID] [P?] [Story] Description with file path`. `[P]` = different files, no dependency on an incomplete task.

Notes: Next.js here has breaking changes; read the relevant guide in `node_modules/next/dist/docs/` before changing any Next API usage. No database change, so no migration or pgTAP task. Use tokens from `app/globals.css` only (no hex colors or arbitrary sizes). Run commands with `corepack pnpm`.

## Phase 1: Setup

- [X] T001 Confirm the baseline is green on branch `017-dashboard-refinements`: run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test` and `corepack pnpm test:e2e -g "dashboard"`; note any pre-existing failures so they are not blamed on this feature.

## Phase 2: Foundational

**Purpose**: Shared refactor that US1 and US2 both depend on.

- [X] T002 Move the `UnitRows` list (and its `Bar` helper) out of `components/dashboard/unit-income-chart.tsx` into a shared export in `components/dashboard/unit-income-rows.tsx`, with no behavior change, and import it back into `unit-income-chart.tsx`. Keep the `shownUnits = 5` constant exported from the chart file or the new file so the card and the dialog agree.

**Checkpoint**: Dashboard renders exactly as before.

## Phase 3: User Story 2 - Full unit list in a pop-up (Priority: P1)

**Goal**: "Show all N units" opens a dialog with every unit instead of expanding the card.

**Independent Test**: With 100 demo units, click "Show all 100 units"; a dialog lists all units; the page height is unchanged; Escape, X and outside click close it with no network request.

- [X] T003 [US2] Create the client component `components/dashboard/unit-income-dialog.tsx` (`"use client"`): a button "Show all {N} units" (class `touch-target`, same link-style as the old summary) that opens `Dialog` + `DialogContent` from `components/ui/dialog.tsx` with `fixedHeader`, title "All units", description "{monthLabel}. Net income is collected minus expenses.", and the shared rows from T002 for all `bars` in the given order rendered directly inside the dialog. Do not add an inner scroll area or `max-h`: the dialog popup already scrolls (`max-h-svh overflow-y-auto`) while `fixedHeader` keeps the title and close button in view. Props: `bars: UnitIncomeBar[]`, `monthLabel: string`. The dialog uses the already-loaded props only (no fetching).
- [X] T004 [US2] Edit `components/dashboard/unit-income-chart.tsx`: render only the first `shownUnits` (5) bars in the card; remove the `<details>` block; when `bars.length > shownUnits`, render `<UnitIncomeDialog bars={bars} monthLabel={monthLabel} />` instead; no control when there are 5 or fewer units (FR-008).
- [X] T005 [P] [US2] Add `tests/e2e/dashboard-refinements.spec.ts` with the US2 cases (read N from the button text, never hard-code it: demo mode has 11 active units; on phones first tap "Show charts", because the charts sit behind `PhoneFold` below `md`): "Show all N units" opens a dialog containing every unit in card order; the dialog title stays visible after scrolling the list; dashboard `document.body.scrollHeight` is equal before open and after close; Escape, the X button and a backdrop click each close it; no network request is made on open or close; at 360 px the dialog fits the viewport width and `document.documentElement.scrollWidth <= innerWidth`.

**Checkpoint**: US2 works on its own; the unit card no longer changes height.

## Phase 4: User Story 1 - Balanced "This month" row (Priority: P1)

**Goal**: Daily collections and Collected vs expenses end at the same height on wide screens.

**Independent Test**: At 1280 px wide, the two cards have identical top and bottom edges with 5, 20 and 100 units; at 360 px they stack.

- [X] T006 [P] [US1] Edit `components/dashboard/daily-trend-chart.tsx`: make the `Card` fill the grid cell (`h-full`), make `CardContent` a flex column (`flex flex-1 flex-col`), make the `<figure>` `flex flex-1 flex-col`, and replace the SVG's fixed `h-32` with `min-h-32 flex-1` so the chart absorbs spare height. Keep `preserveAspectRatio="none"`, the text summary, and the no-data message unchanged.
- [X] T007 [US1] Edit `components/dashboard/unit-income-chart.tsx` (same file as T004, so run after it, not in parallel): add `h-full` to its `Card` so it fills the grid cell.
- [X] T008 [US1] Edit `app/(owner)/dashboard/page.tsx` line with the charts grid: change `grid items-start gap-4 lg:grid-cols-2` to `grid gap-4 lg:grid-cols-2` (default stretch) and confirm `PhoneFold` does not add a wrapper that breaks stretch; if it does, give that wrapper `h-full`/`grid` so cards still stretch.
- [X] T009 [US1] Extend `tests/e2e/dashboard-refinements.spec.ts` with US1 cases (the spec's 5, 20 and 100 unit examples cannot all be seeded in demo mode, which has 11 active units; assert equality for the demo fleet and cover the 5-or-fewer-units case, where the card has no "Show all" button, with a unit test or an e2e that filters nothing and still checks equal height; at 360 px first tap "Show charts"): at 1280 px the bounding boxes of the Daily collections and Collected vs expenses cards have equal `y` and equal `y + height`; the heights are still equal after opening and closing the dialog; at 360 px the cards stack (second card `y` is at or after the first card's bottom) with no horizontal scroll.

**Checkpoint**: US1 and US2 deliver the full "This month" fix.

## Phase 5: User Story 3 - Unpaid sinking fund loans card (Priority: P2)

**Goal**: A third Needs attention card lists participants who still owe on open sinking fund loans.

**Independent Test**: In demo mode the Needs attention row shows three cards; the loans card lists borrowers largest balance first with an Overdue badge where due; fully paid loans do not appear; empty state shows "No unpaid loans."

- [X] T010 [P] [US3] Add to `lib/dashboard/ordering.ts` the `UnpaidLoanItem` interface (`participantId`, `participantName`, `outstandingCentavos`, `openLoanCount`, `overdue`, `earliestDueDate: string | null`) and `orderUnpaidLoans(loans, participants)`: input loans `{ participant_id, balance_centavos, overdue, due_date }[]` and participants `{ id, name }[]`; keep only loans with `balance_centavos > 0`; group per participant, summing balances (integer centavos), `overdue` true if any loan is overdue, `earliestDueDate` the minimum due date; skip loans whose participant is unknown; sort by `outstandingCentavos` descending then `participantName`.
- [X] T011 [P] [US3] Add unit tests to `tests/unit/dashboard-ordering.test.ts` for `orderUnpaidLoans`: two loans for one participant combine into one row with summed centavos and `openLoanCount` 2; the overdue flag is true when any loan is overdue; zero-balance loans are excluded; unknown participants are skipped; ordering is balance descending then name; empty input gives an empty array.
- [X] T012 [US3] Edit `lib/dashboard/queries.ts` live path (`liveDashboard`): add to the existing `Promise.all` a read of `sf_loans_v` (`participant_id, balance_centavos, overdue, due_date`, `.eq("status", "open")`) and of `sf_participants` (`id, name`, `.is("deleted_at", null)` only, no archived filter, so a borrower can never be hidden by archiving); pass both to `assemble` as `loans` and `participants`.
- [X] T013 [US3] Edit `lib/dashboard/queries.ts` demo path (`demoDashboard`) and `assemble`: in demo, build loans from `openLoans(buildLoans(demoSfData, today))` and participants from `demoSfParticipants` (import from `@/lib/sinking-fund/aggregate` and `@/lib/sinking-fund/demo-data`); in `assemble`, add `attention.loans = toPanel(orderUnpaidLoans(loans, participants), "/sinking-fund")`. Check `DashboardData` type still infers correctly (typecheck).
- [X] T014 [US3] Edit `components/dashboard/attention-panels.tsx`: add a `loans: Panel<UnpaidLoanItem>` prop and a third `DashboardPanel` with `id="panel-loans"`, title "Unpaid sinking fund loans", description "Largest balance first.", empty "No unpaid loans."; each `PanelRow` has the participant name as title (link to `/sinking-fund`), detail "{N} open loan(s), due {earliestDueDate}", and an aside with the amount (`formatPesos`, `font-data text-data font-semibold text-danger`) plus a `StatusBadge` "Overdue" (tone `danger`) when `overdue`. Update the file's doc comment to mention loans.
- [X] T015 [US3] Edit `app/(owner)/dashboard/page.tsx`: change the attention grid from `md:grid-cols-2` to `md:grid-cols-2 xl:grid-cols-3`; update the Needs attention band description to "Expired documents, unpaid balances and unpaid loans, most urgent first." (`AttentionPanels {...data.attention}` already spreads the new `loans` prop).
- [X] T016 [US3] Extend `tests/e2e/dashboard-refinements.spec.ts` with US3 cases: three panels (`panel-documents`, `panel-balances`, `panel-loans`) in Needs attention at 1536 px wide; `panel-loans` rows are ordered largest balance first, show an Overdue badge for an overdue borrower, and exclude fully paid loans (use the demo data in `lib/sinking-fund/demo-data.ts`); at most 5 rows and at most 3 visible at 360 px; at 360 px the three cards stack with no horizontal scroll. FR-013 needs no extra code: the Dashboard is owner-only and the owner can open Sinking fund; add one assertion that the card's "View all" link goes to `/sinking-fund`.
- [X] T017 [US3] Update `tests/e2e/dashboard-refresh.spec.ts`: the existing loop over `main ul.panel-rows` already covers the new panel (at most 5 rows, at most 3 visible on phones); also fix any assertion on the Needs attention band description or panel counts that the third card changes, keeping each test's intent.

**Checkpoint**: All three stories work independently.

## Phase 6: Polish and Cross-Cutting

- [X] T018 Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test` and `corepack pnpm test:e2e` (full suite) and fix any failures this feature caused; run `corepack pnpm check` for vinext compatibility.
- [X] T019 Also record the SC-003 (find a unit in the pop-up in under 15 seconds) and SC-006 (no noticeable slowdown versus before) checks as manual observations. Walk through `specs/017-dashboard-refinements/quickstart.md` in the live dev server at 1280 px and 360 px (screenshots of the equal-height row, the open dialog, and the three-card row); confirm the console and network are clean.
- [X] T020 Update `docs/DEVELOPMENT.md` only if it describes the dashboard panels (add the third Needs attention card and the unit dialog); otherwise make no change.

## Dependencies and Order

- Phase 1 then Phase 2 (T002 blocks T003, T004).
- US2 (Phase 3) before US1 (Phase 4): the stable top-5 card from T004 is what makes equal height hold; T007 and T008 also edit files touched by US2.
- US3 (Phase 5) depends only on Phase 1, so its data work (T010 to T013) can run in parallel with US1/US2; T015 and T008 both edit `app/(owner)/dashboard/page.tsx`, so do them in sequence.
- Tests in `tests/e2e/dashboard-refinements.spec.ts` (T005, T009, T016) are the same file: write them in order.
- Phase 6 last.

## Parallel Examples

- After T002: T003 (new file) and T006 (`daily-trend-chart.tsx`) can run together.
- US3: T010 and T011 run together, then T012 and T013 sequentially (same file), while T014 can start once T010 is done.

## Implementation Strategy

- **MVP**: Phases 1 to 4 (US2 then US1), which fix the layout and the expand-in-place behavior.
- **Increment 2**: Phase 5 (US3, the new card).
- Verify after each phase with the checkpoint, and verify in the live dev server at 360 px before finishing.
