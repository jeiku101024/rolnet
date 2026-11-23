# Quickstart: Participant Loans Redesign

Prerequisites: `corepack pnpm install`. Demo mode (`NEXT_PUBLIC_DEMO_MODE=true`) provides a participant with open, overdue, paid and withdrawn loans. The live :3000 server (real database) also works for the manual pass.

## Automated

```powershell
corepack pnpm typecheck
corepack pnpm exec vitest run tests/unit/sinking-fund-loan-list.test.ts
corepack pnpm lint
corepack pnpm test
corepack pnpm test:e2e tests/e2e/sinking-fund.spec.ts
```

## Manual (desktop, then 360 px, owner then staff)

1. Open `/sinking-fund?view=participants`, then View details on a participant with several loans.
2. **Scan (US1)**: the Loans section shows a summary and compact rows, overdue first and then nearest due. With 5 active loans all rows fit in about one screen at 360 px.
3. **Expand (US2)**: tap a row to see the figures, breakdown, payments and actions; tapping another row collapses the first. Add payment and Pay full balance open the Add transaction dialog on that loan, the second with the balance prefilled. Save one and check the row, summary and tab update.
4. **Owner only**: Mark as withdrawal is enabled for an owner on an overdue loan and disabled for staff.
5. **Closed (US3)**: open Paid and closed. It shows 5 rows per page with page controls, the year filter resets to page 1, and the header count and repaid total match the filter.
6. Empty states: a participant with no loans, and one with only closed loans.
7. Dark theme and keyboard: tabs and rows are reachable with Tab and toggled with Enter or Space, and status is readable without color.
