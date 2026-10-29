# Research: Driver and Unit Status Toggles with Edit Locking

No `NEEDS CLARIFICATION` items remained after the spec's clarification session. The decisions
below come from the current code (`app/actions/units.ts`, `app/actions/drivers.ts`, the
`(owner)` pages, `lib/domain/resource-config.ts`, and the migrations up to
`20261029001500_sync_driver_license_expiry.sql`).

## R1. Where the lock is enforced

- **Decision**: In the database, with `BEFORE UPDATE` triggers on `public.units` and
  `public.drivers`. The UI and server actions also check, but only to give a clearer message
  sooner.
- **Rationale**:
  - Owners can update these tables through three routes: Server Actions, `/api/v1/units|drivers`
    (`lib/domain/resource-config.ts` lists `status` and `is_active` as update fields), and direct
    REST with their JWT.
  - Only a trigger covers all three (SC-002).
  - This follows the project's earlier fixes, such as `guard_soft_delete_columns` and
    `drivers_license_expiry_matches_document`.
- **Alternatives considered**:
  - Checks in the server actions only: rejected, because `/api/v1` and REST would bypass them.
  - A narrower RLS `with check`: rejected, because RLS cannot compare `OLD` with `NEW` columns.

## R2. Which state decides the lock

- **Decision**: The row's **old** state.
  - If the old row is locked (a driver with `is_active = false`; a unit with
    `status in ('in_repair','retired')`), only these columns may change: the status column, the
    system columns (`updated_at`, `updated_by`, `deleted_at`, `deleted_by`), the unit's
    `current_mileage`, and the driver's `license_expiry_date` (see R4).
  - If the old row is Active, any change is allowed, including locking and editing in the same
    request.
- **Rationale**:
  - It is one simple rule.
  - Unlocking takes its own explicit step, which is what the spec asks ("unless toggled to
    active").
  - Archive and restore keep working on locked rows.
- **Alternatives considered**: Checking the new state was rejected. It would block an edit made
  together with the switch to Active (allowed by the spec, but surprising), and it would block a
  lock and an edit in the same request.

## R3. Mileage on a locked unit

- **Decision**: `current_mileage` is exempt from the unit lock.
- **Rationale**:
  - Mileage readings are a daily operation (FR-009).
  - Two places update `units.current_mileage`: the mileage-reading trigger
    (`20261029000800_reject_mileage_above_later_reading.sql`) and
    `20261027000200_add_operational_crud_functions.sql`. Both must keep working on in-repair
    units.
- **Alternatives considered**: Making those functions bypass the lock with a session flag was
  rejected; it adds hidden state.

## R4. License expiry on a locked driver

- **Decision**: On an Inactive driver, `license_expiry_date` may change only to the `expires_on`
  of a current, non-deleted `driver_license` document for that driver. All other detail changes
  are refused.
- **Rationale**:
  - `renew_compliance_document` updates the driver's expiry as part of a document renewal, and
    documents remain allowed for locked records (FR-009, Principle V).
  - A direct edit to an arbitrary date has no matching document, so it is still refused.
  - The existing `drivers_license_expiry_matches_document` trigger is kept and runs as before.
  - `renew_compliance_document` today supersedes the old document, then updates the driver, then
    inserts the renewal, so no current license document exists when the driver is updated. The
    new migration recreates it with the order **supersede → insert renewal → update driver**. The
    lock and the expiry-match trigger then both see the new current document. The partial unique
    index on current driver documents still holds, because the old one is superseded first.
- **Alternatives considered**: Exempting the expiry entirely was rejected, because it would let
  a locked driver's expiry be edited directly.

## R5. Deactivating a driver with assignments

- **Decision**: Add a `BEFORE UPDATE OF is_active` trigger on `drivers`. When `is_active` changes
  from true to false and the driver has a non-deleted assignment with
  `coalesce(ends_on, 'infinity') >= Manila today`, it raises `23503` with: "This driver still has
  current or upcoming assignments. End or remove them before setting the driver to Inactive."
- **Rationale**:
  - FR-006.
  - It mirrors `20261029001400_reject_unit_delete_with_open_assignments.sql`, including the Manila
    date.
  - The existing `run()` error mapping shows our own messages as they are.
- **Alternatives considered**:
  - Ending the assignments automatically was rejected: it is silent and loses the owner's
    intent.
  - Warning only was rejected: it leaves an inactive driver assigned.

## R6. Units going into repair keep their assignments

- **Decision**: There is no assignment guard for units. In repair and Retired lock only the
  unit's details, and both keep the unit's current and upcoming assignments (confirmed after
  analysis on 2026-10-29).
- **Rationale**:
  - The spec's edge cases say so: repair is usually short.
  - The existing assignment trigger already refuses new assignments to Retired units.

## R7. Status history

- **Decision**: Read status changes from `public.audit_events`.
  - The rows to read have `entity_type in ('units','drivers')` and a different `status` or
    `is_active` in `changed_fields->'before'` and `changed_fields->'after'`, excluding
    `action = 'insert'` rows (their "before" is empty).
  - `actor_user_id` references `auth.users`, so display names come from a second query on
    `profiles.user_id`.
  - They are shown on the detail page as a short "Status history" list (latest 10).
- **Rationale**:
  - `audit_business_change()` already records actor, time, and before/after snapshots for both
    tables (FR-011, SC-004).
  - `audit_events` is readable by owners only, and the detail pages are owner-only.
- **Alternatives considered**: A `status_changes` table was rejected; it would duplicate the
  audit data (Principle II).

## R8. Retries and stale views

- **Decision**: `setUnitStatus` and `setDriverStatus` take `{ id, status, expectedStatus }`, where
  `expectedStatus` is the status the screen last showed. They update with
  `.eq("status", expectedStatus)` (for drivers, `.eq("is_active", …)`).
  - **No row matched:** re-read the record. If it already has the requested status (a retried
    request that had succeeded), return success. Otherwise return `STALE_RECORD` with the current
    status.
  - **The requested status equals the current one:** return success without writing, so no audit
    row is added.
  - The detail edit forms (`updateUnit`, `updateDriver`) keep an `updated_at` check
    (`expectedUpdatedAt`), because they overwrite several fields.
- **Rationale**:
  - FR-012 and the "same status picked again" edge case.
  - Mileage readings and license renewals also change `updated_at`. An `updated_at` check would
    wrongly refuse a status change made after one of them; comparing the status refuses only real
    status conflicts.
- **Alternatives considered**:
  - Idempotency keys were rejected. A status is a target state, so repeating the same request is
    naturally safe.
  - `updated_at` for status changes was rejected for the reason above.

## R9. UI control

- **Decision**: A small client `StatusSelect` built on the existing `Select` from
  `components/ui/form-field.tsx`.
  - It changes the status optimistically on change, calls the server action, and reverts with the
    message on failure.
  - It is rendered inside the existing `DataTable` cell and on the detail page.
  - The label and the status badge tone/icon come from `lib/status/record-status.ts`, so the
    status is not shown by colour alone (FR-015).
- **Rationale**:
  - A native select is the most reliable touch control at 360 px.
  - It needs no new library (DESIGN.md, CLAUDE.md).
- **Alternatives considered**:
  - A menu/popover dropdown was rejected: more code, and harder to use on small screens.
  - A two-state switch was rejected, because units have three statuses.

## R10. Detail editing UI

- **Decision**: Add `UnitDetailsForm` and `DriverDetailsForm` on the detail pages.
  - They are shown only to the owner, and only while the record is Active.
  - They use the existing `updateUnit` and `updateDriver` actions; `updateUnit` stops writing
    `status`, which becomes `unitDetailsSchema`.
  - While the record is locked, the page shows the same values as read-only text with
    `LockedNotice`.
- **Rationale**:
  - The actions exist but no screen calls them.
  - Without an edit form, the "locked" state has nothing to lock in the UI.
- **Alternatives considered**: Disabling a form that is always shown was rejected: disabled
  inputs are hard to read and confusing on phones.
