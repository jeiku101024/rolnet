# Research: Page-Level Report Downloads

All decisions come from reading the current code. No open NEEDS CLARIFICATION items remain.

## R1. Overlay component

- **Decision**: Reuse `components/ui/dialog.tsx` (Base UI Dialog). It already provides focus trap, Escape, close button, outside-click close, and the project's pop-up motion. Add a thin shared `DownloadReportButton` that owns the icon button, tooltip and open state, and mounts its card only while open.
- **Rationale**: Meets FR-004 to FR-008 with no new library. Mounting on open resets defaults and errors for free.
- **Alternatives**: A custom popover (weaker focus handling); a per-page copy of the button (three places to keep consistent).

## R2. Remittances: keep the old card and routes untouched

- **Decision**: Render the existing `ReportExportForm` inside the overlay. It already has Weekly | Monthly | Yearly, period selectors, Scope, validation, pending label, error and Retry. Keep `/api/reports/*` and the browser-side builder as they are.
- **Rationale**: Files stay identical by construction (FR-015, SC-002). Only presentation moves.
- **Alternatives**: Rewrite the form for the overlay (risk of drift from the old behavior).

## R3. Year choices for the overlay

- **Decision**: The Remittances server component runs the same single-row query the old page used (earliest non-deleted remittance date) only when the user has `export_reports`, and passes `years` down. Staff pay no extra query.
- **Rationale**: Preserves the old choices exactly with no new route. The query is one indexed row.
- **Alternatives**: Fetch years when the overlay opens (adds a route and a loading state); fixed ten years (changes the old behavior).

## R4. Permission model

- **Decision**: Remittances button and downloads follow `export_reports` (owner today, enforced by `reportsGuard`). Standings follow owner-only like the distribution download (`profile.role === "owner"`, plus the SQL function checks the caller again). Expenses follows `requireApprovedSession`, the same as the Expenses page.
- **Rationale**: Matches FR-016, FR-028, FR-030 and the constitution's rule that definer functions check the caller.

## R5. Toolbar placement per page

- **Decision**:
  - Remittances Daily: inside the existing right-hand status group of the date-control row.
  - Remittances List and Expenses: the `action` slot of `listView`, which already sits at the end of the search/filter row.
  - Sinking fund: add the button to `PrimaryActions`, which each of the three views already renders at the top right of its toolbar.
- **Rationale**: No new layout containers; wraps correctly at 360 px because those rows already use `flex-wrap`.
- **Alternatives**: Page header slot (explicitly forbidden by the spec).

## R6. Where the standings figures are computed

- **Decision**: New owner-only SQL function `sf_standings(p_as_of date)` returning one row per participant who is not archived/deleted and was created on or before the date (fleet time zone). It derives, from non-voided ledger rows dated on or before the date: savings, open loan principal, unpaid balance (principal + interest − payments, ignoring loans fully repaid or withdrawn by then), and whether any open loan's due date is before the date. A TypeScript twin `standingsFor` in `aggregate.ts` serves demo mode and unit tests, as the existing `sf_*` functions do.
- **Rationale**: The existing `sf_participant_summaries(p_as_of)` only applies the date to savings; loans use the current state (`sf_loans_v`), so it cannot give past-month loans. Ledger rows are many; the repo's own note says the Worker CPU budget is small, so aggregation belongs in SQL.
- **Alternatives**: Fetch every ledger row and fold in TypeScript (CPU and row-limit risk); extend `sf_participant_summaries` (changes a function other screens use).
- **Loan "open as of date"**: a loan counts if its loan date ≤ date, and it is not withdrawn on or before the date, and its balance after payments dated ≤ date is above zero. Overdue means due date < date (for the current month the date is today, so the flag matches the app).
- **Participant "joined"**: created date in the fleet time zone ≤ date (clarified). Existing SQL (for example `driver_outstanding_balances`) hardcodes `Asia/Manila` for the fleet date, so `sf_standings` does the same and the migration comment says so; `fleet_settings.timezone` and `NEXT_PUBLIC_FLEET_TIMEZONE` default to the same value.
- **Owner check**: `public.require_owner()` exists (shared primitives migration, granted to `authenticated`) and is used first in `sf_standings`.

## R7. Ranking and totals

- **Decision**: Reuse `rankRows` (competition ranking, ties by name, zero-savings last with rank 0). The sheet shows a blank rank for rank 0. The totals row sums savings, loans and unpaid balance with live formulas, like the distribution sheet.
- **Rationale**: "Same ranking as Top participants" is then true by shared code (FR-021).

## R8. Overdue marking in the sheet

- **Decision**: A new `overdueAmountCents` style: pale red fill, dark red bold text, and a number format that appends the word "Overdue" (for example `#,##0.00" Overdue"`), so the cell value stays numeric for totals and sorting (clarified). Column width leaves room for the word.
- **Rationale**: Survives black-and-white printing and keeps formulas valid.

## R9. Building the files: server or browser

- **Decision**: Standings are built on the server (tens of rows, as the distribution workbook is). Expenses data comes from JSON and the browser builds the workbook with a dynamic import, as the remittance reports do (feature 014 R4).
- **Rationale**: A 100-sheet workbook would exceed the free Workers CPU limit; the standings sheet will not.
- **Alternatives**: Build Expenses on the server (CPU risk); build standings in the browser (two code paths for no benefit).

## R10. Writer page setup

- **Decision**: Add optional `orientation`, `fitToHeight` and `printTitleRows` to `SheetModel`. Defaults (portrait, 1, existing behavior) leave all current outputs identical; a test compares the XML of an existing sheet before and after. Expenses uses landscape and `fitToHeight=0` (as many pages tall as needed, one wide) with the header rows repeated. Standings uses portrait; if more than 45 participants it switches to `fitToHeight=0` so the width rule holds without shrinking text.
- **Rationale**: The writer currently hard-codes portrait and one page wide and tall, which would shrink a long Expenses sheet unreadably and does not satisfy "landscape".
- **Alternatives**: A second writer (duplicates 250 lines).

## R11. Expenses sheet order and names

- **Decision**: Sheets follow `sortUnits` (natural order by name, ties by id), the order the report workbooks and the Units list use. Confirmed by the owner: units are named like "ROLNET-1", "ROLNET-2", so natural name order is the order they expect. Names go through `sheetNames` (31 characters, forbidden characters replaced, duplicates numbered). The existing helper reserves "All units" for the summary sheet, which is harmless here.
- **Rationale**: Reuse proven, tested rules (spec FR-035). The Expenses table itself lists "Body NN", but the sheet is "named after the unit", i.e. its name.

## R12. Expenses columns

- **Decision**: Date (same short format as the page), Category (`categoryText`, custom name for Others), Amount (pesos with two decimals), Last replaced (`N/A` for Others, otherwise the date the page shows), Notes. Rows sorted by date, then creation order. Total row uses a `SUM` formula. Empty unit: title band, the line "No expenses for [month year]", total 0.
- **Rationale**: Mirrors `CategoryCell`, `LastReplacedCell` wording (FR-033). The implementation will read those components' formatting helpers so wording cannot drift.

## R13. Redirect for the old address

- **Decision**: `redirects()` in `next.config.ts` sends `/reports` and `/reports/:path*` to `/remittances` (temporary, no query kept). The sign-in proxy still runs first, so a signed-out visitor is sent to sign-in and then lands on Remittances.
- **Rationale**: Resolves the open question from the spec checklist: query strings are not meaningful for the old page, so they are dropped.
- **Alternatives**: A stub page that calls `redirect()` (leaves a dead route file). `corepack pnpm check` verifies vinext handles the config rule; fall back to the stub page if it does not.

## R14. Labels

- **Decision**: Remittances/Expenses button label: "Download report". Sinking fund: "Download monthly standings"; existing dialog button: "Download year-end distribution (Excel)".
- **Rationale**: Spec FR-003 and FR-017.
