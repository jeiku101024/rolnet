# Validation: Remittance Financials and XLSX Reports

Run on 2026-10-31, branch `009-remittance-financials-reports`.

## Automated checks

| Check | Result |
|-------|--------|
| `corepack pnpm lint` | Pass (0 errors; the 4 warnings predate this feature) |
| `corepack pnpm typecheck` | Pass |
| `corepack pnpm test` | Pass: 33 files, 188 tests |
| `corepack pnpm check` | Pass (vinext compatibility report, no new issues) |
| `corepack pnpm build:vinext` | Pass |
| Playwright (demo build on :3100) | 48 passed, 6 failed. The 6 are the sign-in tests in `accessibility-mobile`, `app-navigation` and `ui-system-refresh`, which need the sign-in page that demo mode doesn't have (the same 6 failed for feature 008). All of `remittance-financials`, `remittances-daily-view`, `list-sort-filter` and `paged-lists` pass. |

## XLSX in Excel

A Monthly and a Yearly sample from `lib/reports/report-layout.ts` were opened in Microsoft Excel through COM:

- The sheet name included the unit ("Monthly - ROLNET-1"), and the header row was frozen.
- `CalculateFull()` produced the expected values. The week subtotals, Net (−70.50, shown in red), and GRAND TOTAL (`=D7+D18+D29+D40+D49`) were all correct.
- Header fill `1F3864` with white bold text, subtotal fill `D9E1F2` in bold, Month and Year in green `00B050`, italic Expenses and Allowance, bold Net, and thick borders (weight 4) above and below the GRAND TOTAL.
- On the yearly sheet, months with no data showed "-".

## Browser (demo build)

- Daily view at 375 px: a locked card shows "Rental", Allowance ₱40.00, Deposit ₱260.00, and "Paid".
- The Reports page at 1280 px shows the segmented Report control. At 360 px it shows a Report select, with no sideways scroll.

## Database on rolnet-dev (T006, approved 2026-10-31)

Local Supabase can't run on this laptop, so the migrations were pushed to the linked rolnet-dev
project and pgTAP was run through `supabase db query --linked`. Each file ran as one transaction:
pgTAP was created inside it, and a final exception rolled everything back while carrying the TAP
output.

- **Dry run:** `20261031000100_remittance_financials.sql` was first applied inside a rolled-back
  transaction. It applied cleanly on 76 remittances: 7 were already overpaid (legacy) and 24 had a
  negative deposit.
- **Backfill left history alone (FR-016):**

  | | Before push | After push |
  |---|---|---|
  | Remittances | 76 | 76 |
  | Latest `updated_at` | 2026-10-31 03:56:52.66599+00 | same |
  | Sum of `updated_at` (epoch) | 136285927874.954577 | same |
  | Remittance audit rows | 110 | 110 |
  | Active payments | 64 | 64 |

  After the push, 0 rows had an allowance other than 4000, and 0 rows had a deposit other than active payments − allowance.
- **First full pgTAP run: 40 of 41 files passed.** In `rls/030_remittances_rls.sql`, a pending
  user adding a payment to a fully paid remittance got the over-rental message instead of a
  permission error. `validate_remittance_payment()` is security definer, and BEFORE triggers run
  before RLS, so the message showed an unapproved user the rental and how much was paid. The
  trigger could also lock the row.
- **Fix:** the new migration `20261031000200_payment_check_after_approval.sql` skips the trigger's
  checks for a signed-in caller who isn't approved, so RLS rejects the insert with 42501 as before.
  A new assertion in `rls/200_remittance_financials_rls.sql` covers this case.
- **After the fix: 41 of 41 files pass,** including `270_remittance_financials.sql` (17),
  `200_remittance_financials_rls.sql` (7), `030_remittances.sql` (37),
  `140_remittance_facts_locked_rls.sql` (13), `210_driver_outstanding_balances.sql` (10) and
  `220_monthly_report_reconciliation.sql` (12). Afterwards pgTAP wasn't installed, no test rows
  remained, and the 76 remittances were unchanged.
- This ran on a database already at the previous schema with existing data, not on a clean
  `db reset`.

## Not yet run

- **T036 (needs your approval):** walk through the quickstart against rolnet-dev with real data, check SC-004 reconciliation and SC-005 timing, and review the new messages in plain language.
