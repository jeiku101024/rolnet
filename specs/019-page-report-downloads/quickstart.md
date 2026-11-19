# Quickstart: validating Page-Level Report Downloads

## Prerequisites

- `corepack pnpm install`
- Demo mode for UI checks: `NEXT_PUBLIC_DEMO_MODE=true corepack pnpm dev` (owner navigation, demo data)
- For the database function: the new migration applied to the dev database and the pgTAP suite run (ask the owner first; local Supabase is not available)

## Automated checks

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm check
corepack pnpm test:e2e
```

Expected: all pass. New unit tests cover the writer defaults (existing sheet XML unchanged), standings ranking and as-of figures, the standings and expenses workbook layouts, both routes' status codes, the redirect rule, and the button and dialog behavior.

## Manual scenarios

1. **Reports removed.** Sidebar has no Reports item. Open `/reports` and `/reports/anything`: both end on `/remittances`.
2. **Remittances overlay.** In Daily view and List view, the workbook icon is at the right end of the toolbar row, shows a tooltip on hover and focus, and opens the card on Monthly, this month and year, All units. Download Weekly, Monthly and Yearly files; compare with files from the previous release for the same choices (same names and content).
3. **Staff view.** Sign in as staff: no workbook icon on Remittances, and `GET /api/reports/monthly?month=...` returns 403.
4. **Standings.** As owner on Sinking fund (each view), the icon is at the top right of the toolbar. Download the current month: title band says "as of" today, ranking matches Top participants (Total savings, Monthly), totals row present, overdue balances shaded with "Overdue", an archived participant absent. Download a past month: figures match the ledger on that month's last day; a participant created later is absent. As staff, no icon and the route returns 403.
5. **Year-end label.** The distribution details button reads "Download year-end distribution (Excel)".
6. **Expenses.** Download a month with expenses: one sheet per unit in app order, an empty unit shows "No expenses for ..." and total 0, an archived unit appears only if it had expenses, no Unit or receipt column, Others shows its custom name and "N/A", rows oldest first with a total. Delete an expense and download again: it is gone.
7. **Print setup.** Open each file in Excel print preview: A4, Narrow margins, one page wide; standings portrait, expenses landscape.
8. **Overlay behavior (each page).** Tab stays inside the overlay; Escape, close button and outside click each close it and return focus to the icon; a slow download shows the pending label and blocks a second click; with the network blocked the card shows an error and Retry, the overlay stays open, and Retry succeeds once the network is back.
9. **Mobile.** At 360 px each page shows the icon without sideways scrolling and the overlay fits.
10. **Dark mode.** Overlay and icon use the dark tokens correctly.
