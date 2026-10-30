# Tasks: Unit Name and Register Columns

**Input**: Design documents from `specs/007-unit-name-columns/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/units-register.md](contracts/units-register.md),
[quickstart.md](quickstart.md)

**Tests**: Included where the project rules require them:
- CLAUDE.md requires pgTAP coverage for every migration.
- The definition of done requires lint, typecheck and Vitest to pass.
- The constitution requires a 360 px acceptance run, so there are Playwright checks. Playwright runs
  in demo mode on a 360 px "mobile" project (`playwright.config.ts`).

**Organization**: Tasks are grouped by user story. US1 (unit name) owns the migration, because only
the name needs new data. US2 (Motorcycle label) and US3 (current driver) touch only the app. All
three stories edit `app/(owner)/units/page.tsx`, so the tasks on that file run one after another.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: The user story the task belongs to (US1–US3)

## Path Conventions

Single Next.js app at the repository root: `app/`, `components/`, `lib/`, `tests/`, `supabase/`.
AGENTS.md: before changing page code, read
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (`searchParams`
is a Promise).

---

## Phase 1: Setup

**Purpose**: Put the feature on its own branch, as CLAUDE.md requires.

- [X] T001 Create branch `007-unit-name-columns` from an up-to-date `main` (merge or stash the `feat/006-toolbar-redesign` work first) and carry over the uncommitted `specs/007-unit-name-columns/` folder and `.specify/feature.json`

---

## Phase 2: Foundational

**Purpose**: None. No work blocks all three stories. US1's migration blocks only US1's tasks, and
US2 and US3 can start right after Setup.

---

## Phase 3: User Story 1 — Name each tricycle (Priority: P1) 🎯 MVP

**Goal**: Every unit has a unique fleet name, shown in the register's Unit column, with the body
number in its own Body number column. The name can be set when adding a unit, edited later,
searched and sorted.

**Independent Test**: Add a unit named "ROLNET-1" with body "0633". The register shows "ROLNET-1"
(a link) under Unit and "0633" under Body number. A second unit named " rolnet-1 " is rejected.
Searching "ROLNET-1" finds the unit.

### Database (blocks the rest of US1)

- [X] T002 [US1] Create `supabase/migrations/20261030000200_add_unit_name.sql`:
  - `alter table public.units add column name text`.
  - Backfill `update public.units set name = trim(body_number)` for all rows, including soft-deleted ones.
  - `alter column name set not null`.
  - Add `constraint units_name_length check (length(trim(name)) between 1 and 40)`.
  - `create unique index units_name_unique on public.units (lower(trim(name))) where deleted_at is null`.
  - Add the trigger function `public.units_default_name()` (`language plpgsql`,
    `set search_path = public`). When `new.name is null or length(trim(new.name)) = 0`, it sets
    `new.name := trim(new.body_number)`.
  - Attach it with `create trigger units_default_name before insert or update on public.units for each row`.
  - `revoke all on function public.units_default_name() from public, anon, authenticated`.
  - Leave the RLS policies as they are.
- [X] T003 [US1] Create pgTAP test `supabase/tests/constraints/260_unit_name.sql`, following the
  `begin; select plan(n); … select * from finish(); rollback;` style of
  `supabase/tests/constraints/250_status_locking.sql`. Assert that:
  - `units.name` exists and is `not null`;
  - an insert without `name` gets `trim(body_number)`;
  - an explicit name is kept;
  - a name of `'   '` falls back to the body number;
  - a 41-character name fails `units_name_length`;
  - a second active unit named `' ROLNET-1 '` fails against `'rolnet-1'` with a unique violation;
  - after soft-deleting the first unit (`deleted_at = now()`), the name can be reused;
  - renaming a unit writes a business audit row whose new row data holds the new name (check the
    audit table that `supabase/tests/constraints/080_business_audit.sql` asserts on);
  - `anon` and `authenticated` have no EXECUTE on `public.units_default_name()`
    (`has_function_privilege`).
- [X] T004 [US1] Run `corepack pnpm exec supabase db reset && corepack pnpm exec supabase test db` (all files pass, the 24 existing files that insert units without a name included), then regenerate `types/database.ts` with `corepack pnpm exec supabase gen types typescript --local > types/database.ts`

### Validation, actions, errors

- [X] T005 [P] [US1] In `lib/validation/units.ts`, add `name: z.string().trim().min(1).max(40)` as the first field of `unitSchema`; `unitDetailsSchema` inherits it through `.omit({ status: true })`
- [X] T006 [P] [US1] In `lib/actions/errors.ts`, add `units_name_unique: { code: "DUPLICATE_UNIT_NAME", message: "Another unit already uses this name. Choose a different name." }` next to `units_body_number_unique`, and add `units_name_length: { code: "INVALID_UNIT_NAME", message: "Use a unit name of 1 to 40 characters." }` for callers of the generic API. Then add cases to `tests/unit/action-errors.test.ts` showing that both constraints map to their codes and messages (check how the file matches check-constraint names compared with unique indexes, and follow that)
- [X] T007 [US1] In `app/actions/units.ts`, add `name: "unit name"` to `labels`; write `name: value.name` in the `insert` of `createUnit` and in the `update` of `updateUnit` (depends on T004, T005)
- [X] T008 [P] [US1] In `lib/domain/resource-config.ts`, add `"name"` to the `units` entry's `createFields`, `updateFields` and `sortFields` (contract: optional on create; the database falls back to the body number)

### Forms

- [X] T009 [P] [US1] In `components/forms/unit-form.tsx`, add a first field `<FormField label="Unit name" required><Input required name="name" maxLength={40} placeholder="e.g. ROLNET-1" /></FormField>` above the body/plate grid, and pass `name: text(data, "name")` to `createUnit`
- [X] T010 [P] [US1] In `components/forms/unit-details-form.tsx`, add `name: string` to the `Unit` type, the same "Unit name" field with `defaultValue={unit.name}`, and `name: text(data, "name")` in the `updateUnit` call

### Search, sort, demo data

- [X] T011 [P] [US1] In `lib/pagination/search-specs.ts`, change `searchSpecs.units.columns` to `["name", "body_number", "plate_number", "make_model"]`
- [X] T012 [P] [US1] In `lib/pagination/list-control-specs.ts`, put these first in `listControlSpecs.units.sorts`, so name A to Z becomes the default:
  - `{ value: "name", label: "Name, A to Z", column: "name", ascending: true, then: [{ column: "body_number", ascending: true }] }`
  - `{ value: "name-desc", label: "Name, Z to A", column: "name", ascending: false, then: [{ column: "body_number", ascending: true }] }`

  Keep the body and mileage sorts. Update `tests/unit/list-controls.test.ts` so an unknown `sort` on units falls back to `name`.
- [X] T013 [P] [US1] In `lib/demo/mode.ts`, add `name` to every `demoUnits` row: `ROLNET-1` and `ROLNET-2` for the first two, and `` `ROLNET-${index + 3}` `` in the generated rows. Keep the `body_number` values (`T-001`…), because other demo rows and e2e tests use them

### Pages

- [X] T014 [US1] In `app/(owner)/units/page.tsx` (depends on T004, T011–T013):
  - Add `name` to the units `select`.
  - Add `unit.name` to the demo search text.
  - Change `headers` to `["Unit", "Body number", "Plate", "Model", "Mileage", "Status"]`.
  - Render the first cell as the name link (`<Link className="muted-link" href={`/units/${unit.id}`}>{unit.name}</Link>`).
  - Add `<td className="font-data">{unit.body_number}</td>`.
  - Change the `StatusSelect` label to `` `Status for ${unit.name}` ``.

  US2 relabels "Model" and US3 inserts "Current driver".
- [X] T015 [US1] In `app/(owner)/units/[id]/page.tsx` (depends on T004):
  - Add `name` to the unit `select`.
  - Set the `PageHeader` `title={unit.name}` and `` description={`Body ${unit.body_number} · ${unit.plate_number} · ${unit.make_model}`} ``.
  - Change the `StatusSelect` label to `` `Status for ${unit.name}` ``.
  - Pass `name` through to `UnitDetailsForm`.

### Story check

- [X] T016 [US1] Create `tests/e2e/units-register.spec.ts` (demo mode, 360 px). Check that `/units` shows the "Unit" and "Body number" headers, that the first row's Unit link reads `ROLNET-1` and its Body number cell reads `T-001`, that searching `ROLNET-2` leaves one row, and that `?sort=name-desc` puts the highest name first

**Checkpoint**: US1 works on its own: names are stored, unique, editable, searchable and sortable.

---

## Phase 4: User Story 2 — Show the motorcycle (Priority: P2)

**Goal**: The make and model is labelled "Motorcycle" everywhere on the Units page and in the unit forms.

**Independent Test**: The register header reads "Motorcycle" and shows "Yamaha YTX" for the second demo unit; both forms label the field "Motorcycle".

- [X] T017 [P] [US2] In `components/forms/unit-form.tsx` and `components/forms/unit-details-form.tsx`, change `label="Make and model"` to `label="Motorcycle"` and add `placeholder="e.g. Yamaha YTX"` to the `makeModel` input in the add form
- [X] T018 [P] [US2] In `app/actions/units.ts`, change the `labels.makeModel` value from `"make and model"` to `"motorcycle"`, so validation messages use the new word
- [X] T019 [US2] In `app/(owner)/units/page.tsx`, rename the `"Model"` header to `"Motorcycle"` (after T014)
- [X] T020 [US2] In `tests/e2e/units-register.spec.ts`, assert that a "Motorcycle" column header exists, that the second row shows `Yamaha YTX`, and that the add-unit panel has a field labelled "Motorcycle"

**Checkpoint**: US2 is visible with no data change.

---

## Phase 5: User Story 3 — See who is driving each unit (Priority: P2)

**Goal**: A Current driver column shows today's operator per unit, using the same rules as the unit page.

**Independent Test**: In demo mode, rows show a primary driver's name, a backup driver with a
"Backup" badge, "Day off · no backup", and "Unassigned".

- [X] T021 [P] [US3] Create `lib/assignments/current-drivers.ts`, exporting
  `currentDrivers(unitIds: string[], assignments: (AssignmentRow & { unit_id: string })[], daysOff: DayOffRow[], today: string)`.
  It groups assignments by `unit_id`, calls `coverageOn(today, unitAssignments, daysOff)` from
  `lib/assignments/coverage.ts` for each unit, and returns a
  `Map<string, { kind: "primary" | "backup" | "day-off" | "unassigned"; driverName?: string; driverId?: string }>`:
  - `operator` set and `backup` set → `backup`;
  - `operator` set → `primary`;
  - `dayOff` set but no `operator` → `day-off`;
  - otherwise → `unassigned`.
- [X] T022 [P] [US3] Create `tests/unit/current-drivers.test.ts`, covering:
  - a primary driver with no day off;
  - a day off covered by a backup;
  - a day off with no backup;
  - no primary;
  - a primary that ended yesterday (`ends_on < today`);
  - a primary starting tomorrow;
  - two units in one call, so results don't leak between units;
  - a unit with no assignment rows at all (the shape left after T024 drops rows for archived drivers).

  Follow the fixtures in `tests/unit/assignment-coverage.test.ts`.
- [X] T023 [P] [US3] In `lib/demo/mode.ts`, add `export const demoUnitAssignments` (primary rows for `demoUnits[0..7]` with `unit_id`, `driver_id`, `driverName` from `demoDrivers` of kind `"primary"`, `starts_on: addDays(today, -30)`, `ends_on: null`, `covered_primary_assignment_id: null`; plus one backup row for `demoUnits[2]` (T-003) dated `today` covering its primary, reusing Pedro Santos and the id of `demoBackupAssignments[0]` so the dashboard demo agrees) and `export const demoUnitDaysOff` (today's day off for the primaries of `demoUnits[1]` (no backup) and `demoUnits[2]` (covered)). Units 9–12 stay unassigned. Leave `demoAssignments` and `demoBackupAssignments` unchanged, because the remittances page and dashboard use them
- [X] T024 [US3] In `app/(owner)/units/page.tsx` (after T019), load current drivers for the page's units. Use `fleetToday()` from `lib/dates/fleet-date.ts`.
  - Live mode: with `ids = units.map((u) => u.id)` and `ids.length > 0`, read
    `supabase.from("driver_assignments").select("id, unit_id, assignment_type, starts_on, ends_on, driver_id, covered_primary_assignment_id, drivers(full_name)").in("unit_id", ids).is("deleted_at", null).lte("starts_on", today).or(`ends_on.is.null,ends_on.gte.${today}`)`.
    Drop rows whose `one(r.drivers)` is null (an archived driver hidden by RLS), so the unit shows
    "Unassigned", then map the rest to `driverName: one(r.drivers)!.full_name`, with `one` from
    `lib/supabase/embed.ts`. Then read
    `supabase.from("driver_days_off").select("id, primary_assignment_id, day_off_date, notes").in("primary_assignment_id", primaryIds).eq("day_off_date", today).is("deleted_at", null)`.
  - Demo mode: use `demoUnitAssignments` and `demoUnitDaysOff`.
  - Build the map with `currentDrivers`. Insert the `"Current driver"` header after "Motorcycle".
  - Render the cell:
    - `primary` → the driver's name;
    - `backup` → the name followed by `<StatusBadge label="Backup" tone="muted" />` (`StatusBadge` tones are `success | warning | danger | muted`);
    - `day-off` → `<StatusBadge label="Day off · no backup" tone="warning" />`;
    - `unassigned` → `<span className="text-muted">Unassigned</span>`.
- [X] T025 [US3] In `tests/e2e/units-register.spec.ts`, assert that a "Current driver" header exists, that row 1 shows a driver name, that the `ROLNET-3` row shows a "Backup" badge, that the `ROLNET-2` row shows "Day off · no backup", and that an unassigned row shows "Unassigned"

**Checkpoint**: All three stories work; the register matches the contract's column order.

---

## Phase 6: Polish & Cross-Cutting

- [X] T026 [P] In `tests/e2e/units-register.spec.ts`, add a 360 px check: `document.documentElement.scrollWidth <= 360` on `/units` (the page itself doesn't scroll sideways; only the table region does)
- [X] T027 [P] Update the units section of `docs/DEVELOPMENT.md` (business rules): units have a unique name (1–40 chars, defaulting to the body number), and the register shows the current driver using the unit-page coverage rules
- [X] T028 Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm exec supabase test db` and `corepack pnpm test:e2e`, and fix any failures (existing specs such as `tests/e2e/list-sort-filter.spec.ts` and `tests/e2e/paged-lists.spec.ts` touch `/units`)
- [ ] T029 Walk through [quickstart.md](quickstart.md) against local Supabase as the owner and as staff, at 360 px and on desktop, then record the results in `specs/007-unit-name-columns/validation.md`. At 360 px, include long names (40 characters), long motorcycle text and long driver names, and confirm no cell text overlaps (SC-005)

---

## Dependencies & Execution Order

- **Setup (T001)** comes first.
- **US1**: T002 → T003 → T004. T005, T006, T008, T009–T013 can run in parallel any time after T001. T007 needs T004 and T005. T014 and T015 need T004. T016 comes last.
- **US2**: T017 and T018 can start after T001. T019 waits for T014, because they edit the same file. T020 needs T016's file.
- **US3**: T021, T022 and T023 can start after T001. T024 waits for T019 (same file) and T021. T025 needs T024.
- **Polish**: after all stories.

Story order: US1 → US2 → US3 for `app/(owner)/units/page.tsx`. Everything else in US2 and US3 is independent of US1.

## Parallel Execution Examples

- **US1**: once T001 is done, run T005, T006, T008, T009, T010, T011, T012 and T013 together while T002 and T003 are written.
- **US2**: T017 alongside T018.
- **US3**: T021 (helper), T022 (its test) and T023 (demo data) together, then T024.

## Implementation Strategy

1. **MVP = US1**: the migration, the name in forms, search and sort, and the register's Unit and
   Body number columns. This alone gives the fleet its names.
2. **US2**: a quick relabel; ship it with US1 or right after.
3. **US3**: the Current driver column; read-only and no schema work.
4. **Polish**: the 360 px check, docs, the full test run, and the quickstart validation.
