# Contract: Server Actions and API v1

All actions use the existing `run()` wrapper (returns `{ ok: true, data } | { ok: false, message, fieldErrors? }`)
and revalidate `/units`, `/units/[id]`, and `/remittances` as listed.

## New: `app/actions/unit-assignments.ts`

| Action | Permission | Input (Zod) | Effect | Returns |
|--------|------------|-------------|--------|---------|
| `saveUnitAssignment` | `encode_operations` (owner + staff) | `{ unitId: uuid, serviceDate: YYYY-MM-DD, driverId: uuid \| null, notes: string ≤ 500, expectedUpdatedAt?: ISO }` | `rpc("save_unit_assignment")` | `{ id, driverId, notes, updatedAt }` |
| `upcomingAssignmentCount` | `manage_master_data` | `{ unitId } \| { driverId }` | counts active `unit_assignments` with `service_date >= fleet date` and no active remittance for that unit and date | `{ count }` |

- A null `driverId` returns the field error "Choose a driver first" without calling the database (FR-017).
- On the driver-uniqueness error, it returns `{ ok: false, code: "DRIVER_TAKEN", message: "Driver already assigned today" }`, and the card resets (FR-016).

## Changed: `app/actions/units.ts`

| Action | Change |
|--------|--------|
| `createUnit` | unchanged write. The modal shows the "Unit added" toast on success |
| `updateUnit` | unchanged (inline Edit details). The feature-005 lock message passes through |
| `setUnitStatus` | unchanged write. The release happens in the database. The client calls `upcomingAssignmentCount` first and confirms when the count is above 0 (FR-030) |
| `archiveUnit` | **new**. `{ id, expectedUpdatedAt }` → `update units set archived = true` where `updated_at` matches and the unit isn't archived. Stale → "This unit was changed by someone else. Reload the page." |
| `restoreUnit` | **new**. `{ id, expectedUpdatedAt }` → `archived = false` |
| `archiveSummary` | **new**. `{ id }` → `{ todayDriver: { name, role } \| null, assignments, remittances, expenses, documents, auditEntries }` (head-only counts) |
| `softDeleteUnit` | **removed** |

All of them need `manage_master_data` (owner).

## Changed: `app/actions/drivers.ts`

`setDriverStatus` (to Inactive) and `softDeleteDriver` are unchanged writes. The release happens in the
database, and the client confirms first with `upcomingAssignmentCount({ driverId })` (FR-029b).

## Changed: `app/actions/remittances.ts`

`createRemittance` and `recordDailyRemittance` input is `{ unitId, driverId, serviceDate, … }`. `assignmentId`
is removed. The insert sends `unit_id`, `driver_id`, and `service_date`, and the database links
`unit_assignment_id`. The error label "assignment" becomes "driver assignment for this date".

## Removed: `app/actions/assignments.ts`

`createPrimaryAssignment`, `endPrimaryAssignment`, `recordDayOff`, and `assignBackupDriver`. Their forms
and pickers are deleted with them.

## API v1 (`lib/domain/resource-config.ts`)

| Resource | Change |
|----------|--------|
| `assignments` | read-only (create and update fields removed) |
| `driver-days-off` | read-only |
| `unit-assignments` | **new**, read-only list and get; filters `unit_id`, `driver_id`, `service_date`; excludes released rows |
| `units` | adds `archived` to the response and filters. DELETE now returns the database's "Units are archived, not deleted" refusal |
| `remittances` | create body takes `unit_id`, `driver_id`, `service_date` (no `assignment_id`) |
