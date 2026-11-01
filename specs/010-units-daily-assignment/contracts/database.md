# Contract: Database

The three migrations are applied in order. Every new function in `public` starts with
`revoke execute … from public, anon, authenticated`, and grants are listed explicitly below. "Fleet
date" is `(now() at time zone 'Asia/Manila')::date`.

## Migration 1: `20261101000100_unit_assignments.sql`

| Object | Kind | Security | EXECUTE grant |
|--------|------|----------|---------------|
| `unit_assignments` | table + 3 indexes ([data-model](../data-model.md)) | RLS on | n/a |
| `validate_unit_assignment()` | BEFORE INSERT OR UPDATE trigger | definer (reads remittances, drivers, units) | none |
| `save_unit_assignment(p_unit_id uuid, p_service_date date, p_driver_id uuid, p_notes text, p_expected_updated_at timestamptz default null) returns public.unit_assignments` | function | invoker | `authenticated` |
| `latest_unit_assignments_before(p_date date) returns table(unit_id uuid, driver_id uuid, service_date date)` | function, stable | invoker | `authenticated` |

Triggers on `unit_assignments`: `set_audit_fields`, `reject_hard_delete`, `validate_unit_assignment`, and
`<table>_business_audit` (`audit_business_change`).

**RLS on `unit_assignments`**:
- `select` to authenticated using `is_approved_user()`
- `insert` to authenticated with check `is_approved_user()`
- `update` to authenticated using and with check `is_approved_user()`

There's no delete policy.

**`save_unit_assignment` behaviour**:

| Case | Result |
|------|--------|
| `p_expected_updated_at` null, no active row for (unit, date) | inserts, returns the row |
| `p_expected_updated_at` null, active row exists | `P0001` "This unit was just assigned by someone else. Reload to see it." |
| `p_expected_updated_at` set, it matches the active row | updates `driver_id` and `notes`, returns the row |
| `p_expected_updated_at` set, no match | `P0001` "This assignment was changed by someone else. Reload to see it." |
| driver already active on another unit that date | `23505` on `unit_assignments_driver_date_unique` |
| `p_driver_id` null | `22023` "Choose a driver first" |

**`validate_unit_assignment` errors** (`23514` unless noted):

| Rule | Message |
|------|---------|
| update or soft delete with an active remittance for (old unit, old date) | "A remittance is already recorded for this day. The assignment can't be changed." |
| `unit_id` or `service_date` changed on update | "An assignment's unit and date can't change. Release it and save a new one." |
| unit deleted or archived | "This unit is archived. Restore it to assign a driver." |
| date before the unit's fleet creation day | "This unit wasn't in the fleet on this date." |
| unit blocked on the date | "This unit is In repair on this date. Set it to Active to assign a driver." (or Retired) |
| driver inactive, deleted, or licence expired on the date | "This driver can't be assigned on this date. Check that they're active and their licence is valid." |

## Migration 2: `20261101000200_unit_status_history_and_archive.sql`

| Object | Kind | Security | EXECUTE grant |
|--------|------|----------|---------------|
| `unit_status_changes` | table + index, backfill ([research R3](../research.md)); standard audit and soft-delete columns with `set_audit_fields` and `reject_hard_delete` triggers | RLS on; `select` to authenticated using `is_approved_user()`; no write policies | n/a |
| `record_unit_status_change()` | AFTER INSERT OR UPDATE OF status ON units trigger | definer; returns early unless `is_approved_user()` or the session is a migration (`auth.uid() is null`) | none |
| `unit_status_on(p_unit_id uuid, p_date date) returns unit_status` | function, stable | definer (used by the validation triggers) | none |
| `units.archived`, `archived_at`, `archived_by` + check + partial index | columns | covered by the existing units RLS (owner update) | n/a |
| `set_unit_archive_fields()` | BEFORE UPDATE OF archived ON units | invoker | none |
| `release_unit_assignments(p_unit_id uuid default null, p_driver_id uuid default null) returns integer` | function | definer; raises unless `is_owner()` | none |
| `release_on_unit_change()` | AFTER UPDATE OF status, archived ON units | definer; calls release when the status became `in_repair` or `retired`, or `archived` became true | none |
| `release_on_driver_change()` | AFTER UPDATE OF is_active, deleted_at ON drivers | definer; calls release when `is_active` became false or `deleted_at` became non-null | none |
| `drivers_reject_deactivation_with_assignments` trigger + function | **dropped** (replaced by the release) | | |
| `soft_delete_record` | replaced; `p_table = 'units'` raises `22023` "Units are archived, not deleted. Use Archive." The rest is unchanged | definer, unchanged grant | unchanged |

**Release rule**: soft-delete active `unit_assignments` rows where `service_date >= fleet date`, for the
unit or driver, `and not exists (active remittance for unit_id, service_date)`. Returns the count.

## Migration 3: `20261101000300_remittances_use_unit_assignments.sql`

| Object | Change |
|--------|--------|
| `remittances.assignment_id` | `drop not null` |
| `remittances.unit_assignment_id` | new FK + `num_nonnulls` check + index |
| `validate_remittance()` | replaced: INSERT rules from [data-model](../data-model.md); UPDATE keeps only the rental rule. Definer, no grant |
| `lock_remittance_financial_facts()` | replaced: also freezes `unit_assignment_id` |
| policies `assignments_owner_insert_policy`, `assignments_owner_update_policy`, and the `driver_days_off` owner insert and update policies | dropped |
| release-day seed | one insert into `unit_assignments` per eligible unit for the fleet date: the primary, or the backup covering the primary's day off, or no row when the primary is off with no backup ([research R13](../research.md)); `on conflict do nothing` |

**New remittance insert errors** (`23514`):

| Rule | Message |
|------|---------|
| `assignment_id` given | "Driver assignments are now recorded per day on the Units page." |
| no active assignment for the unit and date | "Assign a driver to this unit for this date first." |
| driver differs from the assignment | "This unit is assigned to another driver on this date. Reload the page." |
| unit archived | "This unit is archived." |
| unit blocked | "This unit is In repair on this date. No remittance for this date." (or Retired) |
| date before the unit was added | "This unit wasn't in the fleet on this date." |

## Error mapping (`lib/actions/errors.ts`)

- `23505` on `unit_assignments_driver_date_unique` → "Driver already assigned today" (the card resets its selection).
- `23505` on `unit_assignments_unit_date_unique` → the "just assigned by someone else" message.
- Every `23514`, `22023`, and `P0001` message above passes through as-is.
