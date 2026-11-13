# Implementation Plan: Sinking Fund

**Branch**: `015-sinking-fund` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-sinking-fund/spec.md`

## Summary

Add a `/sinking-fund` page (nav item after Expenses) where staff and the owner keep a shared savings
ledger: participants, deposits, loans against their own savings (5%, ₱100 steps, one-month term),
payments split into an interest part and a principal part, owner-set interest collection, an Interest
fund that the owner divides equally, loan write-offs ("Withdrawal"), savings withdrawals, voids, archive,
and three views (Transactions, Top participants, Participants) with charts.

Technical approach ([research.md](research.md)):

- **One append-only ledger table** (`sf_transactions`) plus participants, distributions, and a settings
  row. Money is integer centavos (R1). Loan status, balances, savings, and the Interest fund are derived,
  never stored (R2).
- **Every write is one SQL function in one transaction**, owner checks inside, serialized by one advisory
  lock, followed by a full-timeline re-validation so savings and the Interest fund are never negative on
  any date, including back-dated entries and voids (R3, R4). The app never writes tables directly.
- **Reads** use RLS-protected views and a few SQL read-model functions for totals, rankings, and monthly
  flows (R5). Lists use the app's existing URL-state filters; "Load more" grows a `?n=` limit (R6).
- **A pure TypeScript twin of the money rules** (`lib/sinking-fund/`) powers live form previews, the demo
  mode, and unit tests; both implementations are pinned to the spec's worked examples A and B (R7).
- **UI** reuses `components/ui/*` (dialog, sheet, dropdown-menu, segmented toggle, tooltip, toast) and
  draws the donut and grouped-bar charts as dependency-free SVG with a "View as table" fallback (R8).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19, Next.js 16.4 App Router (built with vinext for
Cloudflare Workers); PostgreSQL via Supabase. AGENTS.md warns this Next.js differs from older versions:
read `node_modules/next/dist/docs/` for `searchParams`, `useRouter`, and Server Action rules before
writing the page and actions.

**Primary Dependencies**: Existing only: `@base-ui/react` (via `components/ui/*`), `react-hook-form`,
`zod`, `lucide-react` (PiggyBank, Trophy, and similar icons), `@supabase/ssr`. No new libraries (constitution
I, CLAUDE.md).

**Storage**: Supabase Postgres. New tables `sf_participants`, `sf_transactions`, `sf_distributions`,
`sf_settings`; new views and SQL functions; three migrations (R9). Uses existing `audit_events`,
`set_audit_fields`, `reject_hard_delete`, `audit_business_change`, `is_approved_user`, `require_owner`.
No Storage objects.

**Testing**: Vitest (rules, ledger fold, rankings, due dates, URL state, validation schemas, components),
pgTAP (`supabase/tests/constraints/410..430`, `supabase/tests/rls/100_sinking_fund_rls.sql`), Playwright
(demo mode: navigation, views, forms, 360 px, keyboard). pgTAP runs against `rolnet-dev` through the
rollback wrapper; ask the owner before running (no local Supabase).

**Target Platform**: Phone-first web app (360 px minimum), Cloudflare Workers (free plan, 10 ms CPU).
Heavy work stays in Postgres; the Worker only renders and validates.

**Project Type**: Single Next.js web application (monolith).

**Performance Goals**: Transactions page for 100 participants and 5,000 transactions: filters and "Load
more" respond in under 1 second (SC-010). Each page load issues a handful of queries, never a
row-per-transaction scan in the Worker.

**Constraints**: Free tier only; integer centavos; soft delete only; owner checks on the server and in
SQL; every screen works at 360 px; no hex colors or arbitrary sizes in components; functions in `public`
start with no EXECUTE for `anon` and grant `authenticated` explicitly, with caller checks inside.

**Scale/Scope**: About 20 participants (design limit 100), about 5,000 ledger rows, 1–3 concurrent users.
One route, three views, 12 dialogs, one sheet, 2 charts.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 (below).*

| Principle | Status | How the plan meets it |
|---|---|---|
| I. Free-tier sustainability | Pass | No new dependency or service; charts are plain SVG; reads are cheap SQL on indexed tables. |
| II. Monolithic simplicity | Pass | Same Next.js app and database; one advisory lock instead of queues or workers; derived values instead of cached counters. |
| III. Data integrity and auditability | Pass | Integer centavos (`bigint`) everywhere. `created_at`, `updated_at`, actor IDs on all four tables. Ledger rows are never deleted: void markers (`voided_at`, `voided_by`, `void_reason`) are the "equivalent status" for soft delete; participants use `archived_at` plus `deleted_at`; `reject_hard_delete` trigger on all tables. Every action is one transactional SQL function, so no multi-step write sequence is needed (the clause for ordered multi-step writes is not used). All inserts and updates are audited by `audit_business_change`; voids, distributions, and settings changes also write explicit audit events with reasons. |
| IV. Mobile-first | Pass | Cards stack, lists use the app's responsive table pattern, dialogs become full-width at 360 px, charts stack; verified in Playwright at 360 px. |
| V. Compliance documents | N/A | No document types are touched. |

Post-design re-check: pass. The one judgment call is that void markers replace `deleted_at` on ledger
rows (Principle III allows "equivalent status"); see R2 and [data-model.md](data-model.md).

## Project Structure

### Documentation (this feature)

```text
specs/015-sinking-fund/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R12
├── data-model.md        # Phase 1: tables, views, derived values, state rules
├── quickstart.md        # Phase 1: validation walkthrough
├── contracts/
│   ├── sql-functions.md     # Write and read SQL function signatures, errors, grants
│   ├── server-actions.md    # Server Actions, input schemas, toasts, error codes
│   └── page-and-urls.md     # Route, query parameters, UI contract per view and dialog
├── checklists/requirements.md
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   ├── 20261113000100_sinking_fund_tables.sql     # enums, tables, indexes, triggers, RLS reads, views, settings row
│   ├── 20261113000200_sinking_fund_rules.sql      # validators + all write functions + grants
│   └── 20261113000300_sinking_fund_reads.sql      # summary, ranking, monthly-flow read functions
└── tests/
    ├── constraints/410_sinking_fund_tables.sql    # constraints, derived views, audit, soft delete
    ├── constraints/420_sinking_fund_rules.sql     # worked examples A and B, back-dating, voids, distribution
    ├── constraints/430_sinking_fund_reads.sql     # totals, rankings, monthly flows
    └── rls/100_sinking_fund_rls.sql               # staff vs owner vs anon, no direct writes

app/
├── (operations)/sinking-fund/
│   ├── page.tsx              # server component: session, view + filter parsing, data loading
│   └── loading.tsx
└── actions/sinking-fund.ts   # Server Actions (thin: validate, call one SQL function, revalidate, message)

lib/
├── sinking-fund/
│   ├── rules.ts              # interest, due date, allowed interest range, loan state (pure)
│   ├── ledger.ts             # savings timeline fold, negative-date finder (pure, mirrors SQL)
│   ├── rankings.ts           # rank with ties, week/month period math (pure)
│   ├── url-state.ts          # view, filters, n, participant, period parsing and building
│   ├── queries.ts            # data loading for the page (Supabase) 
│   ├── demo-data.ts          # seeded demo ledger built through ledger.ts
│   ├── messages.ts           # toast and error copy shared by actions and forms
│   └── types.ts
├── validation/sinking-fund.ts          # zod schemas (amounts as centavos via lib/money/centavos.ts)
├── navigation/items.ts                 # + Sinking fund destination (PiggyBank), orders shifted
├── navigation/page-context.ts          # + sinkingFund title and eyebrow
└── permissions/roles.ts                # + "manage_fund" (owner only)

components/sinking-fund/
├── sinking-fund-page.tsx               # header, view toggle, toolbar (client shell)
├── view-toggle.tsx
├── summary-strip.tsx, interest-fund-card.tsx
├── transactions-view.tsx, transaction-row.tsx, transaction-row-menu.tsx, type-tag.tsx, loan-status-tag.tsx
├── top-view.tsx, participants-view.tsx, participant-card.tsx, participant-detail-sheet.tsx
├── charts/donut-chart.tsx, charts/monthly-bars.tsx, charts/chart-table.tsx
└── dialogs/ add-participant, add-transaction (+ deposit/loan/payment parts), savings-withdrawal,
    change-interest-part, loan-withdrawal, distribute, distribution-history, fund-settings, void, edit-name, archive

types/database.ts                       # hand-edited: new tables, views, functions, enums
tests/unit/sinking-fund-*.test.ts       # rules, ledger, rankings, url-state, validation
tests/e2e/sinking-fund.spec.ts          # navigation, views, forms, 360 px, keyboard
docs/DEVELOPMENT.md                     # short section: business rules and test commands
```

**Structure Decision**: One route with server-loaded data per view and a client shell for dialogs. SQL is
the source of truth for rules; `lib/sinking-fund` mirrors the rules for previews and demo mode, and
parity is enforced by running the spec's worked examples in both Vitest and pgTAP.

## Complexity Tracking

No constitution violations. Two deliberate deviations from the spec's data model are explained in
research.md and need the owner's awareness, not an exemption:

| Deviation | Why | Simpler alternative rejected because |
|---|---|---|
| Loan `status` is derived, not stored (spec §17 lists a stored status) | Voids, back-dated entries, and interest-part changes would all have to keep a stored status in sync | A stored column can drift from the ledger; the spec itself requires all totals be derivable (FR-020) |
| Amounts stored as integer centavos (`*_centavos bigint`), rate as basis points (`500`) | Constitution III and CLAUDE.md forbid decimal money storage | The spec's "2 decimals" is satisfied by display only |
