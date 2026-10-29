# US1 Units and Drivers Validation

Original implementation: 2026-10-20. Checkpoint T043 run: 2026-10-28 (not passed). Re-run T145:
2026-10-29. **Result: passed (40 / 40).**

## Implementation (2026-10-20)

- Units, drivers, primary/backup assignments, day-off records, and mileage migrations are present.
- RLS migrations and pgTAP test files are present.
- Owner actions, approval-aware permission guards, validation schemas, mobile forms and list/detail
  pages are implemented. `typecheck`, `lint` and `build:vinext` passed.
- The database-backed checkpoint was blocked (no Docker/WSL2 runtime).

## Re-run 2026-10-29 (after Phase 11)

- Run id `FCVM`, fleet date 2026-10-29 (Asia/Manila), run in the early afternoon Manila time
  (UTC the same calendar date).
- Commit tested: `423c3f2` (main after PR #14), branch `test/001-checkpoint-reruns`.
- Environment: `rolnet-dev` with every migration through `20261029001500`, `next dev` in backend
  mode on `localhost:3000`, Chromium at 360 × 800 (mobile, touch), E2E owner and approved-staff
  accounts. Owner sign-in lands on `/dashboard`, staff on `/remittances`.
- The same 40 checks as the T043 run. Units, drivers, primary assignments, reassignment, ending an
  assignment, days off and backup coverage now go through the unit detail screens (they had no UI
  before). Checks that the UI no longer offers (an expired driver, a second backup for a covered
  day) are checked twice: the UI does not offer them, and the database rejects them through REST with
  the owner's JWT.

**40 of 40 checks passed** (24 / 40 before).

### Owner: units and drivers

| Check | Result | Evidence |
|---|---|---|
| Create two units (body, plate, make/model, status) | Pass | "Unit saved.", form cleared; both listed with model and Active |
| Duplicate body number rejected | Pass | "Another unit already uses this body number. Check the number and try again." |
| Create primary, backup and expired-license drivers (6) | Pass | "Driver saved." for each |
| `/units`, `/drivers`, unit detail at 360 px | Pass | no page-level horizontal overflow |
| Owner reads the run's units and drivers | Pass | REST, 2 units, 6 drivers |
| Assignment, day-off and backup controls exist | Pass | unit detail: Assign/Reassign primary driver, End assignment, Record day off, Assign backup |

### Assignments, days off and backup coverage (owner, unit detail screens)

| Check | Result | Evidence |
|---|---|---|
| Assign P1 → unit A and P2 → unit B from today | Pass | "Primary driver assigned." |
| Second overlapping primary for unit A ("end current" unticked) | Pass | "This unit already has a primary driver for some of these dates…"; still one primary |
| P1 as primary of a second unit | Pass | "This driver is already the primary driver of another unit for some of these dates…" |
| Driver with an expired license | Pass | not offered in the driver picker; REST insert rejected, "Driver license is expired or driver is inactive" |
| Record P1's day off (tomorrow) with backup B1 | Pass | "Day off and backup driver saved." |
| Duplicate day off for the same date | Pass | "A day off is already recorded for this date."; one day off |
| Record P2's day off; B1 as its backup | Pass | day off saved; backup refused: "Driver already operates another unit on this date." |
| B2 covers unit B (days-off list, Assign backup) | Pass | "Backup driver assigned." |
| A second backup for unit A on the same date | Pass | no Assign backup control once covered. REST with a free driver (P3): 409 `backup_unit_date_unique` (probe after the run; the journey's own REST attempt used B2, which is refused earlier as busy) |
| End P1's assignment (last day +10) | Pass | "Assignment end date saved."; `ends_on` 2026-11-08 |
| Reassign unit A to P3 from +11 | Pass | "Primary driver assigned." |
| Unit A history keeps P1 (ended), B1 (backup), P3 (current) | Pass | `P1:primary:2026-10-29→2026-11-08, B1:backup:2026-10-30, P3:primary:2026-11-09→current` |

### Detail pages

| Check | Result | Evidence |
|---|---|---|
| Unit detail history shows driver names | Pass | P3 / B1 ("Backup for P1") / P1 rows, no "Unknown driver" |
| Unit detail shows the current driver and the date's backup | Pass | today: operating P1; `?date=` tomorrow: "B1 FCVM (backup)", "Covered by B1 FCVM" |
| Driver detail history shows the covered unit | Pass | B1's "Backup coverage" lists body `VFCVMA` |

### Staff (approved)

| Check | Result | Evidence |
|---|---|---|
| Read unit labels | Pass | REST, 1 row |
| Create a unit, change a driver, create an assignment, soft-delete a unit (direct API) | Pass | 403 `42501` / 0 rows updated / 403 `42501` / 0 rows updated |
| Open `/settings/staff` | Pass | `/forbidden` |
| Unit create form and assignment controls hidden | Pass | no Save unit on `/units`; no assignment buttons on unit detail |

### Defect status

| Old ID | Status | Notes |
|---|---|---|
| D1 | Fixed | A primary assignment can be ended; reassignment ends the current one the day before |
| D2 | Fixed | Assignment, end, day-off and backup forms on unit detail |
| D3 | Fixed | Names shown in unit and driver history |
| D4 | Fixed | Driver on a date (current and backup) on unit detail; days off and backup coverage on driver detail |
| D5 | Fixed | Success messages after save, forms cleared |
| D6 | Fixed | Staff see no unit form or assignment controls |

No new defects.

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
