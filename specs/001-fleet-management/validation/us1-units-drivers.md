# US1 Units and Drivers Validation

Original implementation: 2026-10-20. Checkpoint T043 run: 2026-10-28. **Result: not passed (open defects).**

## Implementation (2026-10-20)

- Units, drivers, primary/backup assignments, day-off records, and mileage migrations are present.
- RLS migrations and pgTAP test files are present.
- Owner actions, approval-aware permission guards, validation schemas, mobile forms and list/detail
  pages are implemented. `typecheck`, `lint` and `build:vinext` passed.
- The database-backed checkpoint was blocked (no Docker/WSL2 runtime).

## T043 run (2026-10-28)

Environment: `rolnet-dev` Supabase project with all migrations through
`20261028000300`, `next dev` (Next.js 16.4.3) in backend mode, Chromium at a 360 × 800 mobile
viewport, E2E owner and approved-staff accounts. Run id `6SQH`, fleet date 2026-10-28.

- UI checks drive the real pages.
- Assignment, day-off and backup checks run as the owner through the Supabase REST API with the
  owner's own JWT, so RLS, exclusion constraints and validation triggers apply. There is no UI for
  them (defect D2).

**24 of 40 checks passed.**

### Owner: units and drivers

| Check | Result |
|---|---|
| Create two units (body, plate, make/model, status) | Saved and listed with model and Active status. **But the form reports "Could not save the unit" after a successful save** (D5) |
| Duplicate body number rejected | Pass: plain-language guidance shown |
| Create primary, backup and expired-license drivers | Saved (6 drivers). Same misleading error message (D5) |
| `/units`, `/drivers`, unit detail at 360 px: no page-level horizontal overflow | Pass |

### Assignments, days off and backup coverage (owner, through RLS)

| Check | Result |
|---|---|
| Assign primary drivers P1 → unit A and P2 → unit B from today | Pass |
| Second overlapping primary for the same unit | Pass: rejected (`primary_unit_date_exclusion`) |
| Same primary driver on a second unit | Pass: rejected |
| Assign a driver with an expired license | Pass: rejected, "Driver license is expired or driver is inactive" |
| Record a primary driver's day off; duplicate day off for the same date | Pass: created; duplicate rejected (409) |
| Backup B1 covers unit A on P1's day off | Pass |
| B1 covers unit B on the same date | Pass: rejected, "Driver already operates another unit on this date" |
| A second backup for unit A on the same date | Pass: rejected (`backup_unit_date_unique`) |
| **End P1's primary assignment, then reassign unit A to P3** | **Fail (D1):** `backup_shape_check` requires `ends_on is null` for every primary assignment, so a primary assignment can never be ended and reassignment is impossible |
| Unit A history keeps both primary and backup responsibility | Partly: the primary and backup rows are kept; the ended-primary/reassignment case cannot be created (D1) |

### Detail pages

| Check | Result |
|---|---|
| Unit detail assignment history shows driver names | **Fail (D3):** every row shows "Unknown driver" |
| Driver detail history shows the unit | **Fail (D3):** shows "Body Unknown" |
| Unit detail shows the current (and same-date backup) driver | **Fail (D4):** not displayed |

### Staff (approved)

| Check | Result |
|---|---|
| Read unit labels | Pass |
| Create a unit, change a driver, create an assignment, soft-delete a unit (direct API) | Pass: all denied (403 `42501`, or 0 rows updated) |
| Open owner settings (`/settings/staff`) | Pass: redirected to `/forbidden` |
| Unit create form unavailable to staff | **Fail (D6):** the form is shown; saving is rejected server-side |

## Defects

| ID | Area | Defect | Cause |
|---|---|---|---|
| D1 | Database | Primary assignments cannot be ended, so a unit cannot be reassigned (acceptance scenario 3) | `driver_assignments.backup_shape_check` requires `ends_on is null` for `assignment_type = 'primary'` |
| D2 | UI | No screen creates primary assignments, records days off, or assigns backup coverage (scenarios 2, 3, 5, 6). The server actions exist in `app/actions/assignments.ts` but nothing calls them | T041/T042 marked done without these controls |
| D3 | UI | Assignment history shows "Unknown driver" / "Body Unknown" | `app/(owner)/units/[id]/page.tsx` and `app/(owner)/drivers/[id]/page.tsx` read the embedded `drivers` / `units` as an array (`[0]`); PostgREST returns a many-to-one embed as an object |
| D4 | UI | Unit detail does not show the current driver or the backup for a date; driver detail does not list days off or backup coverage | Not implemented (T041/T042 scope) |
| D5 | UI | Unit and driver forms show the failure message after a successful save | `event.currentTarget.reset()` runs after `await`; React has cleared `currentTarget`, so it throws and the catch block reports failure |
| D6 | UI | Staff see the "Add a unit" form | `app/(owner)/units/page.tsx` renders `UnitForm` for every approved user |

T043 stays unchecked until D1–D6 are fixed and this journey passes.
