# Research: Sinking Fund Refinements

All unknowns from the Technical Context are resolved here. Each entry: Decision, Rationale, Alternatives considered. "015" means `specs/015-sinking-fund` and migrations `20261113000100`–`300`.

## R1. How the proportional shares are calculated

**Decision**: In `sf_distribute_interest`, for the ticked participants compute `overall = sum(savings_at_distribution_date)` and each `share_i = floor(available * savings_i / overall)` using integer `bigint` math (multiply first, then divide; use `numeric` for the intermediate product so large pesos cannot overflow). `total_distributed = sum(share_i)`, `remainder = available - total_distributed`. A participant with `share_i = 0` gets no `interest_share` row but still gets a snapshot row. The function raises plain-language errors when `overall = 0` ("No ticked participant has savings.") or `total_distributed = 0` ("… is too little to share.").

**Rationale**: Matches the client's formula (individual savings ÷ overall savings × fund) exactly, keeps money in whole centavos (constitution III), and the leftover is below `count` centavos by construction (each floor loses less than one centavo), so the existing "remainder stays in the fund" behavior is unchanged. Savings are read as of the distribution date with `sf_savings_total(p, date)` so a backdated date is consistent with how 015 already works out the fund (`sf_fund_total(date)`).

**Alternatives considered**: Largest-remainder rounding (hands out the leftover centavos): fairer to the centavo but changes what the client approved ("rounded down, remainder stays") and makes shares harder to explain. Computing shares in TypeScript and sending them to the database: duplicates money rules outside the transaction and invites mismatch; rejected (015 R4: rules live in SQL).

## R2. Preview in the Distribute pop-up versus the server

**Decision**: The pop-up computes the preview in the browser with a pure `proportionalShares(available, [{id, savings}])` in `lib/sinking-fund/rules.ts`, using the same integer math. At confirm, the action sends the ticked ids, the date, and the **expected shares total** the owner saw; the SQL function recomputes and, if the recomputed `total_distributed` differs, raises `STALE_RECORD`-style error "The figures changed. Review them and confirm again." (FR-008). The browser preview and the SQL function are checked against each other by a Vitest case and a pgTAP case using the same fixtures (₱1,000 / ₱2,000 / ₱3,000 with a ₱300 fund → 50/100/150).

**Rationale**: Live preview while ticking cannot wait on the network. A server-side comparison keeps the database the single source of truth for what is booked.

**Alternatives considered**: A read function that previews shares: one more round trip per tick; unnecessary for about 50 rows. No server comparison: the owner could confirm numbers that no longer match after another user's deposit.

## R3. Modeling the year-end reset

**Decision**: Add a ledger row type `cycle_close` (enum value, new migration). Rules:

- One `cycle_close` row per ticked participant whose ended total is above ₱0.00, `amount_centavos` = ended total savings (savings plus the share just added), `tx_date` = distribution date, `distribution_id` set. `sf_savings_delta` returns `-amount` for it, so Total savings becomes ₱0.00 with no change to the derived-from-ledger design.
- Loans, balance to pay: derived from open loans only. Distribution is blocked while any ticked participant has an Open or Overdue loan (FR-034), so they are already ₱0.00 after the close; nothing to write.
- "Payments received" and "interest collected" on the summary cards use a **cycle start** = the latest non-voided `dist_date` (exclusive: `tx_date > cycle_start`); with no distribution yet, no limit. `sf_fund_summary` and `sf_participant_summaries` gain this default; the existing date-range filter still narrows within the cycle.
- A transaction for a participant cannot be dated on or before that participant's latest non-voided `cycle_close` date. This is added to `sf_assert_participant_timeline` (the existing post-write check every record function already runs), with the message "X's year was closed on {date}. Use a later date." This keeps the stored snapshot true (FR-036) and makes the void rule (R5) simple.
- The Interest fund is untouched by the close (it is not a participant balance); it keeps only the remainder.
- `sf_void_transaction` rejects voiding a `cycle_close` row on its own and voiding any transaction of a closed participant dated on or before the close ("Void the distribution first."); otherwise voiding an old loan or deposit would leave savings off ₱0.00 and make the saved ended total untrue (spec FR-050).
- The distribution date cannot be earlier than a ticked participant's latest non-voided transaction date (spec FR-048); together with the post-close date rule this keeps the close a clean line in each participant's history.

**Rationale**: Zero-savings-by-ledger keeps every derived total, void, and timeline check working without special cases, never deletes or edits earlier rows (FR-033), and the audit trail shows exactly who closed what. A "cycle" is defined by data already stored.

**Alternatives considered**: A per-participant `cycle_start_date` column and filtering all totals by it: touches every query, and savings would not truly be zero for the existing timeline check. Setting `savings_withdrawal` rows instead of a new type: reuses a type but is indistinguishable from a real cash withdrawal in history, reports, and the Transactions view; a distinct type reads "Year-end close" and can be excluded from deposit/withdrawal totals. Resetting by archiving participants: loses names, links to drivers, and open-loan rules.

## R4. Where the ended totals and shares are stored

**Decision**: New table `sf_distribution_participants (distribution_id, participant_id, savings_before_centavos, share_centavos, ended_total_centavos, created_*)` with a composite primary key and the full business-row columns (`created_*`, `updated_*`, `deleted_*`, constitution III), written only by the distribute function, never updated. Read through owner-only `security definer` functions (R6). Legacy distributions have no snapshot rows; the details function falls back to the `interest_share` rows for the share and returns `ended_total_centavos = null`, shown as "Not recorded" (FR-045).

**Rationale**: FR-036 says later changes must never alter a past distribution's figures, and a ₱0-savings participant must still appear in the table; neither can be derived reliably from the ledger once new transactions arrive. The table is tiny (one row per participant per distribution).

**Alternatives considered**: Derive ended total from the `cycle_close` row and share from `interest_share`: loses ₱0 participants and breaks if a row is voided and later rows change. A JSON blob on `sf_distributions`: not queryable or constrained, and violates the constitution's "queryable data" spirit.

## R5. Voiding a closed distribution

**Decision**: `sf_void_distribution` additionally voids the distribution's `cycle_close` rows and its snapshot is kept (it is history). It raises "This distribution cannot be voided because {name} has new transactions since it." when any ticked participant has a non-voided transaction created after the distribution (dated after the distribution date; nothing can be dated on or before a close, so that is exactly the activity recorded since) other than the distribution's own rows. After a successful void, savings are restored automatically because totals are derived (the `interest_share` and `cycle_close` rows are voided together).

**Rationale**: Matches FR-037 with the smallest rule that cannot corrupt later data; no restore code is needed.

**Alternatives considered**: Forbid voiding closed distributions entirely: leaves no way to fix a mistaken close. Allow voiding with later activity: would need re-simulating later rows; unsafe.

## R6. Owner-only reads, and where the history list comes from

**Decision**: Replace the `sf_distribution_history()` read (granted to all approved users) with owner-only versions: `sf_distribution_history()` keeps its name but now calls `require_owner()` and returns the new columns (`year`, `share_count`, `participant_count`, `total_distributed_centavos`, `remainder_centavos`, voided fields); a new `sf_distribution_details(p_id)` returns the table rows sorted highest ended total first (ties by name, `null` ended totals last) with the totals. Both are `security definer` with a caller check. The page loader calls the history function only for the owner; staff get an empty list and no "View history" link. The Excel route re-checks the owner itself (a second check beside the database one).

**Rationale**: FR-047 and 015's rule that owner-only actions are enforced in the UI, the action or route, and the database. The Interest fund card's amounts stay visible to all approved users as in 015; only the per-participant history is owner-only.

**Alternatives considered**: Row-level security on the new table only: the history list reads `sf_distributions`, which 015 made readable by approved users; a function with `require_owner()` is simpler and follows the repo's established pattern.

## R7. Excel file: build, page setup, delivery

**Decision**: Reuse the feature 014 writer (`lib/reports/xlsx.ts` `workbookBytes`, `SheetModel`, styles). It already writes `fitToPage`, `paperSize="9"` (A4), `fitToWidth="1"`, `fitToHeight="1"`, and Excel's "Narrow" margins (0.25 in left and right, 0.75 in top and bottom). A pure builder `buildDistributionWorkbook(details)` in `lib/sinking-fund/distribution-workbook.ts` returns one `SheetModel` named "Distribution": a four-row title block (title, year and date, Sinking fund total for the year, distributed and leftover) so the writer's frozen header and repeat rows match, then the table (Rank, Participant, Ended total savings, Distributed share) and a totals row. Money is written as pesos from centavos exactly as in 014. The route `GET /api/sinking-fund/distributions/[id]/xlsx` guards with the existing report guard pattern, owner only, returns `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with `Content-Disposition` named `rolnet-sinking-fund-{year}-{date}.xlsx` and `cache-control: no-store`. Voided distributions download too, marked "Voided" in the title block.

**Rationale**: No new dependency, A4 one page and narrow margins come from code that is already tested; one page for 50 rows works because the sheet is portrait with fit-to-one-page (about 60 rows before text gets small, see the guard in R9).

**Alternatives considered**: A CSV or a print-styled HTML page: the client asked for Excel. A client-side export library: new dependency and larger bundle; forbidden by the free-tier and simplicity principles.

## R8. The participant pop-up without a re-render on close

**Decision**: Replace the right-hand `Sheet` and the `?detail=` navigation with a `Dialog` (same primitive and look as Add transaction) controlled by client state in `SinkingFundPage`. Opening calls a read action `getParticipantDetail({ participantId, historyCount })` and shows a loading state; closing only sets the state to `null`. The address is kept in step with `history.replaceState` (as in the Documents page and the local lists) so a refresh or a shared link still opens the participant, without a router navigation. After a write that affects the pop-up (a transaction, a void), the existing `revalidatePath` refresh updates `data` and the pop-up re-requests its detail. The dialog body scrolls vertically only (`max-h`, `overflow-y-auto`), the title row stays fixed; the history rows use the same wrap-friendly row component, and the long note column wraps instead of overflowing, removing the sideways scroll seen in the client's screenshot.

**Rationale**: A router `replace` on close forces a server render of the whole page, which is the redraw the client sees. Local state removes it, and the dialog primitive already gives centered layout, Escape, outside tap, focus return, and scroll lock.

**Alternatives considered**: Keep the Sheet but narrow it: still not "centered like Add transaction". Intercepting routes / parallel routes: heavier and still navigates. Load every participant's detail up front: unnecessary data for 50 people.

## R9. Excel page fit for many participants

**Decision**: Keep one sheet, portrait, fit to one page. Set column widths so the four columns fit A4 width at normal font; row height default; limit the legible range by documenting that up to 50 participants fits at about 70% scale. If a distribution has more than 60 participants the file still prints on one page but at a smaller scale; this is covered by an edge-case test that opens the XML and checks the page setup rather than the print preview. The details screen shows a hint above 60 participants.

**Rationale**: The spec requires exactly one page; Excel scales for us. The success criterion is stated for up to 50.

**Alternatives considered**: Switching to landscape or two columns: not asked, and it would break "one A4 portrait page" expectations.

## R10. Chart readability

**Decision**: In `MonthlyBars` raise month label size from 9 to 11 viewBox units, use `fill-ink` (high contrast) instead of `fill-muted`, and set the three series to distinct, existing tokens that stay apart in light surfaces and for common color-vision differences: Deposits `ok` (green), Loans `warn` (amber), Payments `info` (blue) become `ok`, `warn`, `info` at their strong shade, plus a visible outline pattern: Loans bars get a diagonal hatch and Payments bars a dotted pattern through SVG `<pattern>` fills so the series differ without color (FR-027). Empty months keep a thin baseline tick and their label. At 360 px labels show as "Nov" with the year on a second line, and at most every other month is labeled when there are more than six months. The donut already uses the token set; its colors are checked against the same tokens (FR-030). Any needed token is added to `app/globals.css`, not to components (DESIGN.md).

**Rationale**: The screenshot shows month labels almost invisible (muted on a light surface) and bars too similar for a shade check. Contrast and non-color cues are accessibility requirements already stated in 015 FR on charts.

**Alternatives considered**: A chart library: new dependency, forbidden. Only changing colors: does not fix the unreadable labels.

## R11. Divider lines

**Decision**: The stray lines come from `.data-region { border-block: 1px solid var(--token-rule); }` in `app/globals.css`: the card draws a rule at the top above the toolbar and at the bottom below the pagination footer. Remove `border-block` from `.data-region` (keep the surrounding card border and radius) and check each user of the class and each toolbar/pagination screen. The review covers every route that renders a list, table, or pagination: Dashboard (recent data glimpse), Units, Drivers, Remittances, Expenses, Audit, Documents, Reports, Settings → Staff, Sinking fund (three views), and detail pages (unit, driver, remittance, document). The review result is recorded in `quickstart.md` as a checklist. Dividers between rows (`.data-table td { border-top }`), under toolbars (`border-b` in `paged-list.tsx` between toolbar and rows) and section rules stay, as the spec's assumption says.

**Rationale**: One CSS rule is the root cause; a single change fixes every page. A review prevents a second source of the same line (for example `form.data-region`, `.section-rule`).

**Alternatives considered**: Hiding the line per page: many edits, easy to miss one.

## R12. Demo mode and the TypeScript ledger fold

**Decision**: `lib/sinking-fund/aggregate.ts` and `demo-data.ts` (the browser/demo mirror of the SQL) gain `cycle_close`, the cycle start, proportional shares, and snapshot rows, so demo mode and Playwright run the same flows. A Vitest suite runs the same fixtures against `proportionalShares` and the fold. Mutating actions in demo mode keep the existing `DEMO_MODE` guard for writes that need the database; the e2e specs seed demo data that already has a distribution to read.

**Rationale**: 015 runs its e2e in demo mode (`tests/e2e/sinking-fund.spec.ts`), and the new read screens must work there.

**Alternatives considered**: Real Supabase for e2e: not available locally (memory: no local Supabase) and slower.

## R13. Wording and documentation to update

**Decision**: Change every on-screen and doc statement of equal sharing: `distribute-dialog.tsx`, `distribution-history-dialog.tsx`, `messages.ts` toast, `docs/DEVELOPMENT.md` Sinking fund section, the 015 spec/plan/contracts references only noted in this feature's "supersedes" lines (015 files are not rewritten; this feature's `contracts/sql-functions.md` states what changed). The toast reads "₱X distributed to N participants. Year closed. Everyone starts again from ₱0.00."

**Rationale**: FR-012 and constitution "Every specification… MUST include a constitution-compliance check" need the docs to match behavior.

**Alternatives considered**: Rewrite 015's artifacts: would hide history of the original decision.
