# US4 Parts and Tires Validation

Original implementation: 2026-10-20. Checkpoint T077 run: 2026-10-28. **Result: not passed (open defects).**

## Implementation (2026-10-20)

- `part_replacements`, `tire_installations` and `mileage_readings` migrations with RLS, the
  `replace_tire_installation()` and `due_maintenance()` functions, Zod schemas, server actions,
  the mobile part/tire forms and the `/maintenance` and `/maintenance/[unitId]` pages are present.
- `typecheck` and the Workers build passed. The database-backed checkpoint was blocked (no local
  Supabase runtime).

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
