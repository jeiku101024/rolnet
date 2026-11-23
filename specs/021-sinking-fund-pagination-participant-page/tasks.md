# Tasks: Sinking Fund Pagination and Participant Page

**Input**: Design documents from `/specs/021-sinking-fund-pagination-participant-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/page-and-urls.md, quickstart.md

**Tests**: Included, because the plan lists Vitest and Playwright updates and `CLAUDE.md` makes passing tests part of "done".

**Organization**: Grouped by user story. US2, US3, and US4 are all P1 and build one page, so they run in order US2 → US3 → US4; US1 is independent of them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Commands always run through `corepack pnpm`
- Before touching routing, `redirect`, `notFound`, or `searchParams`, read the matching guide in `node_modules/next/dist/docs/` (`AGENTS.md`)

---

## Phase 1: Setup

- [X] T001 Read the Next.js guides in `node_modules/next/dist/docs/` for dynamic routes (`[id]`), async `params`/`searchParams`, `redirect`, and `notFound`; note any difference from older versions at the top of `specs/021-sinking-fund-pagination-participant-page/research.md` under a new "Next.js notes" heading
- [X] T002 [P] Read `components/ui/list-controls.tsx`, `components/ui/list-search.tsx`, and the `listControlSpecs.sinkingFund` definition (find it with a search for `sinkingFund` under `lib/`) and record in `research.md` R4 whether `ListSort` can be reused with the Participant filter left out, or whether a trimmed spec variant is needed
- [X] T003 [P] Read `components/ui/paged-list.tsx` and the Expenses list page to confirm the exact `Pagination` usage (props, `prefix`, range label) the Transactions view must match

---

## Phase 2: Foundational (blocks US2, US3, US4)

**Purpose**: Make the dialogs and base data reusable by a second route. US1 does not need this phase.

- [X] T004 Split `loadFromDatabase` and `loadFromDemo` in `lib/sinking-fund/queries.ts` so the shared pieces (participants, open loans, summary, prefill, distributions, drivers) come from one `loadBase` function per source, with the existing view-specific extras left in place; behavior of `/sinking-fund` must not change
- [X] T005 Create `components/sinking-fund/sinking-fund-shell.tsx`: move the `Context`, `useSfActions`, `SfActions` type, `Dialog` union, dialog state, `TooltipProvider`, and the whole dialog host out of `components/sinking-fund/sinking-fund-page.tsx`, and export a `SinkingFundShell` component taking `data`, `params`, `searchParams`, `isOwner`, and `children`; keep `useSfActions` exported from `sinking-fund-page.tsx` as a re-export so existing imports keep working
- [X] T006 Update `components/sinking-fund/sinking-fund-page.tsx` to render its header, view toggle, and views inside `SinkingFundShell`; run `corepack pnpm typecheck` and `corepack pnpm test:e2e -- sinking-fund` to confirm nothing changed

**Checkpoint**: `/sinking-fund` behaves exactly as before, now built on the shell.

---

## Phase 3: User Story 1 - Transactions list shows 10 rows per page (P1) 🎯 MVP

**Goal**: Replace "Load more" with Expenses-style numbered pages, 10 per page.

**Independent Test**: Quickstart scenarios 1 and 2.

### Tests for User Story 1

- [X] T007 [P] [US1] Add Vitest cases in `tests/unit/sinking-fund-url-state.test.ts` proving `parseSfParams` no longer returns `n`, and that `page` is read through `parseListPage` (non-numeric and 0 become page 1)
- [X] T008 [P] [US1] Add a Playwright case in `tests/e2e/sinking-fund.spec.ts`: with more than 10 demo transactions, only 10 rows show, page 2 shows the next rows, a search returns to page 1, and `page=99` shows the last page

### Implementation for User Story 1

- [X] T009 [US1] In `lib/sinking-fund/queries.ts`, replace the `range(0, params.n - 1)` read in `loadFromDatabase` with `fetchListPage` using `parseListPage(searchParams)`, and the demo slice in `loadFromDemo` with page-sized slicing via `finishListPage` and `rangeFor`; return `ledger` as `{ rows, page, lastPage, total, rangeLabel }` and update `SfPageData.ledger` in the same file
- [X] T010 [US1] In `lib/sinking-fund/url-state.ts`, remove `n`, `loadMoreStep`, and the `stepped` helper if nothing else uses it; keep `historyStep` and `hn` until T027
- [X] T011 [US1] In `components/sinking-fund/transactions-view.tsx`, remove the "Load more" link, import `Pagination` from `components/ui/pagination.tsx`, render it under the list with the ledger page state, and show the Expenses-style range text; keep the empty state and the `ListSort` row
- [ ] T012 [US1] Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, and the T008 e2e case; check the Transactions view at 360 px

**Checkpoint**: The main list pages like Expenses. This alone is a shippable MVP.

---

## Phase 4: User Story 2 - Participant opens on its own page (P1)

**Goal**: "View details" opens `/sinking-fund/participants/[id]`; back, direct links, legacy links, and not-found work.

**Independent Test**: Quickstart scenarios 3 and 6.

### Tests for User Story 2

- [X] T013 [P] [US2] Add Vitest cases in `tests/unit/sinking-fund-url-state.test.ts` for a new `participantHref(id, returnQuery)` and `safeReturn(value)` helper: valid `/sinking-fund...` values pass, anything else (outside host, `//evil`, missing) falls back to `/sinking-fund?view=participants`
- [X] T014 [P] [US2] Add Playwright cases in `tests/e2e/sinking-fund.spec.ts`: View details navigates (no dialog), Back restores the participants search and sort, `?detail=<id>` redirects, and a random UUID shows not-found

### Implementation for User Story 2

- [X] T015 [US2] Add `participantHref` and `safeReturn` to `lib/sinking-fund/url-state.ts` per `contracts/page-and-urls.md` (the `return` value must start with `/sinking-fund`)
- [X] T016 [US2] Add `loadParticipantPage(id, searchParams, isOwner)` to `lib/sinking-fund/queries.ts`: uses `loadBase` from T004, finds the participant in the summaries, returns `null` for an unknown, archived, or deleted id, and reads the participant's loans (newest first); history is added in T024. Define `SfParticipantPageData` in `lib/sinking-fund/types.ts` per `data-model.md`
- [X] T017 [US2] Create `app/(operations)/sinking-fund/participants/[id]/page.tsx`: `requireApprovedSession`, validate `id` as a UUID, call `loadParticipantPage`, call `notFound()` on `null`, and render `ParticipantPage`
- [X] T018 [P] [US2] Create `app/(operations)/sinking-fund/participants/[id]/loading.tsx` mirroring `app/(operations)/sinking-fund/loading.tsx`
- [X] T019 [US2] Create `components/sinking-fund/participant-page.tsx` as a client component inside `SinkingFundShell` with a `PageHeader` (participant name, Driver and Overdue tags) and a back link built from `safeReturn`; the body sections arrive in US3 and US4. Add a not-found view (`not-found.tsx` beside the route) with a link to `/sinking-fund?view=participants`
- [X] T020 [US2] In `components/sinking-fund/participants-view.tsx`, change "View details" to a link to `participantHref(participant.participant_id, <current participants query>)`; remove `viewParticipant` from `SfActions` in `sinking-fund-shell.tsx`
- [X] T021 [US2] In `app/(operations)/sinking-fund/page.tsx`, redirect to `participantHref` when `params.detail` is set (keep `detail` parsing in `url-state.ts` for this one use)
- [ ] T022 [US2] Run `corepack pnpm lint`, `typecheck`, `test`, and the T014 e2e cases

**Checkpoint**: The page opens, returns, and handles bad links; the body is still empty.

---

## Phase 5: User Story 3 - Same card details and actions (P1)

**Goal**: The participant page shows what the pop-up showed, and its buttons work.

**Independent Test**: Quickstart scenario 4.

### Tests for User Story 3

- [X] T023 [P] [US3] Add a Playwright case in `tests/e2e/sinking-fund.spec.ts`: the page shows the four figures, both buttons, and a loan card with every field; Add transaction opens the form preset to this participant; saving refreshes the figures; staff see Withdraw savings hidden and Mark as withdrawal disabled as before

### Implementation for User Story 3

- [X] T024 [US3] In `components/sinking-fund/participant-page.tsx`, add the four-figure grid (Total savings, Total loans, Balance to pay, Interest shares received), the **Add transaction** and owner-only **Withdraw savings** buttons, and the Loans section, ported from the markup in `components/sinking-fund/participant-detail-dialog.tsx` (same `data-testid` values `sf-detail-loan`); use `formatPesos` for every amount and `formatListDate` for dates
- [X] T025 [US3] Make saves and voids refresh the new route: check every action in `app/actions/sinking-fund.ts` that calls `revalidatePath` and make each also cover `/sinking-fund/participants/[id]` (a layout-level revalidation of `/sinking-fund` is acceptable); record the result in `research.md` R7
- [ ] T026 [US3] Run `corepack pnpm lint`, `typecheck`, `test`, and the T023 e2e case; check the page at 360 px

**Checkpoint**: Everything the pop-up showed is on the page.

---

## Phase 6: User Story 4 - History works like the main list (P1)

**Goal**: 10-row History with search, sort, pagination, and the main list's row actions, for one participant.

**Independent Test**: Quickstart scenario 5.

### Tests for User Story 4

- [X] T027 [P] [US4] Add Vitest cases in `tests/unit/sinking-fund-url-state.test.ts` for the participant history params (`page`, `q` trimmed to 100 characters, `sort` falling back to date newest first)
- [X] T028 [P] [US4] Add a Playwright case in `tests/e2e/sinking-fund.spec.ts`: a participant with more than 10 rows shows 10 and page controls; searching notes narrows rows and returns to page 1; changing sort reorders; only that participant's rows appear; the empty state reads "No transactions yet."; a voided row keeps its style

### Implementation for User Story 4

- [X] T029 [US4] Extend `loadParticipantPage` in `lib/sinking-fund/queries.ts` with `history` as an `SfLedgerPage`: filter `sf_ledger_v` by `participant_id`, search notes (reuse `searchPattern`, notes only), apply the sort from T002, and page with `fetchListPage`; add the equivalent demo path
- [X] T030 [US4] Create `components/sinking-fund/participant-history.tsx`: a card with `ListSearch` (placeholder "Search notes"), the result line and `ListSort`, a header row and `TransactionRow` list matching `transactions-view.tsx`, an empty state ("No transactions yet." or "No transactions match this search."), and `Pagination`; reuse `rowGrid` and keep the Participant column out or leave it as the main list does, whichever keeps the 360 px layout clean
- [X] T031 [US4] Render `ParticipantHistory` in `components/sinking-fund/participant-page.tsx` under the Loans section with the heading "History"
- [X] T032 [US4] Remove the pop-up: delete `components/sinking-fund/participant-detail-dialog.tsx`, delete `getParticipantDetail` and `loadParticipantDetail`, remove `SfDetail`, `hn`, `historyStep`, and the pop-up state from the shell and page; update `tests/unit/sinking-fund-url-state.test.ts` and `tests/e2e/sinking-fund.spec.ts` to drop pop-up cases
- [ ] T033 [US4] Run `corepack pnpm lint`, `typecheck`, `test`, and the T028 e2e case; check History at 360 px

**Checkpoint**: All four stories work; the pop-up is gone.

---

## Phase 7: Polish and Cross-Cutting

- [X] T034 Search the repo for leftover references (`detail=`, `hn`, `viewParticipant`, `loadMoreStep`, `ParticipantDetailDialog`) in `app/`, `components/`, `lib/`, `tests/`, and `docs/` and remove or update them
- [X] T035 [P] Update `docs/DEVELOPMENT.md` if it describes the pop-up or Load more behavior for the sinking fund
- [ ] T036 Run `corepack pnpm lint`, `typecheck`, `test`, `test:e2e`, `check`, and `build:vinext`
- [ ] T037 Walk through every scenario in `specs/021-sinking-fund-pagination-participant-page/quickstart.md` at desktop width and at 360 px (use the Playwright browser, per the hidden-pane note), including the staff pass in scenario 5
- [ ] T038 Mark the spec's checklist items verified in `checklists/requirements.md` notes and record any deviation in `spec.md` Assumptions

---

## Dependencies and Execution Order

- **Setup (T001–T003)**: no dependencies; T002 and T003 in parallel.
- **Foundational (T004–T006)**: after Setup. Blocks US2, US3, US4. Does not block US1.
- **US1 (T007–T012)**: after Setup only; can run alongside Foundational. Both touch `lib/sinking-fund/queries.ts` and `sinking-fund-page.tsx`, so do them one after the other if one person is working.
- **US2 (T013–T022)** → **US3 (T023–T026)** → **US4 (T027–T033)**: sequential, as each builds on the page from the one before.
- **Polish (T034–T038)**: after all stories.

Within a story, write the tests first and see them fail, then implement.

## Parallel Examples

```text
Setup:  T002 and T003 together
US1:    T007 and T008 together (different test files' cases)
US2:    T013 and T014 together; T018 beside T017
US4:    T027 and T028 together
```

## Implementation Strategy

1. **MVP**: Setup, then US1. Ship numbered paging on its own if wanted.
2. **Next**: Foundational, then US2, US3, US4 in order. Ship them together, because a participant page without its body or History would be a regression from the pop-up.
3. Stop at each checkpoint and run the story's quickstart scenarios.
