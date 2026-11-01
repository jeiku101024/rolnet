---

description: "Task list for feature 010: Units Daily Assignment, Archiving, and Blocked Units"
---

# Tasks: Units Daily Assignment, Archiving, and Blocked Units

**Input**: Design documents from `specs/010-units-daily-assignment/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. CLAUDE.md requires lint, typecheck, and tests to pass for every task, plus pgTAP coverage for schema changes. Write each story's tests first and confirm they fail.

**Organization**: Tasks are grouped by user story (US1 to US7 from spec.md), so each story can be built, tested, and demonstrated on its own once Phase 2 is done.

**Hard rules for every task** (CLAUDE.md, constitution 1.1.0, memory):
- **Schema**: schema, RLS, and SQL functions change only in the three new migrations named below, each with pgTAP coverage. Never edit a pushed migration.
- **Grants**: new `public` functions start with `revoke execute … from public, anon, authenticated`. Only `save_unit_assignment` and `latest_unit_assignments_before` get `grant execute … to authenticated`. `security definer` trigger functions check `public.is_owner()` or `public.is_approved_user()` before writing.
- **rolnet-dev needs the user's approval**: pushing migrations to rolnet-dev and running pgTAP there needs the user's explicit approval (there's no local Supabase). Ask before T013. Run the **full** pgTAP suite, not only the new files.
- **Fleet date**: it's `(now() at time zone 'Asia/Manila')::date` in SQL and `fleetToday()` in TypeScript.
- **No soft delete for units**: units are never soft-deleted in app flows. Released assignments are soft-deleted (`deleted_at`), never hard-deleted.
- **UI**: no new npm packages. Use shadcn `base-nova` components on `@base-ui/react` and tokens only (no hex or arbitrary sizes). Every screen must work at 360 px.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1 to US7)

---

## Phase 1: Setup

- [X] T001 Confirm branch `010-units-daily-assignment` (cut from `main` at 95a5c94) is checked out and `.specify/feature.json` points to `specs/010-units-daily-assignment`
- [X] T002 [P] Add the shadcn `base-nova` `dialog` and `checkbox` components with `corepack pnpm dlx shadcn@latest add dialog checkbox`, giving `components/ui/dialog.tsx` and `components/ui/checkbox.tsx`. Confirm `package.json` gains no dependency, and swap any non-token classes for tokens from `app/globals.css`
- [X] T003 [P] Create `components/ui/toast.tsx` on `@base-ui/react`'s `Toast` primitive (research R14). It exports a `ToastProvider` and `useToast()` returning `toast(message: string)`, with a polite live region, bottom-center on phones and bottom-right from 768 px, and a 4 s auto-dismiss. Mount `ToastProvider` in `app/layout.tsx`
- [X] T004 [P] Move `components/remittances/date-control.tsx` to `components/ui/date-control.tsx` and add an `allowFuture?: boolean` prop. When true, the calendar has no `max`, "Next day" is never disabled, and dates after `today` show `<span className="status-badge …">Upcoming</span>`. Remittances keeps the default (false). Update imports in `components/remittances/daily-view.tsx` and `tests/unit/*`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The three migrations, regenerated types, the shared status logic, and the remittance write path that migration 3 forces. Every story depends on these.

**⚠️ CRITICAL**: No user story work starts until this phase is complete. Migration 3 changes how remittances are inserted, so T014 must land with the migrations.

### Database tests first

- [X] T005 [P] Write `supabase/tests/constraints/280_unit_assignments.sql` (contracts/database.md, migration 1). It must check:
  - Two active rows can't share `(unit_id, service_date)` or `(driver_id, service_date)`. Both raise `23505`.
  - A soft-deleted row frees both keys.
  - `save_unit_assignment` inserts when `p_expected_updated_at` is null and raises `P0001` "This unit was just assigned by someone else. Reload to see it." when an active row exists. It updates when the timestamp matches and raises the "changed by someone else" `P0001` when it doesn't. A null driver raises `22023` "Choose a driver first".
  - Saving is refused (`23514`, the exact messages in contracts/database.md) for:
    - an archived unit
    - a date before the unit's fleet creation day
    - a unit whose `unit_status_on` is `in_repair` or `retired` on that date
    - an inactive or deleted driver
    - a driver whose `license_expiry_date < service_date`
  - With an active remittance for (unit, date), updating `notes` or `driver_id`, or setting `deleted_at`, raises "A remittance is already recorded for this day. The assignment can't be changed." After `reverse_remittance`, the same update succeeds.
  - Changing `unit_id` or `service_date` on update is refused.
  - `latest_unit_assignments_before(d)` returns one row per unit, the latest `service_date < d`, ignoring released rows.
  - Hard delete is refused.
  - `validate_unit_assignment()` has no EXECUTE for `anon` or `authenticated`. `save_unit_assignment` and `latest_unit_assignments_before` have EXECUTE for `authenticated` only.
- [X] T006 [P] Write `supabase/tests/constraints/290_unit_status_blocking.sql` (research R3, R4). It must check:
  - Inserting a unit writes a `unit_status_changes` row with `from_status` null.
  - Updating `status` writes `from_status`/`to_status`, `changed_by = auth.uid()`, and `effective_on` = the Manila date of `changed_at` (test 23:30 Manila is still that day).
  - `unit_status_on` returns the latest `to_status` with `effective_on <= d`, the earliest `from_status` before the first change, and `active` with no rows. Two changes on one day resolve to the later one.
  - The backfill produced rows for the audited status changes, and every non-active unit has a latest row ending in its current status (FR-025 invariant).
  - `unit_status_changes` can't be inserted or updated by `authenticated`. It has `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, and `deleted_by`, and a hard delete is refused (constitution III).
  - `unit_status_on` ignores soft-deleted rows.
  - `unit_status_on` has no EXECUTE for `anon` or `authenticated`.
- [X] T007 [P] Write `supabase/tests/constraints/300_unit_archive_release.sql` (research R8, R12). It must check:
  - Setting `archived = true` sets `archived_at` and `archived_by`. Setting it to false clears all three. The check `archived = (archived_at is not null)` holds.
  - Setting a unit to `in_repair`, to `retired`, or archiving it soft-deletes its assignments with `service_date >= fleet date`, keeps earlier ones, and keeps any day with an active remittance.
  - Returning the unit to `active` or restoring it brings nothing back.
  - For a unit with remittances, payments, and expenses, the sums of `remittances.amount_due_centavos`, `allowance_centavos`, `deposit_centavos`, active payments, and `expenses.amount_centavos` are identical before and after archive, restore, a status change to `in_repair`, and back to `active` (SC-004, FR-052).
  - Setting a driver `is_active = false`, or setting `deleted_at`, releases that driver's rows from the fleet date on, under the same exceptions.
  - Deactivating a driver who has an open legacy primary assignment now succeeds (the feature-005 block is dropped).
  - `soft_delete_record('units', id)` raises `22023` "Units are archived, not deleted. Use Archive."
  - The release functions have no EXECUTE for `anon` or `authenticated`. `release_unit_assignments` raises when not `is_owner()`.
- [X] T008 [P] Write `supabase/tests/constraints/310_remittance_unit_assignments.sql` (research R6, R13). It must check:
  - A remittance insert with `assignment_id` raises "Driver assignments are now recorded per day on the Units page."
  - An insert with no matching assignment raises "Assign a driver to this unit for this date first."
  - A different driver raises "This unit is assigned to another driver on this date. Reload the page."
  - An archived unit, a blocked date, or a date before the unit existed is refused with the contract messages.
  - A valid insert sets `unit_assignment_id`.
  - `num_nonnulls(assignment_id, unit_assignment_id) = 1` holds for every row.
  - A legacy remittance (with `assignment_id`) still accepts a payment, and its `deposit_centavos` updates.
  - Changing `unit_assignment_id` is refused by the facts lock.
  - `driver_assignments` and `driver_days_off` refuse inserts and updates from `authenticated` owners (RLS).
  - The release-day seed left at most one active row per unit and per driver for the seed date, and none for blocked units.
  - The seed rule, exercised with fixture rows (a primary with no day off, a primary off with a backup, a primary off with no backup): the seeded driver is the primary, then the backup, then no row.
- [X] T009 [P] Write `supabase/tests/rls/210_unit_assignments_rls.sql` (FR-056, FR-057, research R9). It must check:
  - An approved staff user can select, insert (through `save_unit_assignment`), and update rows in `unit_assignments`, and can select `unit_status_changes`.
  - Staff updates to `units` are refused or affect 0 rows: `status`, `archived`, `name`, `body_number`, `plate_number`, `make_model`.
  - Staff can't insert or update `unit_status_changes`, `driver_assignments`, or `driver_days_off`.
  - Staff calling `soft_delete_record` is refused.
  - Pending or rejected users and `anon` can't read or write `unit_assignments` or `unit_status_changes`.

### Migrations

- [X] T010 Write `supabase/migrations/20261101000100_unit_assignments.sql` per data-model.md and contracts/database.md, migration 1:
  - **Table**: `unit_assignments` with `notes text` checked `length(trim(notes)) <= 500`.
  - **Indexes**: `unit_assignments_unit_date_unique` and `unit_assignments_driver_date_unique` (unique, partial on `deleted_at is null`), and `unit_assignments_date_idx`.
  - **Triggers**: `set_audit_fields`, `reject_hard_delete`, and a business audit trigger created as in `20261027000100_add_complete_business_audit.sql`.
  - **RLS**: select, insert, and update policies using `public.is_approved_user()`.
  - **Functions**:
    - `validate_unit_assignment()`, a BEFORE INSERT OR UPDATE trigger, `security definer`, `set search_path = public`, with the rules in the data-model order. Its blocked check calls `public.unit_status_on`, so create a stub `unit_status_on` here that returns the unit's current status, replaced in migration 2.
    - `save_unit_assignment(...)`, `security invoker`.
    - `latest_unit_assignments_before(date)`, `stable`, `security invoker`, using `distinct on (unit_id)`.
  - **Grants**: revoke and grant exactly as contracts/database.md lists.
  - Ask the user before pushing anything to rolnet-dev.
- [X] T011 Write `supabase/migrations/20261101000200_unit_status_history_and_archive.sql` per contracts/database.md, migration 2:
  - **Status history**: the `unit_status_changes` table with the standard `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, and `deleted_by` columns and the `set_audit_fields` and `reject_hard_delete` triggers, its index (partial on `deleted_at is null`), and RLS (select only, `is_approved_user()`). `record_unit_status_change()` is an AFTER INSERT OR UPDATE OF status trigger, definer, that sets `effective_on = (changed_at at time zone 'Asia/Manila')::date`.
  - **Backfill**: from `audit_events` (`entity_type = 'units'`, before/after `status` differ, keeping `occurred_at` as `changed_at` and `actor_user_id` as `changed_by`), then the FR-025 rows (`active` → current status, `changed_at = now()`, `changed_by` null) for non-active units lacking a matching latest row.
  - **`unit_status_on`**: replace the stub with the real function per research R3.
  - **Archive**: the `units.archived` / `archived_at` / `archived_by` columns, the check, `units_archived_idx`, and `set_unit_archive_fields()` (BEFORE UPDATE OF archived).
  - **Release**: `release_unit_assignments(...)` (definer, requires `is_owner()`, skips days with an active remittance, returns the count). Triggers `release_on_unit_change()` on units and `release_on_driver_change()` on drivers.
  - **Feature-005 block**: drop the trigger `drivers_reject_deactivation_with_assignments` and the function `reject_driver_deactivation_with_assignments()`.
  - **`soft_delete_record`**: `create or replace` it, copying the body from `20261029001400_reject_unit_delete_with_open_assignments.sql` but replacing the units branch with the `22023` refusal.
  - **Grants**: revoke every new function from `public`, `anon`, and `authenticated`.
- [X] T012 Write `supabase/migrations/20261101000300_remittances_use_unit_assignments.sql` per contracts/database.md, migration 3:
  - **Remittance columns**: `alter remittances.assignment_id drop not null`. Add `unit_assignment_id uuid references public.unit_assignments(id)`, the `num_nonnulls` check, and the `remittances_unit_assignment_idx` index.
  - **`validate_remittance()`**: replace it, keeping `security definer`. INSERT gets the full rule set and the rental rule. UPDATE keeps only the rental rule.
  - **`lock_remittance_financial_facts()`**: replace it, copying the latest body from `20261031000100_remittance_financials.sql` and adding `unit_assignment_id`.
  - **Legacy write policies**: drop `assignments_owner_insert_policy` and `assignments_owner_update_policy`, plus the `driver_days_off` owner insert and update policies (read their names from `20261019001700_add_driver_days_off_rls.sql`).
  - **Seed**: last, the release-day seed per research R13. For the fleet date, use the primary. If the primary has a day off that day, use the backup covering it, or insert no row if there's no backup. The driver must be eligible and the unit not blocked. Use `on conflict do nothing`.
- [X] T013 With the user's approval, push the three migrations to rolnet-dev and run the **full** pgTAP suite through the rollback wrapper. Update the existing tests that insert legacy assignments or remittances, or expect the dropped deactivation block, until everything passes:
  - `supabase/tests/constraints/030_remittances.sql`, `110_delete_restore.sql`, `170_assignment_lifecycle.sql`, `240_unit_delete_and_license_sync.sql`, `250_status_locking.sql`, `270_remittance_financials.sql`
  - `supabase/tests/rls/010_units_drivers_rls.sql`, `030_remittances_rls.sql`, `100_master_data_crud_rls.sql`, `140_remittance_facts_locked_rls.sql`, `200_remittance_financials_rls.sql`

  Fixtures create remittances through a `unit_assignments` row. Then regenerate `types/database.ts` with `corepack pnpm exec supabase gen types typescript --linked > types/database.ts`.

### Shared app code

- [X] T014 Switch the remittance write path to daily assignments (contracts/actions.md):
  - **`lib/validation/remittances.ts`**: replace `assignmentId` with `unitId: z.string().uuid()` and `driverId: z.string().uuid()` in both schemas.
  - **`app/actions/remittances.ts`**: `createRemittance` and `recordDailyRemittance` insert `unit_id`, `driver_id`, and `service_date` with no `assignment_id`, and drop the `driver_assignments` lookups. Labels change to "driver assignment for this date".
  - **`lib/actions/errors.ts`**: map `23505` on `unit_assignments_driver_date_unique` to code `DRIVER_TAKEN` with "Driver already assigned today", and on `unit_assignments_unit_date_unique` to the "just assigned by someone else" message. Pass through the new `23514`, `22023`, and `P0001` messages.
- [X] T015 [P] Write `tests/unit/status-on.test.ts` covering `statusOn` and `existsOn` with the same cases as T006 (no rows, before the first change, same-day changes, future date = current status, an 23:30 Manila `created_at`). Then implement `lib/units/status-on.ts`:
  - `statusOn(changes: { from_status: UnitStatus | null; to_status: UnitStatus; effective_on: string; changed_at: string }[], date: string): UnitStatus`
  - `existsOn(createdAt: string, date: string): boolean`, using `lib/dates/fleet-date.ts` for the Manila date
- [X] T016 [P] Write `tests/unit/units-view-params.test.ts`, then implement `lib/units/view-params.ts` with:
  - `parseUnitsView(params, today, isOwner)` → `{ view: "list" | "daily", date }`. Staff are always `daily`. An invalid `date` falls back to today. Future dates are allowed.
  - `unitsDailyHref(date?)` and `unitsListHref()`
- [X] T017 Update `lib/demo/mode.ts` for the new model:
  - `demoUnitAssignmentsDaily` (rows for the last 7 days and today across the demo units, with a free driver left over)
  - `demoUnitStatusChanges` (one unit `active` → `in_repair` 3 days ago)
  - one archived demo unit (`archived: true`, `archived_at`)
  - `driver_kind` on demo drivers

  Keep the existing exports that later tasks still read. Remove `demoUnitDaysOff` and `demoBackupAssignments` once T037 lands.

**Checkpoint**: The migrations are applied on rolnet-dev, the full pgTAP suite passes, types are regenerated, and `corepack pnpm typecheck` passes.

---

## Phase 3: User Story 1 - Assign a driver to each unit for the day (Priority: P1) 🎯 MVP

**Goal**: The Units page toggle opens a Daily assignment view where the owner or staff save one driver per unit per date, with save-and-lock and edit.

**Independent Test**: With 3 units and 3 drivers on today, save driver A on unit 1: the card locks, the header reads "1 of 3 units assigned", and driver A is missing from the other dropdowns. Edit to driver B: driver A returns (spec US1).

### Tests for User Story 1

- [X] T018 [P] [US1] Write `tests/unit/assignment-board.test.ts` for `buildAssignmentBoard`. It must check:
  - One card per non-archived unit existing on the date, sorted by name.
  - `saved` cards carry `assignmentId`, `driverId`, `notes`, and `updatedAt`.
  - `locked` when a remittance exists for the unit and date.
  - Each open card's `options` exclude drivers saved on other units but include the card's own driver, and exclude inactive drivers and drivers with an expired licence.
  - Option labels read "NAME (Primary)" or "NAME (Backup)" from `driver_kind`.
  - `assigned` counts saved and locked cards. `assignable` excludes blocked cards.
  - `isToday` and `isFuture` are set.
- [X] T019 [P] [US1] Write `tests/e2e/units-daily-assignment.spec.ts` (demo build, 1280 px and 360 px). Demo mode has no write path, so it checks only pre-seeded demo state (T017) and client-side behaviour. It must check:
  - The toggle switches to Daily with no document reload (assert the `performance.navigation` entry count is unchanged).
  - The date shows "Sunday, November 1, 2026"-style text with the "Today" tag, and the "N of M units assigned" count matches the demo data.
  - A pre-seeded saved card shows "Assigned", "Saved", disabled inputs, and a "Card options" menu. "Edit assignment" unlocks it, and Cancel locks it again.
  - On a past date, "Edit assignment" asks "You are editing an assignment from …. Continue?" the first time only, in the same session.
  - An open card's dropdown omits the drivers saved on other demo cards and labels options "(Primary)" or "(Backup)".
  - Save with no driver gives "Choose a driver first". This is client validation and doesn't call the server.
  - At 360 px there's one card per row and no horizontal scroll.

  The save, "Driver already assigned today", and overwrite flows are covered by T005, T018, T022's unit tests, and the T062 walkthrough.

### Implementation for User Story 1

- [X] T020 [US1] Implement `lib/units/assignment-board.ts`: a pure `buildAssignmentBoard({ date, today, rows, prefill? })` returning `{ date, today, isToday, isFuture, cards, assigned, assignable }`. The card kinds are `open | saved | locked | blocked` (data-model.md "Assignment board card"). Blocked cards use `statusOn`, and the blocked kind is completed in US4. Make T018 pass.
- [X] T021 [US1] Implement `lib/units/assignment-query.ts` `loadAssignmentRows(supabase | null, date)`. It runs these reads in parallel:
  - units: `id, name, body_number, plate_number, make_model, status, created_at`, filtered by `archived = false` and `deleted_at is null`
  - `unit_status_changes` for those units
  - active `unit_assignments` for `service_date = date`, with `drivers(full_name, driver_kind)`
  - active remittances for the date (`unit_id` only)
  - eligible drivers: `id, full_name, driver_kind, is_active, license_expiry_date`, filtered by `is_active = true` and `license_expiry_date >= date`

  A `null` client returns the demo data from T017.
- [X] T022 [US1] Create `lib/validation/unit-assignments.ts`: `saveUnitAssignmentSchema` with `unitId` uuid, `serviceDate` `YYYY-MM-DD`, `driverId` uuid or null, `notes` string trimmed with a max of 500 that defaults to "", and an optional `expectedUpdatedAt` ISO string. Then create `app/actions/unit-assignments.ts`:
  - `saveUnitAssignment` uses `requirePermission("encode_operations")` and calls `rpc("save_unit_assignment")`. A null driver gives the field error "Choose a driver first". `DRIVER_TAKEN` passes through. It revalidates `/units` and `/remittances`.
  - `upcomingAssignmentCount({ unitId } | { driverId })` uses `requirePermission("manage_master_data")`.

  Demo mode has no write path, so there's nothing demo-specific to add. The demo e2e tests only read pre-seeded demo state, and these actions are covered by unit tests and pgTAP.
- [X] T023 [P] [US1] Create `components/units/units-view-toggle.tsx`: a `SegmentedToggle` labelled "Units view" with "List view" and "Daily assignment view". It switches with `router.push(..., { scroll: false })`, and Daily always opens on today (FR-001, FR-009).
- [X] T024 [US1] Create `components/units/assignment-card.tsx` (contracts/ui.md "Card"):
  - **Title and subheader**: the unit name and "BODY · PLATE · MOTORCYCLE", both truncated with a `Tooltip`.
  - **Inputs**: an "Assign driver" `Select` (from `components/ui/form-field`) and a "Notes" input.
  - **Footer states**:
    - open: "Save assignment"
    - saved: disabled inputs, `bg-canvas` muted, an "Assigned" `StatusBadge`, "Saved" with a lucide `Lock`, and a "Card options" `DropdownMenu` with "Edit assignment"
    - editing: "Save assignment" and "Cancel", sending `expectedUpdatedAt`
    - locked: no menu, plus "A remittance is already recorded for this day."
  - **Errors**: inline. On `DRIVER_TAKEN` the selection resets to empty.
  - **No options**: when the card has no available drivers, the select shows "No available drivers" and "Save assignment" is disabled.
  - **Past-date edit**: confirmed through `components/ui/alert-dialog.tsx` once per session, using the `sessionStorage` key `rolnet.pastAssignmentEditOk`.
- [X] T025 [US1] Create `components/units/assignment-view.tsx`:
  - **Header**: `DateControl allowFuture`, then "N of M units assigned" with `components/ui/progress.tsx`.
  - **Grid**: 1 / 2 (`md`) / 4 (`desk`) columns, matching the Remittances Daily view grid.
  - **Empty state**: "No units to assign. Add a unit in List view." for the owner, "No units to assign." for staff.
  - **Navigation**: date changes use `router.push(unitsDailyHref(date))`, and saves call `router.refresh()`.
- [X] T026 [US1] Rewrite the top of `app/(owner)/units/page.tsx`:
  - **Inputs**: read the profile and call `parseUnitsView`.
  - **Header**: render `PageHeader` with `UnitsViewToggle` as `action` for owners only.
  - **Daily view**: `buildAssignmentBoard(await loadAssignmentRows(...))` → `AssignmentView`.
  - **List view**: owner only. Keep the current table until US6.
- [X] T027 [US1] Extend DESIGN.md's card-layout exception (line 62) to cover Daily assignment cards, with the same 4/2/1 grid

**Checkpoint**: US1 works on its own: assignments can be saved, edited, and locked, and the 1:1 rule holds in the UI and the database.

---

## Phase 4: User Story 2 - Plan future days with pre-filled drivers (Priority: P1)

**Goal**: Future dates pre-fill each open card with the unit's latest earlier driver. Nothing is stored until it's saved.

**Independent Test**: Save driver A on unit 1 today. Tomorrow shows driver A with "Pre-filled from previous day", and the count is still 0 until Save (spec US2).

- [X] T028 [P] [US2] Add pre-fill cases to `tests/unit/assignment-board.test.ts`:
  - future date only (today and past have no pre-fill)
  - a driver saved on another unit that date gives no pre-fill
  - an ineligible driver gives no pre-fill
  - blocked and saved cards get none
  - two cards may pre-fill the same driver only if neither is saved
  - pre-fills don't change `assigned`
- [X] T029 [P] [US2] Add to `tests/e2e/units-daily-assignment.spec.ts`: tomorrow shows the demo units pre-filled from today's demo assignments, with "Pre-filled from previous day". The count stays at 0 after reloading. Changing the selection removes the hint. Today and past dates show no pre-fill. These are reads only; demo mode can't save.
- [X] T030 [US2] In `lib/units/assignment-query.ts`, when `date > today`, also call `rpc("latest_unit_assignments_before", { p_date: date })`, with a demo equivalent. In `lib/units/assignment-board.ts`, set `prefillDriverId` on open cards per FR-021.
- [X] T031 [US2] In `components/units/assignment-card.tsx`, start the select at `prefillDriverId` and show the hint "Pre-filled from previous day" until the user changes the selection. The value is client state only (FR-022).

**Checkpoint**: US1 and US2 together let the owner plan any future day in a few clicks.

---

## Phase 5: User Story 3 - Record remittances under the day's assigned driver (Priority: P1)

**Goal**: The Remittances Daily view takes each card's driver from that date's unit assignment. An unassigned unit links to the Units Daily assignment view, and the day-off and backup UI is gone.

**Independent Test**: Assign backup driver B to unit 2 today. On Remittances, unit 2 shows driver B tagged "Backup" with no coverage tooltip. Unassigned unit 3 shows "Assign driver", which opens `/units?view=daily&date=<today>` (spec US3).

- [X] T032 [P] [US3] Update `tests/unit/daily-board.test.ts`:
  - `unrecorded` cards get the driver from `unitAssignments` with `role` = `driver_kind` and no `coveringFor`.
  - A unit with no assignment is `no-driver` and is counted in `countable`.
  - Saved cards keep their saved driver.
  - Archived units are excluded.
  - Units created after the date are excluded unless they have a saved remittance.
  - Delete the day-off and backup cases.
- [X] T033 [P] [US3] Update `tests/unit/daily-card.test.tsx`: the no-driver card shows "No driver assigned for this date" and an "Assign driver" link to `/units?view=daily&date=2026-11-01`. The driver tag shows only "Primary" or "Backup".
- [X] T034 [US3] Rewrite `lib/remittances/daily-query.ts` `loadDailyRows`:
  - **Units**: read `id, name, body_number, status, created_at, archived` with `deleted_at is null`.
  - **Assignments and status**: `unit_assignments` for the date with `drivers(full_name, driver_kind)`, and `unit_status_changes`.
  - **Remittances**: select `drivers(full_name, driver_kind)` instead of the `driver_assignments` embed.
  - **Removed**: the `driver_assignments`, `driver_days_off`, and free-driver reads.
  - **Demo**: update the demo branch to match.
- [X] T035 [US3] Rewrite `lib/remittances/daily-board.ts` per data-model.md "Remittance board card":
  - **Card kinds**: `saved | unrecorded | no-driver | blocked`. `unrecorded` carries `unitId` and `driver: { driverId, name, role }`.
  - **Removed**: the `coverageOn`, day-off, and `freeDrivers` logic.
  - **Hidden units**: archived units and units not existing on the date are hidden, unless they have a saved remittance.
  - **Counts**: `countable` and `receivedCentavos` per FR-046.
- [X] T036 [US3] Update `components/remittances/daily-card.tsx` and `daily-view.tsx`. The save sends `{ unitId, driverId, serviceDate }`. The no-driver card renders the text and an "Assign driver" `Link` to `unitsDailyHref(date)` for owner and staff, with save controls hidden. Then update `components/remittances/driver-tag.tsx` to show only the role, with the coverage tooltip removed.
- [X] T037 [US3] Delete `components/remittances/assign-backup-picker.tsx`, `app/actions/assignments.ts`, and `components/forms/assignment-forms.tsx`, and remove their imports. Reduce or delete `lib/assignments/coverage.ts` so nothing imports day-off coverage. Rewrite `lib/assignments/current-drivers.ts` as `currentDriversOn(supabase, unitIds, date)` reading `unit_assignments`.

**Checkpoint**: Remittances record against daily assignments end to end. This is required before release, together with Phase 2.

---

## Phase 6: User Story 4 - Block units that are in repair or retired (Priority: P2)

**Goal**: Status on a date decides blocking in both daily views. Changing status on the unit page confirms and releases future assignments.

**Independent Test**: Unit 4 has driver C today and tomorrow. Set it to In repair, confirm the release, and both days show a blocked card with driver C free. Yesterday is unchanged (spec US4).

- [X] T038 [P] [US4] Add blocked cases to `tests/unit/assignment-board.test.ts` and `tests/unit/daily-board.test.ts`:
  - A unit `in_repair` from Nov 1 is `blocked` on Nov 1 and Nov 5, not on Oct 31, and assignable again after an `active` change on Nov 5.
  - Saved records on blocked dates show as saved or locked and are counted.
  - Blocked cards are excluded from `assignable`, `countable`, and `receivedCentavos`, and get no pre-fill.
- [X] T039 [P] [US4] Add `tests/e2e/unit-status-blocking.spec.ts` (demo reads, using the demo unit set In repair 3 days ago in T017):
  - That unit is blocked today and on the previous 3 days, and isn't blocked 4 days ago.
  - It's excluded from both counts.

  The release confirmation and its Cancel are covered by a unit test of `components/units/unit-status-control.tsx` in `tests/unit/unit-status-control.test.tsx` (mock `upcomingAssignmentCount` returning 0 and 2). The release itself is covered by T007. Blocked cards show "Unit is in repair. Change its status on the unit page to assign a driver." with "Open unit" (owner). The Remittances card shows "Unit is in repair. No remittance for this date."
- [X] T040 [US4] Finish the `blocked` kind in `lib/units/assignment-board.ts` and `lib/remittances/daily-board.ts`, using `statusOn`. Render it in `components/units/assignment-card.tsx`: muted, an "In repair"/"Retired" `StatusBadge` (`unitStatusTone`), disabled controls, the FR-026 message, and an "Open unit" link to `/units/[id]` for owners only. Render it in `components/remittances/daily-card.tsx` with the FR-046 message and no rental, payment, notes, or Save.
- [X] T041 [US4] Create `components/units/unit-status-control.tsx`, wrapping `components/forms/status-select.tsx` for units. Before a change to `in_repair` or `retired`, it calls `upcomingAssignmentCount({ unitId })`. If the count is above 0, it opens an `AlertDialog`: "[Unit] has driver assignments from today onward. Changing the status will release them. Continue?". Cancel restores the previous value, and Continue calls `setUnitStatus`. Revalidate `/units` and `/remittances` in `app/actions/units.ts` `setUnitStatus`.
- [X] T042 [US4] Update `components/records/status-history.tsx` so `kind="unit"` reads `unit_status_changes` (newest first, 10 rows): "From → To" or "Created as In repair" for a creation row that isn't Active, then "who · when". Drivers keep the audit-trail source.

**Checkpoint**: Blocking and release work across both daily views.

---

## Phase 7: User Story 5 - Archive and restore units instead of deleting them (Priority: P2)

**Goal**: The row menu archives with a counts modal, the unit hides from daily work, history stays, and Restore brings it back. Driver deactivate and archive confirm and release.

**Independent Test**: Archive a unit with remittances and a driver today. The modal shows counts, and on confirm the "Unit archived" toast shows. The unit is gone from both daily views and still in Remittances List view and reports. Restore shows the "Unit restored" toast (spec US5). The row menu (T048) is part of this story so the archive entry point exists without US6.

- [X] T043 [P] [US5] Write `tests/e2e/unit-archive.spec.ts` (demo reads, using the archived demo unit from T017). It must check:
  - Units List hides the archived unit by default, and "Show archived (1)" shows it dimmed with the "Archived" tag and a menu of "More info" / "Restore".
  - An active row's "Unit options" → "Archive" opens "Archive [name]?" with Cancel focused and the six count lines. Escape closes it without changes. The menu, dialog, and Escape work keyboard-only.
  - The archived unit is absent from both daily views, and its remittances still show in Remittances List view.

  The confirm and restore writes, and their toasts, are covered by T007, a unit test of `components/units/archive-unit-dialog.tsx` in `tests/unit/archive-unit-dialog.test.tsx` (mocked `archiveUnit`, expects "Unit archived"), and T062.
- [X] T044 [US5] In `app/actions/units.ts`:
  - **Add**: `archiveUnit({ id, expectedUpdatedAt })` and `restoreUnit({ id, expectedUpdatedAt })`, which update `archived` with the `updated_at` match and give the stale message otherwise. Also add `archiveSummary({ id })` built on `lib/units/archive-summary.ts` (today's driver with role, then head-only counts of active `unit_assignments`, `remittances`, `expenses`, `documents`, and `audit_events` for the unit).
  - **Remove**: `softDeleteUnit`.
  - **Inputs**: add Zod inputs to `lib/validation/units.ts`.
- [X] T045 [US5] Create `components/units/archive-unit-dialog.tsx` per contracts/ui.md "Archive", on `components/ui/alert-dialog.tsx`, with initial focus on "Cancel" and a destructive "Archive unit". On success it shows `toast("Unit archived")` and refreshes.
- [X] T046 [US5] Hide archived units from:
  - pickers for new records: the unit selects in `components/forms/expense-form.tsx`, `part-replacement-form.tsx`, `tire-installation-form.tsx`, `mileage-form.tsx`, and `document-form.tsx`, and their page queries (add `.eq("archived", false)`)
  - `lib/dashboard/queries.ts`: exclude archived units from "units on the road" counts, and read each driver's current unit from today's `unit_assignments`

  On the Reports page unit list (`app/(owner)/reports/page.tsx`), label archived units "(archived)" next to the existing "(retired)" label.
- [X] T047 [US5] In `app/(owner)/drivers/[id]/page.tsx`, the driver status control, and the driver archive button:
  - **Confirmation**: before deactivating or archiving, call `upcomingAssignmentCount({ driverId })`. If the count is above 0, confirm with "[Driver] is assigned from today onward. Deactivating will release those units. Continue?" (or "Archiving…").
  - **Removed**: the primary, day-off, and backup forms.
  - **Kept**: the old history tables, read-only, under the heading "Before daily assignments".
  - **New**: an "Assignment history" table (Date, Unit) from `unit_assignments`, newest first, paged.
- [X] T048 [US5] Create `components/units/unit-row-menu.tsx`, a `DropdownMenu` with `aria-label="Unit options"`:
  - **Active row**: "More info" (link to `/units/[id]`) and "Archive" (opens the archive dialog).
  - **Archived row**: "More info" and "Restore" (calls `restoreUnit`, then `toast("Unit restored")`).

  Leave the default collision avoidance on so the menu flips upward.

**Checkpoint**: Archive and restore work, and nothing is deleted.

---

## Phase 8: User Story 6 - Simplified units list with an Add a unit modal (Priority: P2)

**Goal**: A full-width list with a toolbar Add button, a Show archived checkbox, today's driver, a read-only status badge, and a row menu.

**Independent Test**: There's no side card. Add a unit with Plate empty and see the inline error. Fix it and save: the modal closes, the row shows "Unassigned", and the "Unit added" toast shows (spec US6).

- [X] T049 [P] [US6] Add to `tests/e2e/unit-archive.spec.ts` (or a new `tests/e2e/units-list.spec.ts`):
  - The columns are in order.
  - Status is a badge, not a select.
  - The Add modal opens from the toolbar button, shows inline errors for empty required fields on save (client validation, no server call), and closes on Escape.
  - The last row's menu opens upward (its bounding box is above the trigger).

  The successful add, "Unit added" toast, and new open card are covered by a unit test of `components/units/add-unit-dialog.tsx` in `tests/unit/add-unit-dialog.test.tsx` (mocked `createUnit`) and T062.
- [X] T050 [US6] Create `components/units/add-unit-dialog.tsx`: a `Dialog` titled "Add a unit" wrapping `components/forms/unit-form.tsx`. Add an `onSaved` callback to `unit-form.tsx` if needed. On success it closes, calls `toast("Unit added")`, and refreshes.
- [X] T051 [US6] Create `components/units/units-list.tsx` and wire it into `app/(owner)/units/page.tsx`:
  - **Removed**: the `<aside>` "Add a unit" card. The `workspace-grid` becomes full width.
  - **Toolbar**: the existing search and Filters, plus a primary "Add a unit" button with a `Plus` icon.
  - **Count row**: the record count on the left, and a `Checkbox` "Show archived (N)" on the right, bound to `archived=1`. N comes from a head-only count (`select("id", { count: "exact", head: true }).eq("archived", true).is("deleted_at", null)`) run in parallel with the list query.
  - **Query**: filter `archived = false` unless the box is ticked.
  - **Columns**: Unit, Body number, Plate, Motorcycle, Current driver (`currentDriversOn(today)` or "Unassigned"), Mileage, Status (`StatusBadge` only, with the `StatusSelect` removed), and the menu.
  - **Archived rows**: dimmed, with an "Archived" tag.
  - **Demo mode**: uses the demo data.

**Checkpoint**: The List view matches the mockup. Delete is gone from the UI.

---

## Phase 9: User Story 7 - Redesigned unit detail page (Priority: P3)

**Goal**: The header with the status control, an inline Details grid, and the read-only sections (12-month allowance vs expenses, status history, assignment history, documents). The old driver forms are removed.

**Independent Test**: Mileage is a normal field. Current driver shows "NAME (Role)" or "No driver assigned today". Edit details changes the plate inline. No reassign, end, or day-off forms remain (spec US7).

- [X] T052 [P] [US7] Write `tests/unit/monthly-allowance.test.ts`, then implement `lib/units/monthly-allowance.ts`: `monthlyAllowanceBlocks(remittances: { service_date, allowance_centavos }[], expenses: { expense_date, amount_centavos }[], today)`. It keeps only months within the 12 calendar months ending with today's month that have activity, newest first, each with `allowanceCentavos`, `expensesCentavos`, `netCentavos`, and bar widths as a percentage of the larger value. Use `lib/money/centavos.ts` for formatting only.
- [X] T053 [P] [US7] (Done as component tests in `tests/unit/unit-dialogs.test.tsx`: the unit page has no demo-mode data source, so no demo e2e spec.) Write `tests/e2e/unit-detail.spec.ts`:
  - The header order and subtitle are correct.
  - The status select is top right.
  - Details shows six fields at equal size.
  - Edit details switches the four fields to inputs, and Cancel reverts them. Saving is a write, covered by `tests/unit/unit-details-section.test.tsx` (mocked `updateUnit`, including the In repair lock message) and T062.
  - Mileage, driver, and status aren't editable.
  - The removed headings are absent.
  - The documents empty-state text is exact.
- [X] T054 [US7] Create `components/units/unit-details-section.tsx`:
  - **Heading**: `SectionHeading` "Details" with an "Edit details" button.
  - **Grid**: 2 columns on phones, 3 at `md`, showing Unit name, Body number, Plate number, Motorcycle, Mileage ("12,345 km"), and Current driver ("NAME (Role)" or "No driver assigned today").
  - **Link**: the "Maintenance and mileage" text link.
  - **Edit mode**: inline inputs for the four editable fields, with "Save details" and "Cancel", reusing `updateUnit` with `expectedUpdatedAt`. The feature-005 locked message shows inline when the unit is In repair or Retired.
- [X] T055 [P] [US7] Create `components/units/monthly-allowance.tsx`: per block, the month label, Allowance and Expenses bars (token colours, widths from T052), and their amounts, then "Net ₱X" via `components/remittances/money-text.tsx` (red with a minus sign when negative). Empty state: "No remittances or expenses in the last 12 months."
- [X] T056 [P] [US7] Create `components/units/assignment-history.tsx`: a paged `DataTable` with Date, Driver (link), and Role from active `unit_assignments` for the unit, newest first. Empty state: "No assignments recorded yet."
- [X] T057 [US7] Rewrite `app/(owner)/units/[id]/page.tsx`:
  - **Access**: `requirePermission("manage_master_data")`.
  - **Header**: the "← Back to units" link, then `PageHeader` with eyebrow "Unit history", title the unit name, description "Body … · plate · motorcycle", and `action={<UnitStatusControl />}`.
  - **Body**, in order: `UnitDetailsSection`, `MonthlyAllowance` (reads the unit's remittances and expenses for the 12-month window), `StatusHistory`, `AssignmentHistory`, and Documents (the existing list and empty text).
  - **Removed**: "Driver on a date", the reassign, end, and day-off forms, "Days off and backup coverage", the large mileage heading, and the right-side edit card.

**Checkpoint**: All seven stories work.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T058 [P] Update `lib/domain/resource-config.ts` (contracts/actions.md API v1):
  - `assignments` and `driver-days-off` become read-only (no create or update fields).
  - Add a read-only `unit-assignments` resource (filters `unit_id`, `driver_id`, `service_date`).
  - `units` exposes and filters `archived`.
  - `remittances` create fields become `unit_id`, `driver_id`, `service_date`, `disposition`, `notes`.

  Update `tests/unit/*resource*` and API tests to match.
- [X] T059 [P] Update `docs/DEVELOPMENT.md` business rules:
  - daily assignments (1:1 per day, pre-fill, lock after a remittance)
  - blocking by status history
  - release triggers (unit status, archive, driver deactivate or archive)
  - archive instead of delete
  - the release-day migration timing (research R13)
  - staff access to the Daily assignment view
- [X] T060 [P] Remove leftover dead code and exports: `demoUnitDaysOff` and `demoBackupAssignments` in `lib/demo/mode.ts`, `list-control-specs.ts` entries for days off, and unused types in `lib/remittances/daily-board.ts`. Confirm with `corepack pnpm lint`.
- [X] T061 Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm test:e2e`, `corepack pnpm check`, and `corepack pnpm build:vinext`, and fix any failures
- [ ] T062 Walk through `quickstart.md` section 4 as owner and as staff at 1280 px and 360 px against the running dev server (verify with Playwright, because the hidden Browser pane doesn't hydrate), and record the results in `specs/010-units-daily-assignment/validation.md`. Include the write flows that the demo e2e can't cover (save, the "Driver already assigned today" race, archive and restore toasts, Add a unit, Edit details save) and measured timings: view and date switches under 1 s (SC-006), and assigning 12 units under 3 minutes (SC-001)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T002 to T004 can run in parallel.
- **Foundational (Phase 2)**: depends on Setup. T005 to T009 (tests) can be written in parallel. Then the migrations go in order: T010 → T011 → T012 → T013 (needs the user's approval). After that come T014 and T017, while T015 and T016 can start any time. **Blocks every story.**
- **US1 (Phase 3)**: after Phase 2.
- **US2 (Phase 4)**: after US1 (it extends the board, query, and card).
- **US3 (Phase 5)**: after Phase 2. Independent of US1 in code, but it needs saved assignments to demonstrate, either through US1 or the seed.
- **US4 (Phase 6)**: after US1 and US3 (it adds the blocked kind to both boards).
- **US5 (Phase 7)**: after Phase 2. It includes the row menu (T048), so archive and restore work from the current list table before US6 restyles it.
- **US6 (Phase 8)**: after US5 (the new list reuses the US5 row menu).
- **US7 (Phase 9)**: after US4 (it uses `UnitStatusControl`).
- **Polish (Phase 10)**: after the stories you're shipping.

### Release gate

Phase 2 and US3 must ship together: migration 3 refuses the old remittance insert path. A deploy must also include US1 so drivers can be assigned after release day.

### Within each story

Write the tests first and confirm they fail. Then do the pure lib, then the query and actions, then the components, then the page.

## Parallel Examples

```text
# Phase 2 tests together:
T005 280_unit_assignments.sql | T006 290_unit_status_blocking.sql | T007 300_unit_archive_release.sql | T008 310_remittance_unit_assignments.sql | T009 rls/210_unit_assignments_rls.sql

# US1 tests together:
T018 assignment-board.test.ts | T019 units-daily-assignment.spec.ts

# After Phase 2, two people can split the work:
Developer A: US1 → US2 → US4
Developer B: US3, then US5 → US6, then US7

# US7 building blocks together:
T052 monthly-allowance lib | T055 monthly-allowance component (after T052) | T056 assignment-history
```

## Implementation Strategy

### MVP (release-ready minimum)

1. Phase 1 and Phase 2 (with the user's approval for rolnet-dev).
2. US1, then US3. The owner and staff can assign drivers daily and record remittances against them.
3. **Stop and validate** quickstart steps 2, 3, 7, and 8.

### Incremental delivery

4. US2 (pre-fill), then US4 (blocking and release).
5. US5 and US6 (archive, list redesign), then US7 (detail page).
6. Phase 10 polish, the full checks, and `validation.md`.

## Notes

- Every task must leave lint, typecheck, and tests green, plus the full pgTAP suite after any SQL change.
- Commit after each task or logical group. Never commit `.env*` files.
- `types/database.ts` is generated. Regenerate it with `--linked`; never hand-edit it.
