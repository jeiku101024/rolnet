# Quickstart: Validate Remittance Financials and XLSX Reports

## Prerequisites

- On branch `009-remittance-financials-reports`.
- **Database (needs your approval):** push the migration to rolnet-dev with `corepack pnpm exec supabase db push --linked`, regenerate the types with `corepack pnpm exec supabase gen types typescript --linked > types/database.ts`, and run the new pgTAP files through the rollback wrapper (project memory "No local Supabase").
- **UI checks:** a demo build on :3100 (`NEXT_PUBLIC_DEMO_MODE=true corepack pnpm build`, then the `demo` launch config).

## Automated checks

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm check
corepack pnpm build:vinext
```

Then run Playwright against the demo build:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3100 corepack pnpm exec playwright test tests/e2e/remittance-financials.spec.ts tests/e2e/remittances-daily-view.spec.ts
```

What they should show:

- **pgTAP `270_remittance_financials.sql`:**
  - A new remittance gets allowance 4000 and deposit −4000.
  - Adding ₱100 gives deposit 6000, adding ₱80 more gives 14000, and voiding the ₱80 gives 6000 again.
  - A payment pushing the total above the rental is rejected with the plain message.
  - A legacy overpaid row can't take a new payment.
  - The allowance can't be updated, and a direct write to the deposit is overwritten.
  - After the backfill, every row has allowance 4000 and deposit = paid − 4000. (`updated_at` being unchanged is checked with the before/after snapshot taken around the push.)
  - The service-date index exists.
- **pgTAP `200_remittance_financials_rls.sql`:** staff can add a payment within the rental. Neither staff nor the owner can set `deposit_centavos` or `allowance_centavos` to an arbitrary value. The new functions have no EXECUTE for `anon` or `authenticated`.
- **Vitest:**
  - `financials`: the spec's four examples (180 gives 140, 100 gives 60, 100 then 180 gives 140, 0 gives −40).
  - `report-periods`: weeks for months starting on each weekday, a week crossing a month and a year, leap February, and Weekly "Week N" equal to the Monday's week of month.
  - `report-layout`: rows, blank days, subtotal, Expenses, Allowance and Net rows and formulas, the grand total, and the yearly "-" months.
  - `xlsx-writer`: a valid zip (CRC values checked), the parts present, a frozen pane, styles for each key, formulas with cached values, and column widths.
  - `daily-card`: the live breakdown, negative in red, and the over-rental block.
- **Playwright:**
  - The card shows "Rental" and its deposit updates while typing.
  - List view has the 8 columns.
  - The Reports page downloads Weekly, Monthly, and Yearly files (opened in the test, with header cells, a subtotal formula, and the file name checked).

## Manual walkthrough (rolnet-dev, owner, 360 px and desktop)

1. Daily view, Returned card: type 100. It shows Allowance ₱40.00 and Deposit ₱60.00. Type 200: "Payment can't exceed the rental of ₱180.00", and saving is blocked. Type 100 and save; the locked card still shows ₱60.00.
2. Edit the card and type 180. The deposit goes live to ₱140.00. Save, and List view shows Paid ₱180.00, "Paid", Allowance ₱40.00, Deposit ₱140.00.
3. Record a card with an empty payment. List view shows Deposit −₱40.00 in red.
4. On the details page of a fully paid record, try to add ₱10. The database message appears.
5. Reports, Monthly, this month, whole fleet: open the file in Excel or Google Sheets.
   - Check the frozen dark-blue header, the light-blue subtotals, italic Expenses and Allowance, bold Net, the GRAND TOTAL's thick borders, green Month and Year, thousands separators, and red negatives.
   - Change one Deposit cell: its week subtotal and the GRAND TOTAL update.
6. Weekly for a date in a week that crosses a month: rows show both months, there's one block, and "Week N" matches that week on the earlier month's Monthly report.
7. Yearly for this year: months without data show "-", and Net = Allowance − Expenses.
8. One unit, including a retired unit: the file name and sheet name include the unit, and only its remittances and expenses are counted.
9. Compare one month's report totals with List view (dates filtered) and the Expenses page (SC-004).
