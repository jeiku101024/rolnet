# Data Model: Dashboard Refinements

No database changes. One new in-memory shape in `lib/dashboard/ordering.ts`.

## UnpaidLoanItem

| Field | Type | Notes |
|---|---|---|
| participantId | string | `sf_participants.id` |
| participantName | string | from `sf_participants.name` |
| outstandingCentavos | number | sum of `balance_centavos` over the participant's open loans (integer centavos) |
| openLoanCount | number | count of open loans |
| overdue | boolean | true when any open loan has `overdue = true` |
| earliestDueDate | string or null | minimum `due_date`, shown as detail text |

**Rules**: include only loans with `status = 'open'` (balance above zero, not withdrawn, not voided); one item per participant; order by `outstandingCentavos` descending, then `participantName`; skip loans whose participant is unknown. Wrapped with `toPanel(items, "/sinking-fund")` to give `Panel<UnpaidLoanItem>` (`items` at most 5, `total` is the number of borrowers).

## Reused (unchanged)

- `UnitIncomeBar` (all units go to the dialog; the card shows the first 5)
- `Panel<Item>`, `panelLimit = 5`, `phoneRowLimit = 3`

## Dashboard data addition

`DashboardData.attention` gains `loans: Panel<UnpaidLoanItem>`.
