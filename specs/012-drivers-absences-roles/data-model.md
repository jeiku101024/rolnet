# Data Model: Drivers Page, Role Switch, Dated Absences, Stale Leave Flag

All new tables follow the project pattern:
- They carry `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, and `deleted_by`.
- Triggers `set_audit_fields`, `reject_hard_delete`, and `audit_business_change` are attached.
- RLS is enabled, and `anon` has no access.

"Today" means `(now() at time zone 'Asia/Manila')::date`.

## Changed: `drivers`

| Column | Change |
|--------|--------|
| `notes` | **new** `text null`, `check (notes is null or length(trim(notes)) <= 1000)` |
| `driver_kind` | unchanged enum `driver_kind ('primary','backup')`. It is now also changed through `set_driver_role`, and the inactive-details lock no longer covers it |
| `is_active` | unchanged. Still the only stored status (Active or Inactive) |

Date joined = `created_at` (fleet date). It is read-only.

## Changed: `fleet_settings`

| Column | Type | Default | Check |
|--------|------|---------|-------|
| `stale_leave_amber_days` | smallint not null | 14 | `> 0` |
| `stale_leave_red_days` | smallint not null | 30 | `> stale_leave_amber_days` |
| `stale_leave_snooze_days` | smallint not null | 7 | `> 0` |

## New enums

- `driver_absence_type`: `day_off`, `on_leave`
- `driver_absence_reason`: `sick`, `vacation`, `family_emergency`, `personal`, `other`

## New: `driver_absences`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid pk | |
| `driver_id` | uuid not null → `drivers(id)` | |
| `absence_type` | `driver_absence_type` not null | |
| `start_date` | date not null | Past dates are allowed |
| `end_date` | date null | Equals `start_date` for `day_off`. Null means open-ended `on_leave` |
| `reason` | `driver_absence_reason` not null | |
| `note` | text null | `length(trim(note)) <= 500` |
| `cancelled_at`, `cancelled_by` | timestamptz / uuid null | Set by cancel |
| `ended_early_on` | date null | Fleet date when ended early. Coverage stops the day before |
| `ended_early_at`, `ended_early_by` | timestamptz / uuid null | Who and when |
| `snoozed_until` | date null | Stale flag hidden while `today < snoozed_until` |
| audit columns | | |

**Constraints**
- `check (end_date is null or end_date >= start_date)`
- `check (absence_type = 'on_leave' or end_date = start_date)`: a Day-off always has an end date equal to its start
- `check (ended_early_on is null or ended_early_on >= start_date)`
- `check (cancelled_at is null or ended_early_on is null)`: cancelled and ended early are mutually exclusive
- `exclude using gist (driver_id with =, daterange(start_date, least(end_date + 1, ended_early_on), '[)') with &&) where (cancelled_at is null and deleted_at is null)`
- Index `(driver_id, start_date, end_date) where deleted_at is null`

**Validation trigger** (`validate_driver_absence`, before insert or update):
- The driver must exist, not be deleted, and be `is_active`, on insert and on any date change: "Inactive drivers cannot have absences".
- A cancelled, ended-early, or completed absence (last covered date before today) can't change dates, type, or reason: "This absence is finished and can't be edited."
- For an Active-now absence, a new `end_date` may not be before today.
- It skips silently for signed-in users who aren't approved, so RLS rejects them (the pattern from 20261031000200).

**Effective coverage** (`driver_absent_on(driver_id, date)`, and `covers()` in TypeScript):
covered when `cancelled_at is null and deleted_at is null and date >= start_date and (end_date is null or date <= end_date) and (ended_early_on is null or date < ended_early_on)`.

**Derived absence status** (TypeScript, `absenceStatus(a, today)`):

| Status | Rule |
|--------|------|
| Cancelled | `cancelled_at` set |
| Ended early | `ended_early_on` set |
| Upcoming | `start_date > today` |
| Active now | covers today |
| Completed | otherwise (its last covered date is before today) |

**State transitions**

```text
            save (start > today)           cancel
  (new) ──────────────────────► Upcoming ─────────► Cancelled
    │                              │ date reaches start
    │ save (covers today)          ▼
    └────────────────────────► Active now ──end early──► Ended early
                                   │ end_date passes
                                   ▼
                               Completed
```

Edit is allowed in Upcoming and Active now. Cancel is allowed in Upcoming only, and End early in
Active now only.

**Stale level** (TypeScript, `staleLevel(a, today, settings)`): only for an open-ended `on_leave`
that covers today. `daysOpen = today − start_date`. If `snoozed_until > today` → `snoozed`. Else if
`daysOpen >= red` → `red`. Else if `daysOpen >= amber` → `amber`. Else `none`.

## New: `driver_absence_confirmations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid pk | |
| `absence_id` | uuid not null → `driver_absences(id)` | |
| `confirmed_by` | uuid not null → `auth.users(id)` | |
| `confirmed_at` | timestamptz not null default now() | |
| audit columns | | |

Index `(absence_id, confirmed_at desc)`. Written only by `confirm_driver_leave`, which sets
`driver_absences.snoozed_until = today + stale_leave_snooze_days` in the same transaction.

## New: `driver_role_changes`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid pk | |
| `driver_id` | uuid not null → `drivers(id)` | |
| `from_role` | `driver_kind` not null | |
| `to_role` | `driver_kind` not null | `check (from_role <> to_role)` |
| `changed_by` | uuid not null → `auth.users(id)` | |
| `changed_at` | timestamptz not null default now() | |
| audit columns | | `deleted_at` set when undone (withdrawn) |

Index `(driver_id, changed_at) where deleted_at is null`. No backfill (FR-062).

**Role on a date** (`roleOn`): see research R8.

## Unchanged but affected: `unit_assignments`

`validate_unit_assignment` also refuses `driver_absent_on(driver_id, service_date)`. Releases by
`save_driver_absence` soft-delete rows dated today or later. The lock for rows with a remittance is
unchanged and aborts the save.

## Availability on a date (TypeScript, `availability(date)`)

A driver is available when `is_active`, `license_expiry_date >= date`, no absence covers `date`, and
no saved assignment that date (on another unit). Hidden counts are grouped as follows, first match
wins in this order: Inactive → On day-off or leave → Licence expired → Already assigned.
