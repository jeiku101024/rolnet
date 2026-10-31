# Data Model: Remittance Financials and XLSX Reports

## Schema changes (migration `20261031000100_remittance_financials.sql`)

### `public.remittances`: new columns

| Column | Type | Rule |
|--------|------|------|
| `allowance_centavos` | `bigint not null default 4000`, check `>= 0` | Forced to 4000 on insert by `remittances_set_deposit`. It can't change after insert (added to `lock_remittance_financial_facts`) |
| `deposit_centavos` | `bigint not null default -4000` | Always set by the BEFORE trigger to the active payments total minus `allowance_centavos`. It may be negative, and client-written values are overwritten |

Existing columns are unchanged. `amount_due_centavos` is the **Rental**, still set by `validate_remittance()` (18000 or 30000) and locked after insert.

### New index

`create index remittances_service_date_idx on public.remittances (service_date) where deleted_at is null;`

### Functions and triggers

| Object | Kind | Behavior |
|--------|------|----------|
| `remittances_set_deposit()` + trigger `remittances_set_deposit` | BEFORE INSERT OR UPDATE on `remittances` | On insert, sets allowance to the rate. Always sets `deposit_centavos := coalesce(sum(active payments), 0) - allowance_centavos` |
| `lock_remittance_financial_facts()` | replaced | Also rejects a change to `allowance_centavos`. `deposit_centavos` is not locked, because it is derived |
| `validate_remittance_payment()` | replaced | Requires an active remittance (as now). On insert, on restore, or on an amount change, it locks the remittance row and rejects if `other active payments + new amount > amount_due_centavos` (23514, message from research R3) |
| `remittance_payments_sync_deposit()` + trigger | AFTER INSERT OR UPDATE on `remittance_payments` | Touches the parent remittance (and the old parent if it changed) so `remittances_set_deposit` recalculates |
| none (backfill) | one-time `update` | With the audit-fields, business-audit and lock triggers disabled: `allowance_centavos = 4000` and `deposit_centavos = active paid - 4000` for every remittance |

None of these functions are granted to `anon` or `authenticated`. `remittances_set_deposit()` and `remittance_payments_sync_deposit()` are `security invoker`, so they run under the caller's RLS. `validate_remittance_payment()` stays `security definer`, as it is today, and only reads. The pgTAP RLS test checks that staff and owners writing `deposit_centavos` or `allowance_centavos` directly can't change the result.

## Derived values (TypeScript, `lib/remittances/financials.ts`)

| Name | Formula |
|------|---------|
| Rental | `amount_due_centavos` (or `dueFor(disposition)` before saving) |
| Paid | sum of active `remittance_payments.amount_centavos` |
| Balance | `max(rental - paid, 0)`, shown as "Paid" when 0 and "Owes ₱X" otherwise |
| Allowance | `allowance_centavos` (4000 before saving) |
| Deposit | `paid - allowance`; saved cards and List view read `deposit_centavos` |

Validation is `0 ≤ paid ≤ rental` for new payments. Existing records already above the rental are left as they are.

## View-model changes

- `SavedCard` (`lib/remittances/daily-board.ts`) gains `allowanceCentavos` and `depositCentavos`. `DailyRows.remittances[]` gains `allowance_centavos` and `deposit_centavos`.
- The List view row select gains `allowance_centavos, deposit_centavos`.
- Demo remittances gain `allowance_centavos: 4000` and `deposit_centavos: paid - 4000`. Demo expenses are spread over the current month so the reports have data.

## Report model (`lib/reports/*`)

### `ReportRequest`

| Field | Type | Rule |
|-------|------|------|
| `kind` | `"weekly" \| "monthly" \| "yearly"` | |
| `date` | `YYYY-MM-DD` | Weekly only. A real date within 10 years of today |
| `month` | `YYYY-MM` | Monthly only. Within 10 years |
| `year` | `YYYY` | Yearly only. Within 10 years |
| `unitId` | uuid or null | null means the whole fleet. Otherwise a non-deleted unit (any status) |

### `ReportRemittance` (one per remittance in range)

`{ serviceDate, driverName, rentalCentavos, depositCentavos, allowanceCentavos }`, ordered by service date and then creation time.

### `ReportDay`

`{ date, week, dayLabel ("Mon"…"Sun"), monthLabel ("Jan"…"Dec"), year, remittances: ReportRemittance[] }`

### `ReportWeek`

`{ week, days: ReportDay[], expensesCentavos }`. For a monthly report, only the week's days inside the month count, and expenses are summed over those days.

### `YearMonth`

`{ monthLabel, rentalCentavos, depositCentavos, allowanceCentavos }` × 12, plus `expensesCentavos` for the year.

### Sheet model (input to `xlsx.ts`)

`{ name, columns: { width: number }[], frozenRows: 1, rows: Cell[][] }`

`Cell = { value: number | string | null, formula?: string, style: StyleKey }`

Numeric values are pesos (`centavos / 100`). Formula cells carry their computed value as the cached `value`.
