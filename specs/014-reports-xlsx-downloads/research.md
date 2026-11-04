# Research: Reports Page XLSX Downloads

Feature: [spec.md](spec.md) · Plan: [plan.md](plan.md)

Each entry records a decision, why it was chosen, and what else was considered. Nothing in the
Technical Context is left as NEEDS CLARIFICATION.

## R1. Workbook writer: extend the in-house writer

- **Decision**: Keep and extend `lib/reports/xlsx.ts` (feature 009's dependency-free SpreadsheetML
  writer). It gains: several sheets per workbook, a style registry that dedupes cell formats, merged
  cells, custom row heights, tab colours, frozen panes at A5, internal hyperlinks, sheet-scoped print
  titles, page setup, and deflate compression. No new npm dependency.
- **Rationale**: It already runs in the Cloudflare Worker and in Vitest, writes formulas with cached
  values, and every client formatting rule maps to an explicit XML attribute, so the output can be
  compared with the mocks attribute by attribute (R14). Constitution I and II favour no new
  dependency.
- **Alternatives**: ExcelJS streaming `WorkbookWriter` (depends on Node `stream`, `fs`, and
  `archiver`; large Worker bundle; its streaming mode buffers shared strings anyway). SheetJS
  Community Edition (free build does not write styles). `xlsx-populate` / `write-excel-file` (no
  print titles or cached formula values). LibreOffice round-trip (not available in a Worker, and it
  rewrites header/footer margins and row heights, as the mocks show).

## R2. Zip compression and CRC without a JavaScript CRC loop

- **Decision**: Compress each part with the platform `CompressionStream("gzip")`. A gzip stream is a
  10-byte header, the raw deflate data, then CRC-32 and the uncompressed size (both little-endian).
  The zip writer stores the raw deflate data (method 8) and copies the CRC and size from the gzip
  trailer. If `CompressionStream` is missing, fall back to the existing STORE path with the JS
  `crc32`.
- **Rationale**: An all-units monthly workbook is about 3 to 5 MB of XML for 100 units. CRC-32 and
  deflate in native code cost far less CPU than the current byte-by-byte JS loop, and the download
  shrinks about tenfold (better on mobile data). `CompressionStream` exists in Workers and in Node 18+
  (Vitest).
- **Alternatives**: `fflate` (small and fast, but a new dependency and still JS-speed);
  `CompressionStream("deflate-raw")` plus JS CRC (keeps the slow loop); STORE only (large files on
  phones).

## R3. Memory: build and compress one sheet at a time

- **Decision**: The route builds the summary model first from per-unit totals (computed in centavos
  from the loaded rows), then for each unit sheet builds its XML string, compresses it, keeps only the
  compressed bytes, and drops the string before the next unit. The zip is assembled at the end from
  compressed parts (about 300 KB to 1 MB for 100 units).
- **Rationale**: Peak memory is one sheet's XML plus the compressed parts, which meets the spec's
  "without loading everything into memory at once" and keeps well inside the Worker's 128 MB.
- **Alternatives**: Streaming the zip response with data descriptors (bit 3). Possible later, but it
  complicates error handling (a failure after headers are sent cannot return the JSON error the form
  shows) for little gain at this size.

## R4. Where the workbook is built: in the browser (owner decision 2026-11-03)

- **Finding**: Workers Free allows 10 ms of CPU per request (waiting on the database does not count). A
  local run of the real generator for an All units monthly workbook of 100 units (one remittance a day)
  took about 250 ms wall and about 390 ms CPU on a developer machine (build 37 ms, serialise and compress
  213 ms, 257 KB). Even allowing for a faster Worker CPU, that is more than 20 times the limit, and Workers
  Paid would break Constitution I.
- **Decision**: Build the .xlsx in the browser. \`GET /api/reports/{kind}\` does the guards and database
  reads and returns the report data as JSON (units in tab order plus per-unit amounts in centavos). The
  Reports form then loads the same pure modules the tests use (\`build-report\`, \`report-layout\`,
  \`summary-sheet\`, \`xlsx\`, \`zip\`) with a dynamic \`import()\` on the first Download, builds the workbook, and
  saves it from a Blob. The server never builds or compresses a workbook, so there is no server CPU
  limit to hit and the free tier is kept. Money logic is unchanged: all arithmetic is integer centavos in the
  shared module, and the server sends no computed totals.
- **Consequences**: the browser needs \`CompressionStream\` (Chrome 80+, Safari 16.4+, Firefox 113+; older
  browsers fall back to stored, uncompressed parts, which Excel opens the same). The payload for 100 units in
  a month is about 300 KB of JSON before network compression. The data endpoint still has to stay light: it
  pages through PostgREST and serialises JSON, which the production check measures (quickstart section 5).
- **Keeps**: R2 (native compression, now in the browser), R3 (one sheet at a time, which keeps phone memory
  low), and R5 (yearly aggregate function), because the browser downloads the data over the network.
- **Alternatives**: Measure on a deployed preview first (rejected by the owner: the local result is already
  far over the limit). Generate on the server and accept failures on big workbooks (rejected). Workers Paid
  (violates Constitution I). Several smaller downloads (the client wants one workbook).

## R5. Loading the data

- **Decision**:
  - Weekly and monthly: page through `remittances` (`unit_id, service_date, amount_due_centavos,
    allowance_centavos, drivers(full_name)`, non-deleted, ordered by unit, date, created_at, id) and
    `expenses` (`unit_id, expense_date, amount_centavos`). A 100-unit month is about 3,100 remittance
    rows (4 pages).
  - Yearly: a new invoker SQL function `report_unit_month_totals(p_from date, p_to date)` returns one
    row per unit and month with rental, allowance, and expense totals plus a remittance count (at most
    1,200 rows for 100 units).
  - Units: `id, name, archived, deleted_at is null`.
- **Rationale**: A year of daily rows for 100 units is about 36,500 rows, which is 37 sequential
  PostgREST pages (slow, and close to the Workers Free 50-subrequest cap). Aggregating in Postgres keeps
  the yearly request to a few subrequests. The function is `security invoker`, so RLS still decides
  what the caller sees, and is granted to `authenticated` only because the app calls it (CLAUDE.md).
- **Alternatives**: A `security_invoker` view (the hand-maintained `types/database.ts` has no
  `Views` entries and the project's convention is RPC functions); parallel paging (subrequest cap).

## R6. New Deposit rule in the database

- **Decision**: A new migration replaces `remittances_set_deposit()` so it sets
  `deposit_centavos := amount_due_centavos - allowance_centavos`, and backfills every remittance
  (including soft-deleted ones, as 009 did) with the audit, audit-field, and financial-lock triggers
  disabled for the update only. `remittance_payments_sync_deposit()` stays: it still touches the parent
  row, so a payment keeps bumping `updated_at`, which the Daily view uses as its concurrency token
  (`app/actions/remittances.ts`).
- **Rationale**: One rule, stored, for the card, List view, detail page, and reports. The backfill is a
  derived-value correction, not a business event, so it does not write audit rows or change
  `updated_by` (same approach and justification as migration `20261031000100`). The migration comment
  documents the old rule for recovery: old deposit = active payments − allowance.
- **Alternatives**: Computing deposit on read everywhere and dropping the column (wider change, more
  files, and the column is part of existing contracts); leaving stored values as they are (app and
  exports disagree, FR-110).

## R7. Sheet names, file names, and references

- **Decision**: `sheetNames(units)` processes units in tab order: replace `: \ / ? * [ ]` with "-",
  trim leading/trailing apostrophes, trim spaces, empty → "Unit", rename exactly "All units"
  (case-insensitive, as Excel compares names case-insensitively) to "All units (unit)", cut to 31,
  then de-duplicate case-insensitively with " (2)", " (3)"… cutting the base so the result stays ≤ 31.
  `sheetRef(name)` returns `'` + name with `'` doubled + `'`. File-name unit part: remove
  `\ / : * ? " < > |` and control characters, collapse whitespace to "-", trim dots and dashes, empty →
  "unit" (so `rolnet-1` stays `rolnet-1`).
- **Rationale**: Matches FR-012, FR-013, FR-006; case-insensitive checks match Excel's own rules,
  which would otherwise trigger a repair prompt.
- **Alternatives**: The current `fileSafe` (keeps only letters, digits, and dashes). It gives the same
  result for `rolnet-1` but drops characters the spec allows (only those not allowed in file names
  must go).

## R8. Tab order

- **Decision**: `Intl.Collator("en", { numeric: true, sensitivity: "base" })` on the unit name, tie-break
  by unit id. Already used for the Reports unit dropdown (`lib/reports/report-data.ts`).
- **Rationale**: Gives rolnet-1, rolnet-2, … rolnet-10 (clarification 2026-11-03).

## R9. Dates and the period texts

- **Decision**: Write dates as Excel serial numbers (days since 1899-12-30) computed from the plain
  `YYYY-MM-DD` string in UTC, with formats `ddd", "mmm d` (date rows) and `mmmm` (yearly months).
  Title and range texts are built from fixed English month arrays, not `Intl` locale output, so they
  are identical in every runtime. Weeks reuse `weekRange()` / `monthWeeks()` from
  `lib/reports/periods.ts`; week numbers count blocks from 1 (the existing `weekOfMonth` gives the
  same result).
- **Rationale**: Real date values sort and filter (FR-027); the format codes match the mocks
  (`ddd", "mmm\ d` is equivalent).

## R10. Amounts and cached values

- **Decision**: All arithmetic stays in integer centavos. Cells get `centavos / 100` as their value;
  each formula cell's cached value is computed from the same centavo sums. Number format
  `#,##0;[Red]-#,##0;"-"` everywhere for amounts. The workbook keeps `fullCalcOnLoad="1"` so Excel
  recalculates on open while previews show the cached values.
- **Rationale**: Constitution III; FR-031, FR-081.

## R11. Styles and print setup XML

- **Decision**: A style registry keyed by (font, fill, border, alignment, numFmt) assigns `cellXfs`
  indexes on first use. Per sheet: `<sheetPr><tabColor/><pageSetUpPr fitToPage="1"/></sheetPr>`,
  frozen pane `ySplit=4 topLeftCell=A5`, `<printOptions horizontalCentered="1"/>`,
  `<pageMargins left="0.25" right="0.25" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>`,
  `<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/>`; unit sheets get
  a `_xlnm.Print_Titles` defined name with `localSheetId` = `'Name'!$1:$4`. Internal hyperlinks use
  `<hyperlink ref="A5" location="'Name'!A1" display="Name"/>` (no relationship part needed).
- **Rationale**: Exactly the values in the mocks; nothing post-processes the file, so the Narrow
  margins are never rewritten.

## R12. Row heights versus the mocks

- **Decision**: Write the spec's heights (30, 20, 10, 20, then 13 or 16; notes 15 or 28) with
  `customHeight="1"`. The mocks show 19.5, 9.75, 12.75, 27.75 because LibreOffice saved them (it rounds
  to its own units). Mock comparisons allow ±0.5 pt.
- **Rationale**: The spec text gives the intended values; the difference is a save artefact.

## R13. Unit dropdown for Single unit

- **Decision**: New `GET /api/reports/units?kind=…&date|month|year=…` returns the eligible units for
  that period (non-archived units, plus archived units with a remittance or expense in it), sorted as
  in R8. The form fetches it when the scope is Single unit and the period changes, and clears the
  selection if the chosen unit drops out. The download route applies the same rule and returns 404 for
  an ineligible unit.
- **Rationale**: The rule depends on the period, so a list loaded once with the page can't be exact.
- **Alternatives**: Preloading each archived unit's first/last record date (inexact for gaps).

## R14. Proving the files match the mocks

- **Decision**: Copy the six mocks into `tests/fixtures/reports/`, plus a JSON fixture holding the
  mocks' sample data (units, per-day driver/rental/allowance, per-week or per-year expenses). A Vitest
  suite feeds the fixture to the generator and compares each generated sheet with the mock after
  normalising: resolved cell style (font name/size/bold/italic/underline/colour, fill, borders, number
  format code, alignment, indent), values, formulas (ignoring sheet-name quoting), merges, column
  widths, row heights (±0.5), freeze panes, tab colour, hyperlinks, print setup, and defined names. The
  mock-only notes lines ("MOCK DATA…" and its sample note 4) are excluded. Parts are inflated with
  `node:zlib` in tests.
- **Rationale**: The spec says the mocks win; this makes "matches the mocks" an automated check rather
  than a visual one.

## R15. Expenses per block

- **Decision**: Monthly week blocks sum expenses whose date is in the block's days inside the month;
  the weekly sheet sums all 7 days; yearly sums the year. The monthly GRAND TOTAL Expenses is the sum
  of the week cells, so it equals the month total.
- **Rationale**: FR-023 and the worked examples.

## R16. Reports page states

- **Decision**: Keep `useActionForm` (pending state already disables the button and shows progress).
  Add a Retry button in the error state that resubmits the last query, add the Single unit dropdown fed
  by R13, and change the weekly hint to "Oct 26 – Nov 1, 2026". Scope labels become "All units" /
  "Single unit".
- **Rationale**: FR-001 to FR-004 with the least change to a component that already works at 360 px.
