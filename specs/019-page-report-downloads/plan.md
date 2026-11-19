# Implementation Plan: Page-Level Report Downloads

**Branch**: `019-page-report-downloads` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-page-report-downloads/spec.md`

## Summary

Move the Reports card into a modal overlay opened from a workbook icon button on Remittances, delete the Reports page and sidebar item (old address redirects), and add two new monthly workbooks: Sinking fund standings (owner only) and per-unit Expenses. Approach (see [research.md](research.md)): one shared client component, `DownloadReportDialog` plus a `DownloadReportButton`, wraps the existing Base UI `Dialog`; each page passes its own card. The Remittances card is the existing `ReportExportForm`, moved unchanged, so those files stay identical. The standings sheet is computed in the database by one new owner-only function and built on the server (a few dozen rows, like the distribution workbook). The Expenses data comes from a new JSON route and the browser builds the workbook, as the existing remittance reports do (free-tier CPU limit). The shared workbook writer gains optional page-setup fields whose defaults reproduce today's output byte for byte.

## Technical Context

**Language/Version**: TypeScript 5, React 19.3, Next.js 16.4.6 (App Router, Cache Components), Tailwind CSS v4

**Primary Dependencies**: Existing only: `@base-ui/react` Dialog and Tooltip, shadcn `base-nova` components, `lucide-react` (`FileSpreadsheet` icon), the in-house `.xlsx` writer in `lib/reports/xlsx.ts`. No new packages.

**Storage**: Supabase Postgres. One new migration adds a read function `sf_standings(date)`; no table or column changes.

**Testing**: Vitest (writer, layout, route, ranking, component tests), pgTAP for the new function, Playwright (e2e at 360 px and desktop)

**Target Platform**: Mobile-first web; Cloudflare Workers build via vinext

**Project Type**: Single Next.js web application (monolith)

**Performance Goals**: Each download ready in under 5 s for the expected fleet (about 100 units, a few dozen participants); the standings route does one database call; the Expenses route pages through one month of expenses

**Constraints**: Free tier; Worker CPU budget (big workbooks built in the browser); 360 px viewport; `DESIGN.md` tokens; money as integer centavos; existing remittance files unchanged

**Scale/Scope**: About 100 units, tens of participants, a few thousand ledger rows, up to a few thousand expenses per month at most

## Constitution Check

*GATE: passes before research and again after design.*

| Principle | Result |
|-----------|--------|
| I. Free tier | Pass. No new service or dependency. Large workbook built in the browser, as in feature 014. |
| II. Monolith | Pass. Same app, two new route handlers and one SQL function. |
| III. Data integrity | Pass. Read-only feature. Amounts stay integer centavos until the writer, which turns them into pesos exactly as the distribution workbook does. Voided (standings) and deleted (expenses) rows are excluded. |
| IV. Mobile-first | Pass. Overlay and button verified at 360 px; button sits in the existing wrapping toolbar rows. |
| V. Compliance documents | Not applicable. |
| Workflow gates | New SQL function ships in a new migration with pgTAP; it has no EXECUTE for `anon`, grants `authenticated` explicitly, and calls the owner check inside. |

No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/019-page-report-downloads/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── download-overlay.md
│   ├── sinking-fund-standings.md
│   └── expenses-month.md
└── tasks.md            # created later by /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── (owner)/reports/                       # DELETED (page.tsx, loading.tsx)
├── (operations)/remittances/page.tsx      # loads year choices, passes the download button
├── (operations)/expenses/page.tsx         # adds the button to the toolbar action
├── api/sinking-fund/standings/route.ts    # NEW: owner-only JSON/xlsx for a month
└── api/expenses/month/route.ts            # NEW: JSON for the browser-built workbook
components/
├── reports/
│   ├── download-report-button.tsx         # NEW: icon button + tooltip + dialog shell (shared)
│   ├── use-download.ts                    # NEW: shared pending / error / retry / save-file hook
│   ├── standings-download-form.tsx        # NEW: Month/Year card
│   └── expenses-download-form.tsx         # NEW: Month/Year card
├── forms/report-export-form.tsx           # MOVED USE ONLY: unchanged logic, now rendered in the dialog
├── remittances/{daily-view,remittances-list}.tsx   # toolbar slot for the button
├── sinking-fund/sinking-fund-page.tsx     # button in each view's toolbar
└── sinking-fund/dialogs/distribution-details-dialog.tsx   # label "Download year-end distribution (Excel)"
lib/
├── reports/xlsx.ts                        # optional orientation / fitToHeight / printTitles rows
├── reports/download-years.ts              # NEW: shared month and year choices
├── sinking-fund/standings-workbook.ts     # NEW: sheet model + file name
├── sinking-fund/aggregate.ts              # NEW: standingsFor (TypeScript twin, demo + tests)
├── sinking-fund/queries.ts                # NEW: loadStandings
├── expenses/month-workbook.ts             # NEW: payload type, sheet models, file name
├── expenses/month-data.ts                 # NEW: load one month of expenses and units
└── navigation/{items,page-context}.ts     # Reports entry removed
next.config.ts                             # redirect /reports and /reports/:path* to /remittances
supabase/
├── migrations/20261119000100_sf_standings.sql   # NEW
└── tests/sf_standings.test.sql                  # NEW (pgTAP)
tests/
├── fixtures/report-golden.json            # NEW: hashes of today's remittance files, recorded before any code change
├── unit/                                  # writer defaults, standings, expenses workbook, routes, button
└── e2e/                                   # overlay flows; the old /reports e2e moves to Remittances
```

**Structure Decision**: Single Next.js project, extending the existing `lib/reports`, `lib/sinking-fund` and `lib/expenses` folders. One shared overlay component keeps the three pages identical in behavior; page-specific cards stay next to their data.

## Design Notes

1. **Button and overlay (all pages).** `DownloadReportButton` renders an icon button (`FileSpreadsheet`) with `aria-label="Download report"` and a Tooltip, and a `Dialog` whose content is the page's card passed as children. Base UI `Dialog` already gives Escape, close button, outside-click, focus trap and focus return. The card is mounted only while open, so each open starts from the defaults and a stale error is gone (spec edge case). On Sinking fund the button's label reads "Download monthly standings" so it is not confused with the year-end download.
2. **Toolbar placement.** Remittances Daily view: the button joins the right-hand group of the date-control row (next to the "recorded / received" status). List view: it goes in `listView`'s `action` slot, which already places a control at the end of the search and filter row. Expenses uses the same `action` slot beside "Add expense". Sinking fund: the three views each render their own toolbar through `PrimaryActions`; the button is added there so it stays at the top right of the toolbar in every view. The page header is untouched.
3. **Remittances overlay.** Renders `ReportExportForm` as is, with `years` from the server. The page loads the earliest remittance year only for users with `export_reports`, in parallel with its other reads. Defaults already are Monthly, current month and year, All units. Download routes, workbook builders, file names and print setup are not edited, so files are identical (SC-002), proven by the existing report tests plus a new golden comparison.
4. **Reports removal.** Delete `app/(owner)/reports`, the navigation item and its page-context entry; add a `redirects()` rule for `/reports` and `/reports/:path*` to `/remittances`. The API routes under `/api/reports` stay (the overlay uses them).
5. **Writer extension.** `SheetModel` gets optional `orientation` (default portrait), `fitToHeight` (default 1) and `printTitleRows` (default off keeps today's `printTitles` behavior). Defaults leave every existing workbook byte-identical (guarded by a test). Standings: portrait, fit width 1, height 1 (a few dozen rows fit one page; if the fund grows the owner can still print, and `fitToHeight=0` is used when more than 45 participants so the width rule from the spec holds). Expenses: landscape, `fitToHeight=0` so long months continue on more pages with the header rows repeated.
6. **Standings.** `sf_standings(p_as_of date)` (owner only) returns, per non-archived participant created on or before the date: savings, open/overdue loan principal, unpaid balance including interest, and an overdue flag, all as of the date. The route clamps the date to `min(last day of month, today)` and builds the single sheet on the server. Ranking reuses `rankRows` so ties and zero-savings handling match the Top view. Overdue cells use a new `overdueAmountCents` style (colored fill plus a number format that appends the word "Overdue"), keeping the value numeric.
7. **Expenses.** `GET /api/expenses/month?month=YYYY-MM` (any approved user, like the Expenses page) returns units in app order plus the month's non-deleted expenses; the browser builds one sheet per unit. Sheet names reuse `sheetNames`, which already applies the 31-character, forbidden-character and duplicate rules. Unit order uses `sortUnits` (natural order by unit name), the same order as the report workbooks and the Units list; the owner confirmed this ("ROLNET-1, ROLNET-2" naming).
8. **States.** The shared dialog card uses the existing `useActionForm` pattern from `ReportExportForm`: a pending label on the Download button, an error message, and a Retry button, with the overlay kept open and selections kept.

## Risks and Notes

- `sf_standings` is a new SQL function: migration plus pgTAP are required, and memory notes the pgTAP suite runs against `rolnet-dev` through a rollback wrapper and needs the owner's go-ahead before running.
- The remittance form fetches `/api/reports/units` lazily; it needs no change.
- `corepack pnpm check` (vinext) must pass with the new redirect and routes.
- Unit names in the demo data begin with `=` (for example `=1+1,"QHYRV"`). Cells are written as inline strings, so Excel treats them as text; a test covers a name starting with `=`, `+`, `-` or `@`.

## Complexity Tracking

No constitution violations to justify.
