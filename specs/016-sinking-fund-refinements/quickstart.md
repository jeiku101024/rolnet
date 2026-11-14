# Quickstart: validating Sinking Fund Refinements

Run guide only. Rules live in [data-model.md](data-model.md); interfaces in [contracts/](contracts/).

## Prerequisites

- Node with Corepack; dependencies installed (`corepack pnpm install`).
- Demo mode for the browser flows: `NEXT_PUBLIC_DEMO_MODE=true` (see `.env.local.demo`). Demo login is on the login page.
- pgTAP runs against `rolnet-dev` through the rollback wrapper (no local Supabase); ask the owner before running (project memory).

## Automated checks

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
```

The Playwright specs need demo mode. The usual dev server on `:3000` runs on real Supabase data (`NEXT_PUBLIC_DEMO_MODE=false`) and only one `next dev` can run per folder, so: ask the owner, stop that server, start the `demo-dev` entry from `.claude/launch.json` (port 3200, demo mode), then run:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3200 corepack pnpm exec playwright test tests/e2e/sinking-fund.spec.ts tests/e2e/dividers.spec.ts --project=mobile
```

When finished, stop the demo server and start the normal `:3000` server again.

Expected: all pass. New Vitest cases cover `proportionalShares` (₱300 → 50/100/150; floor and remainder; zero-savings participant), `buildDistributionWorkbook` (sort order, totals, a 50-participant file, A4 / fit-to-one-page / narrow margins in the sheet XML), and the demo-mode cycle totals. New pgTAP files: `supabase/tests/constraints/440_sf_proportional_distribution.sql` and `supabase/tests/rls/110_sf_distribution_rls.sql` (case list in [contracts/sql-functions.md](contracts/sql-functions.md)); run the whole pgTAP suite, not only the new files.

## Manual scenarios (owner, phone width 360 px first, then desktop)

1. **Proportional shares (US1).** Three participants with ₱1,000 / ₱2,000 / ₱3,000 savings and ₱300 in the Interest fund. Open Distribute: shares ₱50.00 / ₱100.00 / ₱150.00, no "Each participant gets". Untick the ₱3,000 participant: shares become ₱100.00 / ₱200.00. Tick again. Read the close-the-year warning. Confirm.
2. **Reset (US1).** Each ticked participant shows ₱0.00 savings, loans, balance, and payments; the Transactions view still lists every earlier row plus a "Year-end close" row; the monthly chart keeps its past months; rankings and the donut show the new cycle.
3. **Loan block (US1).** Add an Open loan for a participant, open Distribute: the participant is flagged "Has an unpaid loan" and confirm is disabled. Pay the loan or untick the participant: confirm works.
4. **History and details (US2).** Open "View history": the distribution is listed; open it: table sorted highest to lowest, totals row, Sinking fund total for the year. Download Excel; open it and use Print Preview: one A4 page, narrow margins, same rows and order.
5. **Staff view (US2).** Sign in as staff: no "View history", no Distribute; opening `/api/sinking-fund/distributions/{id}/xlsx` returns 403.
6. **Void (US1).** Void the new distribution right away: savings are restored. Make a distribution, add a deposit, try to void: blocked with the explanation.
7. **Pop-up (US4).** Open a participant with loans and several history rows at 360 px: no sideways scroll; only the body scrolls; close with the button, Escape, and a tap outside; the page behind keeps its scroll position, search, and sort and does not flash (watch the network tab: no page request on close).
8. **Chart (US5).** Month labels are clearly readable (contrast ratio at least 4.5:1 against the card background); Deposits, Loans, and Payments are distinguishable by color and by pattern; at 360 px labels do not overlap; "View as table" still works.
9. **Year-closed guards (US1).** After a close, try to add a deposit dated on or before the close date: blocked with the "year was closed" message. Try to void the year-end close row and an older transaction of a closed participant: both blocked with "Void the distribution first." Try a distribution date earlier than a ticked participant's last activity: blocked.
10. **Owner review (SC-007).** On a phone, show the owner the Distribute dialog, the history details, and the participant pop-up; record whether they agree the sharing is fair and the pop-up is easier to use than the side panel.
11. **Dividers (US3).** Visit each page in the checklist below at 360 px and desktop width: no line above the toolbar and none under the pagination footer; row dividers and the card outline are still there.

## Divider review checklist (record the result when done)

| Page | Toolbar line gone | Footer line gone | Notes |
|------|-------------------|------------------|-------|
| Dashboard (recent data) | Yes | Yes | No shared list card; edge scan found no line at 360 and 1280 px |
| Units (list) | Yes | Yes | Screenshot at 1280 px after the fix shows a clean card top; `.data-region` has no top or bottom border |
| Drivers | Yes | Yes | Same shared card |
| Remittances (list view and daily view) | Yes | Yes |  |
| Expenses | Yes | Yes |  |
| Audit | Yes | Yes |  |
| Documents | Yes | Yes | Uses its own panes, no `.data-region`; edge scan clean |
| Reports | Yes | Yes | Edge scan clean |
| Settings: Staff | Yes | Yes |  |
| Sinking fund: Transactions, Top participants, Participants | Yes | Yes | Transactions uses the shared card; edge scan clean for all three |
| Units: Daily assignment | Yes | Yes | Edge scan clean |

Checked 2026-11-14 with `tests/e2e/dividers.spec.ts` (computed borders at 360 and 1280 px) plus a one-off scan for any line stuck to a card's top or bottom edge on every page above. The root cause was `.data-region { border-block }` in `app/globals.css`; it was removed.

## Done when

Lint, typecheck, Vitest, the sinking fund e2e specs, and (after the owner agrees) the full pgTAP run pass; the manual scenarios above are checked at 360 px; the divider table is filled in; `docs/DEVELOPMENT.md` describes proportional sharing and the year-end close.
