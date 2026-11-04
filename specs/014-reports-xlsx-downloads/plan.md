# Implementation Plan: Reports Page XLSX Downloads

**Branch**: `014-reports-xlsx-downloads` | **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-reports-xlsx-downloads/spec.md`

## Summary

Replace feature 009's single-sheet Weekly, Monthly, and Yearly exports with per-unit workbooks: an
"All units" summary sheet (hyperlinked rows, live link formulas, ALL UNITS total, notes) followed by
one sheet per unit in natural name order, or a single unit's sheet alone. Every sheet matches the six
client mocks in [reference/](reference/) cell for cell (Arial, colours, `#,##0;[Red]-#,##0;"-"`,
merged title bands, frozen panes, live formulas with cached values, one A4 page with Narrow margins).

Technical approach ([research.md](research.md)): extend the existing dependency-free writer in
`lib/reports/xlsx.ts` to multi-sheet workbooks with a style registry, merges, hyperlinks, print setup,
and native gzip-based deflate (R1–R3, R11), all as pure modules that run in the browser (R4); rewrite `lib/reports/report-layout.ts` as pure functions
that turn centavo data into sheet models (R9, R10, R15); load yearly data through a new invoker SQL
aggregate (R5); have the download endpoint return the report data as JSON and build the .xlsx in the browser, because the free Workers plan's 10 ms CPU limit cannot generate a 100-unit workbook (R4, owner decision 2026-11-03); add a units-for-period endpoint for the Single unit dropdown (R13); change the stored
Deposit rule to Rental − Allowance with a backfill (R6); and prove mock fidelity with an automated
comparison against the mocks (R14).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19, Next.js 16 App Router built with vinext for
Cloudflare Workers; SQL (PostgreSQL 15 via Supabase).

**Primary Dependencies**: Existing only: Next.js, Supabase JS, shadcn `base-nova` UI. Workbook writing
uses the in-house `lib/reports/xlsx.ts` and the platform `CompressionStream`. No new packages.

**Storage**: Supabase Postgres. No new tables. Two migrations: new Deposit rule + backfill (US4), and the
`report_unit_month_totals(date, date)` function.

**Testing**: Vitest (unit: periods, sheet names, layout, writer, mock comparison, benchmark), pgTAP
(deposit rule, backfill, aggregate function, grants/RLS), Playwright (Reports page at 360 px,
downloads, deposit display).

**Target Platform**: Cloudflare Workers (free plan) serving a mobile-first web app; files opened in
Excel (Windows/Mac), Excel mobile, Google Drive / Gmail previews, LibreOffice.

**Project Type**: Single monolithic web application (Next.js app + Supabase).

**Performance Goals**: All units workbook for 100 units downloads in ≤ 10 s wall time (SC-004). The
server only reads data and returns JSON; the workbook is built in the browser (R4). A Vitest timing test
guards generation speed, and a production check measures the data endpoint's CPU.

**Constraints**: Workers Free CPU (10 ms per request, I/O excluded), 128 MB memory, 50 subrequests, so no
workbook is built on the server;
integer centavos; no new dependencies; reports are owner-only; every screen works at 360 px.

**Scale/Scope**: About 100 units → up to 101 sheets; a month ≈ 3,100 remittance rows; a year ≈ 36,500
rows aggregated to ≤ 1,200 in SQL.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Free-Tier Sustainability | No new dependency or service; runs on Workers Free and Supabase Free. CPU limit avoided by building the workbook in the browser (R4) and aggregating yearly data in SQL (R5); no paid plan. | Pass |
| II. Monolithic Simplicity | Same app, same route family; one extra GET endpoint; extends an existing in-house module instead of adding a library. | Pass |
| III. Data Integrity and Auditability | Centavo arithmetic end to end, written as pesos only at the cell. Deposit stays stored and DB-computed by trigger. Backfill follows the 009 precedent (derived value, triggers disabled only for the update, old rule documented for recovery). No hard deletes; deleted rows excluded from reports. Live formulas carry cached values. | Pass |
| IV. Mobile-First, Human-Centered | Form keeps its 360 px layout, adds plain-language loading, error, and Retry states; the files themselves render in phone previews (cached values). | Pass |
| V. Compliance Document Lifecycle | Not affected. | N/A |
| Workflow gates | Schema change only via a new migration with pgTAP coverage; function starts with no EXECUTE, `authenticated` granted explicitly because the app calls it; it is `security invoker`, so no definer caller check is needed. | Pass |

**Post-design re-check (after Phase 1)**: Still passes. The data model adds no table; contracts keep the
existing auth guard order; the only new SQL object is an invoker function with explicit grants.

## Project Structure

### Documentation (this feature)

```text
specs/014-reports-xlsx-downloads/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── reports-http.md      # Download and units-for-period endpoints
│   ├── workbook-layout.md   # Sheet, row, cell, style, formula, print contract
│   └── ui-changes.md        # Reports form and Deposit displays
├── reference/           # The six client mocks
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
app/
├── (owner)/reports/page.tsx                 # pass eligible-unit loader defaults to the form
├── api/reports/[kind]/route.ts              # guards + database reads, returns report data as JSON (R4)
└── api/reports/units/route.ts               # NEW: eligible units for a period (R13)

components/
├── forms/report-export-form.tsx             # scope labels, unit dropdown per period, range hint, Retry, builds the .xlsx in the browser
└── remittances/daily-card.tsx               # Deposit = Rental − Allowance in the live breakdown

lib/
├── reports/xlsx.ts                          # multi-sheet writer, style registry, print setup, hyperlinks
├── reports/zip.ts                           # NEW: zip assembly, gzip→deflate parts, STORE fallback
├── reports/sheet-names.ts                   # NEW: sheet names, refs, file-name part (R7, R8)
├── reports/periods.ts                       # title/range texts, Excel serial dates
├── reports/report-layout.ts                 # REWRITE: weekly/monthly/yearly unit sheets
├── reports/summary-sheet.ts                 # NEW: All units summary sheet + notes
├── reports/build-report.ts                  # NEW: units + data → sheets; file names (shared by tests and browser)
├── reports/report-payload.ts                # NEW: the JSON the route returns, and the browser's download
├── reports/report-data.ts                   # per-unit loaders, yearly RPC, eligible units
├── remittances/financials.ts                # depositFor(rental, allowance)
└── demo/mode.ts                             # demo deposits follow the new rule

supabase/
├── migrations/20261103000100_report_deposit_rule.sql   # NEW: trigger rule + backfill (US4)
├── migrations/20261103000200_report_unit_month_totals.sql # NEW: yearly aggregate fn (US3)
└── tests/
    ├── constraints/390_report_deposit_rule.sql         # NEW
    ├── constraints/400_report_unit_month_totals.sql    # NEW
    └── rls/250_report_month_totals_rls.sql             # NEW

types/database.ts                            # hand-add report_unit_month_totals (hand-maintained)

tests/
├── fixtures/reports/                        # NEW: the six mocks + mock-data.json
├── support/xlsx-read.ts                     # NEW: unzip (inflate) + normalise for comparisons
├── support/extract-mock-data.ts             # NEW: rebuilds mock-data.json from the mocks
├── unit/report-periods.test.ts              # extend: titles, ranges, serials, 6-week months
├── unit/sheet-names.test.ts                 # NEW
├── unit/summary-sheet.test.ts               # NEW
├── unit/report-units-route.test.ts          # NEW: GET /api/reports/units
├── unit/xlsx-writer.test.ts                 # extend: multi-sheet, styles, print setup, zip
├── unit/report-layout.test.ts               # REWRITE: worked examples (FR rows/formulas)
├── unit/report-mocks.test.ts                # NEW: generated vs mocks (R14)
├── unit/report-benchmark.test.ts            # NEW: 100-unit generation time and size (R4)
├── unit/report-payload.test.ts              # NEW: payload round trip and client download
├── unit/financials.test.ts                  # update deposit rule
└── e2e/remittance-financials.spec.ts        # update: report form, downloads, deposit display
```

**Structure Decision**: Single Next.js application, extending the feature 009 report modules in place.
Pure layout and writer code stays in `lib/reports/` so it is unit-testable without a database and runs in
the browser, where the workbook is built (R4).

## Implementation Notes

1. **Deposit rule first** (US4): migration + pgTAP, `financials.ts`, daily card, demo data. Everything
   downstream (List view, detail page) reads the stored column and needs no code change beyond tests.
2. **Writer** (R1–R3, R11): multi-sheet model `{ sheets: SheetModel[] }`, each with columns, rows
   (cells + height), merges, freeze, tab colour, hyperlinks, print titles flag, notes. Keep the
   existing single-sheet tests passing until the old layout is removed.
3. **Layout** (Sections 4–9 of the spec): one function per sheet type returning a sheet model and its
   link targets (G or S row), plus `summarySheet(units, kind)`. Row numbers come from the build, never
   hard-coded, and are asserted against the worked examples.
4. **Route**: validate → load units (sorted, eligibility) → load data → return JSON (units, data, file name).
   **Browser**: fetch the JSON, `import()` the builder, build the summary from per-unit centavo totals,
   build and compress unit sheets one by one, zip, and save the Blob. File names per FR-006.
5. **Form** (R13, R16), then e2e.
6. **Mock comparison** (R14) and **benchmark** (R4) gate the work; quickstart covers Excel, phone
   preview, and print preview checks that can't be automated.

## Risks

| Risk | Mitigation |
|------|------------|
| Worker CPU over the free limit for 100 units | Local measurement (about 250 ms for 100 units) showed a server-built workbook cannot fit 10 ms, so the browser builds it (R4, owner decision). The data endpoint stays light (paging and JSON only); quickstart section 5 measures it in production. |
| Old browsers without `CompressionStream` | The zip writer falls back to stored parts (R2); the file still opens. |
| Excel repair prompt from a subtle XML error | Mock comparison test, an Excel open check in the quickstart, and XML order per the SpreadsheetML schema (sheetPr, dimension, sheetViews, sheetFormatPr, cols, sheetData, mergeCells, hyperlinks, printOptions, pageMargins, pageSetup). |
| Deposit backfill surprises the owner (partial payments now show a full deposit) | Called out in spec Assumptions; quickstart includes a before/after spot check on rolnet-dev. |
| pgTAP runs only against rolnet-dev (no local Supabase) | Use the existing rollback wrapper; ask before running against rolnet-dev. |

## Complexity Tracking

No constitution violations to justify.
