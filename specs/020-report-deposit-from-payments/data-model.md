# Data Model: Report Deposit From Payments

No tables or columns change. One read function gains a column and the report data shapes gain fields. Money is integer centavos until the workbook writer writes pesos.

## Existing data used (unchanged)

| Source | Fields used | Rule |
|--------|-------------|------|
| `remittances` | `service_date`, `amount_due_centavos` (Rental), `allowance_centavos`, `deposit_centavos`, `deleted_at` | `deposit_centavos` = sum of the remittance's non-voided payments minus `allowance_centavos`, kept current by trigger. May be negative. Deleted remittances are excluded by `deleted_at is null`. |
| `remittance_payments` | `remittance_id`, `paid_at`, `amount_centavos`, `deleted_at` | A payment with `deleted_at` set (voided) never counts. `paid_at` is a timestamp; its fleet-time-zone date decides "late". |

## `report_unit_month_totals(p_from date, p_to date)` (replaced)

| Column | Type | Meaning |
|--------|------|---------|
| unit_id | uuid | Unit |
| month | date | First day of the month |
| rental_centavos | bigint | Sum of `amount_due_centavos` (unchanged) |
| allowance_centavos | bigint | Sum of `allowance_centavos` (unchanged) |
| **deposit_centavos** | bigint | **New:** sum of `remittances.deposit_centavos` for the unit and month; may be negative |
| remittance_count | integer | Count (unchanged) |
| expense_centavos | bigint | Sum of expenses (unchanged) |

Months with expenses but no remittances return `deposit_centavos = 0`. The column is appended after `allowance_centavos`; existing callers read by name.

## Report data shapes (TypeScript)

| Shape | Change |
|-------|--------|
| `ReportRemittance` | Adds `depositCentavos: number` and `latePayments: { date: string; amountCentavos: number }[]` (empty when none). `date` is the fleet-time-zone date YYYY-MM-DD. |
| `UnitYearData.months[i]` | Adds `depositCentavos: number`. |
| `UnitTotals` | Unchanged fields; `depositCentavos` is now the sum of Deposit values, no longer `rental - allowance`. |
| `ReportPayload` | Carries the new fields through JSON; no new top-level fields. |

## Derived values

- **Row Deposit** = `depositCentavos` of the remittance.
- **Block, week, month, year totals** = sums of the rows above.
- **Net** = Allowance total minus Expenses total (unchanged).
- **Late note text** = one late payment: `Received later: ₱<amount> on <Mon d>`; several: `Received later: <n> payments, ₱<total> (last <Mon d>)`; empty when there are none.

## Validation rules

- A payment is late only when its fleet date is after the remittance's `service_date`; same-day and earlier payments are not late.
- Notes text is plain text and takes no part in any total.
- A remittance with no payments has `depositCentavos = -allowance_centavos` (for example −4000 centavos).

## State transitions

None. Read-only.
