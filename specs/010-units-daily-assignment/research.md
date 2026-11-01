# Research: Units Daily Assignment, Archiving, and Blocked Units

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-01

The Technical Context had no open unknowns. Each item below records a design choice the spec leaves
to planning, checked against the current code and migrations.

## R1. A new `unit_assignments` table instead of reusing `driver_assignments`

**Decision**: Add a new table, `public.unit_assignments` (`unit_id`, `service_date`, `driver_id`, `notes`,
plus the audit columns), with two partial unique indexes on active rows: `(unit_id, service_date)` and
`(driver_id, service_date)`. Also add a `service_date` index. `driver_assignments` and `driver_days_off`
stay as they are, read-only, for history.

**Rationale**: `driver_assignments` models date ranges (primary, with `ends_on` null for "current"),
with gist exclusion constraints, a backup shape check, and a day-off reason. A one-day-per-row
record with two plain unique keys is a different shape. Folding it in would mean another
`assignment_type`, more check branches, and constraints that only apply to some rows. A separate
table keeps the 1:1-per-day rule as two simple unique indexes, so the database enforces FR-013 even when
two saves race.

**Alternatives considered**: (a) Adding `assignment_type = 'daily'` to `driver_assignments`: it mixes
two lifecycles and risks the existing exclusion constraints and `validate_driver_assignment`. (b) Storing
the driver on `units` with a date: one row can't hold history or future plans.

## R2. Saving goes through one SQL function, `save_unit_assignment`

**Decision**: Add `public.save_unit_assignment(p_unit_id uuid, p_service_date date, p_driver_id uuid,
p_notes text, p_expected_updated_at timestamptz default null) returns unit_assignments`. It's
`security invoker`, so RLS applies, and EXECUTE is granted to `authenticated`, because the app calls it.

- With no `p_expected_updated_at`, it inserts. If the unit already has an active row for the date, it
  raises `P0001`, "This unit was just assigned by someone else. Reload to see it." A clash on the
  driver index raises `23505`, which the app maps to "Driver already assigned today".
- With `p_expected_updated_at`, it updates the active row for (unit, date) only if `updated_at` matches.
  Otherwise it raises the stale-record error. This is FR-018's overwrite.

A `BEFORE INSERT OR UPDATE` trigger, `validate_unit_assignment`, does every check, so a direct table
write through the API gets the same rules:
- the unit isn't deleted or archived, and exists on the date (R5)
- the unit isn't blocked on the date (R4)
- the driver is active, not deleted, and has a licence valid on the date
- for an update or soft delete, there's no active remittance for (old unit, old date) (R7)

**Rationale**: supabase-js `upsert` can't target a partial unique index. An `INSERT … ON CONFLICT` inside a
function can, but silently overwriting another person's save hides a conflict the user should see. The
explicit insert-or-update split matches the card's states: an unsaved card inserts, and an "Edit
assignment" card updates with the `updated_at` it showed. Running as invoker keeps the constitution's
rule that a function the app calls doesn't bypass RLS.

**Alternatives considered**: Plain `insert`/`update` from the server action: workable, but the error
mapping and the stale check would be repeated in two places, and API writes would differ. A
`security definer` function isn't needed, because RLS already gives approved users write access (R9).

## R3. Status history gets its own table, `unit_status_changes`

**Decision**: Add a new table, `public.unit_status_changes` (`unit_id`, `from_status` nullable, `to_status`,
`effective_on date`, `changed_at`, `changed_by`, plus the standard business-row columns `created_at`,
`created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`, with the `set_audit_fields` and
`reject_hard_delete` triggers, as CLAUDE.md and constitution III require). Rows are never updated or
soft-deleted by the app. The extra columns keep the table under the same rules as every business table. An `AFTER INSERT OR UPDATE OF status`
trigger on `units` writes it. On insert, `from_status` is null. `effective_on` is
`(changed_at at time zone 'Asia/Manila')::date`. Approved users can read it. No role can write it
directly (no insert or update policy); only the trigger can.

**Backfill** (the same migration):
1. One row per past status change found in `audit_events`, where `entity_type = 'units'` and
   `changed_fields->'before'->>'status'` differs from `->'after'->>'status'`. These keep their original
   time and actor.
2. For FR-025: each non-deleted unit whose current status isn't `active`, and whose latest backfilled
   row doesn't have `to_status` equal to that status, gets a row from `active` to the current status,
   `changed_at = now()`, `changed_by` null. Its `effective_on` is the release date, so earlier dates
   aren't blocked.

**Status on a date** (FR-024): `public.unit_status_on(p_unit_id uuid, p_date date) returns unit_status`.
It returns `to_status` of the latest row with `effective_on <= p_date`. If there is none, it returns
`from_status` of the earliest row. If that's null too, it returns `active`. For a future date it returns
the current status, because no change can be dated in the future. A pure TypeScript twin,
`statusOn(changes, date)` in `lib/units/status-on.ts`, computes the same thing for the two board
builders from rows loaded once per page. A shared fixture table tests both.

**Rationale**: Today's status history comes from `audit_events`, which only owners can read. Staff need
blocking on the Remittances Daily view, and the database needs it in triggers. A small dedicated table
is the plain way to make it readable and indexable. It also replaces scanning the 100 latest audit rows
in `components/records/status-history.tsx`. Several changes on one day resolve to the last one
(the latest `changed_at`).

**Alternatives considered**: Granting staff read access on `audit_events` exposes every audited field.
A `security definer` reader over `audit_events` is slower, and `changed_fields` JSON can't be indexed by
date.

## R4. Blocking is checked in the database as well as the UI

**Decision**: `validate_unit_assignment` and the new remittance insert check (R6) both reject
`unit_status_on(unit, date) in ('in_repair', 'retired')`. The errors are "This unit is In repair on this
date. Set it to Active to assign a driver." and "…No remittance for this date.". The boards show blocked
cards from `statusOn`. Saved records on blocked dates are never touched (FR-027, FR-047).

**Rationale**: Without it, an API write or a stale screen could create an assignment or remittance on a
blocked day.

## R5. A unit's first day is its creation date

**Decision**: A unit exists on a date if `(created_at at time zone 'Asia/Manila')::date <= date`
(FR-011a). Both boards leave units out of dates before that, except a unit with a saved remittance on
that date (a legacy record). `validate_unit_assignment` and the remittance insert check reject dates
before it.

**Rationale**: `created_at` is already on every unit and can't be changed by the app. No new column is
needed.

## R6. How remittances link to the daily assignment

**Decision** (migration 3):
- `remittances.assignment_id` becomes nullable. Add `remittances.unit_assignment_id uuid references
  unit_assignments(id)`, with `check (num_nonnulls(assignment_id, unit_assignment_id) = 1)`. Existing rows
  keep their `assignment_id`.
- `validate_remittance()` is replaced:
  - **On INSERT**, it rejects a non-null `assignment_id` ("Driver assignments are now recorded per day on
    the Units page"). It then finds the active `unit_assignments` row for (`unit_id`, `service_date`), and
    requires it to exist ("Assign a driver to this unit for this date first") and to have the same
    `driver_id`. It also requires the unit not to be archived, not to be blocked (R4), and to exist on
    the date (R5). It then sets `unit_assignment_id`, then the `amount_due_centavos` rule as before.
  - **On UPDATE**, it does nothing beyond the existing rental rule. `lock_remittance_financial_facts`
    already freezes unit, driver, date, and `assignment_id`; it's extended to freeze
    `unit_assignment_id` too.
- `createRemittance` and `recordDailyRemittance` send `unit_id` + `driver_id` + `service_date` instead of
  `assignmentId`. The card already knows the unit and the assigned driver.

**Rationale**: Re-running the old check on UPDATE would break legacy rows once their primary assignment
stops being "active". Every payment change updates the remittance's `deposit_centavos` (feature 009),
which fires the update trigger. The check exists to guard creation. The facts lock already makes later
changes to the link impossible.

**Alternatives considered**: Pointing new remittances at a synthetic `driver_assignments` row keeps the
`NOT NULL` but writes fake history. Dropping the FK loses the link from a remittance to the assignment
it was saved under.

## R7. An assignment locks once its day has a remittance

**Decision**: `validate_unit_assignment`, on UPDATE (including setting `deleted_at`), raises `23514`,
"A remittance is already recorded for this day. The assignment can't be changed.", when an active
remittance exists for (`old.unit_id`, `old.service_date`). The release functions (R8) skip those rows.
When the remittance is reversed (`deleted_at` set), the lock lifts on its own. The board marks the card
`locked-by-remittance`, with no "Card options" menu.

## R8. Releasing assignments happens in database triggers

**Decision**: One internal function,
`public.release_unit_assignments(p_unit_id uuid default null, p_driver_id uuid default null)`. It soft-deletes
(`deleted_at = now()`, `deleted_by = auth.uid()`) every active `unit_assignments` row with
`service_date >= fleet today` for that unit or driver, skipping rows locked by a remittance (R7). It
writes one audit event per released row (the existing `audit_business_change` trigger on the table
covers this). It's called from:
- `AFTER UPDATE OF status ON units` when the new status is `in_repair` or `retired` (FR-029)
- `AFTER UPDATE OF archived ON units` when `archived` becomes true (FR-029)
- `AFTER UPDATE OF is_active, deleted_at ON drivers` when the driver is deactivated or archived (FR-029b)

The trigger functions are `security definer`. They fire `AFTER` the row update, so RLS has already let
the caller change the unit or driver, and they check `public.is_owner()` before doing anything, as the
"definer trigger before RLS" lesson requires. EXECUTE is revoked from `public`, `anon`, and
`authenticated`.

**The confirmations** (FR-030, FR-029b) are UI only. Before the change, the client calls
`upcomingAssignmentCount({ unitId } | { driverId })`, which counts releasable rows. If the count is above
0, it shows the confirmation. The release itself happens atomically with the status, archive, or
deactivation update.

**Feature 005's deactivation rule is replaced**: Migration 2 drops the trigger
`drivers_reject_deactivation_with_assignments` and its function. Legacy open primaries (`ends_on` null)
would otherwise block every deactivation forever, and FR-029b replaces that rule.

**Rationale**: Triggers cover every entry point (UI, API v1, future scripts), and the release can't be
lost between two requests.

## R9. Access and RLS

**Decision**:
- **`unit_assignments`**: approved users can SELECT, INSERT, and UPDATE (`is_approved_user()`). No
  DELETE (`reject_hard_delete`). `set_audit_fields` and `audit_business_change` triggers as on other
  tables. This is FR-056.
- **`unit_status_changes`**: approved users can SELECT. There are no write policies.
- **`units`**: the existing policies already make INSERT and UPDATE owner-only, so archive, restore,
  status, and details stay owner-only at the database too (FR-057). `soft_delete_record('units', …)` now
  raises "Units are archived, not deleted" (FR-008, FR-032).
- **`driver_assignments`, `driver_days_off`**: their owner insert and update policies are dropped, so
  nobody can create or change them (FR-049). SELECT stays.
- **The app**: `/units` reads the role. Staff get the Daily assignment view only (no toggle, list, or
  dialogs, and no "Open unit" link). `/units/[id]` calls `requirePermission("manage_master_data")`. The
  navigation item stays `access: "approved"`.

## R10. The Units page uses one URL with soft navigation

**Decision**: `/units?view=list|daily&date=YYYY-MM-DD`. List view is the default for the owner. Staff are
always on `daily`. The toggle and the date controls call `router.push(…, { scroll: false })`. That's a
client-side navigation with no full document reload, the same pattern as `components/remittances/
view-toggle.tsx` (feature 008), so it meets FR-001. The Remittances "Assign driver" link is
`/units?view=daily&date=<date>`. Opening the view from the toggle always lands on today (FR-009).

`DateControl` is moved to `components/ui/date-control.tsx`, and gets `allowFuture` (no `max`, next is
always enabled) and an "Upcoming" tag for dates after today. Remittances keeps `allowFuture = false`.

## R11. Pre-fill comes from one read function

**Decision**: `public.latest_unit_assignments_before(p_date date)` returns
`table(unit_id, driver_id, service_date)`. It's `security invoker`, granted to `authenticated`, and selects
`distinct on (unit_id)` active rows with `service_date < p_date`, ordered by `service_date desc`. It's
only called for future dates. The pure board builder applies FR-021: no pre-fill for blocked units,
saved cards, drivers saved elsewhere that date, or ineligible drivers. A pre-fill is client state only
(FR-022).

**Alternatives considered**: One query per unit (12 round trips), or loading a whole history window
(unbounded).

## R12. Archiving uses new columns, not `deleted_at`

**Decision**: Add `units.archived boolean not null default false`, `archived_at timestamptz`, and
`archived_by uuid references auth.users(id)`, with `check (archived = (archived_at is not null))`. A
BEFORE trigger sets or clears `archived_at` and `archived_by` when `archived` changes. Add the index
`units (archived) where deleted_at is null`.

- **Archive and restore** are owner updates of `archived`, through `archiveUnit` and `restoreUnit` with an
  `updated_at` check. Archiving fires the R8 release.
- **Archived units are hidden from**: the Units list (unless "Show archived"), both daily boards, and
  pickers for new records (expense, maintenance, part, tire, document forms, and the API's create
  validation is unchanged). Owners restore a unit to record against it. This is recorded in the
  spec's Assumptions ("Archived units and new records"); it keeps archived units out of daily work.
- **Archived units stay in**: the Remittances List view, record details, reports (feature 009's unit
  list shows them with "(archived)"), and the dashboard history. Dashboard "units on the road" counts
  exclude them.
- **The archive modal's counts** come from `archiveSummary(unitId)` (owner): today's driver, plus
  `count` on `unit_assignments` (active), `remittances` (active), `expenses` (active), `documents`
  (active), and `audit_events` for the unit. These are head-only count queries.

**Rationale**: `deleted_at` rows are hidden by RLS and dropped from reports. Archiving must keep
everything visible in history.

## R13. The release-day seed runs inside migration 3

**Decision**: The last step of migration 3 inserts one `unit_assignments` row per non-deleted, non-blocked
unit for `d = (now() at time zone 'Asia/Manila')::date`. The driver is the primary covering `d`. If
that primary has a `driver_days_off` row for `d`, it's the backup whose `driver_assignments` row
covers that day off instead, and if there's no backup the unit gets no row. It needs the driver to be eligible on `d` (active, licence ≥ d), uses `on conflict do nothing` for both
unique indexes, and sets `created_by` null with `notes` null.

**Ordering**: the seed runs after `unit_status_changes` is backfilled, so blocked units are skipped. It
runs with triggers enabled, so each row is audited like any insert.

**Operational note**: The migration must be applied on the release morning, the same fleet day the app
deploys. If it's applied on an earlier day, that day gets seeded instead, and the owner assigns release
day by hand (pre-fill helps). `quickstart.md` records this.

## R14. UI building blocks

**Decision**: Add the shadcn `base-nova` components `dialog`, `checkbox`, and `tooltip`, which is already
present. They're all built on `@base-ui/react`, so no new library. Add a small `components/ui/toast.tsx`
on Base UI's `Toast` primitive for "Unit added", "Unit archived", and "Unit restored". It uses
`role="status"` and design tokens. sonner (shadcn's default toast) is a new library and isn't allowed.

- **Menus**: use the existing `dropdown-menu.tsx`. Base UI positioning flips upward on its own near the
  viewport bottom (FR-007), with `collisionAvoidance` left at its default.
- **The archive modal**: uses `alert-dialog.tsx`, which already gives focus trapping, Escape, and initial
  focus (set on Cancel).
- **The card grid**: reuses the Remittances Daily view's grid (`desk` breakpoint). DESIGN.md's card
  exception is extended to the assignment cards.

## R15. Code that's retired

**Decision**: Remove:
- `app/actions/assignments.ts` (createPrimaryAssignment, endPrimaryAssignment, recordDayOff,
  assignBackupDriver)
- `components/forms/assignment-forms.tsx`
- `components/remittances/assign-backup-picker.tsx`
- the day-off and coverage parts of `lib/assignments/coverage.ts`, `current-drivers.ts`, and the
  remittance board

API v1 `assignments` and `driver-days-off` become read-only (no create or update fields). A new
read-only `unit-assignments` resource lists rows by `unit_id`, `driver_id`, and `service_date`. API writes
for daily assignments aren't added in this feature.

The driver detail page keeps its primary, day-off, and backup history tables read-only, and adds an
"Assignment history" list from `unit_assignments`. Its "current unit" and the dashboard's
driver-to-unit figures read today's `unit_assignments`.
