---
description: "Task list for feature 014: Reports Page XLSX Downloads"
---

# Tasks: Reports Page XLSX Downloads

**Input**: Design documents from `specs/014-reports-xlsx-downloads/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. CLAUDE.md requires lint, typecheck, and tests to pass for every task, schema
changes need pgTAP coverage, and the plan makes the mock comparison (research R14) and the CPU
benchmark (R4) acceptance gates.

**Organization**: One phase per user story from spec.md, in priority order. User Story 1 (Monthly) is
the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 Monthly · US2 Weekly · US3 Yearly · US4 Deposit consistency · US5 Report form

## Hard rules for every task (CLAUDE.md, constitution 1.1.0)

- **Free tier (constitution I)**: no new npm dependencies or services; the workbook is built with the
  in-house writer and the platform `CompressionStream`. The free Worker's 10 ms CPU limit
  cannot generate a 100-unit workbook, so the browser builds it (research R4, T008), never a paid plan.
- **Monolith (constitution II)**: everything stays in this Next.js app and its Supabase database; new
  code extends `lib/reports/` and the existing `/api/reports` routes.
- **Data integrity (constitution III)**: money stays integer centavos until a cell is written
  (`centavos / 100`); app money is parsed/formatted only with `lib/money/centavos.ts`. Nothing is
  hard-deleted; reports read only rows with `deleted_at is null`. The Deposit backfill is a documented
  derived-value correction (spec FR-111). Schema changes only through new migrations with pgTAP
  coverage; new functions start with no EXECUTE and grant `authenticated` explicitly.
- **Mobile, human-centred (constitution IV)**: the Reports form works at 360 px with no horizontal
  scroll; every error says what to do next and offers Retry; shadcn `base-nova` components and
  `app/globals.css` tokens only (workbook colours are file data, not UI tokens).
- **Compliance documents (constitution V)**: not affected by this feature.
- **Layout source of truth**: exact layout, style, formula, and print values are in
  [contracts/workbook-layout.md](contracts/workbook-layout.md); the mocks in `reference/` win on any
  disagreement.
- **Environment**: no local Supabase; migrations and pgTAP go to rolnet-dev only after the owner
  approves, through the rollback wrapper. `types/database.ts` is hand-maintained: add new functions
  by hand, never regenerate.

---

## Phase 1: Setup (shared test infrastructure)

**Purpose**: Fixtures and helpers that every story's tests use.

- [X] T001 Copy the six mocks from `specs/014-reports-xlsx-downloads/reference/` into `tests/fixtures/reports/` (same file names)
- [X] T002 Create `tests/support/xlsx-read.ts`: open an .xlsx (deflate via `node:zlib` `inflateRawSync` and stored entries), parse `xl/workbook.xml`, each worksheet, `xl/styles.xml`, and shared strings using regular expressions (no XML DOM dependency), and return per sheet: name, tab colour, column widths, row heights, merges, freeze pane, hyperlinks (ref → location), print setup (margins, paperSize, orientation, fitToWidth/Height, horizontalCentered, fitToPage), print titles, and per cell: value, formula (sheet-name quotes stripped for comparison), and a resolved style `{ fontName, size, bold, italic, underline, color, fill, borderTop, borderBottom, horizontal, vertical, indent, wrap, numFmtCode }` with number-format codes normalised (`[RED]`→`[Red]`, `\-`→`-`, `\ `→` `, `"-"`/`\-` zero section equal)
- [X] T003 Create `tests/fixtures/reports/mock-data.json` with a committed script `tests/support/extract-mock-data.ts` (`tests/unit/report-mock-data.test.ts` checks it against the mocks and rewrites it with `UPDATE_MOCK_DATA=1 corepack pnpm exec vitest run tests/unit/report-mock-data.test.ts`; the script reads the mocks with T002) so the fixture can be rebuilt and reviewed. The fixture holds units in mock tab order with, per kind, each date's driver, rental and allowance (pesos → centavos), each block's expenses (centavos), and the yearly month totals and yearly expenses; also store each mock's period (`2026-10`, `2026-10-26`, `2026`)

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Writer, names, periods, data loading, summary sheet, and route skeleton shared by the
three report types.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Create `lib/reports/zip.ts`: `zipParts(parts: { name: string; xml: string }[]): Promise<Uint8Array>` that compresses each part with `CompressionStream("gzip")`, strips the 10-byte gzip header and 8-byte trailer, takes CRC-32 and size from the trailer, and writes zip entries with method 8 plus the central directory (fixed 1980-01-01 timestamps, UTF-8 flag); falls back to STORE with the existing JS `crc32` when `CompressionStream` is undefined (research R2). Move `crc32`/`storeZip` here from `lib/reports/xlsx.ts`
- [X] T005 [P] Extend `tests/unit/xlsx-writer.test.ts` (and `tests/support/stored-zip.ts` if needed) for `zipParts`: deflate output round-trips through `inflateRawSync`, CRC matches `crc32`, STORE fallback when `CompressionStream` is stubbed away
- [X] T006 Rewrite `lib/reports/xlsx.ts` as a multi-sheet writer: `SheetModel` per [data-model.md](data-model.md) (`name, tabColor, columns, rows {height, cells}, merges, freezeAt "A5", hyperlinks, printTitles`), a style registry keyed by (font name/size/bold/italic/underline/colour, fill, top/bottom border style+colour, horizontal/vertical alignment, indent, wrap, numFmt) that assigns `cellXfs` on first use, the named styles table from [contracts/workbook-layout.md](contracts/workbook-layout.md) with Arial fonts and AMT = `#,##0;[Red]-#,##0;"-"`, date formats `ddd", "mmm d` and `mmmm`; worksheet XML in schema order (sheetPr with tabColor + `pageSetUpPr fitToPage="1"`, dimension, sheetViews with frozen pane `ySplit="4" topLeftCell="A5"`, sheetFormatPr, cols, sheetData with `ht`+`customHeight="1"`, mergeCells, hyperlinks with `location` only, `printOptions horizontalCentered="1"`, `pageMargins left="0.25" right="0.25" top="0.75" bottom="0.75" header="0.3" footer="0.3"`, `pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"`); workbook.xml with sheets, `_xlnm.Print_Titles` defined names (`localSheetId`, `'Name'!$1:$4`) and `calcPr fullCalcOnLoad="1"`; content types and rels for N sheets; `workbookBytes(sheets: Iterable<SheetModel> | AsyncIterable<SheetModel>)` that serialises and compresses one sheet at a time via T004 (research R3, R11)
- [X] T007 Update `tests/unit/xlsx-writer.test.ts` for T006: two-sheet workbook opens with `tests/support/xlsx-read.ts`; styles resolve to Arial sizes 16/11/10 and the exact colours; merges, heights, freeze pane, tab colours, hyperlink locations, print setup values, and print-title defined names are present; formula cells carry cached `<v>`; XML special characters in names and text are escaped; worksheet child elements appear in the order listed in [contracts/workbook-layout.md](contracts/workbook-layout.md) (sheetPr, dimension, sheetViews, sheetFormatPr, cols, sheetData, mergeCells, hyperlinks, printOptions, pageMargins, pageSetup); sheet names are unique ignoring case and ≤ 31 characters; every defined name and hyperlink points at an existing sheet
- [X] T008 Decide where the workbook is built (research R4): measured locally, a 100-unit All units workbook takes about 250 ms (about 390 ms CPU), far over the free Workers plan's 10 ms CPU limit, so the owner decided on 2026-11-03 to build the .xlsx in the browser. Record the numbers and the decision in `specs/014-reports-xlsx-downloads/research.md` R4, and update plan.md, contracts/reports-http.md, quickstart.md and this task list to match (done with this decision)
- [X] T009 [P] Create `lib/reports/sheet-names.ts` per research R7/R8: `sortUnits(units)` with `Intl.Collator("en", { numeric: true, sensitivity: "base" })` then id; `sheetNames(names: string[]): string[]` (replace `: \ / ? * [ ]` with "-", trim apostrophes and spaces, empty → "Unit", "All units" (case-insensitive) → "All units (unit)", cut to 31, case-insensitive de-duplication with " (2)", " (3)"… staying ≤ 31); `sheetRef(name)` → `'` + name with `'` doubled + `'`; `fileNamePart(name)` (remove `\ / : * ? " < > |` and control characters, whitespace runs → "-", trim dots/dashes, empty → "unit")
- [X] T010 [P] Create `tests/unit/sheet-names.test.ts`: rolnet-1, rolnet-2, … rolnet-10, rolnet-100 order; forbidden characters; leading/trailing apostrophes; 40-character names; two names cleaning to the same 31 characters → second ends " (2)" with length 31; "All units" and "all units"; `sheetRef("Mang Ben's")` = `'Mang Ben''s'`; `fileNamePart("rolnet-1")` = `rolnet-1`
- [X] T011 [P] Extend `lib/reports/periods.ts`: `excelSerial(date)` (days since 1899-12-30, UTC), `monthTitle("2026-10")` → "October 2026", `weekTitle(monday)` → "Week of Oct 19 – 25, 2026" / "Week of Oct 26 – Nov 1, 2026" / "Week of Dec 28, 2026 – Jan 3, 2027", `rangeLabel(from, to)` → "Oct 1–4" / "Oct 26–Nov 1" / "Nov 1", `weekCoverText` replaced by `weekRangeText(date)` → "Oct 26 – Nov 1, 2026" (fixed English month arrays, no `Intl`); keep `monthWeeks`, `weekRange`, `validatePeriod`
- [X] T012 [P] Extend `tests/unit/report-periods.test.ts` for T011: October 2026 blocks (Oct 1–4, 5–11, 12–18, 19–25, 26–31), November 2026 has 6 blocks with the first "Nov 1", week titles for same month / across months / across years, `excelSerial("2026-10-01")` = 46296
- [X] T013 Rewrite `lib/reports/report-data.ts` shared parts: `loadReportUnits(supabase, range)` returning `{ id, name, archived }[]` for non-deleted units that are non-archived, or archived with ≥ 1 non-deleted remittance or expense in `range`, sorted by `sortUnits` (T009); `loadDailyData(supabase, range, unitIds | null)` paging `remittances` (`unit_id, service_date, amount_due_centavos, allowance_centavos, created_at, id, drivers(full_name)`, `deleted_at is null`, ordered unit, date, created_at, id) and `expenses` (`unit_id, expense_date, amount_centavos`, `deleted_at is null`) into `Map<unitId, { remittances: {date, driverName, rentalCentavos, allowanceCentavos}[]; expensesByDate: Map<date, centavos> }>`; demo-mode branches use `lib/demo/mode.ts` data; remove `depositCentavos` from report data (FR-022)
- [X] T014 Create `lib/reports/summary-sheet.ts`: `summarySheet(kind, period text, units: { sheetName, linkRefs: {B,C,D,E,F cell refs}, totals: {rental, deposit, allowance, expenses, net} }[])` building the "All units" `SheetModel` per [contracts/workbook-layout.md](contracts/workbook-layout.md): columns A 26, B–F 15; title band and "All units  ·  {Type} report"; headers; one row per unit with hyperlink `#'Name'!A1` (`link` style) and `='Name'!{ref}` formulas (`linkAmount`) with cached values; "ALL UNITS" row with `=SUM(B5:B{last})`…F; "Notes" two rows below with the kind's exact lines from spec FR-043 (heights 15 or 28 by the 112-character rule); tab colour 1F3864; no print titles
- [X] T015 [P] Create `tests/unit/summary-sheet.test.ts`: two units → rows 5–6, ALL UNITS row 7 formulas and cached sums, notes start row 9, notes text equals FR-043 for each kind with no "MOCK DATA" line, hyperlink locations quoted, a unit named `Mang Ben's` produces `'Mang Ben''s'!C56`
- [X] T016 Rewrite `app/api/reports/[kind]/route.ts` as the report-data endpoint (contracts/reports-http.md): keep the guard order and error envelope; accept `scope=all|unit` (`fleet` → `all`); validate the period; load units with `loadReportUnits`; for `scope=unit` return 404 `NOT_FOUND` "That unit has no report for this period. Choose another unit." when the unit is not eligible; load the data (`loadDailyData` for weekly and monthly, `loadYearlyData` for yearly); return the JSON payload built by `lib/reports/report-payload.ts` (units in tab order, per-unit data in centavos, file name per FR-006) with `cache-control: no-store`. The route never builds a workbook

**Checkpoint**: Writer, names, periods, data, summary, and route skeleton are ready; lint, typecheck, and tests pass.

---

## Phase 3: User Story 1 - Download the Monthly report (Priority: P1) 🎯 MVP

**Goal**: Monthly / All units and Monthly / Single unit workbooks that match the monthly mocks.

**Independent Test**: Download Monthly for October 2026 (All units and DHDMM1-style single unit); the mock comparison passes and the worked example rows/formulas hold.

### Tests for User Story 1

- [X] T017 [P] [US1] Rewrite `tests/unit/report-layout.test.ts` monthly section: October 2026 rows — Week 1 dates 5–8, subtotal 9, Expenses 10, Allowance 11, Net 12; Week 2 13–19 / 20–23; Week 3 24–30 / 31–34; Week 4 35–41 / 42–45; Week 5 46–51 / 52–55; GRAND TOTAL 56–59; formulas D5 `C5-E5`, C9 `SUM(C5:C8)`, C11 `E9`, C12 `C11-C10`, C56 `C9+C20+C31+C42+C52`, C57 `C10+C21+C32+C43+C53`, C58 `E56`, C59 `C58-C57`; link refs C56, D56, E56, C57, C59; blank day has date, empty cells, no formula; two remittances on one date → two rows; November 2026 → 6 blocks, first "Week 1 Subtotal  ·  Nov 1"; empty month → all dates, zero cached totals; a rental of 18050 centavos is written as 180.5 with the AMT format; row heights 13 from row 5
- [X] T018 [P] [US1] Create `tests/unit/report-mocks.test.ts` monthly cases: build Monthly All units and Single unit from `tests/fixtures/reports/mock-data.json` (T003) and compare with `rolnet-monthly-2026-10-all-units-MOCK.xlsx` and `rolnet-monthly-2026-10-DHDMM1-MOCK.xlsx` using `tests/support/xlsx-read.ts`: sheets matched by name, not position (the mocks' tab order DHDMM1, DHDMM2, DRECB2, DKQLM3, DNPTV4 is sample data; the generator sorts naturally); "All units" is first; summary rows from row 5 are matched by the unit name in column A (each row's cells, hyperlink, and formulas compared after mapping), and the ALL UNITS row and notes are compared by position relative to the last unit row; then every cell's value, formula, and resolved style, merges, widths, heights (±0.5), freeze, tab colours, hyperlinks, print setup, print titles; skip the mock-only notes lines ("MOCK DATA…" and its sample note 4 text)

### Implementation for User Story 1

- [X] T019 [US1] Implement `monthlyUnitSheet(unit: { sheetName, name }, data, month)` in `lib/reports/report-layout.ts` per spec Section 6 and [contracts/workbook-layout.md](contracts/workbook-layout.md): columns A 36, B 24, C–E 17; title `monthTitle`, subtitle "Unit {name}  ·  Monthly report"; headers Date | Driver | Rental | Deposit | Allowance; week blocks from `monthWeeks` with date rows (`excelSerial`, `date` style), driver, rental, `=C{r}-E{r}`, allowance, subtotal "Week {n} Subtotal  ·  {rangeLabel}", Expenses (block days inside the month), Allowance `=E{S}`, Net `=C{S+2}-C{S+1}`; GRAND TOTAL block; heights 13 from row 5; every formula's cached value from centavo sums; return `{ sheet, linkRefs: { B: C{G}, C: D{G}, D: E{G}, E: C{G+1}, F: C{G+3} }, totals }`. Remove the old 009 `monthlySheet`
- [X] T020 [US1] Create `lib/reports/report-payload.ts`: the `ReportPayload` type from contracts/reports-http.md, `toPayload(...)` (server: Maps → plain JSON), `fromPayload(payload)` (browser: JSON → `BuildInput`), and `buildPayloadWorkbook(payload)` that runs `buildReportSheets` and `workbookBytes` (this is what the browser calls); add `tests/unit/report-payload.test.ts` covering the JSON round trip, `scope=unit` (no summary sheet) and `scope=all` (summary first), and file names
- [X] T021 [US1] Update the monthly download checks in `tests/e2e/remittance-financials.spec.ts` (demo build on :3100): Monthly / All units downloads `rolnet-monthly-<YYYY-MM>-all-units.xlsx` whose first sheet is "All units" followed by unit sheets in natural order (rolnet-2 before rolnet-10), with the summary rows in the same order

**Checkpoint**: Monthly reports are complete and match the mocks (MVP).

---

## Phase 4: User Story 2 - Download the Weekly report (Priority: P2)

**Goal**: Weekly / All units and Single unit workbooks that match the weekly mocks.

**Independent Test**: Download Weekly for 2026-10-28 (Oct 26 – Nov 1); mock comparison passes; rows equal the matching monthly rows.

### Tests for User Story 2

- [X] T022 [P] [US2] Add the weekly section to `tests/unit/report-layout.test.ts`: week of 2026-10-26 → title "Week of Oct 26 – Nov 1, 2026", dates 5–11 Monday–Sunday, row 12 "Week Subtotal  ·  Oct 26–Nov 1", C12 `SUM(C5:C11)`, C14 `E12`, C15 `C14-C13`, link refs C12, D12, E12, C13, C15; no GRAND TOTAL; expenses on Oct 30 and Nov 1 both counted; future days blank; Dec 28, 2026 – Jan 3, 2027 title; heights 16 from row 5; the weekly rows for Oct 26–31 equal the October monthly rows for the same data
- [X] T023 [P] [US2] Add weekly cases to `tests/unit/report-mocks.test.ts` (sheets and summary rows matched by name as in T018) against `rolnet-weekly-2026-10-26-all-units-MOCK.xlsx` and `rolnet-weekly-2026-10-26-DHDMM1-MOCK.xlsx`

### Implementation for User Story 2

- [X] T024 [US2] Implement `weeklyUnitSheet(unit, data, monday)` in `lib/reports/report-layout.ts` per spec Section 7 (shares the monthly date-row and block helpers; one block, no GRAND TOTAL, heights 16, title `weekTitle`, subtitle "… Weekly report"); return link refs `C{S}`, `D{S}`, `E{S}`, `C{S+1}`, `C{S+3}` and totals. Remove the old 009 `weeklySheet`
- [X] T025 [US2] Make sure the weekly data (`loadDailyData` over the Monday–Sunday range from `validatePeriod`) is in the payload, with file name `rolnet-weekly-<Monday>-all-units.xlsx` / `rolnet-weekly-<Monday>-{unit}.xlsx`, and add a weekly case to `tests/unit/report-payload.test.ts`

**Checkpoint**: Weekly reports work on their own and match the mocks.

---

## Phase 5: User Story 3 - Download the Yearly report (Priority: P2)

**Goal**: Yearly / All units and Single unit workbooks that match the yearly mocks, loaded from monthly aggregates.

**Independent Test**: Download Yearly 2026; mock comparison passes; each month equals that month's monthly GRAND TOTAL.

### Tests for User Story 3

- [X] T026 [P] [US3] Create `supabase/tests/constraints/400_report_unit_month_totals.sql` (pgTAP): sums of `amount_due_centavos`, `allowance_centavos`, `amount_centavos` per unit and month within `[p_from, p_to]`; soft-deleted remittances and expenses excluded; a month with only expenses returns a row with zero rental; `remittance_count` correct
- [X] T027 [P] [US3] Create `supabase/tests/rls/250_report_month_totals_rls.sql` (pgTAP): `anon` has no EXECUTE; `authenticated` has EXECUTE; the function is `security invoker` (`prosecdef = false`); a user whose RLS hides the rows gets none
- [X] T028 [P] [US3] Add the yearly section to `tests/unit/report-layout.test.ts`: rows 5–16 month serials with `mmmm` style, C `B{r}-D{r}`, empty months hold 0, row 17 "Year Subtotal  ·  Jan–Dec" `SUM(B5:B16)`, 18–20, 21 `B17`/`C17`/`D17`, 22 `B18`, 23 `D21`, 24 `B23-B22`; link refs B21, C21, D21, B22, B24; widths 30/24/24/24; heights 16 from row 5; October's row equals the October monthly GRAND TOTAL for the same data
- [X] T029 [P] [US3] Add yearly cases to `tests/unit/report-mocks.test.ts` (sheets and summary rows matched by name as in T018) against `rolnet-yearly-2026-all-units-MOCK.xlsx` and `rolnet-yearly-2026-DHDMM1-MOCK.xlsx`

### Implementation for User Story 3

- [X] T030 [US3] Create `supabase/migrations/20261103000200_report_unit_month_totals.sql`: `public.report_unit_month_totals(p_from date, p_to date)` returning `(unit_id uuid, month date, rental_centavos bigint, allowance_centavos bigint, remittance_count integer, expense_centavos bigint)`, `language sql stable security invoker set search_path = public`, one row per (unit, month) with a non-deleted remittance or expense; `revoke all … from public, anon, authenticated;` then `grant execute … to authenticated;`
- [X] T031 [US3] Hand-add `report_unit_month_totals` (Args `{ p_from: string; p_to: string }`, Returns the row array) under `Functions` in `types/database.ts`
- [X] T032 [US3] Add `loadYearlyData(supabase, year, unitIds | null)` to `lib/reports/report-data.ts` calling the RPC and returning `Map<unitId, { months: {rentalCentavos, allowanceCentavos}[12]; expenseCentavos }>`; demo mode aggregates `lib/demo/mode.ts` data the same way
- [X] T033 [US3] Implement `yearlyUnitSheet(unit, data, year)` in `lib/reports/report-layout.ts` per spec Section 8 and remove the old 009 `yearlySheet`
- [X] T034 [US3] Make sure the yearly data (`loadYearlyData`) is in the payload, with file name `rolnet-yearly-YYYY-all-units.xlsx` / `rolnet-yearly-YYYY-{unit}.xlsx`, and add a yearly case to `tests/unit/report-payload.test.ts`

**Checkpoint**: Yearly reports work on their own and match the mocks.

---

## Phase 6: User Story 4 - App Deposit figures match the reports (Priority: P2)

**Goal**: Stored and displayed Deposit = Rental − Allowance everywhere.

**Independent Test**: Returned card with Rental ₱180.00, type 100 → Deposit ₱140.00; old partial-payment records show Rental − Allowance in List view and on the detail page.

### Tests for User Story 4

- [X] T035 [P] [US4] Create `supabase/tests/constraints/390_report_deposit_rule.sql` (pgTAP): a new remittance gets `deposit_centavos = amount_due_centavos - allowance_centavos`; adding, editing, and voiding payments leaves the deposit unchanged but changes `updated_at`; the migration's backfill leaves no row where `deposit_centavos <> amount_due_centavos - allowance_centavos` (deleted rows included); the backfill wrote no `business_audit` rows
- [X] T036 [P] [US4] Update `tests/unit/financials.test.ts`: `depositFor(18000, 4000)` = 14000 regardless of payment; overpayment helpers unchanged

### Implementation for User Story 4

- [X] T037 [US4] Create `supabase/migrations/20261103000100_report_deposit_rule.sql`: header comment documenting the old rule (active payments − allowance) for recovery; `create or replace function public.remittances_set_deposit()` setting `new.deposit_centavos := new.amount_due_centavos - new.allowance_centavos` (keep `allowance_centavos := 4000` on INSERT, `security invoker`); keep `remittance_payments_sync_deposit()` so payments still bump `updated_at`; backfill all rows with `remittances_audit_fields`, `remittances_business_audit`, and `remittances_lock_financial_facts` disabled only around the update (same pattern as `20261031000100_remittance_financials.sql`); re-revoke EXECUTE on the trigger function from `public, anon, authenticated`
- [X] T038 [US4] Change `depositFor` in `lib/remittances/financials.ts` to `(rentalCentavos, allowanceCentavos = ALLOWANCE_CENTAVOS) => rentalCentavos - allowanceCentavos` and update its comment (feature 014 supersedes 009's rule)
- [X] T039 [US4] Update `components/remittances/daily-card.tsx`: the live breakdown shows Deposit = rental − allowance as soon as the card has a rental (not tied to the typed payment or the over-rental state); locked cards still show the stored value
- [X] T040 [P] [US4] Update demo remittances in `lib/demo/mode.ts` so `deposit_centavos = amount_due_centavos - allowance_centavos`
- [X] T041 [US4] Update deposit expectations in `tests/e2e/remittance-financials.spec.ts`: typing 0, 100, or 180 on a ₱180 Returned card shows Deposit ₱140.00; List view and the detail page show the same value after saving

**Checkpoint**: App and exports agree on Deposit.

---

## Phase 7: User Story 5 - Report form usability (Priority: P3)

**Goal**: The Reports form offers type, All units / Single unit with a period-aware unit list, the week range hint, loading, error, and Retry, at 360 px.

**Independent Test**: At 360 px, complete all six type/scope downloads without horizontal scrolling; offline Download shows an error with Retry that works once online.

### Tests for User Story 5

- [X] T042 [P] [US5] Create `tests/unit/report-routes.test.ts` for both routes in demo mode: `GET /api/reports/units` (401/403/400, non-archived units plus archived units with records in the period, natural order, archived labels "(archived)") and `GET /api/reports/{kind}` (guards, period checks, all-units and single-unit payloads, 404 for an ineligible unit, yearly and weekly keys, empty period)
- [X] T043 [P] [US5] Add Reports form checks to `tests/e2e/remittance-financials.spec.ts` at a 360 × 800 viewport: scope labels "All units" / "Single unit"; Single unit dropdown lists units in natural order; weekly hint "Oct 26 – Nov 1, 2026" for 2026-10-28; offline Download shows the error and a Retry button that downloads once back online; no horizontal scroll (`scrollWidth <= clientWidth`)

### Implementation for User Story 5

- [X] T044 [US5] Create `app/api/reports/units/route.ts` per [contracts/reports-http.md](contracts/reports-http.md): same guards, `kind` + period validation via `validatePeriod`, `loadReportUnits` (T013), response `{ units: { id, name, label, archived }[] }` with `label = "<name> (archived)"` for archived units, `cache-control: no-store`
- [X] T045 [US5] Update `components/forms/report-export-form.tsx` per [contracts/ui-changes.md](contracts/ui-changes.md): scope values `all` / `unit` labelled "All units" / "Single unit"; Single unit dropdown fed by `/api/reports/units` for the current kind and period (refetch on change, "Loading units…" while pending, clear a selection that disappears); weekly hint from `weekRangeText`; on Download fetch `/api/reports/{kind}`, then `import("@/lib/reports/report-payload")` and build the workbook in the browser (research R4) and save it from a Blob under the payload's `fileName`; pending label "Creating report…"; error state with a Retry button repeating the last query; success message with the file name; no CSV option
- [X] T046 [US5] Update `app/(owner)/reports/page.tsx`: remove the `loadReportUnits` preload and the `units` prop (the form fetches `/api/reports/units` when Single unit is first chosen and on every period change, per T045); keep the year options; confirm the page still renders in demo mode

**Checkpoint**: All stories work independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T047 [P] Create `tests/unit/report-benchmark.test.ts`: generate an All units monthly workbook for 100 synthetic units (one remittance per day, a few expenses) through the real layout + `workbookBytes` path; record the time and size in a console line; assert it completes in under 5 s (a phone-class budget with room to spare), the file is under 5 MB, and the output opens with `tests/support/xlsx-read.ts` with 101 sheets in natural order
- [X] T048 [P] Edge-case tests in `tests/unit/report-layout.test.ts`: a unit named `All units`, a 45-character name, two names that clash after cleaning, `Mang Ben's` — formulas and hyperlinks all resolve to existing sheet names
- [X] T049 Remove dead 009 report code and tests (`fitColumns`, old `StyleKey` matrix, `safeSheetName`, `fileSafe`, `weekCoverText`, `weeklyLabel` if unused) from `lib/reports/` and `tests/unit/`; grep for remaining imports
- [X] T050 Update `docs/DEVELOPMENT.md` business rules: Deposit = Rental − Allowance; report types, scopes, file names, and the mock-comparison test
- [X] T051 Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm check`, and `corepack pnpm build:vinext`; fix any failures
- [X] T052 Ask the owner for approval, then apply both migrations to rolnet-dev and run the full pgTAP suite through the rollback wrapper (including T026, T027, T035); record results
- [ ] T053 Run the manual checks in [quickstart.md](quickstart.md) sections 3, 4, and 6 (Excel open with no repair prompt, Narrow margins and one A4 page per sheet, live formulas, phone preview, 360 px form) and record outcomes in `specs/014-reports-xlsx-downloads/validation.md`
- [ ] T054 After deploy, run [quickstart.md](quickstart.md) section 5: a 100-unit All units download on a computer and on a phone is saved in ≤ 10 s, and Workers observability shows the data request well under the free plan's CPU limit with no error 1102; if the data endpoint is over the limit, raise it with the owner

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none. T002 before T003.
- **Foundational (Phase 2)**: needs Phase 1 for tests. T004 → T006 → T007; T008 is the recorded build-in-the-browser decision (done), so the route only returns data; T009, T011 independent; T013 needs T009; T014 needs T006, T009; T016 needs T006, T009, T011, T013, T014. Blocks all report stories (US1–US3, US5).
- **US1 Monthly (Phase 3)**: after Phase 2. MVP.
- **US2 Weekly (Phase 4)**: after Phase 2; reuses US1's date-row and block helpers in `report-layout.ts`, so do it after T019 (same file).
- **US3 Yearly (Phase 5)**: after Phase 2; independent of US1/US2 except for edits to the same `report-layout.ts` and route file (sequence those tasks).
- **US4 Deposit (Phase 6)**: independent of Phases 2–5; can start immediately after Phase 1 (or even in parallel with Phase 1).
- **US5 Form (Phase 7)**: needs T013 and T016; best after at least US1 so downloads can be exercised.
- **Polish (Phase 8)**: after the stories it covers. T052 needs T030 and T037. T054 needs a deploy.

### Within each story

Tests first and failing, then layout/data, then route wiring, then e2e.

### Parallel opportunities

- Phase 2: T004/T005, T009/T010, T011/T012 in parallel; T015 alongside T016.
- US4 (T035–T041) can run alongside all of Phases 2–5 (different files) — except T041, which shares `tests/e2e/remittance-financials.spec.ts` with T021 and T043.
- Test tasks marked [P] inside a story are separate files or separate `describe` blocks; layout tasks in US1–US3 touch the same `lib/reports/report-layout.ts` and are sequential.

## Parallel Example: User Story 1

```text
Task: "T017 [US1] monthly section of tests/unit/report-layout.test.ts"
Task: "T018 [US1] monthly cases in tests/unit/report-mocks.test.ts"
```

## Parallel Example: across stories

```text
Developer A: Phase 2 → US1 → US2 → US3
Developer B: US4 (T035–T040) → US5 (T042–T046) once T013/T016 land
```

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational, with the T008 decision (workbook built in the browser, so the route returns JSON).
2. Phase 3 (Monthly). **Stop and validate**: mock comparison for the two monthly mocks passes; open the file in Excel; check printing.
3. Ship or demo the monthly report.

### Incremental delivery

1. + US4 (Deposit rule) — the Deposit notes in the workbook now match the app.
2. + US2 Weekly, + US3 Yearly — each validated against its mocks.
3. + US5 form polish (period-aware unit list, Retry).
4. Polish: benchmark, dead-code removal, docs, pgTAP on rolnet-dev (with approval), manual quickstart, production check of the data request.

## Notes

- [P] = different files, no dependency on incomplete tasks.
- Commit after each task or logical group; never commit `.env*`.
- Never edit a migration once pushed to rolnet-dev; add a new one instead.
