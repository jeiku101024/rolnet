# Implementation Plan: Sinking Fund Pagination and Participant Page

**Branch**: `021-sinking-fund-pagination-participant-page` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/021-sinking-fund-pagination-participant-page/spec.md`

## Summary

Two changes to `/sinking-fund`, both UI and query side only (no schema change):

1. The Transactions view stops using "Load more" (`n` = 25, 50, ...) and uses the shared numbered paging used by Expenses: 10 rows per page, `page` in the address, the `Pagination` component, and a page-aware "Showing X–Y of Z" line.
2. "View details" on a participant card navigates to a new route, `/sinking-fund/participants/[id]`, instead of opening `ParticipantDetailDialog`. The page shows the same figures, buttons, and loan cards, then a History table that reuses the main list's row, search, sort, and pagination, scoped to the participant. The pop-up, its server action, and the `detail`/`hn` parameters are removed; old `?detail=<id>` links redirect to the new page.

The dialog host and action context now inside `SinkingFundPage` move into a shared shell so both routes open the same Add transaction, Withdraw, Void, and loan dialogs.

## Technical Context

**Language/Version**: TypeScript, Next.js App Router (read `node_modules/next/dist/docs/` before touching routing, `redirect`, `notFound`, or `searchParams`, per `AGENTS.md`), React

**Primary Dependencies**: Existing only: shadcn `base-nova` components, `components/ui/pagination.tsx`, `components/ui/list-controls.tsx`, `lib/pagination/list-page.ts`. No new libraries.

**Storage**: Supabase Postgres, read-only here. Existing `sf_ledger_v`, `sf_loans_v`, `sf_participant_summaries`. No migration, no pgTAP change.

**Testing**: Vitest (URL parsing, paging helpers), Playwright (`tests/e2e/sinking-fund.spec.ts`), demo mode data for e2e

**Target Platform**: Mobile-first web, Cloudflare Workers build via vinext (`corepack pnpm check`, `build:vinext`)

**Project Type**: Web application (monolith)

**Performance Goals**: Each page reads at most 10 ledger rows (down from up to 1000 with `n`), so list pages get cheaper

**Constraints**: 360 px viewport; money only via `lib/money/centavos.ts`; no hex colors or arbitrary sizes; page size is `pageSize` (10) from `list-page.ts`, never a new constant

**Scale/Scope**: One fund, tens of participants, hundreds of transactions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Free-tier | Pass | No new service or dependency. |
| II. Monolith | Pass | Same app; one new route, shared components. |
| III. Data integrity | Pass | Read paths only; money stays centavos; voiding and saving still go through existing actions; nothing hard-deleted. |
| IV. Mobile-first | Pass (verify) | Participant page and pagination checked at 360 px (SC-005, quickstart step 7). |
| V. Compliance documents | N/A | |
| Workflow gates | Pass | No schema change, so no migration or pgTAP. `types/database.ts` untouched. |

Re-check after design: still passes; no violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/021-sinking-fund-pagination-participant-page/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── page-and-urls.md
├── checklists/requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
app/(operations)/sinking-fund/
├── page.tsx                          # edit: redirect legacy ?detail=, pass page-based ledger
└── participants/[id]/
    ├── page.tsx                      # new: participant page route
    └── loading.tsx                   # new: skeleton, mirrors ../loading.tsx
app/actions/sinking-fund.ts           # edit: remove getParticipantDetail; confirm revalidation covers the new route
components/sinking-fund/
├── sinking-fund-shell.tsx            # new: Context provider, TooltipProvider, dialog host (moved from sinking-fund-page.tsx)
├── sinking-fund-page.tsx             # edit: use shell; drop participant pop-up state
├── transactions-view.tsx             # edit: Pagination replaces Load more
├── participants-view.tsx             # edit: "View details" becomes a link to the participant page
├── participant-page.tsx              # new: figures, buttons, loans, History
├── participant-history.tsx           # new: search, sort, list, pagination for one participant
├── transaction-row.tsx               # edit only if the row needs a non-compact variant in History
└── participant-detail-dialog.tsx     # delete
lib/sinking-fund/
├── queries.ts                        # edit: page-based ledger read; loadParticipantPage replaces loadParticipantDetail
├── url-state.ts                      # edit: drop n, detail, hn, loadMoreStep, historyStep
└── types.ts                          # edit: SfDetail becomes SfParticipantPageData
tests/unit/sinking-fund-url-state.test.ts   # edit: remove n/detail/hn cases, add legacy redirect helper
tests/e2e/sinking-fund.spec.ts              # edit: pagination, participant page, legacy link
```

**Structure Decision**: Single Next.js project. The shared shell is the smallest way to give a second route the same dialogs; duplicating the dialog host would drift.

## Complexity Tracking

No constitution violations. Nothing to justify.
