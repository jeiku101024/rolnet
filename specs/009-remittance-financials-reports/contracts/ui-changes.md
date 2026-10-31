# Contract: UI changes

## Daily view card (`components/remittances/daily-card.tsx`)

Top to bottom (unchanged except as noted):

1. Unit name, driver and tag, and the ⋯ menu on saved cards.
2. **"Rental"** (was "Due"): `₱180.00` or `₱300.00`, the largest figure.
3. Disposition.
4. Payment received (₱).
5. Notes.
6. **The new breakdown** (`text-body-sm text-muted`, a two-column definition list):
   - `Allowance` `₱40.00`
   - `Deposit` `₱140.00`, or `−₱40.00` in `text-danger` when negative, or `—` while the payment text is invalid or above the rental
7. Error or status, then **Save remittance** (unrecorded or editing) or **Paid / Owes ₱X** plus "Saved" (locked).

What it shows and when:

| State | Allowance | Deposit |
|-------|-----------|---------|
| Unrecorded, or editing | 40.00 | `typed (or 0) − 40`, live on every keystroke and disposition change |
| Locked | saved `allowance_centavos` | saved `deposit_centavos` |
| Typed amount > rental | 40.00 | `—`, with the inline error "Payment can't exceed the rental of ₱180.00"; Save does nothing |

The over-rental check runs on input and on save. An amount the database rejects shows its message ("…At most ₱X more can be recorded.").

## List view (`components/remittances/remittances-list.tsx`)

The headers are `Date, Unit / driver, Disposition, Rental, Paid, Balance, Allowance, Deposit`. Allowance and Deposit use `font-data`, and a negative Deposit uses `MoneyText` (minus sign, `text-danger`). Balance is a `BalanceBadge`: "Paid" or "Owes ₱X".

## Details page (`/remittances/[id]`)

- **Labels:** "Due" becomes "Rental", and Allowance and Deposit are added to the summary.
- **Removed:** the "Credit (overpaid)" label.
- **Payment form hint:** reads "Balance: ₱80.00. Payments can't exceed the rental." and blocks amounts above the balance with the same message.

## Removed everywhere

- The "Credit ₱X" badge, the `credit` prop, and the `credit` field from `remittanceTotals`.
