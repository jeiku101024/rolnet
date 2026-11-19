# Data Model: Page-Level Report Downloads

No tables or columns change. This feature adds one read function and three in-memory shapes. Money is integer centavos until the workbook writer, which writes pesos with two decimals.

## Standing (one row of the standings report)

Produced by `sf_standings(p_as_of)` and its TypeScript twin `standingsFor`.

| Field | Type | Meaning |
|-------|------|---------|
| participant_id | uuid | Participant |
| name | text | Participant name |
| savings_centavos | bigint | Total savings after all non-voided ledger rows dated on or before the date |
| loans_centavos | bigint | Principal of loans open or overdue on the date (0 if none) |
| balance_to_pay_centavos | bigint | Still owed on those loans, interest included |
| has_overdue | boolean | Any of those loans has a due date before the date |

**Rules**
- Included: participants with `archived_at` and `deleted_at` null whose creation date (fleet time zone) is on or before the date.
- Excluded rows: voided ledger rows, rows dated after the date.
- Loan counts on the date when: loan date ≤ date; no non-voided withdrawal dated ≤ date; and due amount minus payments dated ≤ date is above zero.
- Date used: `min(last day of chosen month, today)`, decided by the caller.
- Output order for the sheet: `rankRows` (savings high to low, ties by name, no-savings last with no rank).

**Derived report row**: `{ rank (number or blank), name, savings, loans, balance, overdue }`. Totals row: sums of savings, loans, balance.

## Expenses month payload (JSON from `/api/expenses/month`)

| Field | Type | Meaning |
|-------|------|---------|
| month | string `YYYY-MM` | Chosen month |
| monthLabel | string | e.g. "November 2026" |
| units | array in sheet order | `{ id, name }` for each non-archived unit plus archived units with expenses that month |
| expenses | array | `{ unitId, date, category, customCategory, replacedDate, amountCentavos, notes }` for non-deleted expenses dated in the month, sorted by date then creation |

**Rules**
- A unit with no expenses stays in `units` (empty sheet with the "No expenses" line).
- Archived unit appears only when it has at least one expense in the month.
- No receipt data and no unit column are sent.
- Sheet names are derived by `sheetNames(units.map(name))`, so duplicates and long or illegal names are handled once.

## Download overlay state (client only, not stored)

| State | Values |
|-------|--------|
| open | true / false; the card is mounted only when true |
| pending | true while a file is being prepared |
| error | message plus Retry; selections kept |
| period | Remittances: kind, date/month/year, scope, unit (unchanged); others: month, year |

**Defaults on every open**: Remittances Monthly, current month and year, All units; Standings and Expenses current month and year.

## Workbook page setup (per sheet)

| Property | Remittances (unchanged) | Standings | Expenses |
|----------|-------------------------|-----------|----------|
| Paper | A4 | A4 | A4 |
| Orientation | portrait | portrait | landscape |
| Margins | Narrow | Narrow | Narrow |
| Fit | 1 wide, 1 tall | 1 wide, 1 tall (auto height above 45 participants) | 1 wide, automatic height |
| Repeated header rows | as today | rows 1 to 4 | rows 1 to 4 |

## State transitions

None. All three downloads are read-only snapshots.
