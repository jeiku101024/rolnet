# Tasks: Drivers Page, Primary/Backup Role Switch, Dated Absences, and Stale Leave Flag

**Input**: Design documents from `specs/012-drivers-absences-roles/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. CLAUDE.md requires pgTAP coverage for every migration, and a task is done only
when lint, typecheck, Vitest (and `supabase test db` when the schema changes) pass. Playwright specs
follow the plan.

**Hard rules for every task** (CLAUDE.md, constitution 1.1.0, memory):
- **Schema**: schema, RLS, and SQL functions change only in the two new migrations named below, each with pgTAP coverage. Never edit a migration after it is pushed.
- **Grants**: new `public` functions start with `revoke execute … from public, anon, authenticated`. Only the functions listed in contracts/database.md get `grant execute … to authenticated`. `security definer` functions check `public.is_owner()` or `public.is_approved_user()` before writing.
- **Data integrity (constitution III)**: every new table has the audit columns, `reject_hard_delete`, and `audit_business_change`. Cancel, end early, Undo, and release mark rows (`cancelled_at`, `ended_early_on`, `deleted_at`) and never hard-delete. Multi-write actions run in one database function. Past assignments and remittances are never changed.
- **rolnet-dev needs the user's approval**: pushing migrations to rolnet-dev and running pgTAP there needs explicit approval (there's no local Supabase). Run the **full** pgTAP suite, not only the new files.
- **Fleet date**: `(now() at time zone 'Asia/Manila')::date` in SQL and `fleetToday()` in TypeScript.
- **Types**: `types/database.ts` is hand-maintained. Edit it by hand; don't regenerate it.
- **UI (constitution IV)**: no new npm packages. Use shadcn `base-nova` components on `@base-ui/react` and tokens only (no hex or arbitrary sizes). Every screen must work at 360 px, and every error says what to do next.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The user story the task belongs to (US1–US8 from spec.md)

## Path Conventions

Single Next.js monolith at the repo root: `app/`, `components/`, `lib/`, `supabase/`, `tests/`, `types/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Small shared UI and config changes that several stories use.

- [X] T001 [P] Extend `components/ui/toast.tsx` so `useToast()` returns `toast(message, { action?: { label: string; onClick: () => void }, timeout?: number })`. Render the action with Base UI Toast `actionProps` as a text button. Keep the default 4000 ms timeout and allow a per-toast timeout (research R10).
- [X] T002 [P] Add an optional `info` tone (`bg-info-soft text-info`) and an optional leading `icon` prop (a lucide component, `aria-hidden`) to `StatusBadge` in `components/ui/feedback.tsx`, leaving the existing tones unchanged (contracts/ui.md).
- [X] T003 [P] Add entity labels `driver_absences: "Absences"`, `driver_absence_confirmations: "Leave checks"`, `driver_role_changes: "Role changes"` to the entity label map in `lib/pagination/list-control-specs.ts` (research R15).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The absence schema, the shared pure logic, and the demo data that every story needs.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [X] T004 Write migration `supabase/migrations/20261102000100_driver_absences.sql` (header comment citing spec 012 and research R2–R6, R13). It must contain:
  - **Enums**: `driver_absence_type ('day_off','on_leave')` and `driver_absence_reason ('sick','vacation','family_emergency','personal','other')`.
  - **`drivers.notes`**: `text null` with `check (notes is null or length(trim(notes)) <= 1000)`.
  - **`fleet_settings` columns**: `stale_leave_amber_days smallint not null default 14 check (> 0)`, `stale_leave_red_days smallint not null default 30` with a table check `stale_leave_red_days > stale_leave_amber_days`, and `stale_leave_snooze_days smallint not null default 7 check (> 0)`.
  - **Table `driver_absences`** with the columns in data-model.md, including `note` `check (note is null or length(trim(note)) <= 500)`, the audit columns, and these constraints:
    - `check (end_date is null or end_date >= start_date)`
    - `check (absence_type = 'on_leave' or end_date = start_date)`
    - `check (ended_early_on is null or ended_early_on >= start_date)`
    - `check (cancelled_at is null or ended_early_on is null)`
    - `exclude using gist (driver_id with =, daterange(start_date, least(end_date + 1, ended_early_on), '[)') with &&) where (cancelled_at is null and deleted_at is null)`
    - index `(driver_id, start_date, end_date) where deleted_at is null`
  - **Table `driver_absence_confirmations`** (`absence_id`, `confirmed_by uuid not null`, `confirmed_at timestamptz not null default now()`, audit columns), with index `(absence_id, confirmed_at desc)`.
  - **Triggers** on both tables: `set_audit_fields`, `reject_hard_delete`, `audit_business_change`.
  - **RLS** per contracts/database.md, plus `revoke all ... from anon`.
- [X] T005 In the same migration `supabase/migrations/20261102000100_driver_absences.sql`, add:
  - **`driver_absent_on(p_driver_id uuid, p_date date) returns boolean`** (definer, stable). Covered when `cancelled_at is null and deleted_at is null and date >= start_date and (end_date is null or date <= end_date) and (ended_early_on is null or date < ended_early_on)`.
  - **`validate_driver_absence()`** (definer, before insert or update). It skips signed-in unapproved users and refuses with the exact messages in contracts/database.md:
    - an Inactive driver: "Inactive drivers cannot have absences"
    - editing a finished absence
    - an Active-now end date before today
    - To before From
    - a Day-off end date different from its start
  - **`validate_unit_assignment()`** replaced from 20261101000100. It keeps all the feature-010 checks and adds the refusal "This driver is absent on this date. Choose another driver." when `driver_absent_on(new.driver_id, new.service_date)`.
  - **Grants**: revoke EXECUTE on both new functions from `public, anon, authenticated`.
- [X] T006 In the same migration, add the invoker functions `save_driver_absence`, `cancel_driver_absence`, `end_driver_absence`, and `confirm_driver_leave` with the signatures, rules, and messages in contracts/database.md and research R5–R6:
  - **`save_driver_absence`**: runs the friendly overlap pre-check naming the conflict, and forces `end_date = start_date` for `day_off`. It recomputes the today-and-later assignments newly covered and compares them with `p_release_ids`; on a mismatch it raises P0001 "Assignments for these dates changed. Review them again." It checks for a locked assignment and raises "[Unit] on [date] already has a remittance, so this assignment can't be released." Then it upserts with the `updated_at` check and soft-deletes the released `unit_assignments`, all in one transaction.
  - **`cancel_driver_absence`**: Upcoming absences only.
  - **`end_driver_absence`**: covers-today only. Sets `ended_early_on` to today (Asia/Manila) and `ended_early_at`/`ended_early_by`, and cancels the driver's upcoming absences when `p_cancel_upcoming`.
  - **`confirm_driver_leave`**: current open-ended leave only. Inserts the confirmation and sets `snoozed_until = today + fleet_settings.stale_leave_snooze_days`.
  - **Grants**: revoke from `public, anon, authenticated`, then grant EXECUTE to `authenticated`.
- [X] T007 [P] Write pgTAP `supabase/tests/constraints/340_driver_absences.sql` covering:
  - table shape, enums, and checks
  - the exclusion constraint: overlap refused, back-to-back Nov 5–9 and Nov 10–12 allowed, cancelled and ended-early ranges free, ended-early-on-start-day empty
  - `driver_absent_on` cases
  - the Inactive refusal and the finished-absence edit refusal
  - a `unit_assignments` insert refused for an absent driver and allowed the day after
  - `fleet_settings` defaults 14/30/7 and the red > amber check
- [X] T008 [P] Write pgTAP `supabase/tests/rls/230_driver_absences_rls.sql`:
  - owner and staff can select, insert, and update `driver_absences` and call the four absence functions
  - unapproved users and anon can't
  - anon has no table access
  - staff still can't update `drivers` directly

  Also add the four new granted functions and `driver_absent_on` (not granted) to the function-execute inventory in `supabase/tests/rls/120_function_execute_rls.sql`.
- [X] T009 Hand-edit `types/database.ts` (it is hand-maintained; do not regenerate):
  - **Enums**: `driver_absence_type`, `driver_absence_reason`.
  - **Tables**: Row/Insert/Update types for `driver_absences` and `driver_absence_confirmations`.
  - **Columns**: `drivers.notes`, and the three `fleet_settings` stale columns.
  - **Functions**: Args/Returns for `save_driver_absence`, `cancel_driver_absence`, `end_driver_absence`, `confirm_driver_leave`.
- [X] T010 [P] Create `lib/drivers/absences.ts` with pure, fleet-date-string functions (data-model.md):
  - **`covers(absence, date)`**: the same rule as `driver_absent_on`.
  - **`statusToday(driver, absences, today)`**: `'inactive' | 'day_off' | 'on_leave' | 'active'`.
  - **`absenceStatus(absence, today)`**: Cancelled → Ended early → Upcoming → Active now → Completed.
  - **`coveringAbsence(absences, date)`** and **`upcomingAbsences(absences, today)`** (soonest first).
  - **`staleLevel(absence, today, settings)`**: `'none' | 'amber' | 'red' | 'snoozed'`, with `daysOpen = today − start_date`, snoozed while `snoozed_until > today`, and only for an open-ended `on_leave` covering today.
  - **`daysOpen(absence, today)`**.
  - **`formatAbsenceDates(absence)`**: "Nov 5" / "Nov 5 to Nov 9" / "from Nov 1 (open-ended)".
  - **`absenceToast(name, absence)`**: the three save toasts in contracts/actions.md.
- [X] T011 [P] Create `lib/drivers/availability.ts` with `availability({ drivers, absences, assignments, date })`. It returns `{ available: { id, name, role }[], hidden: { inactive, absent, licenceExpired, assigned } }`. A driver is available when `is_active`, `license_expiry_date >= date`, no absence covers `date`, and no saved assignment that date. Hidden reasons use first-match order Inactive → absent → licence expired → assigned (data-model.md).
- [X] T012 [P] Create `lib/validation/driver-absences.ts`, a Zod `absenceInputSchema` per contracts/actions.md `AbsenceInput`:
  - Type required. Date/From required.
  - For `on_leave` with `openEnded` false, To is required and must be `>= startDate`. With `openEnded` true, `endDate` is null.
  - For `day_off`, `endDate` is forced to `startDate`.
  - Reason is one of `sick | vacation | family_emergency | personal | other`. `note` ≤ 500 chars.
  - Plus `releaseIds: string[]` for save.
  - Field labels: "Type", "Date", "From", "To", "Reason", "Note".
- [X] T013 [P] Map the new codes in `lib/actions/errors.ts`: `23P01` → `CONFLICT` "This driver already has an absence on these dates. Reload to see it.". The new 23514/P0001 database messages pass through unchanged.
- [X] T014 [P] Add demo data to `lib/demo/mode.ts` (research R16), with dates relative to today:
  - `demoDriverAbsences`: a Day-off today, a leave with an end date covering today, an open-ended leave started 16 days ago (amber), an open-ended leave started 31 days ago with `snoozed_until` 3 days ahead, an upcoming Day-off in 2 days, one cancelled, one completed.
  - `demoAbsenceConfirmations` for the snoozed leave.
  - `demoStaleSettings` `{ amber: 14, red: 30, snooze: 7 }`.
  - `notes` on two drivers.
  - `demoDriverAssignments` stays consistent: no absent driver is assigned on a covered date.
- [X] T015 [P] Vitest `tests/unit/driver-absences.test.ts` for every function in `lib/drivers/absences.ts`:
  - inclusive ranges, open-ended, ended early mid-range and on the start day, cancelled
  - status precedence
  - stale thresholds at 13/14/29/30 days, and snooze before, on, and after `snoozed_until`
  - date formatting and toasts
- [X] T016 [P] Vitest `tests/unit/driver-availability.test.ts` for `lib/drivers/availability.ts`: each hidden reason, first-match ordering, and a driver on leave Nov 5–9 available on Nov 4 and Nov 10.

**Checkpoint**: The schema, pure logic, and demo data are ready. Stories can start.

---

## Phase 3: User Story 1 - Schedule a day-off or leave and keep the driver out of assignment dropdowns (Priority: P1) 🎯 MVP

**Goal**: Record a Day-off or On-leave from the driver profile. The driver is hidden from the Units Daily assignment dropdowns on the covered dates, and is Active again on his own afterwards.

**Independent Test**: Add an On-leave for driver A from tomorrow for 3 days. The Units daily view offers A today, hides him tomorrow through the end date, and offers him again the day after. Overlapping absences and absences for Inactive drivers are refused.

### Implementation for User Story 1

- [X] T017 [US1] Update `lib/units/assignment-query.ts`:
  - Load the un-cancelled `driver_absences` overlapping the board date (and demo absences), and pass them to the board.
  - Pass absences to the pre-fill input so a pre-filled driver who isn't available on the date is dropped (FR-041).
- [X] T018 [US1] Update `lib/units/assignment-board.ts` so dropdown options come from `availability()` in `lib/drivers/availability.ts`, keeping the 1:1-per-day rule and the "Name (Role)" label. Pre-fill is left empty when the previous driver is absent on the date.
- [X] T019 [P] [US1] Update `tests/unit/assignment-board.test.ts`: an absent driver isn't offered, and pre-fill is empty when the previous day's driver is absent.
- [X] T020 [P] [US1] Update `lib/dashboard/queries.ts` so the available backup drivers list (the live query and the demo branch) leaves out drivers with an absence covering today, using `covers()` from `lib/drivers/absences.ts` (FR-064).
- [X] T021 [US1] Create `app/actions/driver-absences.ts` with `previewAbsence` and `saveAbsence` (approved users, `requireApprovedSession`):
  - **`previewAbsence`**: validates with `absenceInputSchema`, and returns the friendly overlap conflict (if any), past-date counts (the driver's assignments and remittances on dates before today in the range), and the today-and-later saved assignments newly covered (`{ id, date, unitName }`).
  - **`saveAbsence`**: calls RPC `save_driver_absence` with `releaseIds`, returns the saved absence and the toast text from `absenceToast`, and revalidates `/drivers`, `/drivers/[id]`, `/units`, `/remittances`.
- [X] T022 [US1] Create `components/drivers/absence-dialog.tsx` (Base UI Dialog from `components/ui/dialog.tsx`), per contracts/ui.md "Absence dialog":
  - **Title**: "Add absence · [Name]" / "Edit absence".
  - **Type**: segmented Day-off, one date | On-leave, date range.
  - **Dates**: Date*, or From*/To* with the "No end date yet (open-ended)" checkbox that clears and disables To.
  - **Reason* select and Note**, with inline field errors.
  - **Conflict**: an inline error under the dates.
  - **Past-date warning**: amber, with the exact copy and counts. The button reads "Save anyway".
  - **Props**: `initialType`, an optional `absence` for edit, and `focusEnd` (to focus To).
  - On success, show the toast and call `router.refresh()`.
- [X] T023 [US1] Create `components/drivers/driver-status-control.tsx`, a Status dropdown (Active, Day-off, On-leave, Inactive) showing the status today:
  - Day-off or On-leave opens `absence-dialog.tsx` with that type. Cancelling leaves the value unchanged.
  - For an Inactive driver it shows the toast "Inactive drivers cannot have absences" and opens nothing.
  - Marking Inactive and reactivating an Inactive driver keep calling `setDriverStatus` (owner only). Staff see Inactive disabled, and Active disabled for an Inactive driver, with the tooltip "Only the owner can change this." (FR-050).
  - Active while an absence covers today stays enabled for owner and staff. It opens the Active-while-absent dialog, which is added in US7.
- [X] T024 [US1] In `app/(owner)/drivers/[id]/page.tsx`:
  - Replace the driver `StatusSelect` with `driver-status-control.tsx`.
  - Load the driver's absences and compute `statusToday`.
  - Show a simple absence notice for today and the next upcoming absence (the full notice set comes in US5).

**Checkpoint**: Absences can be scheduled, and they hide drivers from the Units dropdowns on covered dates.

---

## Phase 4: User Story 2 - Release saved assignments when an absence covers them (Priority: P1)

**Goal**: Saving an absence (or marking Inactive) over today-and-later saved assignments asks for confirmation, lists them, and releases them with the save.

**Independent Test**: Save driver A on unit 1 today and tomorrow, then add a Day-off for tomorrow. "Release assignments?" lists tomorrow · unit 1. Confirm: tomorrow's card is unassigned and today's is untouched.

### Tests for User Story 2

- [X] T025 [P] [US2] Write pgTAP `supabase/tests/constraints/350_driver_absence_release.sql`:
  - **Save with release**: today-and-later assignments are soft-deleted, past ones untouched.
  - **Release list mismatch**: P0001 "Assignments for these dates changed. Review them again."
  - **Locked assignment**: refused with the safeguard message, and both the absence and the assignment stay unsaved.
  - **Edit**: releases only newly covered dates.
  - **Cancel**: Upcoming only.
  - **End early**: sets `ended_early_on` to today, with and without `p_cancel_upcoming`.
  - **Confirm**: `confirm_driver_leave` sets `snoozed_until` from `stale_leave_snooze_days` and logs one row.

### Implementation for User Story 2

- [X] T026 [US2] Create `components/drivers/release-confirm-dialog.tsx`, the second view of the absence dialog:
  - **Title**: "Release assignments?".
  - **Rows**: "Nov 5 · Unit 3".
  - **Text**: "These units will be unassigned on these dates. Past records are not affected."
  - **Buttons**: [Back] (returns to the form with its values) and [Release and save].
- [X] T027 [US2] Wire the release step into `components/drivers/absence-dialog.tsx`:
  - The preview's `release` list is non-empty → show `release-confirm-dialog.tsx`. Confirm calls `saveAbsence` with those ids.
  - On the P0001 "Assignments … changed" result, re-run `previewAbsence` and show the new list.
  - The safeguard message shows as a form error.
- [X] T028 [US2] Add `driverReleasePreview({ id })` (owner, `manage_master_data`) to `app/actions/drivers.ts`, returning the today-and-later saved assignments `{ date, unitName, kept }[]`, where `kept` is true when the unit and date already have a remittance. In `components/drivers/driver-status-control.tsx`, choosing Inactive shows the same release list, with kept rows labelled "kept (remittance recorded)", before calling `setDriverStatus`. The existing `release_unit_assignments` trigger releases the others and skips locked rows (FR-043). Update the `setDriverStatus` doc comment, which still says the database refuses Inactive.

**Checkpoint**: Absences and Inactive changes release only today-and-later assignments, after confirmation.

---

## Phase 5: User Story 3 - See who is available today from the Drivers list (Priority: P1)

**Goal**: A full-width Drivers table with Role, Current unit, Contact, derived Status today with second lines, Role and Status filters, and the "Available for assignment" line with a preview.

**Independent Test**: With five drivers in the spec's mix of states, the Current unit and Status today columns match US3's independent test, and "Available for assignment: 1 of 5" shows.

### Tests for User Story 3

- [X] T029 [P] [US3] Vitest `tests/unit/drivers-list-board.test.ts` for `lib/drivers/list-board.ts`:
  - Current unit: unit name / "Unassigned" / "—"
  - status second lines: "until Nov 9", "open-ended", "open-ended · checked", stale
  - the "Next: …" line formats
  - filters by `kind` and `status`, combined with search on name, contact, and licence
  - the availability count

### Implementation for User Story 3

- [X] T030 [P] [US3] Create `lib/drivers/list-board.ts`. `buildDriverRows({ drivers, absences, todayAssignments, settings, today })` returns rows with:
  - `currentUnit` (name | "Unassigned" | "—")
  - `statusToday`
  - `statusLine` ("until [end]" | "open-ended" | "open-ended · checked" | `{ stale: 'amber'|'red', days }`)
  - `nextLine` ("Next: Day-off Nov 3" | "Next: On-leave Nov 5–Nov 9" | "Next: On-leave from Nov 5")

  Also `filterDriverRows(rows, { q, kind, status, stale })` and `availableToday`.
- [X] T031 [US3] Create `lib/drivers/list-query.ts`. It loads, in parallel: non-deleted drivers (with `notes`), un-cancelled absences with `end_date >= today` or null, today's `unit_assignments` with the unit name, and the `fleet_settings` stale columns. Demo mode uses the demo data. Rows are paged in memory with `pageRows` (research R9).
- [X] T032 [P] [US3] Create `components/drivers/driver-status-badge.tsx`, rendering Status today with `StatusBadge`:

  | Status | Tone | Icon |
  |--------|------|------|
  | Active | success | none |
  | Day-off | info | `Moon` |
  | On-leave | info | `CalendarDays` |
  | Inactive | muted | none |

  It also renders the second line, with `TriangleAlert` plus warning or danger tone text for stale.
- [X] T033 [P] [US3] Create `components/drivers/availability-preview.tsx`, a Popover from 768 px and a Sheet below:
  - **Title**: "What the Assign driver dropdown lists on [date]", with a date input defaulting to today.
  - It calls `previewAvailability` on change.
  - It lists "Name (Role)" and the hidden counts by reason, omitting zero groups.
  - Note: "Stale leave flags don't change who is available."
- [X] T034 [US3] Add `previewAvailability({ date })` (approved users) to `app/actions/drivers.ts`. It loads drivers, the absences covering `date`, and that date's assignments, then returns `availability()`.
- [X] T035 [US3] Create `components/drivers/drivers-table.tsx`, built on `DataTable` with headers Driver | Role | Current unit | Contact | Status today:
  - The name links to `/drivers/[id]`.
  - The role uses the `DriverTag` colours from `components/remittances/driver-tag.tsx` (Primary `bg-info-soft text-info`, Backup `bg-brand-soft text-brand-dark`).
  - It shows the second lines and the empty state "No drivers match."
- [X] T036 [US3] Add the Status today filter to the drivers spec in `lib/pagination/list-control-specs.ts`: param `status`, options Active/Day-off/On-leave/Inactive, applied in memory, not as a column filter. The Filters badge counts `kind` and `status`.
- [X] T037 [US3] Rebuild `app/(owner)/drivers/page.tsx` with `list-query.ts`, `list-board.ts`, `drivers-table.tsx`, the toolbar (search and Filters as on Units and Expenses), and the meta row: record count on the left, "Available for assignment: N of M · Preview dropdown" on the right. The table is full width. The old Add driver aside is removed in US8 (T071).

**Checkpoint**: The owner can see, from the list alone, who is available, absent until when, and who has an absence coming up.

---

## Phase 6: User Story 4 - Switch a driver between Primary and Backup (Priority: P2)

**Goal**: A header switch saves the role instantly with a 5-second Undo toast, logs Role history, and past records keep the role from their date.

**Independent Test**: Switch a Primary driver to Backup. The toast with Undo appears, Role history shows "Primary → Backup", the list shows Backup, and yesterday's remittance still shows Primary. Undo within 5 s reverts it and hides the entry.

### Tests for User Story 4

- [X] T038 [P] [US4] Write pgTAP `supabase/tests/constraints/360_driver_role_history.sql`:
  - `set_driver_role` writes `driver_kind` and one history row, and is a no-op on the same role
  - it works for an Inactive driver, while other details stay locked for Inactive drivers
  - `undo_driver_role_change` reverts and withdraws (`deleted_at` set)
  - undo is refused for another user, for a non-latest change, and after 60 s ("This change can no longer be undone.")
  - the `check (from_role <> to_role)` holds
- [X] T039 [P] [US4] Vitest `tests/unit/role-on.test.ts` for `roleOn`: the latest change on or before the date, a date before the first change uses its `from_role`, no changes uses the current role, withdrawn changes are ignored, and dates use the fleet day.

### Implementation for User Story 4

- [X] T040 [US4] Write migration `supabase/migrations/20261102000200_driver_role_history.sql`:
  - **Table `driver_role_changes`**: `driver_id`, `from_role driver_kind not null`, `to_role driver_kind not null`, `check (from_role <> to_role)`, `changed_by uuid not null`, `changed_at timestamptz not null default now()`, audit columns. Index `(driver_id, changed_at) where deleted_at is null`. Triggers `set_audit_fields`, `reject_hard_delete`, `audit_business_change`.
  - **RLS**: approved select only, no insert or update policies. `revoke all ... from anon`.
  - **`set_driver_role(p_driver_id, p_to_role, p_expected_updated_at) returns uuid`** and **`undo_driver_role_change(p_change_id) returns void`**: both `security definer`, requiring `is_approved_user()`, with the rules in research R7.
  - **`lock_inactive_driver_details()`** replaced without `driver_kind` in its locked fields.
  - **Grants**: revoke from all, then grant EXECUTE on the two functions to `authenticated`.

  No backfill (FR-062).
- [X] T041 [US4] Extend `supabase/tests/rls/230_driver_absences_rls.sql` and `supabase/tests/rls/120_function_execute_rls.sql`: staff and owner can call `set_driver_role` and `undo_driver_role_change`, unapproved users and anon can't, and there's no direct insert into `driver_role_changes`.
- [X] T042 [US4] Hand-edit `types/database.ts` for the `driver_role_changes` table and the `set_driver_role` / `undo_driver_role_change` functions.
- [X] T043 [P] [US4] Create `lib/drivers/role-on.ts` with `roleOn(changes, currentKind, date)` and `loadRoleChanges(supabase, driverIds)` (demo-aware). Add demo role changes (one Primary → Backup 10 days ago) to `lib/demo/mode.ts`.
- [X] T044 [US4] Add to `app/actions/drivers.ts`:
  - **`setDriverRole({ id, role, expectedUpdatedAt })`**: approved users. RPC `set_driver_role`, returning `{ changeId, role, updatedAt }`.
  - **`undoDriverRole({ changeId })`**.

  Both revalidate `/drivers`, `/drivers/[id]`, `/units`, `/remittances`.
- [X] T045 [US4] Create `components/drivers/role-switch.tsx`:
  - A Base UI `ToggleGroup` styled as the segmented control, with `role="radiogroup"`, `aria-label="Driver role"`, and arrow-key selection.
  - A change calls `setDriverRole`, then the toast "[Name] marked as Backup" (or Primary) with action "Undo" and a 5000 ms timeout. Undo calls `undoDriverRole`.
  - It's disabled while pending and in demo mode.
- [X] T046 [US4] Update `lib/remittances/daily-query.ts` so each card's `driverRole` is `roleOn(changes, driver_kind, serviceDate)` (one extra read of role changes for the board's drivers). Update `tests/unit/daily-board.test.ts` for a driver switched after the service date.
- [X] T047 [US4] Update `app/(owner)/units/[id]/page.tsx` so the assignment history's Role column uses `roleOn(changes, driver_kind, service_date)` for each row, loading role changes for the listed drivers with `loadRoleChanges` (FR-029).
- [X] T048 [US4] Remove `driverKind` from `driverDetailsSchema` in `lib/validation/drivers.ts` and from `updateDriver` in `app/actions/drivers.ts`, so the role changes only through the header switch.

**Checkpoint**: The role switch works with Undo and history, and past remittance cards keep their date's role.

---

## Phase 7: User Story 5 - Read a driver's profile at a glance (Priority: P2)

**Goal**: A single-column profile with header controls, notices, a 4-card summary strip, an inline-edit details grid, and URL-driven tabs (8 rows plus Load more).

**Independent Test**: At 1440 × 900 the header, summary strip, and details fit without scrolling. The Assignments tab shows 8 rows, and Load more shows 16. At 360 px the cards are 2 per row and the tabs scroll sideways.

### Tests for User Story 5

- [X] T049 [P] [US5] Vitest `tests/unit/driver-tab-params.test.ts` for `lib/drivers/tab-params.ts`: default tab `assignments`, unknown tab falls back, `documents` only for the owner, `rows` defaults to 8, is clamped to multiples of 8 between 8 and 200, and the Load more href adds 8.

### Implementation for User Story 5

- [X] T050 [P] [US5] Create `lib/drivers/tab-params.ts`: `parseTabParams(searchParams, isOwner)` → `{ tab, rows }` and `loadMoreHref(pathname, params)` (research R11).
- [X] T051 [US5] Create `lib/drivers/profile-query.ts`. It loads the driver (with `notes`, `created_at`, `updated_at`), the driver's absences and confirmations, today's assignment, the last assignment, the remittance count for today−29..today, and the role changes (demo-aware). It loads only the active tab's rows (`rows + 1`):
  - **Assignments**: from `unit_assignments` with units.
  - **Remittances**: with payments, and balance via `lib/remittances/financials.ts`.
  - **Role history**: plus the existing status history.
  - **Absences**.
  - **Documents**: owner only.

  Balance owed is computed from the driver's remittances and payments, not the owner-only RPC (research R12).
- [X] T052 [P] [US5] Create `components/drivers/summary-strip.tsx`: 4 compact cards, `grid-cols-2` below `lg` and `grid-cols-4` from `lg`:
  - Today's unit (name / "Unassigned" / "—")
  - Remittances (last 30 days) count
  - Balance owed (formatted with `lib/money/centavos.ts`, `text-danger` above zero)
  - Next absence (date or range), or Last assignment (date or "None")
- [X] T053 [P] [US5] Create `components/drivers/driver-notices.tsx` with the exact notice copy from spec US5 scenario 2: Inactive, day-off today, leave with end, open-ended not stale (with the "Checked … Flag returns … if still open." line when snoozed), and upcoming ("Day-off scheduled Nov 5." / "Leave scheduled Nov 5 to Nov 9." plus "+N more upcoming."). It uses the `Notice` style from `components/ui/feedback.tsx`. Stale notice actions come in US6.
- [X] T054 [P] [US5] Create `components/drivers/driver-details-section.tsx`, a definition-list grid (2 columns from `sm`) of full name, contact number, licence number, licence expiry, address, role, status today, date joined (read-only), and notes:
  - [Edit details] is owner-only and hidden for Inactive drivers.
  - It swaps name, contact, licence number, licence expiry, address, and notes to inputs, with [Save details] [Cancel].
  - It calls `updateDriver` and shows the toast "Details saved".
- [X] T055 [US5] Add `notes` to `driverSchema` and `driverDetailsSchema` in `lib/validation/drivers.ts` (optional, `max(1000)`), and to the `row()` mapper and `labels` in `app/actions/drivers.ts`.
- [X] T056 [P] [US5] Create `components/drivers/profile-tabs.tsx`:
  - A `role="tablist"` of links (`aria-selected`, roving tabindex, Left/Right/Home/End keys) with `overflow-x-auto` on phones.
  - The panel has `role="tabpanel"` and a [Load more] link with `scroll={false}` while more rows exist.
- [X] T057 [P] [US5] Create `components/drivers/absences-table.tsx` (read-only in this story):
  - Columns Type | Dates (`formatAbsenceDates`, note in a tooltip) | Reason | Status.
  - Status is an `absenceStatus` badge: Upcoming, Active now, Completed, Cancelled, Ended early.
  - Newest start first, with an [Add absence] button opening `absence-dialog.tsx`. It's disabled with a tooltip for Inactive drivers.
- [X] T058 [US5] Create `components/drivers/profile-header.tsx`:
  - "← Back to drivers", the eyebrow "Driver profile", the name as title.
  - The subtitle "[contact] · Licence [number]".
  - At top right, `role-switch.tsx` and `driver-status-control.tsx`, wrapping under them on phones.
- [X] T059 [US5] Rebuild `app/(owner)/drivers/[id]/page.tsx` as a single column: header, notices, summary strip, details, then tabs:
  - **Assignments**: Date | Unit | Role that day.
  - **Remittances**: Date | Unit | Rental | Paid | Balance | Role that day, with `bg-danger-soft` rows and "Owes ₱X".
  - **Role history**: Date | Change | By | Time, plus a "Status changes" list from `components/records/status-history.tsx`.
  - **Absences**.
  - **Documents**: owner only, the existing `DocumentList`.

  Remove the right-hand column, the old primary-assignment, day-off, and backup-coverage sections, and the `driver_assignments` and `driver_days_off` reads (FR-022, research R14).
- [X] T060 [US5] Delete `components/forms/driver-details-form.tsx` if nothing else imports it, and drop the driver branch from `components/forms/status-select.tsx` if no other caller uses it.

**Checkpoint**: The profile is one column, fits at 1440 × 900, and the tabs page by 8.

---

## Phase 8: User Story 6 - Catch open-ended leaves that have gone on too long (Priority: P2)

**Goal**: Amber and red flags for open-ended leaves on the list, banner, profile, and Absences tab. "Set end date", "End leave now", and "Still on leave" work, with a 7-day snooze.

**Independent Test**: An open-ended leave started 16 days ago shows amber "Open for 16 days" on the list and is counted in the banner. The profile offers the three actions. "Still on leave" shows "open-ended · checked", hides it from the banner, and the profile reads "Checked Nov 2. Flag returns Nov 9 if still open."

### Implementation for User Story 6

- [X] T061 [P] [US6] Create `components/drivers/stale-leave-banner.tsx`:
  - The text "N drivers have been on open-ended leave for [amber] days or more." ("1 driver has been …"), danger tone if any leave is red, warning tone otherwise.
  - [Show them] sets `stale=1`. The [X] button (`aria-label="Dismiss"`) stores `rolnet:stale-banner-dismissed` in `sessionStorage` and hides the banner for the session.
  - Snoozed leaves aren't counted.
- [X] T062 [US6] Wire the stale state into `app/(owner)/drivers/page.tsx` and `lib/drivers/list-board.ts`:
  - The banner sits above the meta row.
  - The `stale=1` filter shows "Showing stale leaves. Clear" beside the count.
  - The stale second line comes from `staleLevel` with the settings thresholds.
- [X] T063 [US6] Add `confirmLeave({ id })` and `endAbsence({ id, expectedUpdatedAt, cancelUpcoming })` to `app/actions/driver-absences.ts`:
  - **`confirmLeave`**: RPC `confirm_driver_leave`. Toast "Marked as still on leave. Flag hidden for [snooze] days."
  - **`endAbsence`**: RPC `end_driver_absence`. Toast "Leave ended. [Name] is available for assignment", or "[Name] is Active again" for a day-off.

  Both revalidate `/drivers`, `/drivers/[id]`, `/units`.
- [X] T064 [US6] Add the stale notice to `components/drivers/driver-notices.tsx`:
  - **Amber**: "On leave since [start]. Open-ended for N days. Set an end date or end the leave."
  - **Red**: "Open for N days. Consider marking Inactive if this driver is not returning."
  - **Actions**: [Set end date] opens `absence-dialog.tsx` in edit mode with open-ended unticked, To empty, and `focusEnd`. [End leave now] calls `endAbsence`. [Still on leave] calls `confirmLeave`.
  - **Snoozed**: the notice reads "Checked [date]. Flag returns [date] if still open."
- [X] T065 [US6] In `components/drivers/absences-table.tsx`, show an "Open N days" tag (warning or danger tone) beside "Active now" for a flagged leave, and "Checked [last date]" under the status for any confirmed leave.

**Checkpoint**: Stale leaves are flagged everywhere, availability is unchanged, and snooze works.

---

## Phase 9: User Story 7 - Manage absences from the Absences tab (Priority: P2)

**Goal**: Edit and cancel upcoming absences, edit and end early the current one, and return a driver to Active from the Status dropdown.

**Independent Test**: An upcoming day-off shows Edit and Cancel. An active leave shows Edit and End early. Choosing Active in Status opens "Return [Name] to Active?". End now with "Also cancel 1 upcoming absence" ticked: the leave shows Ended early, the day-off shows Cancelled, and the driver is available today.

### Implementation for User Story 7

- [X] T066 [US7] Add `cancelAbsence({ id, expectedUpdatedAt })` to `app/actions/driver-absences.ts` (RPC `cancel_driver_absence`). Make `previewAbsence` and `saveAbsence` handle edit (`id` and `expectedUpdatedAt` present; the release list counts only newly covered today-and-later dates).
- [X] T067 [US7] Add row actions to `components/drivers/absences-table.tsx` (`dropdown-menu` with `alert-dialog` confirms):
  - Upcoming: Edit (opens `absence-dialog.tsx` with the absence) and Cancel.
  - Active now: Edit and End early (calls `endAbsence`).
  - Completed, Cancelled, and Ended early rows have no actions.
- [X] T068 [US7] Create `components/drivers/return-to-active-dialog.tsx`:
  - **Title**: "Return [Name] to Active?", with the absence dates in the body.
  - **Checkbox**: "Also cancel N upcoming absences", shown when any exist.
  - **Buttons**: [Keep absence] and [End absence now], which calls `endAbsence` with `cancelUpcoming`.

  In `components/drivers/driver-status-control.tsx`, choosing Active while absent today opens it, for owner and staff (FR-050). Choosing Active for an Inactive driver (owner only) calls `setDriverStatus` with the toast "[Name] is Active again".

**Checkpoint**: All absence lifecycle actions work from the profile.

---

## Phase 10: User Story 8 - Add a driver from a modal (Priority: P3)

**Goal**: "Add a driver" beside Filters opens an "Add driver" modal. The old form card is gone.

**Independent Test**: Saving with Full name empty shows an inline error. A valid save closes the modal, shows "Driver added", adds the row, and the driver is offered in today's Units dropdowns.

### Implementation for User Story 8

- [X] T069 [US8] Add `isActive` (default true) and `notes` to `driverSchema` in `lib/validation/drivers.ts`, and map them in `createDriver` in `app/actions/drivers.ts` (`is_active`, `notes`). `createDriver` also revalidates `/units` and `/remittances`, so the new Active driver is offered in the Units dropdowns at once (FR-013). The field labels are "Full name", "Role", "Status", "Contact number", "Licence number", "Licence expiry", "Address", "Notes".
- [X] T070 [US8] Create `components/drivers/add-driver-dialog.tsx` (Base UI Dialog, focus trap, Escape closes), titled "Add driver", with a 2-column grid from `sm`:
  - **Fields**: Full name*, Role* (toggle Primary | Backup, default Primary), Status (Active | Inactive, default Active), Contact number* (`type="tel"`), Licence number*, Licence expiry* (`type="date"`), Address, Notes (textarea).
  - **Hint**: "Day-off and On-leave are scheduled from the driver profile, because they need dates."
  - **Validation**: inline errors and a validation summary.
  - **Footer**: [Cancel] [Save driver]. On success it closes, shows the toast "Driver added", and calls `router.refresh()`.

  Reuse the field markup from `components/forms/driver-form.tsx`, then delete that file if it's unused.
- [X] T071 [US8] In `app/(owner)/drivers/page.tsx`, remove the Add driver aside and the `workspace-grid` wrapper, and add the "Add a driver" primary button (plus icon) beside Filters for the owner only, opening `add-driver-dialog.tsx`.

**Checkpoint**: All user stories are functional.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [X] T072 [P] Playwright `tests/e2e/drivers-list.spec.ts` (demo):
  - the five columns and the full-width table
  - Role and Status filters and the badge count
  - the banner with Show them, Clear, and dismiss surviving a reload in the same session
  - the preview panel's counts
  - Add driver modal validation and Escape
  - no horizontal scroll at 360 px
- [X] T073 [P] Playwright `tests/e2e/driver-profile.spec.ts` (demo):
  - at 1440 × 900, the header, summary strip, and details sit within the viewport
  - at 360 px, cards are 2 per row, the tabs scroll, and the page doesn't scroll horizontally
  - tab arrow-key navigation, Load more 8 → 16, the notice copy for each demo driver state
  - the role radiogroup's keyboard behaviour
- [X] T074 [P] Playwright `tests/e2e/driver-absences.spec.ts` (demo): the dialog's open-ended checkbox disables and clears To, the To ≥ From error, the Reason required error, the past-date warning copy and "Save anyway", the release dialog copy, and "Inactive drivers cannot have absences".
- [X] T075 [P] Document the absence, availability, release, role history, and stale flag rules (thresholds and snooze in `fleet_settings`) in `docs/DEVELOPMENT.md`.
- [X] T076 Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm test:e2e`, `corepack pnpm check`, and `corepack pnpm build:vinext`, and fix any failures.
- [X] T077 **Owner approval required**: push both 012 migrations to rolnet-dev, then run the full pgTAP suite through the rollback wrapper (including 340, 350, 360, rls/230, and rls/120), and fix any failures.
- [ ] T078 Walk through `specs/012-drivers-absences-roles/quickstart.md` steps 1–12 on the :3000 live dev server against rolnet-dev, including a staff login and a 360 px viewport, and record the results in `specs/012-drivers-absences-roles/validation.md`. Time the Day-off entry from opening the profile to the toast; it should take under 30 s (SC-001). Confirm that availability, absences with their end dates, and upcoming absences can all be read from the list alone (SC-009).
- [X] T079 Constitution compliance review: in `specs/012-drivers-absences-roles/validation.md`, check the finished work against each principle in `.specify/memory/constitution.md` and the spec's Constitution Compliance table. Cover: no new packages or services (I); derived status and no scheduler (II); soft deletes, audit triggers, single-transaction writes, and past records unchanged (III); 360 px and plain-language errors (IV); the licence Documents tab (V). Record pass or fail per principle.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup. Blocks every story. T004 → T005 → T006 (same file, in order). T009 follows T004–T006.
- **User stories (Phases 3–10)**: all after Phase 2.
- **Polish (Phase 11)**: after the stories to be shipped.

### User Story Dependencies

| Story | Depends on | Notes |
|-------|------------|-------|
| US1 (P1) | Foundational only | MVP |
| US2 (P1) | US1 | Extends the absence dialog and status control |
| US3 (P1) | Foundational | Independent of US1/US2 in code. Its stale second line is completed by US6 |
| US4 (P2) | Foundational | Adds migration 2. Independent of US1–US3 |
| US5 (P2) | US1 (status control, dialog) and US4 (role switch) for the header | Can start its lib and components in parallel |
| US6 (P2) | US3 (list) and US5 (notices, absences table) | |
| US7 (P2) | US5 (absences table) and US1 (dialog) | |
| US8 (P3) | US3 (rebuilt list page) | Ship US3 and US8 together, because US8 removes the old form |

### Within Each User Story

Tests are written alongside or first. Migrations come before types, types before lib, lib before
actions, actions before components, and components before the page.

### Parallel Opportunities

- Phase 1: T001, T002, T003.
- Phase 2: after T004–T006, the tasks T007, T008, T010–T016 run in parallel (different files).
- US3 (T029, T030, T032, T033) and US4 (T038, T039, T043) can run alongside US1/US2.
- US5: T049, T050, T052, T053, T054, T056, T057.
- Polish: T072–T075.

## Parallel Example: User Story 3

```text
Task: "Vitest tests/unit/drivers-list-board.test.ts"            (T029)
Task: "Create lib/drivers/list-board.ts"                        (T030)
Task: "Create components/drivers/driver-status-badge.tsx"       (T032)
Task: "Create components/drivers/availability-preview.tsx"      (T033)
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phases 1 and 2.
2. Phase 3 (US1): absences hide drivers from the Units dropdowns.
3. **Stop and validate**: run the US1 independent test on rolnet-dev (it needs T077's push, with approval).

### Incremental Delivery

1. US1 + US2: absences, with safe release.
2. US3 + US8: new Drivers list and Add driver modal (shipped together).
3. US4: role switch and history.
4. US5: profile redesign.
5. US6 + US7: stale flag and absence management.

Each step leaves lint, typecheck, and tests green.

## Notes

- Never edit a migration after it is pushed to rolnet-dev. Fixes go in a new migration.
- `types/database.ts` is hand-maintained. Do not regenerate it.
- Commit after each task or logical group, on branch `012-drivers-absences-roles`.
