# Contract: Report sheet layouts

The style keys are defined in research R5. All numeric values are pesos, and formulas carry cached values.

## Weekly and Monthly sheet

The header (row 1, style `header`, frozen) is: `Week | Day | Driver | Rental | Deposit | Allowance | Month | Year` (columns A to H).

For each week, in date order:

1. **Day rows.** For each day in the week (inside the month, for Monthly):
   - **Each remittance that day:** `A` week number, `B` day (Mon…Sun), `C` driver, `D` rental, `E` deposit, `F` allowance (always 40), `G` month (Jan…Dec, green), `H` year (green).
   - **A day with no remittance:** `A`, `B`, `G`, `H` only, with C to F blank.
2. **`Week N Subtotal`** (style `subtotal` across A to H): `B` "Week N Subtotal", `D` `=SUM(D{first}:D{last})`, `E` `=SUM(E…)`, `F` `=SUM(F…)`.
3. **`Expenses:`**: `B` "Expenses:" (italic), `D` the week's expenses value (italic).
4. **`Allowance:`**: `B` "Allowance:" (italic), `D` `=F{subtotal}` (italic).
5. **`Net:`**: `B` "Net:" (bold), `D` `=D{allowance}-D{expenses}` (bold; red if negative).

**Monthly only: GRAND TOTAL block** after the last week:

| Row | B | D | E | F | Style |
|-----|---|---|---|---|-------|
| 1 | `GRAND TOTAL` | `=D{s1}+D{s2}+…` | `=E{s1}+…` | `=F{s1}+…` | bold, thick black top border across A to H |
| 2 | `Expenses:` | `=D{e1}+D{e2}+…` | | | bold italic |
| 3 | `Allowance:` | `=F{grand}` | | | bold italic |
| 4 | `Net:` | `=D{gAllow}-D{gExp}` | | | bold, thick black bottom border across A to H |

The Weekly report has exactly one week block and no GRAND TOTAL. Week numbers are the week of the month (the weekly label uses the week's Monday, per research R6).

### Worked example (January 2025, fleet, matches the client sample's structure)

Jan 2025 starts on a Wednesday, so Week 1 is Wed 1 to Sun 5, Week 2 is Mon 6 to Sun 12, …, and Week 5 is Mon 27 to Fri 31. A day with Alroy on a ₱300 rental who paid ₱300 is the row `1 | Fri | Alroy | 300 | 260 | 40 | Jan | 2025`.

## Yearly sheet

The header (frozen) is: `Year | Month | Rental | Deposit | Allowance` (columns A to E).

| Rows | Content |
|------|---------|
| 2 to 13 | `A` year (green), `B` Jan…Dec (green), `C` rental total, `D` deposit total, `E` allowance total (₱40 × remittances). Zero shows "-" |
| 14 | `Year Subtotal` (subtotal style): `C` `=SUM(C2:C13)`, `D` `=SUM(D2:D13)`, `E` `=SUM(E2:E13)` |
| 15 | `Expenses:` (italic): `C` the year's expenses value |
| 16 | `Allowance:` (italic): `C` `=E14` |
| 17 | `Net:` (bold): `C` `=C16-C15` |
| 18 | `GRAND TOTAL` (bold, thick top border): `C` `=C14`, `D` `=D14`, `E` `=E14` |
| 19 | `Expenses:` (bold italic): `C` `=C15` |
| 20 | `Allowance:` (bold italic): `C` `=E18` |
| 21 | `Net:` (bold, thick bottom border): `C` `=C20-C19` |

## Shared rules

- **Number formats:** whole pesos `#,##0;[Red]-#,##0`, amounts with centavos `#,##0.00;[Red]-#,##0.00`, and on the yearly sheet `#,##0;[Red]-#,##0;"-"` (or with `.00`).
- **No peso sign.** Column widths follow R5, and a test checks that each column is at least as wide as its longest text plus 2.
- **Sheet title for unit reports:** the sheet name includes the unit (see `reports-http.md`). The header row stays the same.
