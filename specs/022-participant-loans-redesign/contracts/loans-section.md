# UI Contract: Loans Section

The Loans section on `/sinking-fund/participants/[id]` replaces the old per-loan cards. No URL or API change.

## Structure

- Heading "Loans" and summary chips: active count, "₱X to pay", and the overdue count when above 0.
- `role="tablist"` with **Active (n)** and **Paid and closed (n)**, Active selected first. A participant with no loans shows only "No loans yet." and no tabs.
- Tab panel with rows. All rows start collapsed; exactly one row can be expanded per tab.

## Test ids

| Element | `data-testid` |
|---|---|
| Section | `sf-loans` |
| Summary line | `sf-loans-summary` |
| Row (button) | `sf-loan-row` |
| Expanded detail | `sf-loan-detail` |
| Payment list item | `sf-loan-payment` |
| Add payment | `sf-loan-add-payment` |
| Pay full balance | `sf-loan-pay-full` |
| Mark as withdrawal | `sf-loan-withdraw` |
| Closed year select | `sf-loans-year` |

## Active row

Status tag (Open or Overdue, with icon), loan date and amount borrowed, "balance of amount due" with a two-segment bar, due text and due date, and a chevron. `aria-expanded` reflects the state.

## Expanded active loan

- `principal + interest = amount due`.
- Legend: "Interest paid X of Y", "Principal paid X of Y", "N% paid".
- Payment list (date, amount, interest part, principal part), or "No payments yet."
- **Add payment** opens the existing Add transaction dialog (`type: payment`, that loan).
- **Pay full balance (₱X)** opens the same dialog with the amount prefilled to the loan balance. Shown only when the balance is above 0.
- **Mark as withdrawal** on overdue loans: enabled for owners; for staff it is disabled with the title "Owner only" (unchanged).

## Paid and closed tab

- Header "N loans, ₱X repaid" and a "Year" select with "All years" first.
- Rows show status (Paid or Withdrawn), loan date, principal plus interest, and "Paid off {date}" or "Closed {date}".
- Expanded: "repaid in full", or for a withdrawn loan "paid X of Y; Z closed as withdrawal on {date}".
- 5 rows per page with the shared Pagination (hidden when there is one page).

## Behavior rules

- Tab, expansion and page are client state. After a save refresh, the open loan stays open only if it is still in the same tab.
- Empty states: "No active loans.", "No paid or closed loans yet.", "No loans yet."
- At 360 px there is no horizontal scroll; each row wraps to two lines (status and date on top, balance and due below).
