# Implementation Plan: Dashboard Refinements

**Branch**: `017-dashboard-refinements` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/017-dashboard-refinements/spec.md`

## Summary

Three dashboard changes, all in the existing Next.js monolith with no schema change:

1. Make **Daily collections** and **Collected vs expenses by unit** equal height: the side-by-side grid stops top-aligning (`items-start`), both cards fill the row, and the daily chart's SVG grows to take the spare height.
2. Replace the in-place `<details>` expansion in `UnitIncomeChart` with the existing shadcn `Dialog` (a small client component) that lists every unit; the card always shows the top 5.
3. Add an **Unpaid sinking fund loans** panel to `AttentionPanels` using the existing `DashboardPanel`/`PanelRow`, fed by a new read of open loans grouped per participant (live: `sf_loans_v` + `sf_participants`; demo: `buildLoans(demoSfData)`).

## Technical Context

**Language/Version**: TypeScript, Next.js 16 App Router (server components), React 19 (AGENTS.md: read `node_modules/next/dist/docs/` before touching Next APIs)

**Primary Dependencies**: Existing only: shadcn `base-nova` `components/ui/dialog.tsx` (Base UI), `card.tsx`, Tailwind tokens from `app/globals.css`. No new libraries.

**Storage**: Supabase Postgres, read-only. Uses existing view `sf_loans_v` (security invoker, readable by approved users) and table `sf_participants`. No migration, so no pgTAP change.

**Testing**: Vitest (`tests/unit/dashboard-ordering.test.ts` for the new grouping/ordering), Playwright demo mode (`tests/e2e/dashboard-refresh.spec.ts` plus a new `tests/e2e/dashboard-refinements.spec.ts`)

**Target Platform**: Mobile-first web (360 px minimum), Cloudflare Workers via vinext

**Project Type**: Single web application (monolith)

**Performance Goals**: No visible slowdown; two small extra reads join the existing `Promise.all` in `liveDashboard`

**Constraints**: Free tier; money as integer centavos formatted by `formatPesos`; tokens only (no hex or arbitrary sizes); no horizontal scroll at 360 px; closing the pop-up must not refetch

**Scale/Scope**: ~100 units, a handful of sinking fund participants; 1 page, 4 components, 1 ordering helper

## Constitution Check

| Principle | Result |
|---|---|
| I. Free tier | Pass: no new service or dependency |
| II. Monolith | Pass: same app, same database |
| III. Data integrity | Pass: read-only, centavos preserved, deleted/archived rows excluded |
| IV. Mobile-first | Pass: cards stack at 360 px, dialog fits width (`inset-x-4`), verified in e2e at 360 px |
| V. Compliance documents | N/A: Expiring documents panel unchanged |

No violations; Complexity Tracking not needed. Re-checked after design: still passes.

## Project Structure

### Documentation

```text
specs/017-dashboard-refinements/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/dashboard-ui.md
├── checklists/requirements.md
└── tasks.md          # created by /speckit-tasks
```

### Source Code

```text
app/(owner)/dashboard/page.tsx              # equal-height grid; 3-column attention grid
components/dashboard/
├── attention-panels.tsx                    # + Unpaid sinking fund loans panel (third card)
├── daily-trend-chart.tsx                   # card fills row height; SVG grows
├── unit-income-chart.tsx                   # top 5 only; trigger opens dialog
└── unit-income-dialog.tsx                  # NEW client component: "Show all N units" dialog
lib/dashboard/
├── ordering.ts                             # + UnpaidLoanItem, orderUnpaidLoans()
└── queries.ts                              # + open-loans read (live + demo) -> attention.loans
tests/unit/dashboard-ordering.test.ts       # + loan grouping/order/overdue cases
tests/e2e/dashboard-refinements.spec.ts     # NEW
tests/e2e/dashboard-refresh.spec.ts         # update panel expectations if affected
```

**Structure Decision**: Edit the existing dashboard components in place; add one client component only because the dialog needs state. Data shaping stays in `lib/dashboard/ordering.ts` (pure, unit-testable) like the other panels.

## Phase notes

- **Phase 0**: [research.md](research.md). No open clarifications.
- **Phase 1**: [data-model.md](data-model.md), [contracts/dashboard-ui.md](contracts/dashboard-ui.md), [quickstart.md](quickstart.md).
