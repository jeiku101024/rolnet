# Contract: UI changes

All screens keep shadcn `base-nova` components and `app/globals.css` tokens, and must work at 360 px.

## Reports page (`components/forms/report-export-form.tsx`)

| Element | Behaviour |
|---------|-----------|
| Report | Weekly / Monthly / Yearly (segmented toggle ≥ sm, select on phones — unchanged) |
| Scope | "All units" / "Single unit" (values `all` / `unit`) |
| Unit | Shown for Single unit. Options from `GET /api/reports/units` for the current kind and period; refetched when either changes. While loading: disabled with "Loading units…". If the chosen unit is no longer listed, the selection clears. Archived units read "rolnet-7 (archived)". |
| Weekly period | Date input "Any date in the week"; hint shows the range, e.g. "Oct 26 – Nov 1, 2026" |
| Monthly period | Month + Year selects (unchanged) |
| Yearly period | Year select (unchanged) |
| Download | Fetches the report data (`GET /api/reports/{kind}`), then builds the .xlsx in the browser (research R4) and saves it under the returned file name. Disabled with "Creating report…" while pending |
| Error | Plain message from the API, or "The report could not be created. Try again.", with a **Retry** button that repeats the last request |
| Success | "Report downloaded: rolnet-monthly-2026-10-all-units.xlsx." |
| Formats | .xlsx only; no CSV option |

## Remittances

| Place | Change |
|-------|--------|
| Daily card breakdown (`components/remittances/daily-card.tsx`) | Deposit = Rental − Allowance (₱140.00 for a ₱180.00 rental), always shown, and it does not change as the payment is typed or when the payment is over the rental. Locked cards show the stored deposit (the same value). |
| List view Deposit column | No code change; reads the backfilled stored value. |
| Remittance detail page | No code change; reads the stored value. |
| Demo mode data (`lib/demo/mode.ts`) | Demo deposits follow the new rule. |
