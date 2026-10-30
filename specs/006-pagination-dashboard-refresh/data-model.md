# Data Model: Paginated Lists and Dashboard Refresh

**No database change.** No new tables, columns, functions, policies, grants, or migrations.
Everything below is a TypeScript view model built from existing tables and RPCs. Money stays
integer centavos (`number` holding a safe integer from `bigint` columns, formatted only with
`formatPesos`).

## ListPageRequest (`lib/pagination/list-page.ts`)

| Field | Type | Rule |
|---|---|---|
| `prefix` | `string` | `""` for the page's main list; e.g. `"assignments_"` on detail pages |
| `page` | `number` | from `${prefix}page`; integer ≥ 1, otherwise 1 |
| `q` | `string` | from `${prefix}q`; trimmed, max 100 chars; `""` = no search |
| `pageSize` | `10` | fixed (clarification Q2) |
| `from`, `to` | `number` | `from = (page − 1) × 10`, `to = from + 9` |

## ListPageResult\<Row\>

| Field | Type | Rule |
|---|---|---|
| `rows` | `Row[]` | ≤ 10, in the list's existing order (FR-006) |
| `total` | `number` | exact count of rows matching `q` (soft-deleted excluded, RLS applied) |
| `page` | `number` | clamped: `min(requested, lastPage)` |
| `lastPage` | `number` | `max(1, ceil(total / 10))` |
| `rangeLabel` | `string` | `"11–20 of 87 records"`, `"1–1 of 1 record"`, `"0 records"` |

State rules: changing `q` ⇒ `page` resets to 1. `page > lastPage` ⇒ slice re-read at `lastPage`.

## SearchSpec (per list, `lib/pagination/search-filter.ts`)

| Field | Meaning |
|---|---|
| `columns` | own text columns matched with `ilike *q*` |
| `related` | `{ table, column, foreignKey }[]` — ids of rows in `table` whose `column ilike *q*` become `foreignKey.in.(…)` |
| `fixedFilters` | URL filters that are not free text: drivers `kind=backup`, units `status=in_repair`, maintenance `due=1`, remittances `balance=unpaid`, documents `expiring=1` (the last three are id lists from the owner-only RPCs `due_maintenance`, `driver_outstanding_balances`, `expiring_documents`) |

## Dashboard view models (`lib/dashboard/queries.ts`, `lib/dashboard/ordering.ts`)

### AttentionPanel\<Item\>
`{ items: Item[] /* ≤ 5, ordered */, total: number, href: string }`

- **ExpiringDocumentItem**: `id`, `documentType`, `holderLabel` (body number or driver name),
  `expiresOn`, `daysUntil` (negative = overdue), `bucket` (`expired` | `due_7` | `due_30`).
  Order: `expiresOn` ascending.
- **DueMaintenanceItem** (extends existing type): `itemName`, `bodyNumber`, `dueDate`,
  `dueMileage`, `currentMileage`, `daysPastDue`, `kmPastDue`,
  `urgency = max(daysPastDue, kmPastDue / kmPerDayEquivalent)` with `kmPerDayEquivalent = 100`.
  Order: `urgency` descending, then `bodyNumber`.
- **UnpaidBalanceItem**: from `driver_outstanding_balances()` — `driverId`, `driverName`,
  `outstandingCentavos`, `unpaidRemittanceCount`, `firstUnpaidServiceDate`.
  Order: `outstandingCentavos` descending, then `firstUnpaidServiceDate` ascending.

### ExtradorItem
`driverId`, `fullName`, `phone`, `currentUnit: { unitId, bodyNumber } | null`, `assignmentType`
(`backup` | `primary` | `null`). Source: `drivers` (`driver_kind = 'backup'`, `is_active`,
`deleted_at is null`) + `driver_assignments` covering today. Order: assigned first, then name.

### InRepairUnitItem
`unitId`, `bodyNumber`, `plateNumber`, `inRepairSince: string | null` (from latest matching
`audit_events.occurred_at`), `daysInRepair: number | null`. Order: `inRepairSince` ascending,
nulls last.

### FleetStats
| Field | Source |
|---|---|
| `collectedCentavos` | Σ `remittance_paid_centavos` of `dashboard_monthly_unit_summary(month)` |
| `expenseCentavos` | Σ `total_expense_centavos` |
| `netCentavos` | `collectedCentavos − expenseCentavos` (= Σ `net_income_centavos`) |
| `unitsActive`, `unitsInRepair` | counts on `units` by `status`, not deleted |
| `documentsDue` | count of `expiring_documents(today)` rows |
| `maintenanceDue` | count of `due_maintenance(today)` rows |

### UnitIncomeBar
`unitId`, `bodyNumber`, `collectedCentavos`, `expenseCentavos`, `netCentavos`,
`collectedPct`, `expensePct` (0–100, relative to the largest collected-or-expense value of the
month; 0 when the month is empty). Order: body number.

### DailyCollection
`date` (Manila `YYYY-MM-DD`), `collectedCentavos`, `heightPct`. One per day from the 1st to
today (current month). Source: `remittance_payments` where `deleted_at is null` and `paid_at`
falls in the month in Asia/Manila. Σ over days = `collectedCentavos` of FleetStats.

### RecentItem kinds
`remittances` (latest `service_date`), `expenses` (latest `expense_date`), `maintenance`
(latest `part_replacements` / `tire_installations` by `created_at`), `documents` (latest
`created_at`). ≤ 5 each. Kinds `units` and `drivers` are removed.
