# Database Contract: Feature 012

Migrations: `20261102000100_driver_absences.sql`, `20261102000200_driver_role_history.sql`.
Tables and columns are in [data-model.md](../data-model.md).

## RLS

| Table | Select | Insert | Update | Delete |
|-------|--------|--------|--------|--------|
| `driver_absences` | approved, `deleted_at is null` | approved | approved, `deleted_at is null` | none (`reject_hard_delete`) |
| `driver_absence_confirmations` | approved | approved | none | none |
| `driver_role_changes` | approved, `deleted_at is null` | none (through the function only) | none (through the function only) | none |
| `drivers` | unchanged (approved read, owner insert/update) | | | |

`revoke all ... from anon` on every new table.

## Functions

| Function | Security | EXECUTE | Caller check | Purpose |
|----------|----------|---------|--------------|---------|
| `driver_absent_on(p_driver_id uuid, p_date date) returns boolean` | definer, stable | none | n/a (trigger helper) | Coverage rule (R3) |
| `validate_driver_absence()` trigger | definer | none | skips unapproved | Data-model trigger rules |
| `validate_unit_assignment()` trigger (replaced) | definer | none | unchanged | Adds the absence refusal |
| `save_driver_absence(p_id uuid, p_driver_id uuid, p_type driver_absence_type, p_start date, p_end date, p_reason driver_absence_reason, p_note text, p_release_ids uuid[], p_expected_updated_at timestamptz) returns driver_absences` | **definer** | authenticated | `is_approved_user()` | Insert (`p_id` null) or edit, plus release (R5). Definer because a soft-deleted assignment fails the read policy |
| `cancel_driver_absence(p_id uuid, p_expected_updated_at timestamptz) returns driver_absences` | invoker | authenticated | RLS | Upcoming only |
| `end_driver_absence(p_id uuid, p_expected_updated_at timestamptz, p_cancel_upcoming boolean default false) returns driver_absences` | invoker | authenticated | RLS | Covers-today only. Optionally cancels upcoming ones |
| `confirm_driver_leave(p_id uuid) returns driver_absences` | invoker | authenticated | RLS | Open-ended and covering today only. Logs the confirmation and snoozes |
| `set_driver_role(p_driver_id uuid, p_to_role driver_kind, p_expected_updated_at timestamptz) returns uuid` | **definer** | authenticated | `is_approved_user()` | Updates `driver_kind` and inserts history. Returns the change id (null if unchanged) |
| `undo_driver_role_change(p_change_id uuid) returns void` | **definer** | authenticated | `is_approved_user()`, same caller, latest change, ≤ 60 s | Reverts and withdraws |
| `lock_inactive_driver_details()` trigger (replaced) | invoker | none | n/a | `driver_kind` removed from the locked fields |

All new functions: `set search_path = public`, `revoke execute ... from public, anon, authenticated`
first, then grant as listed.

## Error messages (raised by the database, shown as is)

| Code | When | Message |
|------|------|---------|
| 23514 | Absence for an Inactive driver | `Inactive drivers cannot have absences` |
| 23514 | Overlap (friendly pre-check) | `[Name] is already on day-off Nov 5.` / `[Name] is already on leave Nov 5 to Nov 9.` / `[Name] is already on leave from Nov 1 (no end date).` |
| 23P01 | Overlap (race, exclusion) | mapped in app: `This driver already has an absence on these dates. Reload to see it.` |
| 23514 | `end_date < start_date` | `The To date must be on or after the From date.` |
| 23514 | Day-off with a different end date | `A day-off covers one date.` |
| 23514 | Editing a finished absence | `This absence is finished and can't be edited.` |
| 23514 | Active-now end date before today | `The end date can't be before today. Use End early to stop the leave today.` |
| P0001 | Release list mismatch | `Assignments for these dates changed. Review them again.` |
| 23514 | Release would hit a locked assignment | `[Unit] on [date] already has a remittance, so this assignment can't be released.` |
| 23514 | Assignment for an absent driver | `This driver is absent on this date. Choose another driver.` |
| 23514 | Cancel a non-upcoming absence | `Only upcoming absences can be cancelled. Use End early for one that has started.` |
| 23514 | End early when it doesn't cover today | `Only an absence that covers today can be ended early.` |
| 23514 | Confirm on a leave that isn't open-ended and current | `Only a current open-ended leave can be marked as still on leave.` |
| P0001 | Stale `updated_at` | `This absence was changed by someone else. Reload to see it.` / `This driver was changed by someone else. Reload to see it.` |
| P0001 | Undo not allowed | `This change can no longer be undone.` |

## pgTAP coverage

- `constraints/340_driver_absences.sql`:
  - shape, enums, checks
  - the exclusion constraint (overlap, back-to-back allowed, cancelled and ended-early ranges free)
  - `driver_absent_on` cases
  - Inactive refusal
  - finished-absence edit refusal
  - assignment refused for an absent driver, allowed the day after
- `constraints/350_driver_absence_release.sql`:
  - save with release (assignments soft-deleted, past untouched)
  - list mismatch refusal
  - locked refusal leaves both the absence and the assignment unsaved
  - edit releases only newly covered dates
  - cancel, end early (with and without cancelling upcoming)
  - confirm sets `snoozed_until` from settings and logs a row
- `constraints/360_driver_role_history.sql`:
  - switch writes history, a no-op on the same role
  - an Inactive driver can switch
  - undo reverts and withdraws, refused for another user, a non-latest change, or after 60 s
  - details are still locked for Inactive drivers
- `rls/230_driver_absences_rls.sql`:
  - owner and staff can do each action, unapproved users and anon can't
  - staff still can't update `drivers` directly
  - function EXECUTE grants match this table
- Updated existing tests: the function-execute inventory (`rls/120`) and any assignment tests whose
  fixtures now need absence-free drivers (expected: none change behaviour).
