# US7 Reports Validation

Original implementation: 2026-10-20. Checkpoint T108 run: 2026-10-28 (not passed). Re-run T150:
2026-10-29. **Result: not passed (87 / 88, one open defect, D12).**

## Implementation (2026-10-20)

- `monthly_report(month_start, unit_id)` wraps `dashboard_monthly_unit_summary()` and is owner-only
  through its `is_owner()` filter; execute is granted to `authenticated`.
- `lib/reports/monthly-csv.ts` writes fixed columns with RFC 4180 quoting, a UTF-8 BOM and CRLF.
- `GET /api/reports/monthly` and the `/reports` month/scope form are implemented.
- Live reconciliation was blocked (no local Supabase runtime).

## Re-run 2026-10-29 (after Phase 11)

- Run id `JLEH`; report month 2026-06; empty month 2026-01.
- Commit tested: `423c3f2` (main after PR #14), branch `test/001-checkpoint-reruns`.
- Environment: `rolnet-dev` with every migration through `20261029001500`, `next dev` in backend
  mode, Chromium at 360 × 800 (mobile, touch), E2E owner, approved-staff and pending-staff accounts.
- Same fixtures as the T108 run, created through REST with the owner's JWT (unit A body
  `=1+1,"QJLEH"`, unit B `Ñiño JLEH`). The 99,999 fuel expense on unit B is now soft-deleted
  through `soft_delete_record()`, so it is left out. Expected values (centavos):

  | Unit | Due | Paid in month | Outstanding | Credit | Fuel | Repairs | Registration | Insurance | Total expense | Net |
  |---|---|---|---|---|---|---|---|---|---|---|
  | A | 66,000 | 33,000 | 33,000 | 0 | 25,050 | 120,000 | 50,000 | 0 | 195,050 | −162,050 |
  | B | 66,000 | 50,000 | 0 | 2,000 | 10,000 | 0 | 0 | 75,025 | 85,025 | −35,025 |

- The same 88 checks. Files are downloaded through the `/reports` form, including one-unit scope with
  the new unit picker. The shared project has 91 active units in June; every CSV unit row was
  compared with the owner's `monthly_report()` result (all 11 money columns plus body and plate).
- Escaping checks expect the leading `=` to be written as `'=` (formula neutralised) inside the
  RFC 4180 quotes.

**87 of 88 checks passed** (49 / 88 before).

### Fixtures and database function (owner)

| Check | Result | Evidence |
|---|---|---|
| Fixtures created | Pass | |
| Due set to 18,000 / 30,000 | Pass | |
| Owner soft-deletes an expense | Pass | `soft_delete_record()` 200 |
| `monthly_report()` due, A and B | Pass | 66,000 / 66,000 |
| Paid, A | Pass | 33,000 |
| Paid, B (received in June) | Pass | 50,000 (68,000 by service date) |
| Outstanding, A and B | Pass | 33,000 / 0 |
| Total expenses, A and B (soft-deleted excluded) | Pass | 195,050 / 85,025 |
| Net income, A and B | Pass | −162,050 / −35,025 |
| Credit and per-category columns | Pass | returned (14 columns) |
| `monthly_report(month, unit)` returns only that unit | Pass | 1 row, no total row |
| `monthly_report()` equals `dashboard_monthly_unit_summary()` for the unit | Pass | |

### Download and file format (owner, 360 px)

| Check | Result | Evidence |
|---|---|---|
| Fleet CSV downloads from `/reports` | Pass | |
| `content-type: text/csv; charset=utf-8` | Pass | |
| Filename `rolnet-2026-06-fleet.csv` | Pass | |
| UTF-8 BOM and CRLF line endings | **Fail (D12)** | CRLF throughout, but the file saved from the form starts with `month,…` (no BOM). The API response itself starts with `EF BB BF` |
| Every row has the header's column count | Pass | 92 rows |
| `month` column holds the selected month | Pass | |
| Headers match the contract's 14 columns | Pass | |
| Body and plate present | Pass | `'=1+1,"QJLEH"`, `TJLEHA` … |
| Unit-scope GET with `unitId`: one row equal to `monthly_report(month, unit)` | Pass | |
| Invalid month | Pass | 400 |
| `scope=unit` without `unitId` | Pass | 400 |
| Unknown `unitId` | Pass | 404 |
| Malformed `unitId` | Pass | 400 `INVALID_QUERY` |

### Reconciliation and total row

| Check | Result | Evidence |
|---|---|---|
| CSV unit rows equal `monthly_report()` (91 rows, every value, body, plate) | Pass | |
| All 11 money columns for units A and B vs the fixtures (22 values) | Pass | |
| Fleet file ends with a `FLEET TOTAL` row | Pass | `2026-06,FLEET TOTAL,,396000,249000,99000,6000,305148,360000,150000,225075,0,1040223,-791223` |
| `FLEET TOTAL` equals the sum of unit rows and the function's total row | Pass | all 11 columns |

### Escaping

| Check | Result | Evidence |
|---|---|---|
| Comma and quotes quoted with doubled quotes | Pass | `"'=1+1,""QJLEH"""` |
| Leading `=` neutralised | Pass | written as `'=1+1,…`; no other cell starts with `= + - @` (negative numbers aside) |
| `Ñiño` survives export | Pass | |

### Empty month (2026-01)

| Check | Result | Evidence |
|---|---|---|
| `monthly_report()` all zeros | Pass | |
| CSV downloads with the header row | Pass | `rolnet-2026-01-fleet.csv` |
| Every money value is 0 | Pass | |
| Zero `FLEET TOTAL` row | Pass | `2026-01,FLEET TOTAL,,0,0,0,0,0,0,0,0,0,0,0` |

### Owner UI at 360 px

| Check | Result | Evidence |
|---|---|---|
| `/reports` opens for the owner | Pass | |
| No page-level horizontal overflow | Pass | |
| Download button on screen, ≥ 44 px | Pass | 131 × 44 |
| "One unit" offers a unit selector | Pass | lists unit A |
| "One unit" download contains one unit | Pass | 1 row, `rolnet-2026-06-unit--1-1-QJLEH-.csv`, "Report downloaded: …" |
| Empty-state and error feedback | Pass | no unit chosen: "Choose the unit to report on." and no download; empty month: "No remittances or expenses were recorded for 2026-01. The file was downloaded with zero values." |

### Authorization

| Check | Result | Evidence |
|---|---|---|
| Control: injected owner session cookie opens `/reports` | Pass | |
| Approved staff: no Reports link | Pass | |
| Approved staff: `/reports` | Pass | `/forbidden` |
| Approved staff: API | Pass | 403 "Only the owner can download reports.", no CSV |
| Pending staff: UI sign-in | Pass | `/login?error=pending` |
| Pending staff (session cookie): `/reports` and API | Pass | `/login`; 401, no CSV |
| Anonymous: `/reports` | Pass | `/login` |
| Anonymous: API returns no CSV, and 401 | Pass | 401 "Sign in to download reports." |
| Staff, pending, anon: `monthly_report()` and `dashboard_monthly_unit_summary()` via REST | Pass | 0 rows / 0 rows / 401 `42501` |

### Defect status

| Old ID | Status | Notes |
|---|---|---|
| D1 | Fixed | Outstanding and net income computed |
| D2 | Fixed | Credit and per-category columns; 14-column CSV |
| D3 | Fixed | Body and plate written |
| D4 | Fixed | Paid counts payments received in the month |
| D5 | Fixed | `FLEET TOTAL` row, zero for an empty month, none for one-unit reports |
| D6 | Fixed | Leading `= + - @` neutralised with `'` |
| D7 | Fixed | Unit picker; `scope=unit` without `unitId` is 400 |
| D8 | Fixed | Unknown unit 404 |
| D9 | Fixed | Anonymous 401, malformed unit 400, staff 403 |
| D10 | Fixed | Feedback for missing unit, empty month and successful download |
| D11 | Fixed | Owner soft delete works; soft-deleted expense left out of the report |

### New defects

| ID | Area | Defect | Steps | Expected | Actual | Cause |
|---|---|---|---|---|---|---|
| D12 | UI | The CSV saved from the `/reports` form has no UTF-8 BOM (contract: "with UTF-8 BOM for spreadsheet compatibility"; T105) | Owner opens `/reports`, month 2026-06, fleet, Download CSV; inspect the first bytes of the file | `EF BB BF` then `month,…` | `month,…`. `GET /api/reports/monthly` itself returns `EF BB BF` | `components/forms/report-export-form.tsx` reads the response with `response.text()`, whose UTF-8 decoding drops a leading BOM, and saves that string as a Blob. Using `response.blob()` (or prepending `﻿`) would keep it. Excel may then open `Ñiño` with the wrong encoding |

Not tested, as before: opening the files in a spreadsheet application (SC-009); comparing with the
dashboard screen (T101).

## T108 run (2026-10-28)

Environment: `rolnet-dev` Supabase project with all migrations through `20261028000200`,
`next dev` (Next.js 16.4.3) in backend mode, Chromium at a 360 × 800 mobile viewport, E2E owner,
approved-staff and pending-staff accounts. Run id `HYRV`; report month 2026-06; empty month 2026-01.

- Fixtures were created as the owner through the Supabase REST API with the owner's JWT, so RLS and
  triggers apply. Unit A body `=1+1,"QHYRV"` (comma, quotes, leading `=`); unit B body `Ñiño HYRV`.
  Each unit has a primary driver and assignment from 2026-06-01.
  - Unit A: returned 06-02 paid in full; overnight 06-03 paid 10,000 + 5,000; returned 06-04
    unpaid; expenses Fuel 25,050, Repairs 120,000, Registration 50,000.
  - Unit B: overnight 06-02 paid in full; returned 06-05 paid 20,000 (2,000 credit); returned
    06-30 paid 18,000 on 2026-07-01; expenses Insurance 75,025, Fuel 10,000, Fuel 99,999. The
    soft-delete of the 99,999 fuel expense failed (D11), so it stays active and is counted.
  - Expected values (centavos):

    | Unit | Due | Paid in month | Outstanding | Credit | Fuel | Repairs | Registration | Insurance | Total expense | Net |
    |---|---|---|---|---|---|---|---|---|---|---|
    | A | 66,000 | 33,000 | 33,000 | 0 | 25,050 | 120,000 | 50,000 | 0 | 195,050 | −162,050 |
    | B | 66,000 | 50,000 | 0 | 2,000 | 109,999 | 0 | 0 | 75,025 | 185,024 | −135,024 |

- CSV files were downloaded through the real `/reports` form. Unit scope was also requested
  directly with `unitId`, because the form has no unit picker (D7).
- `monthly_report()` covers all 29 active units in the shared project, so every CSV row was compared
  with the owner's `monthly_report()` result, and the two run units were compared with the fixtures.
- The pending-staff and control-owner sessions were injected as Supabase SSR cookies. The control
  check confirms the method gives a working session.

**49 of 88 checks passed.**

### Fixtures and database function (owner)

| Check | Result |
|---|---|
| Units, drivers, assignments, 6 remittances, 6 payments, 6 expenses created | Pass |
| Database sets due to 18,000 (returned) / 30,000 (overnight) | Pass |
| Owner soft-deletes an expense | **Fail (D11):** 403 "new row violates row-level security policy" |
| `monthly_report()` due, unit A and B | Pass: 66,000 / 66,000 |
| `monthly_report()` paid, unit A | Pass: 33,000 |
| `monthly_report()` paid, unit B (payments received in June) | **Fail (D4):** 68,000; expected 50,000. Includes the payment received 2026-07-01 |
| `monthly_report()` outstanding, unit A | **Fail (D1):** 0; expected 33,000 (unit B's expected value is 0, so it passes only by coincidence) |
| `monthly_report()` total expenses, unit A and B | Pass: 195,050 / 185,024 (soft-delete exclusion not exercised, see D11) |
| `monthly_report()` net income, unit A and B | **Fail (D1):** 0 / 0; expected −162,050 / −135,024 |
| `monthly_report()` credit and per-category expense columns | **Fail (D2):** not returned |
| `monthly_report(month, unit)` returns only that unit | Pass |
| `monthly_report()` equals `dashboard_monthly_unit_summary()` | Pass (so the dashboard carries D1, D2, D4 too) |

### Download and file format (owner, 360 px)

| Check | Result |
|---|---|
| Fleet CSV downloads from `/reports` | Pass |
| `content-type: text/csv; charset=utf-8` | Pass |
| Filename `rolnet-2026-06-fleet.csv` (attachment) | Pass |
| UTF-8 BOM, CRLF line endings, every row has the header's column count | Pass |
| `month` column holds the selected month | Pass |
| Headers match the contract's 14 columns | **Fail (D2):** 8 columns. No `credit_centavos` or per-category expense columns |
| Unit body number and plate number present | **Fail (D3):** every row has `0` in both columns |
| Unit-scope GET with `unitId` returns one row equal to `monthly_report(month, unit)` | Pass |
| Invalid month returns 400 | Pass |
| `scope=unit` without `unitId` is rejected | **Fail (D7):** 200, whole-fleet file named `…-unit.csv` |
| Unknown `unitId` returns 404 | **Fail (D8):** 200 with headers only |
| Malformed `unitId` returns 400 | **Fail (D9):** 403 "Owner report access is required" |

### Reconciliation and total row

| Check | Result |
|---|---|
| CSV unit rows equal `monthly_report()` rows (29 rows, every value) | Pass. The CSV passes the function's values through unchanged |
| Unit A/B due, total expenses vs fixtures | Pass |
| Unit A paid vs fixtures | Pass |
| Unit B paid vs fixtures | **Fail (D4):** 68,000 vs 50,000 |
| Unit A outstanding; A and B net vs fixtures | **Fail (D1):** CSV 0 |
| Unit B outstanding vs fixtures | Pass (0 = 0) |
| Credit and the five category columns, both units (12 values) | **Fail (D2):** columns missing |
| Fleet file ends with a `FLEET TOTAL` row | **Fail (D5):** no total row |
| `FLEET TOTAL` equals the sum of unit rows | **Fail (D5):** no total row to compare |

### Escaping

| Check | Result |
|---|---|
| Body with comma and quotes is quoted with doubled quotes | **Fail (D3):** the body is not written. In isolation, `monthlyCsv` quotes it correctly (`"=1+1,""QHYRV"""`) |
| Leading `=` is neutralised so spreadsheets do not run it as a formula | **Fail (D3, D6)** |
| Philippine characters (`Ñiño`) survive export | **Fail (D3):** the body is not written |

### Empty month (2026-01)

| Check | Result |
|---|---|
| `monthly_report()` returns only zeros for the month | Pass |
| CSV downloads with the header row | Pass |
| Every money value is 0 | Pass |
| A zero `FLEET TOTAL` row is present | **Fail (D5)** |

### Owner UI at 360 px

| Check | Result |
|---|---|
| `/reports` opens for the owner | Pass |
| No page-level horizontal overflow | Pass |
| Download button fully on screen, ≥ 44 px tall | Pass: 131 × 44 |
| "One unit" scope offers a unit selector | **Fail (D7):** no selector |
| "One unit" download from the form contains one unit | **Fail (D7):** all 29 units |
| Empty-state and error feedback on the page | **Fail (D10):** none. Errors open raw JSON |

### Authorization

| Check | Result |
|---|---|
| Control: injected owner session cookie opens `/reports` | Pass |
| Approved staff: no Reports link in the navigation | Pass |
| Approved staff: `/reports` | Pass: redirected to `/forbidden` |
| Approved staff: GET `/api/reports/monthly` | Pass: 403 JSON, no CSV |
| Pending staff: UI sign-in | Pass: refused (`/login?error=pending`) |
| Pending staff (session cookie): `/reports` and the API | Pass: redirected to `/login`; API 403, no CSV |
| Anonymous: `/reports` | Pass: redirected to `/login` |
| Anonymous: API returns no CSV | Pass (403) |
| Anonymous: API answers 401 (contract) | **Fail (D9):** 403 |
| Staff, pending, anon: `monthly_report()` and `dashboard_monthly_unit_summary()` via REST | Pass: staff and pending get 0 rows; anon gets 401 `42501` |

### Not tested

- Opening the files in Excel, Google Sheets or LibreOffice (SC-009). No spreadsheet application is
  available to the runner. The files parse as RFC 4180.
- Soft-deleted expenses being left out of reports (FR-030): the owner cannot soft-delete (D11).
- Comparing against the dashboard *screen*: that belongs to T101. The CSV matches the dashboard
  function.

## Defects

| ID | Area | Defect | Cause |
|---|---|---|---|
| D1 | Database | Outstanding and net income are always 0 | `dashboard_monthly_unit_summary` in `supabase/migrations/20261019006000_create_dashboard_monthly_summary.sql` returns the literal `0` for `outstanding_centavos` and `net_income_centavos` |
| D2 | Database / CSV | No credit or per-category expense values (FR-029, contract's 14 columns) | The function returns only due, paid, outstanding, total expense and net. `reportColumns` in `lib/reports/monthly-csv.ts` lists 8 columns |
| D3 | CSV | Unit body number and plate number are written as `0` | `monthlyCsv` reads `row.unit_body_number` and `row.plate_number`, but `monthly_report()` returns `body_number` and no plate. `row[c] ?? 0` fills `0`. This also blocks the escaping and UTF-8 checks |
| D4 | Database | Paid income counts payments by the remittance's service date, not by when they were received (spec Assumptions: "payments received during the selected month") | The paid subquery filters `r.service_date` and ignores `p.paid_at` |
| D5 | Database / CSV | No `FLEET TOTAL` row, so no fleet totals and no zero total row for empty months | T102 says the function returns "unit rows plus fleet totals", but `monthly_report` (`20261019007000_create_monthly_report_query.sql`) returns unit rows only. The serializer, correctly, does not add totals itself |
| D6 | CSV | A leading `=`, `+`, `-` or `@` is not neutralised, so a spreadsheet can run it as a formula | `escapeCsv` in `lib/reports/monthly-csv.ts` only quotes `"`, `,`, CR and LF |
| D7 | UI / API | A single-unit report cannot be made from the UI. "One unit" downloads the whole fleet under a `-unit` filename | `components/forms/report-export-form.tsx` has no `unitId` field. `app/api/reports/monthly/route.ts` does not require `unitId` when `scope=unit`, and the SQL filter treats null as "all units" |
| D8 | API | An unknown or deleted `unitId` returns 200 with only the header row, not 404 | The route never checks that the unit exists |
| D9 | API | Every failure returns 403, including anonymous requests (contract: 401) and a malformed `unitId` (should be 400) | `catch {}` in `app/api/reports/monthly/route.ts` turns every error into 403, including the `redirect()` from `requirePermission` and the RPC's invalid-UUID error |
| D10 | UI | No empty-state or error feedback on `/reports` (T107). Errors show raw JSON in the browser | `report-export-form.tsx` is a plain GET form with no feedback |
| D11 | Database (US4/FR-030) | The owner cannot soft-delete an expense: 403 "new row violates row-level security policy for table expenses" | The update matches `softDeleteExpense` in `app/actions/expenses.ts`. The only SELECT policy on `expenses` is `deleted_at is null` (`20261019002300_add_expenses_rls.sql`), so the soft-deleted row no longer satisfies RLS. Outside US7, but it blocks the soft-delete exclusion check |

T108 stays unchecked until D1–D10 are fixed (and D11, so soft-delete exclusion can be checked) and this journey passes.
