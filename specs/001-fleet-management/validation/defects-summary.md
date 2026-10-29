# Feature 001 validation: consolidated defects (2026-10-28, re-run 2026-10-29)

Source records: `foundation.md` (T026), `us1-units-drivers.md` (T043), `us2-expenses.md` (T054),
`us3-remittances.md` (T065), `us4-parts-tires.md` (T077), `us5-documents.md` (T090),
`us7-reports.md` (T108), `migrations.md` (T112). Defect IDs below refer to those files
(for example US3-D1 is D1 in `us3-remittances.md`).

The checkpoint journeys were re-run on 2026-10-29 (T145–T150) against commit `423c3f2` (main after
PR #14, every migration through `20261029001500`), with the same checks as the first run.

| Task | Checkpoint | Checks passed 2026-10-28 | Re-run 2026-10-29 (run id) | Result |
|---|---|---|---|---|
| T026 | Foundation | all | not re-run | Pass, after #6 and the `signIn` fix (#7) |
| T043 | Units and drivers | 24 / 40 | 40 / 40 (`FCVM`) | Pass |
| T054 | Expenses | 68 / 83 | 82 / 83 (`EDZX`) | Not passed: US2-D10 |
| T065 | Remittances | 47 / 64 | 64 / 64 (`AURM`) | Pass |
| T077 | Parts and tires | 56 / 70 | 70 / 70 (`MPKJ`) | Pass |
| T090 | Documents | 60 / 81 | 81 / 81 (`RECB`) | Pass |
| T108 | Monthly reports | 49 / 88 | 87 / 88 (`JLEH`) | Not passed: US7-D12 |
| T112 | Migrations rebuild | all | not re-run | Pass (with #6) |
| T101 | Dashboard at 100 units × 24 months, 3 s | not run | out of scope | Needs a fixture and a preview deployment |
| T115 | Final acceptance (10 participants) | not run | out of scope | Needs real participants |

**What holds everywhere:** RLS denies anonymous and pending users; staff cannot create or modify
owner-only master data; money is stored as exact integer centavos; private Storage buckets are not
publicly readable; uploads are compressed and size-limited; pages have no horizontal overflow at
360 px; uniqueness and overlap constraints reject conflicting records.

## Open after the re-run

| ID | Defect | Cause (short) |
|---|---|---|
| US2-D10 | A receipt stays downloadable through the direct authenticated Storage URL for several minutes after its expense is archived (signed URLs are refused at once) | Supabase CDN caches the authenticated object response; soft delete leaves the object, so nothing invalidates it. RLS policy is correct |
| US7-D12 | The CSV saved from the `/reports` form has no UTF-8 BOM (the API response has it) | `report-export-form.tsx` uses `response.text()`, which drops the BOM, then saves the string as a Blob |

Observations, not counted as failures: the remittance "Notes saved." message disappears after about
one second (the form is remounted on refresh); reversing an already reversed remittance through REST
answers HTTP 500 `P0002`; `/api/v1` maps `23514` to a generic 409 (known limit); signed-out and
forbidden redirects are streamed (HTTP 200, then a client redirect; no protected data in the first
paint).

## Fix groups and status after the re-run

### 1. Security and data integrity (database)

| ID | Defect | Records | Status 2026-10-29 |
|---|---|---|---|
| SEC-1 | Unapproved users passed `require_owner()` | Fixed in #6 | Fixed (not re-tested separately) |
| SEC-2 | Approved staff can change a saved remittance's service date, disposition (and so the due), driver, unit and assignment. `remittances_operational_update_policy` allows every column | US3-D1 | Fixed |
| SEC-3 | Document type/holder pairing is not enforced (a driver license on a unit), and a license whose expiry differs from the driver profile is accepted through REST and `/api/v1` | US5-D1, US5-D2 | Fixed |
| SEC-4 | An expense can reference another expense's receipt object | US2-D8 | Fixed |

### 2. Database logic bugs

| ID | Defect | Records | Status 2026-10-29 |
|---|---|---|---|
| DB-1 | Primary assignments can never be ended (`backup_shape_check` requires `ends_on is null`), so units cannot be reassigned | US1-D1 | Fixed |
| DB-2 | "Insert new current row, then supersede the old one" violates the partial unique index, so `replace_tire_installation()` and `renew_compliance_document()` always fail with 23505 | US4-D1, US5-D3 | Fixed |
| DB-3 | The owner cannot soft-delete expenses, parts or tires: the only SELECT policy is `deleted_at is null`, so the updated row fails RLS. Staff are blocked only as a side effect, not by an owner-only rule. Likely the same for every table with this policy shape | US2-D3, US4-D6, US7-D11 | Fixed (owners use `soft_delete_record()`; an owner-only trigger denies staff) |
| DB-4 | `dashboard_monthly_unit_summary()` returns literal `0` for outstanding and net income, counts payments by service date instead of received date, and has no credit or per-category columns; `monthly_report()` has no fleet total row | US7-D1, D2, D4, D5 | Fixed |
| DB-5 | `driver_outstanding_balances()` counts the due once per payment (join fan-out) | US3-D2 | Fixed |
| DB-6 | A driver operating one unit can be booked as backup on another unit on the same date | US3-D3 | Fixed |
| DB-7 | A back-dated mileage reading higher than a later reading is accepted | US4-D5 | Fixed |
| DB-8 | Dates use UTC instead of Asia/Manila: the dashboard `asOf`, the `current_date` defaults, and the client-side expiry badge. Wrong between 00:00 and 08:00 Manila, or on devices in other time zones | US4-D11, US5-D7, US5-D8 | Fixed (badge verified from a UTC+14 device; defaults verified in SQL; the 00:00–08:00 window was not exercised live) |

### 3. Shared UI bugs

| ID | Defect | Records | Status 2026-10-29 |
|---|---|---|---|
| UI-1 | Forms report failure after a successful save: `event.currentTarget.reset()` runs after `await` | US1-D5, US2-D1, US3-D5 | Fixed |
| UI-2 | Lists and detail pages show "Unknown" names: many-to-one embeds are read as arrays (`[0]`) | US1-D3, US2-D2, US3-D4 | Fixed |
| UI-3 | CSV export writes `0` for body/plate (wrong field names) and does not neutralise leading `= + - @` | US7-D3, US7-D6 | Fixed |
| UI-4 | Raw Zod JSON or wrong messages shown on validation errors; route errors all map to 403 | US2-D7, US4-D2, US5-D4, US7-D9, US7-D10 | Fixed |
| UI-5 | Double-submit creates two remittances (new idempotency key per submit, button not disabled) | US3-D6 | Fixed |
| UI-6 | Create-then-upload flows leave a saved record without its file (or an orphaned file) when the second step fails | US2-D6, US5-D5 | Fixed (the receipt type is checked first; a failed document save removes the uploaded object) |

### 4. Missing UI

| ID | Missing | Records | Status 2026-10-29 |
|---|---|---|---|
| GAP-1 | Assignments, days off, backup coverage, current driver on unit detail, days off/backup on driver detail | US1-D2, US1-D4 | Fixed |
| GAP-2 | Expense edit, owner delete, and opening an attached receipt | US2-D4, US2-D5 | Fixed (edit only finds expenses among the latest 50, a known limit) |
| GAP-3 | Remittance detail link, later payments, note edits, owner reversal and payment correction; overpayment credit hidden; unpaid balances lack unit and period | US3-D7, D8, D9 | Fixed |
| GAP-4 | Maintenance unit picker, mileage entry, tire history, part details, mileage fields; readable positions; dashboard due panel labels | US4-D3, D4, D7, D8, D9, D10 | Fixed |
| GAP-5 | Document holder field (uploads cannot succeed), renewal, history, file view/download; documents on unit/driver pages | US5-D4, US5-D6 | Fixed |
| GAP-6 | Report unit picker; unknown `unitId` returns 200 | US7-D7, US7-D8 | Fixed |
| GAP-7 | Staff see owner-only forms (for example "Add a unit") | US1-D6 | Fixed |

Not in a group: US2-D9 (WebP receipts stored under a `.png`/`.jpeg` name) is fixed; receipts are
stored as `.webp`.

### 5. New defects found in the re-run

| ID | Defect | Records |
|---|---|---|
| NEW-1 | Archived expense's receipt still served from the CDN cache to a token that downloaded it before | US2-D10 |
| NEW-2 | Report download from the form loses the UTF-8 BOM | US7-D12 |

### 6. Test coverage

Several pgTAP files only checked that objects exist, which is why DB-2, DB-3 and DB-4 were not
caught. Each fix in groups 1–2 should add a behavioural pgTAP test that fails before the fix.
(Not re-assessed in this re-run.)

## Validation scripts

The journeys are kept untracked under `.git/` (`us1-journey.mjs`, `us2-expenses-journey.mjs`,
`us3-journey.mjs`, `us4-journey.mjs`, `us5-journey.mjs`, `t108-journey.mjs`), updated on 2026-10-29
for the current screens, with shared helpers in `.git/journey-lib.mjs` (the pre-fix US2, US3, US5
and US7 versions are kept as `*.orig.mjs`). Rerun them against `rolnet-dev` after fixes. Test
records in `rolnet-dev` are tagged with each run id.
