# Contract: Workbook layout changes

Everything in `specs/014-reports-xlsx-downloads/contracts/workbook-layout.md` and `specs/019-page-report-downloads` stays as it is except what is listed here.

## Weekly and Monthly unit sheets

| Item | Before | After |
|------|--------|-------|
| Columns | Date, Driver, Rental, Deposit, Allowance (widths 36, 24, 17, 17, 17) | Same five, then **Notes** (width 44) |
| Header row | Five headers | Six headers; "Notes" uses the same header style as Driver (left aligned) |
| Title and subtitle bands | Merged A1:E1, A2:E2 | Merged A1:F1, A2:F2 |
| Daily row Deposit (column D) | Formula `C{r}-E{r}` | Plain number: payments received minus allowance (may be negative, red with a minus sign through the existing number format) |
| Daily row Notes (column F) | n/a | `Received later: ₱180.00 on Nov 22` for one payment, `Received later: 3 payments, ₱540.00 (last Nov 22)` for several, or empty |
| Subtotal, Grand total rows | Cells A to E | Cells A to E as before, plus a blank shaded cell in F so the band is continuous; D is still `SUM(D...)` |
| Expenses, Allowance, Net lines | Columns A to C | Unchanged |
| Print | A4 portrait, Narrow, one page wide | Unchanged (fit to width scales the extra column) |

Rows for days with no remittance keep their blank amount cells and now also a blank Notes cell.

## Yearly unit sheets

| Item | Before | After |
|------|--------|-------|
| Columns | Month, Rental, Deposit, Allowance | Unchanged (no Notes column) |
| Month row Deposit (column C) | Formula `B{r}-D{r}` | Plain number: the month's sum of stored deposits |
| Year subtotal and grand total | `SUM(C5:C{n})`, then links | Unchanged |

## All units summary

No structural change. Rental, Deposit, Allowance, Expenses and Net still link to each unit sheet's total cells, so Deposit now equals the unit sheet's Deposit total. Note lines change:

- Weekly and Monthly: `Deposit = Rental - Allowance, whatever was paid that day.` becomes `Deposit = payments received - Allowance. It is negative when less than the allowance was paid. A payment received after the service date is counted on that day's row and noted in the Notes column.` (kept as one sentence group, wrapping like the other note lines).
- Yearly: `Deposit = Rental - Allowance.` becomes `Deposit = payments received - Allowance for the month's remittances.`

## Unchanged

File names, sheet order and names, period titles, fonts, colors, number formats, tab colors, freeze panes, A4, Narrow margins, one page wide, hyperlinks, and the single-unit and all-units choices.
