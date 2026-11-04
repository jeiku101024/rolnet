# Data Model: Reports Page XLSX Downloads

No new tables. One behaviour change on `remittances.deposit_centavos`, one new read function, and
in-memory report models.

## Stored data (existing)

| Table | Fields used | Rules |
|-------|-------------|-------|
| `units` | `id`, `name`, `archived`, `deleted_at` | Deleted units never appear. Non-archived → always a sheet. Archived → a sheet only with ≥ 1 non-deleted remittance or expense in the period. |
| `remittances` | `id`, `unit_id`, `driver_id`, `service_date`, `amount_due_centavos` (Rental), `allowance_centavos`, `deposit_centavos`, `created_at`, `deleted_at` | Non-deleted only. `service_date` is already the fleet (business-timezone) date. One row per remittance; legacy duplicates per unit/day are kept as separate rows. |
| `drivers` | `full_name` | Driver cell = `full_name` of the remittance's `driver_id`. |
| `expenses` | `unit_id`, `expense_date`, `amount_centavos`, `deleted_at` | Non-deleted only; always linked to a unit. |

### Changed: `remittances.deposit_centavos`

| | Before (feature 009) | After (this feature) |
|--|---------------------|----------------------|
| Rule | active payments − allowance (could be negative) | `amount_due_centavos − allowance_centavos` |
| Maintained by | `remittances_set_deposit()` BEFORE INSERT/UPDATE trigger | same trigger, new body |
| Payments | changed the deposit | no longer change it; `remittance_payments_sync_deposit()` still touches the parent so `updated_at` moves |
| Existing rows | — | backfilled in the migration (all rows, including soft-deleted) with audit triggers disabled for that update only |

Recovery note (kept in the migration comment): the old value can be recomputed as the sum of the
remittance's non-deleted payments minus its allowance.

### New: `public.report_unit_month_totals(p_from date, p_to date)`

`security invoker`, `stable`, `set search_path = public`. EXECUTE revoked from `public, anon`;
granted to `authenticated` (the app calls it). RLS on `remittances` and `expenses` decides visibility.

| Column | Type | Meaning |
|--------|------|---------|
| `unit_id` | uuid | Unit |
| `month` | date | First day of the month |
| `rental_centavos` | bigint | Sum of `amount_due_centavos` of non-deleted remittances with `service_date` in the month and in `[p_from, p_to]` |
| `allowance_centavos` | bigint | Sum of `allowance_centavos`, same rows |
| `remittance_count` | integer | Count of those remittances |
| `expense_centavos` | bigint | Sum of non-deleted `expenses.amount_centavos` with `expense_date` in the month and range |

One row per (unit, month) that has a remittance or an expense; missing combinations mean zero. Hand-add
to `types/database.ts` under `Functions`.

## In-memory models (not stored)

### ReportRequest

| Field | Values | Validation |
|-------|--------|------------|
| `kind` | `weekly` \| `monthly` \| `yearly` | else 400 |
| `period` | weekly: any `YYYY-MM-DD` → Monday–Sunday; monthly: `YYYY-MM`; yearly: `YYYY` | real date, within 10 years of today (existing `validatePeriod`) |
| `scope` | `all` \| `unit` (legacy `fleet` accepted as `all`) | `unit` needs a valid `unitId` that is eligible for the period, else 400/404 |

### ReportUnit

`{ id, name, archived, sheetName }` — sorted by natural name order (R8); `sheetName` from R7.

### UnitPeriodData (weekly / monthly)

```text
remittances: { date, driverName, rentalCentavos, allowanceCentavos }[]   // ordered by date, created_at, id
expensesByDate: Map<date, centavos>
```

### UnitYearData (yearly)

```text
months[12]: { rentalCentavos, allowanceCentavos }   // zeros when no remittances
expenseCentavos: number
```

### SheetModel (writer input)

```text
name, tabColor, columns: width[]
rows: { height, cells: Cell[] }[]          // row 1 = title band, 2 = second line, 3 = spacer, 4 = headers
merges: "A1:E1"[]
freezeAt: "A5"
hyperlinks: { ref, sheetName }[]           // summary only
printTitles: boolean                       // unit sheets: rows 1:4
Cell = { value: number | string | null, formula?: string, style: StyleId }
```

Each unit-sheet builder also returns its **link row** (monthly G, weekly S, yearly 21) and centavo
totals `{ rental, deposit, allowance, expenses, net }` so the summary can be written with cached values
before the unit sheets are serialised.

## Derived values (all in centavos until written)

| Value | Formula in the file | Cached value |
|-------|---------------------|--------------|
| Deposit (row) | `=C{r}-E{r}` | rental − allowance |
| Block subtotal | `=SUM(C{F}:C{L})` (C, D, E) | sums of the block rows |
| Expenses | plain number | sum of the block's expenses |
| Allowance line | `=E{S}` | block allowance |
| Net | `=C{S+2}-C{S+1}` | allowance − expenses |
| Grand total | `=C{S1}+…+C{Sn}` | sum of subtotals |
| Summary B–F | `='Name'!C{G}` etc. | the unit's totals |
| ALL UNITS | `=SUM(B5:B{last})` | sum of unit totals |
