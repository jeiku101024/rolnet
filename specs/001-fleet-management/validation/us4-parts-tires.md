# US4 Parts and Tires Validation

Original implementation: 2026-10-20. Checkpoint T077 run: 2026-10-28 (not passed). Re-run T148:
2026-10-29. **Result: passed (70 / 70).**

## Implementation (2026-10-20)

- `part_replacements`, `tire_installations` and `mileage_readings` migrations with RLS, the
  `replace_tire_installation()` and `due_maintenance()` functions, Zod schemas, server actions,
  the mobile part/tire forms and the `/maintenance` and `/maintenance/[unitId]` pages are present.
- `typecheck` and the Workers build passed. The database-backed checkpoint was blocked (no local
  Supabase runtime).

## Re-run 2026-10-29 (after Phase 11)

- Run id `MPKJ`, fleet date 2026-10-29 (Asia/Manila), run at 14:53 Manila (06:53 UTC, same date).
- Commit tested: `423c3f2` (main after PR #14), branch `test/001-checkpoint-reruns`.
- Environment: `rolnet-dev` with every migration through `20261029001500`, `next dev` in backend
  mode, Chromium at 360 × 800 (mobile, touch), E2E owner, approved-staff and pending-staff accounts.
- Units `0000MPKJA` (date thresholds and UI forms), `VMPKJB` (mileage thresholds) and `VMPKJC`
  (mileage history) were created through REST as the owner. `/maintenance` now lists every unit, so
  the UI checks open `/maintenance/<unit id>` directly.
- The same 70 checks. Part entry, tire install and replacement, mileage readings, the same-date
  correction and the back-dated rejection now run through the screens; constraint, boundary and role
  checks still use REST with each user's JWT. `due_maintenance()` is owner-only, so the boundaries
  are read as the owner with `as_of` = the fleet date.
- Changed where the earlier check depended on a defect: the peso-entry check now expects `1250.50`
  to be stored as 125,050 centavos (it used to pass only because the field refused decimals) and
  `12.345` to be refused; the rear-right "workaround" replacement now uses `replace_tire_installation()`
  as the owner; owner soft delete uses `soft_delete_record()` (the server-action path).
- Runs `VNDW` and `NXSR` earlier the same day reported 69 / 70: the script read the tire labels from
  the whole page (brand names in this run contain `rear_left`). The screen was right in both; the
  check now reads only the Current tires list.

**70 of 70 checks passed** (56 / 70 before).

### Tire positions

| Check | Result | Evidence |
|---|---|---|
| Owner installs a front tire through the 360 px form | Pass | "Front tire saved." |
| Staff installs rear-left and rear-right | Pass | 201 / 201 |
| Position `rear` | Pass | `22P02` |
| Second current tire at the same position | Pass | 409 `current_tire_position_unique` |
| Tire without a due value | Pass | `tire_due_check` |
| Current tire for each position, readable labels | Pass | "FRONT · Replacement MPKJ", "REAR LEFT · Val MPKJ rear_left", "REAR RIGHT · Val MPKJ rear_right NEW" |

### Tire replacement history

| Check | Result | Evidence |
|---|---|---|
| Replace the front tire through the owner form | Pass | "Front tire replaced. The previous tire is kept in the history."; old row linked to the new one |
| `replace_tire_installation()` as staff | Pass | 200; three front rows, one current |
| Rear-right replacement (owner, same function) keeps both rows | Pass | 2 rows, 1 current |
| Replaced tire not reported as due | Pass | |
| Unit page shows the replaced tires | Pass | Tire history: Rear right · Val MPKJ rear_right; Front · Dunlop UI; Front · IRC UI, with date and ₱ cost |

### Part replacements

| Check | Result | Evidence |
|---|---|---|
| Staff saves a part through the form | Pass | "Part replacement saved." |
| Parts due yesterday/today/tomorrow; mileage-based parts and tires | Pass | 201 |
| No due value; due date not after replacement; due mileage not above replacement | Pass | `part_due_check`, `part_date_order_check`, `part_mileage_order_check` |
| Unit page lists parts with due labels | Pass | "Next due on 2026-10-29", "at 10,000 km" |
| Unit page shows each part's date and cost | Pass | "Replaced 2026-09-29 · … ₱850.00", "₱1,250.50" |
| Form collects replacement mileage | Pass | "Mileage at replacement (km)" |

### Date and mileage boundaries (`due_maintenance()` as owner)

| Check | Result |
|---|---|
| Part due yesterday / today: due; tomorrow: not due; rear-left due tomorrow: not due | Pass |
| Front tire (current replacement) due today: due | Pass |
| `as_of` + 1 day: the "due tomorrow" part becomes due | Pass |
| Mileage 10,000: parts at 9,999 / 10,000 due, 10,001 not; whichever-first due; both ahead not due | Pass |
| Tires at 9,999 / 10,000 / 10,001 km: due / due / not due | Pass |
| Dashboard names item and body, shows the basis | Pass: "Chain due-today MPKJ · Body 0000MPKJA — Due by date 2026-10-29"; "Oil at-10000 MPKJ · Body VMPKJB — Due by 10,000 km (now 10,000 km)" |

### Mileage

| Check | Result | Evidence |
|---|---|---|
| Staff records 9,000 then 10,000 on the screen; current mileage 10,000 | Pass | "Mileage saved." ×2 |
| Lower than an earlier reading; editing below the previous one | Pass | "Mileage cannot decrease from the previous reading" |
| Second reading for the same date (REST) | Pass | 409 `mileage_readings_unit_date_unique` |
| Back-dated reading higher than a later one (REST and screen) | Pass | "Mileage cannot be higher than a later reading." |
| Same-date correction (`upsertMileageReading()` from the screen) | Pass | "Mileage reading for that date corrected."; one row, 9,000 |
| Mileage entry on the maintenance screen | Pass | Record mileage form |

### Centavos

| Check | Result | Evidence |
|---|---|---|
| ₱1,250.50 → 125,050; tire ₱4,500.00 → 450,000 | Pass | |
| `1250.50` stored exactly; `12.345` refused | Pass | 125,050; "Enter a peso amount such as 180 or 180.50." |
| Cost entered in pesos | Pass | label "Cost (₱)" |
| Fractional and negative cost via API | Pass | `22P02`, cost check |
| ₱25,000,000.00 | Pass | 2,500,000,000 stored exactly |

### Roles

| Check | Result | Evidence |
|---|---|---|
| Staff opens `/maintenance` and `/maintenance/[unitId]` | Pass | |
| Staff `due_maintenance()` | Pass | 0 rows |
| Staff opens `/dashboard` | Pass | `/forbidden` |
| Staff soft-deletes a part (PATCH and `soft_delete_record`) or a tire | Pass | 403 "Only the owner can delete or restore records" / "Owner access is required" |
| Staff hard delete | Pass | 0 rows |
| Owner soft-deletes a part | Pass | `soft_delete_record()` 200, row gone, `soft_delete` audit event |
| Anon reads parts, inserts tires, calls `due_maintenance()` | Pass | 401 `42501` |
| Pending staff JWT | Pass | 0 rows; insert rejected by RLS |

### 360 px layout

| Check | Result |
|---|---|
| `/maintenance` (staff), `/maintenance/[unitId]` (staff, owner), `/dashboard` (owner): no page-level horizontal overflow | Pass |
| The maintenance screen can choose a unit | Pass: `/maintenance` links to every unit |

### Defect status

| Old ID | Status | Notes |
|---|---|---|
| D1 | Fixed | `replace_tire_installation()` works for staff and owner |
| D2 | Fixed | Installing at an occupied position replaces the tire |
| D3 | Fixed | Unit list on `/maintenance`, one page per unit |
| D4 | Fixed | Mileage form; same-date reading corrected |
| D5 | Fixed | Back-dated higher reading rejected |
| D6 | Fixed | Owner soft delete through `soft_delete_record()`; staff denied by an owner-only trigger |
| D7 | Fixed | Costs entered and shown in ₱ |
| D8 | Fixed | Tire history, part date and cost, readable positions |
| D9 | Fixed | Mileage fields on both forms |
| D10 | Fixed | Item name, body number and due basis on the dashboard |
| D11 | Fixed (by code and SQL; the 00:00–08:00 window was not exercised live) | The dashboard uses `fleetToday()` (Asia/Manila); `due_maintenance()`, `expiring_documents()` and `driver_outstanding_balances()` default `as_of` to `(now() at time zone 'Asia/Manila')::date` (checked with `pg_get_function_arguments`). `fleetToday` logic gives 2026-10-30 for 2026-10-29T17:30Z |

No new defects.

## T077 run (2026-10-28)

Environment: `rolnet-dev` Supabase project with all migrations through `20261028000200`,
`next dev` (Next.js 16.4.3) in backend mode, Chromium at a 360 × 800 mobile viewport, E2E owner,
approved-staff and pending-staff accounts. Run id `ELDS`, fleet date 2026-10-28 (Asia/Manila; the
run was at 20:15 Manila, 12:15 UTC, so UTC and fleet dates were the same day).

- The owner created three units through the REST API: `0000ELDSA` (date thresholds, and the unit
  the `/maintenance` forms target, see D3), `VELDSB` (mileage thresholds) and `VELDSC` (mileage
  history).
- UI checks drive the real pages. Constraint, boundary and role checks use the Supabase REST API
  with each user's own JWT, so RLS, triggers and constraints apply. `due_maintenance()` is
  owner-only, so boundaries were read as the owner with `as_of` = the fleet date.
- Earlier runs `LHLA`, `UFTB` and `XRXB` were discarded because of script bugs (wrong heading
  selector, a substring match, an unscoped dashboard check). Their units are left in place, tagged
  with those ids.

**56 of 70 checks passed.**

### Tire positions

| Check | Result |
|---|---|
| Owner installs a front tire through the 360 px form | Pass |
| Staff installs rear-left and rear-right tires | Pass |
| Unsupported position `rear` | Pass: rejected (`22P02`, enum `tire_position`) |
| A second current tire for the same unit and position | Pass: rejected (`current_tire_position_unique`) |
| Tire without a due date or mileage | Pass: rejected (`tire_due_check`) |
| Unit page shows the current tire for front, rear-left and rear-right | Pass, but labels are raw enum values ("Rear_left") (D8) |

### Tire replacement history

| Check | Result |
|---|---|
| **Replace the front tire through the owner form** | **Fail (D2):** the form says "Add a tire and at least one due value."; nothing changes |
| **`replace_tire_installation()` as staff** | **Fail (D1):** `23505` on `current_tire_position_unique`; no new row, old row has no `replaced_by_id` |
| Old row kept and linked when the link is written in a DB-acceptable order (workaround: point the old row at itself, insert the new row, relink) | Pass: two rows, one current |
| Replaced tire is no longer reported as due | Pass |
| **Unit page shows the replaced tire's history** | **Fail (D8):** the page only selects current tires |

### Part replacements

| Check | Result |
|---|---|
| Staff saves a part through the 360 px form | Pass |
| Parts due yesterday, today and tomorrow; mileage-based parts | Pass: saved |
| Part without any due value; due date on/before replacement date; due mileage not above replacement mileage | Pass: rejected (`part_due_check`, `part_date_order_check`, `part_mileage_order_check`) |
| Unit page lists parts with due labels (date, or `N km` when mileage-only) | Pass |
| **Unit page shows each part's replacement date and cost** | **Fail (D8)** |
| **Form collects the optional replacement mileage (FR-019)** | **Fail (D9)** |

### Date and mileage boundaries (`due_maintenance()` as owner)

| Check | Result |
|---|---|
| Part due yesterday / today (= fleet date) | Pass: both reported due |
| Part due tomorrow; rear-left tire due tomorrow | Pass: not reported |
| Front tire due today | Pass: reported |
| Advance `as_of` one day | Pass: the "due tomorrow" part becomes due |
| Unit mileage 10,000: part due at 9,999 and 10,000 km | Pass: reported |
| Part due at 10,001 km | Pass: not reported |
| Part with a later date but mileage reached (whichever first) | Pass: reported |
| Part with both thresholds ahead | Pass: not reported |
| Tires due at 9,999 / 10,000 / 10,001 km | Pass: due / due / not due |
| **Dashboard names the unit and shows the due basis** | **Fail (D10):** each row is "part · unit <UUID>" |

### Mileage

| Check | Result |
|---|---|
| Staff records 9,000 then 10,000; unit current mileage becomes 10,000 | Pass |
| Reading lower than an earlier date's reading; editing a reading below the previous one | Pass: rejected ("Mileage cannot decrease from the previous reading") |
| Second reading for the same unit and date | Pass: rejected (`mileage_readings_unit_date_unique`) |
| **Back-dated reading higher than a later date's reading** | **Fail (D5):** 8,000 on 10-27 accepted after 7,000 on 10-28 |
| **Same-date upsert as done by `upsertMileageReading()`** | **Fail (D4):** `42P10` "no unique or exclusion constraint matching the ON CONFLICT specification" |
| **Mileage entry on the maintenance screen** | **Fail (D4):** no field |

### Centavos

| Check | Result |
|---|---|
| UI entry `125050` → `cost_centavos` 125050; tire `450000` → 450000 | Pass |
| Peso-style entry `1250.50` | Pass: not saved (blocked by the number input's step), nothing wrong stored |
| **Cost is entered in pesos (₱) and converted to centavos** | **Fail (D7):** the field is labelled "Cost in centavos" and takes raw centavos |
| Fractional (12.5) and negative cost via API | Pass: rejected (`22P02`, cost check) |
| ₱25,000,000.00 (2,500,000,000 centavos) | Pass: stored exactly as `bigint` |

### Roles

| Check | Result |
|---|---|
| Staff can open `/maintenance` and `/maintenance/[unitId]` | Pass |
| Staff `due_maintenance()` | Pass: 0 rows (owner-only `is_owner()` filter) |
| Staff opens `/dashboard` | Pass: redirected to `/forbidden` |
| Staff soft-deletes a part or tire (PATCH `deleted_at`) | Pass: denied (403 `42501`), but only because of D6, not an owner-only rule |
| Staff hard delete | Pass: 0 rows affected |
| **Owner soft-deletes a part** | **Fail (D6):** 403 `42501` "new row violates row-level security policy" |
| Anon reads parts, inserts tires, calls `due_maintenance()` | Pass: 401 `42501` |
| Pending staff JWT | Pass: reads 0 rows, insert rejected by RLS |

### 360 px layout

| Check | Result |
|---|---|
| `/maintenance` (staff, owner), `/maintenance/[unitId]` (staff, owner), `/dashboard` (owner): no page-level horizontal overflow | Pass |
| **The maintenance screen can choose a unit** | **Fail (D3)** |

## Defects

| ID | Area | Defect | Cause |
|---|---|---|---|
| D1 | Database | `replace_tire_installation()` always fails, so no tire can be replaced through the API | `supabase/migrations/20261027000200_add_operational_crud_functions.sql` inserts the new current row before setting `replaced_by_id` on the old one; `current_tire_position_unique` (`20261019004200_create_tire_installations.sql`) is a partial unique index, which is checked immediately and cannot be deferred. The pgTAP files (`supabase/tests/constraints/040_parts_tires.sql`, `supabase/tests/rls/040_parts_tires_rls.sql`) only check that objects exist, so this was not caught |
| D2 | Action | Replacing a tire from the form fails with the misleading "Add a tire and at least one due value." | `installTire()` in `app/actions/tires.ts` has the same insert-then-link order as D1 (and the two statements are not one transaction); the form's catch block shows one message for every error |
| D3 | UI | `/maintenance` records parts and tires only for the first unit by body number; there is no unit picker | `app/(operations)/maintenance/page.tsx` uses `units?.[0]` |
| D4 | UI / Action | No mileage entry exists anywhere, and `upsertMileageReading()` would fail if wired up (FR-008) | `app/actions/mileage.ts` is not called by any page; its `upsert(..., { onConflict: "unit_id,reading_date" })` cannot use the partial index `mileage_readings_unit_date_unique` (`where deleted_at is null`) as an ON CONFLICT target |
| D5 | Database | A back-dated reading higher than a later reading is accepted, so history can decrease over time | `validate_mileage_reading()` in `20261019001800_create_mileage_readings.sql` only compares with the latest earlier reading, never the next later one |
| D6 | Database / Action | Nobody can soft-delete a part or tire; RLS does not make soft deletion owner-only | The SELECT policies `parts_staff_read` / `tires_staff_read` require `deleted_at is null`, and PostgREST checks the updated row against them, so every soft delete gets `42501`. The UPDATE policies (`20261019004100`, `20261019004300`) allow any approved user, so staff are denied only by accident. `softDeletePart()` / `softDeleteTire()` ignore the error and no page calls them |
| D7 | UI | Costs are typed as raw centavos ("Cost in centavos"), not pesos, and are never shown as ₱ | `components/forms/part-replacement-form.tsx` and `tire-installation-form.tsx` send `Number(costCentavos)` instead of `parseCentavos()` from `lib/money/centavos.ts` |
| D8 | UI | Unit maintenance page shows no tire history, no part date/cost, unordered parts, and raw position values | `app/(operations)/maintenance/[unitId]/page.tsx` selects only current tires and only `part_name` plus due fields; `components/maintenance/tire-positions.tsx` prints `position` as stored |
| D9 | UI | Part form has no replacement mileage; tire form has no installed mileage | `components/forms/part-replacement-form.tsx`, `tire-installation-form.tsx` |
| D10 | Dashboard | Due items show "part · unit <UUID>" with no part/tire name, body number, due basis or link (scenario 5) | `components/dashboard/due-maintenance-panel.tsx`; `due_maintenance()` returns no unit body number or item name |
| D11 | Dashboard | Dashboard uses the UTC date as `as_of`, so from 00:00 to 08:00 Manila it reports date-based items one day late. Found by reading the code; not exercised (run at 20:15 Manila) | `lib/dashboard/queries.ts` `new Date().toISOString().slice(0, 10)` |

T077 stays unchecked until D1–D11 are fixed and this journey passes.
