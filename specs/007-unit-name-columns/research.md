# Research: Unit Name and Register Columns

No NEEDS CLARIFICATION items remained in the Technical Context. Each decision below settles a design
choice found while reading the current units code.

## R1. Where the unit name lives

- **Decision**: Add a `name text not null` column to `public.units` in a new migration, with a
  check of 1–40 trimmed characters and a partial unique index on `lower(trim(name)) where deleted_at is null`.
- **Rationale**: It matches how `body_number` and `plate_number` are stored and made unique
  (`20261019001000_create_units.sql`). A deleted unit's name can be reused, as the spec requires.
- **Alternatives considered**: Reusing `body_number` for the name was rejected because the spec
  keeps both values. A separate "unit labels" table adds a join for one text field.

## R2. Backfill, and inserts that don't send a name

- **Decision**: In the migration, add the column as nullable, backfill `name = body_number`, then set
  it `not null`. Add a `before insert or update` trigger, `units_default_name`, that sets
  `name := trim(body_number)` when `name` is null or blank.
- **Rationale**: Existing rows get a name without a manual step (FR-004, SC-001). 24 pgTAP files and
  `supabase/seed.sql` insert units without a name. Keeping them valid avoids an unrelated edit to every
  test, and the generic `/api` units create path (`lib/domain/resource-config.ts`) keeps working. The
  app forms always send a name, so the fallback only covers old and internal callers.
- **Alternatives considered**: A column default can't refer to another column. Making `name` nullable
  would break SC-001. Editing all 24 test files and the seed was rejected as churn with no user value.
- **Collision check**: Body numbers are unique among active units, so the backfilled names are too.
  A unit whose body number equals another unit's chosen name falls back to a name that is already in
  use; the unique index then rejects that insert, and the error message tells the owner to choose a name.

## R3. Who counts as the "current driver"

- **Decision**: Reuse `coverageOn(fleetToday(), assignments, daysOff)` from
  `lib/assignments/coverage.ts`, the logic the unit page already uses for its "Operating driver" line:
  - a primary on a day off, covered by a backup → the backup, marked "Backup";
  - a primary on a day off with no backup → "Day off · no backup", in the warning tone;
  - no primary covering today → "Unassigned", muted;
  - otherwise → the primary driver.
- **Rationale**: In this schema a backup always covers a primary's day off (`backup_shape_check`).
  Reusing the helper keeps the register and the unit page in agreement. It refines spec FR-007, which
  is updated to match.
- **Archived drivers**: archiving a driver does not end their assignments, and `drivers` RLS hides
  archived rows (`deleted_at is null`), so the embedded name comes back null. The register drops
  those assignment rows before calling `coverageOn`, so the unit shows "Unassigned" (spec edge case).
- **Alternatives considered**: A SQL view or RPC for the current driver would need a new function with
  grants and pgTAP tests for display-only data. The page already reads assignments under the existing
  RLS policies. Staff can read `driver_assignments`, `driver_days_off` and `drivers`, so the column
  works for them too.

## R4. Loading drivers for one register page

- **Decision**: After the paged units query, make two queries scoped to that page's unit ids (at most
  one page of rows): `driver_assignments` (primary rows that cover today, and backup rows dated today,
  with `drivers(full_name)`) and today's `driver_days_off` for those primaries. Group the rows by unit
  in a small pure helper, `currentDrivers(unitIds, assignments, daysOff, today)`, built on `coverageOn`.
- **Rationale**: The cost stays bounded by page size, needs no schema work, and the helper can be
  unit-tested with Vitest.
- **Alternatives considered**: Embedding assignments in the units select returns the whole assignment
  history per unit. A database function was rejected as in R3.

## R5. Search and sort

- **Decision**: Add `name` to `searchSpecs.units.columns`. Add sorts "Name, A to Z" (`name` ascending,
  the new default because it comes first) and "Name, Z to A", each with `body_number` as a tie-breaker.
  Keep the body-number and mileage sorts. Add `name` to `sortFields`, `createFields` and `updateFields`
  in `resource-config.ts`.
- **Rationale**: Covers FR-008 and FR-009. Plain text order puts "ROLNET-10" before "ROLNET-2"; that
  is acceptable and matches how body numbers sort today.
- **Alternatives considered**: Natural (numeric-aware) sorting needs a collation or a computed column.
  That is out of scope.

## R6. Labels, page title, error message

- **Decision**: The forms gain a "Unit name" field first, placeholder "e.g. ROLNET-1". "Make and
  model" is relabelled "Motorcycle" in both forms, in the validation `labels` map, and in the register
  header. The unit page title becomes the name, and its description becomes
  `Body {body_number} · {plate} · {motorcycle}`. The status select's accessible label uses the name.
  `lib/actions/errors.ts` maps `units_name_unique` to `DUPLICATE_UNIT_NAME`: "Another unit already
  uses this name. Choose a different name."
- **Rationale**: FR-003, FR-006 and FR-010, in plain language, as Principle IV requires.

## R7. 360 px layout

- **Decision**: Keep the shared `DataTable`, whose table scrolls inside its own region
  (`.data-scroll`, `min-width: var(--space-table-min)`), as every list in the app already does. The page
  itself does not scroll sideways. Driver names wrap within their cell.
- **Rationale**: This is the established, accepted pattern for record tables, and it is how feature 002
  interpreted the constitution's "without horizontal scrolling": a bounded table overflow region is
  allowed, and page-wide scrolling is not (002 spec FR-005, SC-005). Turning the table into cards on
  phones would be a redesign beyond "the rest stay the same".

## R8. Demo mode

- **Decision**: Give `demoUnits` names `ROLNET-1`…`ROLNET-12`. Keep their body numbers (`T-001`…),
  because other demo rows and existing e2e tests refer to them. Work out
  the demo current drivers from `demoAssignments` and `demoBackupAssignments` with the same helper.
  Add more demo primary assignments so most rows show a driver, one shows a backup, and some show
  "Unassigned".
