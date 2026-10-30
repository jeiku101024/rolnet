# Implementation Plan: Paginated Lists and Dashboard Refresh

**Branch**: `006-pagination-dashboard-refresh` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-pagination-dashboard-refresh/spec.md`

## Summary

Replace "render every row, hide non-matches in the browser" lists with server-side paging:
each list reads `page` and `q` from the URL, asks the database for one 10-row slice plus an
exact count, and renders First/Previous/Next/Last links and a "11–20 of 87 records" label. A
new search field (with a search icon and clear button, separated from the table by a spaced
toolbar rule) writes `q` to the URL and resets to page 1, so search covers the whole list.

Rebuild the dashboard in four bands, stacked in this order on phones and gridded on wider
screens: (1) attention — expiring documents, due maintenance, unpaid balances, each sorted by
urgency, max 5 + "View all N"; (2) status — active extradors with today's unit, units in
repair with time in repair; (3) statistics — month headline tiles and a per-unit
collected-vs-expenses bar chart (replacing the monthly unit summary table) plus a daily
collections trend, drawn with plain SVG/CSS using existing tokens; (4) recent activity —
remittances, expenses, maintenance work, and newly added documents, 5 each. Recent drivers and
recent units panels are removed.

No schema change is needed: every figure comes from existing tables, RPCs, and the audit trail.

## Technical Context

**Language/Version**: TypeScript 5, React 19.3, Next.js 16.4 App Router (async `searchParams` page prop)

**Primary Dependencies**: Supabase JS 2 (PostgREST `range()` + `count: "exact"`), shadcn `base-nova` UI in `components/ui/`, lucide-react icons, Tailwind 4 tokens from `app/globals.css`. No new dependencies.

**Storage**: Supabase Postgres (existing tables and RPCs: `expiring_documents`, `due_maintenance`, `driver_outstanding_balances`, `dashboard_monthly_unit_summary`; `audit_events` for "in repair since")

**Testing**: Vitest (paging helpers, search filter building, dashboard ordering and totals), Playwright (paging and search flows, dashboard order at 360 px, demo mode). No pgTAP change because no migration.

**Target Platform**: Next.js on Cloudflare Workers (vinext build), mobile browsers first

**Project Type**: Single web application (monolith)

**Performance Goals**: First page of any list visible within 2 s on a typical phone connection regardless of total rows (SC-001); dashboard does a fixed number of bounded queries

**Constraints**: 360 px viewport with no horizontal page scrolling; no hex colours or arbitrary sizes in components; no new component/chart/animation libraries; integer centavos via `lib/money/centavos.ts`; soft-deleted rows excluded everywhere

**Scale/Scope**: Small fleet (≈10–30 units, ≈30–60 drivers); remittances grow ≈ units × 365 per year (thousands of rows); 15 lists across 11 pages; 1 dashboard

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Free-Tier Sustainability | No new services or dependencies. Paging reduces rows transferred per request, lowering free-tier load. | Pass |
| II. Monolithic Simplicity | Everything stays inside the Next.js app: one shared paging helper, one pagination component, one search component; charts are plain SVG/CSS. No new service, no client data layer. | Pass |
| III. Data Integrity and Auditability | Read-only feature. Dashboard totals reuse `dashboard_monthly_unit_summary` (centavo `bigint`) and are summed as integers; formatting only via `formatPesos`. All queries keep `deleted_at is null`. No schema change, so no migration or pgTAP needed. | Pass |
| IV. Mobile-First, Human-Centered Operations | Paging controls are ≥ touch-target size and wrap at 360 px; dashboard stacks attention-first on phones; empty states and "no matching records" messages use plain language; charts have text equivalents and never rely on colour alone (DESIGN.md). | Pass |
| V. Compliance Document Lifecycle | Expired and soon-to-expire documents move to the top of the dashboard, sorted by expiry with days remaining/overdue, and a headline tile counts them. | Pass |

Post-design re-check (after Phase 1): still Pass. The design adds no tables, functions, policies, or grants; see [research.md](research.md) R1–R10.

## Project Structure

### Documentation (this feature)

```text
specs/006-pagination-dashboard-refresh/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # View models (no schema change)
├── quickstart.md        # Validation guide
├── contracts/
│   ├── list-paging.md   # URL parameters + shared list UI contract
│   └── dashboard.md     # Dashboard sections, ordering, data contract
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
lib/
├── pagination/
│   ├── list-page.ts         # NEW: parse/clamp page + q from searchParams (with per-list prefix), range math, labels
│   └── search-filter.ts     # NEW: escape q for PostgREST or(); build ilike/or + related-id filters
├── dashboard/
│   ├── queries.ts           # CHANGED: new bands (stats, extradors, in-repair, trend, recent work)
│   └── ordering.ts          # NEW: urgency sorts for documents, maintenance, balances (pure, unit-tested)
└── demo/mode.ts             # CHANGED: a few more demo rows so paging and panels are visible in demo mode

components/
├── ui/
│   ├── data-table.tsx       # CHANGED: toolbar slot (search + count) above table, pagination footer
│   ├── list-search.tsx      # NEW (client): search icon, clear, writes ?q= and drops ?page=
│   ├── pagination.tsx       # NEW (server): First/Prev/Next/Last links + "Page x of y" + range label
│   └── table-search.tsx     # REMOVED once all lists move to ListSearch
└── dashboard/
    ├── attention-panels.tsx # NEW: expiring documents, due maintenance, unpaid balances (replaces 3 panels)
    ├── extradors-panel.tsx  # NEW
    ├── in-repair-panel.tsx  # NEW
    ├── fleet-stats.tsx      # NEW: headline tiles
    ├── unit-income-chart.tsx# NEW: per-unit collected vs expenses bars + exact amounts list
    ├── daily-trend-chart.tsx# NEW: daily collections columns + text summary
    ├── recent-data-glimpse.tsx # CHANGED: kinds = remittances, expenses, maintenance work, documents
    ├── monthly-unit-summary.tsx, expiring-soon-panel.tsx,
    │   due-maintenance-panel.tsx, unpaid-balances-panel.tsx  # REMOVED (folded into the above)

app/
├── (owner)/dashboard/page.tsx            # CHANGED: four bands
├── (owner)/{units,drivers,documents,audit,settings/staff}/page.tsx      # CHANGED: paged queries
├── (owner)/{units,drivers,documents}/[id]/page.tsx                       # CHANGED: prefixed paged sub-lists
└── (operations)/{remittances,expenses,maintenance}/page.tsx,
    (operations)/maintenance/[unitId]/page.tsx, (operations)/remittances/[id]/page.tsx  # CHANGED

tests/
├── unit/list-page.test.ts, search-filter.test.ts, dashboard-ordering.test.ts, dashboard-stats.test.ts   # NEW
├── unit/dashboard-recent-data.test.ts                                                                    # CHANGED
└── e2e/paged-lists.spec.ts, dashboard-refresh.spec.ts                                                    # NEW
```

**Structure Decision**: Existing single Next.js app. Shared paging lives in `lib/pagination/`
and `components/ui/`; each page keeps its own query (current pattern) and only adds
`.range()`, `count`, and the search filter from the helper. See
[contracts/list-paging.md](contracts/list-paging.md) for the page inventory.

## Complexity Tracking

No constitution violations; nothing to justify.
