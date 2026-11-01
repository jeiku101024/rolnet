# Data Model: Units Daily Assignment, Archiving, and Blocked Units

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

"Fleet date" below means `(now() at time zone 'Asia/Manila')::date`, and "fleet day of X" means
`(X at time zone 'Asia/Manila')::date`.

## New: `unit_assignments`

One driver on one unit for one date (R1).

| Column | Type | Rules |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `unit_id` | uuid → `units.id` | not null |
| `driver_id` | uuid → `drivers.id` | not null |
| `service_date` | date | not null |
| `notes` | text | null; `length(trim(notes)) <= 500` |
| `created_at`, `created_by`, `updated_at`, `updated_by` | audit | `set_audit_fields` trigger |
| `deleted_at`, `deleted_by` | soft delete | set only by release (R8); no hard delete (`reject_hard_delete`) |

**Indexes**:
- `unit_assignments_unit_date_unique` is unique on `(unit_id, service_date)` where `deleted_at is null` (FR-013).
- `unit_assignments_driver_date_unique` is unique on `(driver_id, service_date)` where `deleted_at is null` (FR-013).
- `unit_assignments_date_idx` is on `(service_date)` where `deleted_at is null`.

**Validation** (`validate_unit_assignment`, BEFORE INSERT OR UPDATE), in order:
1. **On UPDATE**: if an active remittance exists for (`old.unit_id`, `old.service_date`), reject. This includes notes edits and soft delete (FR-019a, R7).
2. **On UPDATE**: `unit_id` and `service_date` can't change. To move a driver, release this row and save another.
3. **When the row stays active** (`new.deleted_at is null`):
   - The unit isn't deleted or archived.
   - The fleet day of `units.created_at` is on or before `service_date` (FR-011a).
   - `unit_status_on(unit_id, service_date) = 'active'` (FR-026).
   - The driver isn't deleted, `is_active`, and `license_expiry_date >= service_date` (FR-014).

**States**:

```text
(none) ──save──▶ active ──edit (expected updated_at)──▶ active (overwritten, audited)
                   │
                   ├──unit → In repair / Retired, unit archived, driver deactivated / archived
                   │        (service_date ≥ fleet date, no remittance) ──▶ released (deleted_at set)
                   └──remittance saved for unit+date ──▶ locked (no edit or release until the remittance is reversed)
```

## New: `unit_status_changes`

Append-only status history (R3). Written only by the trigger on `units`.

| Column | Type | Rules |
|--------|------|-------|
| `id` | uuid PK | |
| `unit_id` | uuid → `units.id` | not null |
| `from_status` | `unit_status` | null on the unit's creation row |
| `to_status` | `unit_status` | not null |
| `changed_at` | timestamptz | not null, default `now()` |
| `effective_on` | date | not null; fleet day of `changed_at` (set by trigger) |
| `changed_by` | uuid → `auth.users.id` | `auth.uid()`; null for migration rows |
| `created_at`, `created_by`, `updated_at`, `updated_by` | audit | `set_audit_fields` trigger |
| `deleted_at`, `deleted_by` | soft delete | never set by the app; `reject_hard_delete` trigger |

**Index**: `(unit_id, effective_on desc, changed_at desc)` where `deleted_at is null`. Status lookups ignore soft-deleted rows.

**Status on a date** (`unit_status_on(unit, d)` and the TypeScript `statusOn`):
1. Take the latest row with `effective_on <= d`, by `changed_at`. If there is one, return its `to_status`.
2. Otherwise, take the earliest row's `from_status`, if that isn't null.
3. Otherwise, return `active`.

**Backfill**:
- Rows come from `audit_events` (unit status before and after differ).
- Then, per FR-025, add a release-day row (`active` → current status, `changed_by` null) for every non-active unit whose latest row doesn't already end in its current status.
- Newly created units get a creation row (`from_status` null, `to_status` = the initial status).

## Changed: `units`

| Column | Change |
|--------|--------|
| `archived` | **new** boolean, not null, default false |
| `archived_at` | **new** timestamptz null |
| `archived_by` | **new** uuid → `auth.users.id` null |
| check | `archived = (archived_at is not null)` |

- **Archive fields**: set by a BEFORE UPDATE trigger when `archived` changes. Restore clears all three.
- **`status`**: still `active` / `in_repair` / `retired`. Changing it writes a `unit_status_changes` row. Changing it to `in_repair` or `retired` releases assignments (R8).
- **Details lock (feature 005)**: unchanged. Body number, plate, and motorcycle can't change while the unit is In repair or Retired, and the inline Edit details shows that message.
- **Delete**: `soft_delete_record('units', …)` now refuses, so units are archived, never deleted.
- **Current driver**: derived, not stored. It's the active `unit_assignments` row for (unit, fleet date).

## Changed: `remittances`

| Column | Change |
|--------|--------|
| `assignment_id` | now **nullable** (legacy link to `driver_assignments`) |
| `unit_assignment_id` | **new** uuid → `unit_assignments.id` null |
| check | `num_nonnulls(assignment_id, unit_assignment_id) = 1` |

- **New inserts** (`validate_remittance`, R6) must use the daily assignment:
  - `assignment_id` is null.
  - An active `unit_assignments` row exists for (`unit_id`, `service_date`) with the same `driver_id`. Its id is stored in `unit_assignment_id`.
  - The unit isn't archived, exists on the date, and isn't blocked on the date.
- **Updates**: only the rental rule runs. `lock_remittance_financial_facts` also freezes `unit_assignment_id`.
- **Unchanged**: the unique `(unit_id, service_date)` and `(driver_id, service_date)` indexes, so a remittance's driver always matches that day's locked assignment.

## Changed: `drivers`

- **`driver_kind`** (Primary or Backup): unchanged, display-only (FR-051).
- **Deactivation**: the feature-005 trigger that blocked it while assignments were open is **dropped**. Deactivating (`is_active` → false) or archiving (`deleted_at` set) releases the driver's assignments from today onward (R8).

## Retired (read-only): `driver_assignments`, `driver_days_off`

- **Writes**: the insert and update policies are dropped, so nobody can create or change these rows (FR-049).
- **Reads**: SELECT stays for history (the driver page and legacy remittance details).
- **Release day only**: their rows for the fleet date feed the seed (R13).

## Derived views (no storage)

**Assignment board card** (`lib/units/assignment-board.ts`), one per non-archived unit that exists on the date:

| Kind | When | Shows |
|------|------|-------|
| `blocked` | `statusOn(date)` is In repair or Retired and there's no saved assignment | badge, disabled inputs, the message, and "Open unit" (owner) |
| `locked` | saved assignment and a remittance exists | driver, notes, "Assigned", and "A remittance is already recorded for this day." No menu |
| `saved` | saved assignment | driver, notes, "Assigned", "Saved" with a lock, and the "Card options" menu → "Edit assignment" |
| `open` | otherwise | dropdown (available drivers plus this card's own), notes, Save; `prefillDriverId` on future dates |

- **Counts**: `assigned` counts the `saved` and `locked` cards. `assignable` counts every card except `blocked` (FR-010).
- **Available drivers** for a card: eligible drivers on the date, minus the drivers saved on other units that date.

**Remittance board card** (`lib/remittances/daily-board.ts`), per non-archived unit existing on the date, or any unit with a saved remittance:

| Kind | When |
|------|------|
| `saved` | a remittance exists (always shown and counted, FR-047) |
| `blocked` | the unit is blocked on the date |
| `unrecorded` | an assignment exists; the driver tag is the driver's `driver_kind` |
| `no-driver` | no assignment; the "Assign driver" link goes to `/units?view=daily&date=…` |

- **Counts**: `countable` counts the `saved`, `unrecorded`, and `no-driver` cards. `recorded` counts the `saved` cards. `received` sums the `saved` cards (FR-046).

**Monthly allowance block** (`lib/units/monthly-allowance.ts`): for each month among the 12 calendar months ending with the current one that has activity:
- `allowanceCentavos` is the sum of the unit's active remittances' `allowance_centavos`.
- `expensesCentavos` is the sum of the unit's active `expenses.amount_centavos`.
- `netCentavos` is allowance minus expenses.

Blocks are listed newest first (FR-041).
