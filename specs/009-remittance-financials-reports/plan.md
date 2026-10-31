# Implementation Plan: Remittance Financials and XLSX Reports

**Branch**: `009-remittance-financials-reports` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-remittance-financials-reports/spec.md`

## Summary

Every remittance gets a stored **Allowance** (₱40, fixed at save) and a stored **Deposit** (active
payments minus the allowance, which may be negative). The UI renames "Due" to **Rental**. Daily view
cards show a live Allowance and Deposit breakdown, List view gains Allowance and Deposit columns, and
payments can no longer exceed the rental, so the "Credit" badge goes away. The Reports page replaces
the monthly CSV with **Weekly, Monthly, and Yearly XLSX** downloads for the fleet or one unit, laid
out like the client's template with live formulas.

The database keeps the figures right for every entry point: Daily view, the details page, the API,
and owner corrections. A trigger on `remittance_payments` rejects any payment that would push the
total paid above the rental and recalculates the remittance's deposit after every payment change. A
one-time backfill sets the existing records without touching their audit history. The XLSX files are
built in the app by a small in-repo workbook writer (Office Open XML in a stored zip), so no package
is added and the Cloudflare Worker can run it.

## Technical Context

**Language/Version**: TypeScript 5 (strict), SQL (Supabase Postgres 15), Next.js 16.4 App Router with `cacheComponents` (route handlers under `app/api/`)

**Primary Dependencies**: Existing only (Supabase JS, Zod, Base UI, lucide). **No new packages.** The XLSX writer is in-repo: SpreadsheetML parts with styles, formulas, frozen header and column widths, zipped with the STORE method and a CRC-32 (research R4).

**Storage**: One new migration: `remittances.allowance_centavos` and `remittances.deposit_centavos` (bigint), a service-date index, a payment trigger (an over-rental check plus a deposit recalculation), an extended financial-facts lock, and the backfill. No new tables, RPCs, or grants. The existing `monthly_report` RPC stays (pgTAP 070 and 220 still cover it). Only the app stops using it.

**Testing**: pgTAP (`supabase/tests/constraints/270_remittance_financials.sql`, `rls/200_remittance_financials_rls.sql`) run against rolnet-dev through the rollback wrapper, **after you approve it** (local Supabase can't run here). Vitest covers the financial formula, week numbering, report layout, XLSX writer output (by unzipping and checking parts, formulas, styles), and the card breakdown. Playwright (demo build on :3100) covers the card breakdown, List view columns, and the three downloads (opened with a small zip reader in the test).

**Target Platform**: Mobile-first web on Cloudflare Workers through vinext (`check` and `build:vinext` must stay green; the writer uses only Web APIs: `Uint8Array`, `TextEncoder`, `Response`)

**Project Type**: Single Next.js monolith

**Performance Goals**: A full-year fleet report (about 12 units × 365 days, roughly 4,400 remittances) downloads in under 10 s (SC-005). Rows are read in pages of 1,000 (`max_rows = 1000`) with the new `service_date` index.

**Constraints**: Integer centavos everywhere in SQL and TS. Pesos (centavos / 100) are written only as XLSX cell values. Tokens only in the UI, and 360 px layouts. No middle-dot strings.

**Scale/Scope**: 1 migration, 2 pgTAP files, about 5 lib modules, 3 route handlers (one dynamic route), and changes to the Daily view card, List view, details page, Reports page, demo data, and docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Free-Tier Sustainability | No service or package added. XLSX generation runs inside the existing Worker | Pass |
| II. Monolithic Simplicity | It's one migration, pure lib modules, and route handlers in the app. The in-repo writer (about 250 lines) is chosen over a large spreadsheet library with uncertain Workers support (R4) | Pass |
| III. Data Integrity and Auditability | Centavos throughout. Allowance is fixed at insert and locked with the other financial facts. Deposit is maintained by the database inside the payment's own transaction, so it's always atomic with the payment. Over-rental is rejected at the database for every entry point, with the remittance row locked against concurrent inserts. Payment changes remain audited. The backfill preserves rental, payments, `updated_at`, and audit history (R2) | Pass |
| IV. Mobile-First, Human-Centered | The card breakdown is plain text with a minus sign plus red. The over-rental message says what's allowed. The Reports form works at 360 px | Pass |
| V. Compliance Documents | Not affected | N/A |
| Workflow gates | Ordered migration plus pgTAP coverage. `types/database.ts` is regenerated (with `--linked`, since there's no local DB). The migration adds trigger functions only, with no `anon` or `authenticated` EXECUTE grant. The remaining checks are lint, typecheck, Vitest, Playwright, `supabase test db` (through the rolnet-dev wrapper), vinext check, and the Workers build | Pass, rolnet-dev run needs your OK |

**Post-design re-check**: Pass. Phase 1 added no package, grant, RPC, or service.

## Project Structure

### Documentation (this feature)

```text
specs/009-remittance-financials-reports/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── reports-http.md        # GET /api/reports/{weekly|monthly|yearly}
│   ├── report-sheets.md       # exact sheet layouts, formulas, styles
│   └── ui-changes.md          # card breakdown, List view columns, messages
├── checklists/requirements.md
└── tasks.md                   # next: /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/20261031000100_remittance_financials.sql    # columns, index, triggers, lock, backfill
├── tests/constraints/270_remittance_financials.sql         # new pgTAP
└── tests/rls/200_remittance_financials_rls.sql             # staff can't write deposit/allowance directly
types/database.ts                                           # regenerated
lib/
├── remittances/financials.ts          # new: allowanceCentavos (4000), depositFor(paid, allowance), overRentalMessage
├── remittances/daily-board.ts         # saved card carries allowance and deposit
├── remittances/daily-query.ts         # selects allowance_centavos, deposit_centavos (demo too)
├── remittances/totals.ts              # balance only (no credit)
├── reports/periods.ts                 # new: week (Mon to Sun), month and year ranges, weekOfMonth, day labels
├── reports/report-data.ts             # new: paged loads of remittances and expenses for a range and scope (plus demo)
├── reports/report-layout.ts           # new: pure builders, rows to a sheet model (cells, styles, formulas)
├── reports/xlsx.ts                    # new: sheet model to .xlsx bytes (SpreadsheetML plus stored zip)
├── reports/monthly-csv.ts             # removed
├── validation/remittances.ts          # payment ≤ rental refinements
└── actions/errors.ts                  # over-rental database message passes through
app/
├── api/reports/[kind]/route.ts        # new: weekly | monthly | yearly → .xlsx
├── api/reports/monthly/route.ts       # removed (the CSV)
├── (owner)/reports/page.tsx           # new form, unit list including retired
├── actions/remittances.ts             # return refreshed updated_at and deposit after writes
└── (operations)/remittances/[id]/page.tsx  # no credit wording; payment max hint
components/
├── forms/report-export-form.tsx       # rewritten: report kind, period picker, scope, unit
├── forms/remittance-detail-forms.tsx  # "Paying more is kept as credit" removed; max-amount check
├── remittances/daily-card.tsx         # "Rental" label, live breakdown, over-rental block
├── remittances/balance-badge.tsx      # Paid / Owes only
├── remittances/money-text.tsx         # new: signed peso text, red when negative (minus sign kept)
└── remittances/remittances-list.tsx   # Rental, Paid, Balance, Allowance, Deposit columns
lib/demo/mode.ts                       # demo allowance/deposit, demo expenses across a month
tests/
├── unit/financials.test.ts, unit/report-periods.test.ts, unit/report-layout.test.ts,
│   unit/xlsx-writer.test.ts           # new
├── unit/daily-card.test.tsx, unit/daily-board.test.ts   # extended
├── unit/monthly-report.test.ts        # removed with the CSV
└── e2e/remittance-financials.spec.ts  # new (demo)
docs/DEVELOPMENT.md                    # rules: allowance, deposit, no overpayment, XLSX reports
```

**Structure Decision**: Stay in the monolith layout. The report logic is split into four pure, testable steps (periods, data, layout, then xlsx), behind one dynamic route handler. The database owns the financial invariants.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|------|------------|--------------------------------------|
| In-repo XLSX writer (about 250 lines) | The client needs real .xlsx files with fills, fonts, borders, frozen header, number formats, and live formulas, generated in a Cloudflare Worker | ExcelJS is large, relies on Node streams and Buffer, and its Workers support is unproven. SheetJS Community can't write cell styles. `write-excel-file` has no thick-border or formula-cached-value control. A hand-written stored-zip writer is small, has no dependency, and is fully testable |
