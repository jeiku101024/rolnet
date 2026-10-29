# Tasks: Driver and Unit Status Toggles with Edit Locking

**Input**: Design documents from `specs/005-status-locking/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/status-actions.md](contracts/status-actions.md),
[quickstart.md](quickstart.md)

**Tests**: Included where the project rules require them:
- CLAUDE.md requires pgTAP coverage for every migration.
- The definition of done requires Vitest, lint and typecheck to pass.
- The constitution requires a 360 px acceptance run.

**Organization**: Tasks are grouped by user story. The database rules, the status helpers, the
two status actions and the shared `StatusSelect` are foundational, because every story uses them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: The user story the task belongs to (US1, US2, US3)

## Path Conventions

Single Next.js app at the repository root: `app/`, `components/`, `lib/`, `supabase/`, `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the starting point. No new dependencies or project structure are needed.

- [ ] T001 Confirm that the branch `005-status-locking` is up to date with `origin/main` and that `corepack pnpm lint`, `corepack pnpm typecheck` and `corepack pnpm test` pass before any change; record the baseline at the top of a new `specs/005-status-locking/validation.md` (T026 adds the results)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The database rules, status helpers, actions and shared control used by every story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Create `supabase/migrations/20261030000100_status_locking.sql` with three trigger functions in `public`. Each function is created with `revoke execute ... from public, anon, authenticated`, `set search_path = public`, and is not `security definer`.
  - **`reject_driver_deactivation_with_assignments()`** with trigger `drivers_reject_deactivation_with_assignments` (BEFORE UPDATE OF is_active on `public.drivers`).
    - When: `old.is_active and not new.is_active` and the driver has a `driver_assignments` row with `deleted_at is null and coalesce(ends_on, 'infinity'::date) >= (now() at time zone 'Asia/Manila')::date`.
    - Raises: `errcode = '23503'`, message "This driver still has current or upcoming assignments. End or remove them before setting the driver to Inactive".
  - **`lock_inactive_driver_details()`** with trigger `drivers_lock_inactive_details` (BEFORE UPDATE on `public.drivers`).
    - When: `not old.is_active` and any of `full_name, driver_kind, license_number, phone, address` is distinct from old, or `license_expiry_date` changed to a value that is not the `expires_on` of a non-deleted `documents` row with `document_type = 'driver_license'`, `lifecycle_status = 'current'` and `driver_id = new.id`.
    - Raises: `errcode = '23514'`, message "This driver is Inactive. Set the driver to Active before editing their details".
  - **`lock_out_of_service_unit_details()`** with trigger `units_lock_out_of_service_details` (BEFORE UPDATE on `public.units`).
    - When: `old.status in ('in_repair','retired')` and any of `body_number, plate_number, make_model` is distinct from old.
    - Raises: `errcode = '23514'`, message "This unit is In repair. Set the unit to Active before editing its details" (use "Retired" for retired units).
  - Keep `status`, `is_active`, `current_mileage`, `updated_at`, `updated_by`, `deleted_at` and `deleted_by` changes allowed (research R2–R5).
  - **Recreate `public.renew_compliance_document(p_previous_id uuid, p_document jsonb)`** with the same signature, `security invoker`, `require_owner()` check and grants as in `20261029001500_sync_driver_license_expiry.sql`, but in this order (research R4):
    1. Supersede the previous document.
    2. Insert the renewal as `current`.
    3. Only for `driver_license`: update `drivers.license_expiry_date`.
    4. Set the previous document's `superseded_by_id`.
- [ ] T003 Add the pgTAP test `supabase/tests/constraints/250_status_locking.sql`. Use the patterns of `240_unit_delete_and_license_sync.sql`: owner JWT claims, a rollback-only transaction, and `throws_ok`/`lives_ok`. It covers these cases:
  1. An in-repair or retired unit refuses a `make_model` change (23514).
  2. A locked unit accepts `status` → `active`, then accepts a `make_model` change.
  3. An in-repair unit accepts a `mileage_readings` insert that raises `current_mileage`.
  4. An in-repair unit can be archived and restored with `soft_delete_record`/`restore_record`.
  5. An inactive driver refuses a `phone` change (23514).
  6. An inactive driver refuses a `license_expiry_date` change with no matching current license document.
  7. An inactive driver accepts `renew_compliance_document` updating its expiry, and an active driver's renewal still updates its expiry (regression for the reordered function).
  8. An active driver with a current assignment refuses `is_active = false` (23503).
  9. A driver whose only assignment ended yesterday (Manila) can be set inactive.
  10. Staff updating `units.status` changes no row.
  11. The three new functions have no EXECUTE for `anon` or `authenticated`.
- [ ] T004 Apply the migration locally, then run the database tests and confirm that every test, including the new 250 test, passes:
  ```bash
  corepack pnpm exec supabase db reset && corepack pnpm exec supabase test db
  ```
  Then regenerate the types (the schema shape is unchanged, so expect no diff):
  ```bash
  corepack pnpm exec supabase gen types typescript --local > types/database.ts
  ```
- [ ] T005 [P] Create `lib/status/record-status.ts`.
  - Export `UnitStatus = "active" | "in_repair" | "retired"` and `DriverStatus = "active" | "inactive"`.
  - Export option lists with labels: Active, In repair, Retired; Active, Inactive.
  - Export the tones: unit active success, in_repair warning, retired danger; driver active success, inactive muted.
  - Export `isUnitLocked(status)` (true for `in_repair` and `retired`), `isDriverLocked(isActive)` (true when not active), `driverStatusOf(isActive)`, and `lockedMessage(kind, status)`, which returns the notice text from `contracts/status-actions.md`.
- [ ] T006 [P] Add the status schemas.
  - In `lib/validation/units.ts`:
    - Add `unitStatusSchema = z.object({ id: z.uuid(), status: z.enum(["active","in_repair","retired"]), expectedStatus: z.enum(["active","in_repair","retired"]) })`.
    - Add `unitDetailsSchema`: `unitSchema` without `status`, plus `expectedUpdatedAt: z.iso.datetime({ offset: true })`.
  - In `lib/validation/drivers.ts`:
    - Add `driverStatusSchema = z.object({ id: z.uuid(), status: z.enum(["active","inactive"]), expectedStatus: z.enum(["active","inactive"]) })`.
    - Add `expectedUpdatedAt` to the update input used by `updateDriver`.
- [ ] T007 [P] Add the Vitest file `tests/unit/record-status.test.ts`. It covers `isUnitLocked`, `isDriverLocked`, `lockedMessage` for each status, and the three schemas from T006: valid input, a bad uuid, an unknown status, a missing `expectedStatus`, and a missing `expectedUpdatedAt` for `unitDetailsSchema`.
- [ ] T008 Add `setUnitStatus(input)` to `app/actions/units.ts`, per `contracts/status-actions.md`.
  - Guard with `requirePermission("manage_master_data")` and parse with `unitStatusSchema`.
  - Read the current row (`id, status, updated_at`, `deleted_at is null`); a missing row gives `NOT_FOUND`.
  - If the status is unchanged, return `ok` without writing.
  - Otherwise update with `.eq("id", id).eq("status", expectedStatus).select("id, status, updated_at").maybeSingle()`. Do not compare `updated_at`, because mileage readings also change it (research R8).
  - If no row is returned, re-read: return `ok` if the status now equals the requested one, otherwise `STALE_RECORD` "This unit was changed by someone else. It is now {Label}."
  - Revalidate `/units` and `/units/{id}`.
  - Change `updateUnit` to use `unitDetailsSchema`, stop writing `status`, add `.eq("updated_at", expectedUpdatedAt)`, and return `STALE_RECORD` when no row matches.
- [ ] T009 Add `setDriverStatus(input)` to `app/actions/drivers.ts`.
  - Use the same flow as T008 with `driverStatusSchema`, mapping `active` to `is_active = true` and comparing `.eq("is_active", expectedStatus === "active")`.
  - The trigger's 23503 message from T002 reaches the user unchanged through `run()`.
  - Revalidate `/drivers` and `/drivers/{id}`.
  - Add the `expectedUpdatedAt` stale check to `updateDriver`.
- [ ] T010 Create the client component `components/forms/status-select.tsx`.
  - Props: `kind: "unit" | "driver"`, `id`, `value` (the saved status, sent as `expectedStatus`), `label`.
  - Reset the local value whenever the `value` prop changes (for example, render it with `key={value}` or sync it in an effect), so the control shows the saved status after the page refreshes.
  - Render the `Select` from `components/ui/form-field.tsx` with the options from `lib/status/record-status.ts` and `aria-label={label}`, full width with no fixed width.
  - On change: show the new value at once, disable the control while saving, and call `setUnitStatus` or `setDriverStatus` inside `useTransition`.
  - On `ok: false`: revert to the saved value and show the message in a `<p role="alert" className="mt-1 text-body-sm text-danger">` under the control.
  - Use only tokens from `app/globals.css`; no hex colours or arbitrary sizes.
- [ ] T011 [P] Create the server component `components/records/status-history.tsx`.
  - Read the latest 10 `audit_events` rows for `entity_type` (`units` or `drivers`) and `entity_id` where `action <> 'insert'` and `changed_fields->'before'->>'status' is distinct from changed_fields->'after'->>'status'`. For drivers, compare `is_active` instead.
  - `actor_user_id` references `auth.users`, so fetch display names with a second query: `profiles` by `user_id in (...)`.
  - Render a list with the old and new label, the actor's `profiles.display_name`, and the time formatted in Asia/Manila.
  - Empty state: "No status changes recorded yet."

**Checkpoint**: The database refuses locked edits from every route; both actions and `StatusSelect` work

---

## Phase 3: User Story 1 - Change a driver's status from the driver page (Priority: P1) 🎯 MVP

**Goal**: The owner switches a driver between Active and Inactive on `/drivers/{id}`, and the
change is saved and visible in the status history.

**Independent Test**: Open an active driver with no assignment, set Inactive, reload: Inactive is
kept and the history shows the change with the owner and the time. Set Active again. Try to
deactivate a driver with a current assignment: refused with the "End or remove them" message.

- [ ] T012 [US1] In `app/(owner)/drivers/[id]/page.tsx`:
  - Select `updated_at` with the driver (used by the edit form in T018).
  - For the owner, render `StatusSelect` (`kind="driver"`, `label="Status for {full_name}"`) in place of the static Active/Inactive `StatusBadge`; staff keep the badge.
  - Render `StatusHistory` for drivers below the license block, owner only.
- [ ] T013 [US1] Check the driver page at 360 × 800, following quickstart rows 6, 7 and 10:
  - The select and history fit with no horizontal scroll.
  - A refused change reverts and shows the message.
  - Picking the same status writes no new history row.

**Checkpoint**: User Story 1 is fully usable on its own

---

## Phase 4: User Story 2 - Locked editing for inactive drivers and in-repair units (Priority: P1)

**Goal**: Active records can be edited from their pages. Locked records show read-only details
with a notice, and only the status control can unlock them. Daily operations keep working.

**Independent Test**: Set a driver Inactive and a unit In repair. Both pages show the locked
notice and no edit form, and a REST `PATCH` of a detail field is refused. Record a mileage
reading and a maintenance entry for the unit; both save. Set both records back to Active: the edit
forms appear without a reload and saves succeed.

- [ ] T014 [P] [US2] Create `components/records/locked-notice.tsx`.
  - Props: `kind`, `status`.
  - Renders the existing `feedback.tsx` notice style with an icon and `lockedMessage(kind, status)` from `lib/status/record-status.ts`, inside `role="status"`.
- [ ] T015 [P] [US2] Create the client component `components/forms/unit-details-form.tsx`.
  - Props: `unit: { id, body_number, plate_number, make_model, updated_at }`.
  - Fields: body number (`maxLength={40}`, required), plate number (`maxLength={20}`, required, uppercased), make and model (`maxLength={120}`, required).
  - Submits through `updateUnit` with `expectedUpdatedAt`, using `useActionForm`, `FormPanel` and `FormFooter` like `components/forms/unit-form.tsx`.
  - Success message: "Unit details saved."
- [ ] T016 [P] [US2] Create the client component `components/forms/driver-details-form.tsx`.
  - Fields: full name (required, 1–160 characters), driver type (primary/backup), license number (required, 1–80), license expiry date (`type="date"`, required), phone (required, 3–40, `inputMode="tel"`), address (optional).
  - Submits through `updateDriver` with `expectedUpdatedAt`.
  - Success message: "Driver details saved."
- [ ] T017 [US2] In `app/(owner)/units/[id]/page.tsx`:
  - Select `updated_at` with the unit.
  - For the owner, render `StatusSelect` (`kind="unit"`) next to the unit's status badge.
  - When `isUnitLocked(unit.status)`, render `LockedNotice` and the details as read-only text; otherwise render "Edit details" with `UnitDetailsForm`.
  - Render `StatusHistory` for units, owner only.
  - Keep the mileage, assignment, parts and documents sections unchanged and usable for locked units (FR-009).
- [ ] T018 [US2] In `app/(owner)/drivers/[id]/page.tsx`:
  - When `isDriverLocked(driver.is_active)`, render `LockedNotice` above the read-only license block.
  - Otherwise, for the owner, render "Edit details" with `DriverDetailsForm`.
- [ ] T019 [US2] Check quickstart rows 2, 3, 4, 5, 8 and 9 at 360 × 800 against the local or rolnet-dev database:
  - Locked pages show the notice and no form.
  - Mileage, maintenance and an expense save for an in-repair unit.
  - A REST `PATCH` of `make_model` with the owner JWT is refused.
  - After setting Active, the form appears without a manual reload.
  - An inactive driver's license renewal updates the expiry.

**Checkpoint**: User Stories 1 and 2 both work on their own

---

## Phase 5: User Story 3 - Change status from the drivers and units tables (Priority: P2)

**Goal**: The Status column of `/units` and `/drivers` is a dropdown that saves straight away.

**Independent Test**: On `/units`, set a unit to In repair from its row and reload: kept. On
`/drivers`, set a driver Inactive: kept. A refused change reverts with the message, and the
search text stays.

- [ ] T020 [P] [US3] In `app/(owner)/units/page.tsx`:
  - For the owner, render `StatusSelect` (`kind="unit"`, `label="Status for Body {body_number}"`) in the Status cell in place of `StatusBadge`; staff keep the badge.
- [ ] T021 [P] [US3] In `app/(owner)/drivers/page.tsx`:
  - For the owner, render `StatusSelect` (`kind="driver"`, `label="Status for {full_name}"`) in the existing Status cell; staff keep the badge.
- [ ] T022 [US3] Check quickstart rows 1, 11 and 12 at 360 × 800:
  - The table has no horizontal scroll.
  - Search text is kept after a change.
  - A stale change from a second tab is refused with "changed by someone else".
  - Staff see the owner-only notice, and a staff REST `PATCH` of `status` changes no row.
  - Time two status changes from a list row (tap to saved): each is under 5 s with two taps (SC-001); record the times in `specs/005-status-locking/validation.md`.

**Checkpoint**: All user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and records

- [ ] T023 [P] Update the demo data in `lib/demo/mode.ts`, so `NEXT_PUBLIC_DEMO_MODE=true` still renders `/units`, `/drivers` and their detail pages (with `updated_at` on the demo rows for the edit forms), and make `StatusSelect` read-only in demo mode
- [ ] T024 [P] Update `docs/DEVELOPMENT.md` business rules: Inactive drivers and In repair or Retired units have locked details; daily operations stay allowed; drivers with current or upcoming assignments cannot be set Inactive
- [ ] T025 Run the definition of done and fix any failure:
  - `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`
  - `corepack pnpm exec supabase db reset && corepack pnpm exec supabase test db`
  - `corepack pnpm exec next build`, which must log no prerender errors (`app/(owner)/*/loading.tsx` already provides the boundaries)
- [ ] T026 Run the full `specs/005-status-locking/quickstart.md` table at 360 × 800 as owner and staff, and record pass/fail for each row in a new `specs/005-status-locking/validation.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks every story. T002 → T003 → T004; T005 and T006 can run alongside T002; T007 needs T005 and T006; T008 and T009 need T006; T010 needs T005, T008 and T009; T011 needs T005.
- **User Story 1 (Phase 3)**: Depends on Phase 2.
- **User Story 2 (Phase 4)**: Depends on Phase 2. T018 edits the same file as T012, so run it after T012.
- **User Story 3 (Phase 5)**: Depends on Phase 2 only.
- **Polish (Phase 6)**: Depends on the stories being complete.

### User Story Dependencies

- **US1**: Independent after Phase 2.
- **US2**: Independent after Phase 2 for units. Its driver-page task (T018) follows T012 because both edit `app/(owner)/drivers/[id]/page.tsx`.
- **US3**: Independent after Phase 2.

### Within Each User Story

- Components ([P]) come before the page that uses them; the 360 px check comes last.

### Parallel Opportunities

- **Phase 2:** T005, T006 and T011 can run in parallel with T002 and T003.
- **US2:** T014, T015 and T016 can run in parallel.
- **US3:** T020 and T021 can run in parallel, and alongside US1 or US2 once Phase 2 is done.
- **Polish:** T023 and T024 can run in parallel.

---

## Parallel Example: User Story 2

```text
Task: "T014 [P] [US2] Create components/records/locked-notice.tsx"
Task: "T015 [P] [US2] Create components/forms/unit-details-form.tsx"
Task: "T016 [P] [US2] Create components/forms/driver-details-form.tsx"
# then T017 (unit page) and T018 (driver page, after T012)
```

## Parallel Example: User Story 3

```text
Task: "T020 [P] [US3] Status dropdown in app/(owner)/units/page.tsx"
Task: "T021 [P] [US3] Status dropdown in app/(owner)/drivers/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phases 1 and 2. The database lock already protects every route at this point.
2. Complete Phase 3 (the driver page status control and history).
3. Stop and validate with quickstart rows 6, 7 and 10.

### Incremental Delivery

1. Foundation, then US1: the owner can deactivate and reactivate drivers (MVP).
2. US2: edit forms for active records, and locked pages for inactive or out-of-service records.
3. US3: one-tap status changes from the lists.
4. Polish: demo mode, docs, gates and the validation record.

### Parallel Team Strategy

After Phase 2, one developer takes US1 and then T018. A second takes the unit side of US2 (T014,
T015, T017). A third takes US3 (T020, T021).

---

## Notes

- [P] tasks touch different files and have no unfinished dependencies.
- Never edit a pushed migration; any later fix goes in a new migration file with pgTAP coverage.
- Keep error messages in plain language, with the recovery step (Principle IV).
- Commit after each task or logical group.
