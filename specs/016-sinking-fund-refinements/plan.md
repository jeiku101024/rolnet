# Implementation Plan: Sinking Fund Refinements

**Branch**: `016-sinking-fund-refinements` (not created yet; work currently sits on `015-sinking-fund`) | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-sinking-fund-refinements/spec.md`

## Summary

Five changes to the Sinking fund page of feature 015, plus one app-wide visual fix:

1. **Proportional distribution.** `sf_distribute_interest` is replaced by a version that shares the fund by each ticked participant's savings (floor to the centavo, remainder stays in the fund).
2. **Year-end close.** The same function also closes the cycle: it records each ticked participant's ended total savings and writes a new ledger row of type `cycle_close` that takes their savings back to ₱0.00. Loans, balance, and payments return to zero because distribution is blocked while any ticked participant has an Open or Overdue loan, and "payments received" is counted from the cycle start. Nothing is deleted; totals stay derived from the ledger (feature 015 research R2).
3. **Distribution history and Excel.** A new stored snapshot table (`sf_distribution_participants`) holds the ended totals and shares. Owner-only read functions list distributions and return one distribution's table sorted highest to lowest. An owner-only route downloads it as a one-sheet XLSX built with the feature 014 workbook writer (A4, narrow margins, one page).
4. **Participant pop-up.** `ParticipantDetailSheet` (a right-hand sheet that closes through a router navigation) becomes a centered dialog whose open/close state lives on the client, so closing does not re-render the page.
5. **Chart readability.** `MonthlyBars` gets readable month labels and distinct colors from the existing tokens.
6. **Divider lines.** `.data-region` draws `border-block` inside list cards; that is the stray line above toolbars and below pagination. It is removed app-wide after a page-by-page review.

## Technical Context

**Language/Version**: TypeScript 5 on Next.js 16.4 (App Router, breaking changes: read `node_modules/next/dist/docs/` before changing route handlers or caching), React 19; PostgreSQL via Supabase.

**Primary Dependencies**: Existing only: Tailwind CSS tokens in `app/globals.css`, shadcn `base-nova` components in `components/ui/`, Supabase client, the in-repo XLSX writer in `lib/reports/xlsx.ts` and `zip.ts`. No new dependency (constitution I and II).

**Storage**: Supabase Postgres. Two new migrations after `20261113000300_sinking_fund_reads.sql`: one for the new enum value (it cannot be used in the same transaction that adds it), one for the table, constraint, function, and read-function changes.

**Testing**: Vitest (unit: share math, sorting, workbook model, demo data), pgTAP in `supabase/tests/` (new and changed functions), Playwright (`tests/e2e/`: distribution flow, history, pop-up, chart, divider check at 360 px and desktop).

**Target Platform**: Phone-first web app (360 px minimum) deployed to Cloudflare Workers through vinext; demo mode (`NEXT_PUBLIC_DEMO_MODE=true`) for e2e.

**Project Type**: Single Next.js web application (monolith).

**Performance Goals**: Distribute and the history reads finish in one database call each; the details table and the Excel file handle at least 50 participants. No new client-side data fetch on pop-up close.

**Constraints**: Money in integer centavos only (`lib/money/centavos.ts`); no hard deletes; new `public` functions start with no EXECUTE for `anon` or `authenticated` and are granted explicitly; `security definer` functions call `require_owner()`; pgTAP for every migration; never edit a pushed migration; Worker CPU budget small, so no heavy work in the route; every screen works at 360 px; Excel route must not leak data to staff.

**Scale/Scope**: Up to roughly 50 participants per distribution, about one distribution a year, a few hundred ledger rows a year. Touches the Sinking fund components, one SQL function family, one new route, two shared CSS/component places for dividers, and a review of every list page.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (see the end of this section).*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Free-tier | No new service or dependency; XLSX uses the existing in-repo writer. | Pass |
| II. Monolith | All changes are inside the one app and its database. The Excel route is a route handler beside the existing report routes. | Pass |
| III. Data integrity and auditability | Shares are floor-divided integer centavos; shares plus remainder equal the available amount (checked in the function and by a table constraint). Timestamps and actor ids on every new row. No hard deletes: the close is an additional ledger row, voiding sets `voided_at`. The distribution, shares, snapshot rows, and close rows are written in one function (one transaction) with an audit event. Retry-safe through the existing idempotency key. | Pass |
| IV. Mobile-first | Pop-up reflows without sideways scroll; history list and details table stack at 360 px; chart labels thin out instead of overlapping; Excel is the only wide artifact and it is a download. Acceptance includes 360 px runs. | Pass |
| V. Compliance documents | Not affected. | Pass |
| Tech and cost constraints | One database, one app, free tier. A one-row-per-participant-per-distribution table is trivially small. | Pass |
| Workflow gates | Ordered migrations with pgTAP, generated types are hand-maintained in this repo (`types/database.ts`), integer-centavo review, 360 px acceptance, plain-language check with the owner. | Pass |

**Post-design re-check**: unchanged. The rules that touch existing behavior (transactions cannot be dated on or before a participant's last cycle close, and older transactions of a closed participant cannot be voided) are database checks inside the existing timeline assertion and `sf_void_transaction`; they are spec requirements FR-048 to FR-050, listed in research R3 and data-model.md, and need no constitution exception. The new snapshot table carries the full set of business-row columns (`created_*`, `updated_*`, `deleted_*`), so constitution III is met without an exception.

**Re-check after implementation (2026-11-14, task T054)**: integer centavos only (shares use BigInt in TypeScript and `numeric` floor in SQL, checked by the same fixtures); the new snapshot table carries `created_*`, `updated_*`, and `deleted_*`; nothing is hard-deleted (the close is an extra ledger row, voids set `voided_at`, a trigger rejects deletes); one transaction per distribution with an audit event; every new SQL function starts with no EXECUTE for `anon` or `authenticated` and grants `authenticated` only for the functions the app calls, with `require_owner()` inside the owner-only ones; the distribution pop-up, history, and details were checked at 360 px and desktop; no new dependency. No exception needed.

## Project Structure

### Documentation (this feature)

```text
specs/016-sinking-fund-refinements/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── sql-functions.md
│   ├── server-actions-and-routes.md
│   ├── excel-layout.md
│   └── ui-changes.md
├── checklists/requirements.md
└── tasks.md            # created later by /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   ├── 20261114000100_sf_cycle_close_enum.sql          # new: add 'cycle_close' to sf_transaction_type
│   └── 20261114000200_sf_proportional_distribution.sql # new: table, constraints, functions, reads
└── tests/
    ├── constraints/440_sf_proportional_distribution.sql  # new pgTAP (rules, voids, shapes)
    └── rls/110_sf_distribution_rls.sql                   # new pgTAP (owner-only access)

types/database.ts                                        # hand-maintained: add enum value, table, function types

lib/sinking-fund/
├── rules.ts            # replace equal-share helper with proportionalShares()
├── types.ts            # SfDistribution (per_participant optional), SfDistributionDetail, SfDistributionRow
├── aggregate.ts        # demo mode: cycle start, close rows, current-cycle totals
├── demo-data.ts        # demo distributions with snapshots
├── queries.ts          # load history list (owner only) and one distribution's details
├── messages.ts         # distribution toast and blocked-by-loan messages
└── distribution-workbook.ts   # new: builds the one-sheet SheetModel

app/
├── actions/sinking-fund.ts    # distributeInterest input/result updated; getDistributionDetails action
└── api/sinking-fund/distributions/[id]/route.ts   # new: owner-only XLSX download

components/sinking-fund/
├── participant-detail-sheet.tsx → participant-detail-dialog.tsx   # centered dialog, client state
├── sinking-fund-page.tsx      # open pop-up from client state; history opens details
├── dialogs/distribute-dialog.tsx            # per-participant shares, loan flags, close-year warning
├── dialogs/distribution-history-dialog.tsx  # list of distributions (clickable)
├── dialogs/distribution-details-dialog.tsx  # new: year total, table, Download Excel
└── charts/charts.tsx          # readable labels and colors

app/globals.css                # drop border-block from .data-region (after review)
components/ui/data-table.tsx, components/sinking-fund/transactions-view.tsx   # confirm no stray line

tests/
├── unit/                      # proportional shares, workbook model, demo cycle totals
└── e2e/                       # sinking-fund distribution, history, pop-up, divider specs
```

**Structure Decision**: Keep the single-app layout used by features 014 and 015. Database rules live in SQL (as in 015); the browser and the Worker only call them. The workbook builder is a pure function in `lib/sinking-fund/` so Vitest can check it without a server, and the route only authorizes, loads, and streams bytes.

## Complexity Tracking

No constitution violations. Two choices add moving parts and are justified in [research.md](research.md): a stored snapshot table instead of deriving ended totals (needed for FR-036 and for "Not recorded" on legacy rows), and a new ledger row type instead of mutating totals (keeps the derived-from-ledger design and makes void reversible).
