# Feature 001 validation: consolidated defects (2026-10-28)

Source records: `foundation.md` (T026), `us1-units-drivers.md` (T043), `us2-expenses.md` (T054),
`us3-remittances.md` (T065), `us4-parts-tires.md` (T077), `us5-documents.md` (T090),
`us7-reports.md` (T108), `migrations.md` (T112). Defect IDs below refer to those files
(for example US3-D1 is D1 in `us3-remittances.md`).

| Task | Checkpoint | Checks passed | Result |
|---|---|---|---|
| T026 | Foundation | all | Pass, after #6 and the `signIn` fix (#7) |
| T043 | Units and drivers | 24 / 40 | Not passed |
| T054 | Expenses | 68 / 83 | Not passed |
| T065 | Remittances | 47 / 64 | Not passed |
| T077 | Parts and tires | 56 / 70 | Not passed |
| T090 | Documents | 60 / 81 | Not passed |
| T108 | Monthly reports | 49 / 88 | Not passed |
| T112 | Migrations rebuild | all | Pass (with #6) |
| T101 | Dashboard at 100 units × 24 months, 3 s | not run | Needs a fixture and a preview deployment |
| T115 | Final acceptance (10 participants) | not run | Needs real participants |

**What holds everywhere:** RLS denies anonymous and pending users; staff cannot create or modify
owner-only master data; money is stored as exact integer centavos; private Storage buckets are not
publicly readable; uploads are compressed and size-limited; pages have no horizontal overflow at
360 px; uniqueness and overlap constraints reject conflicting records.

## Fix groups, in recommended order

### 1. Security and data integrity (database), highest priority

| ID | Defect | Records |
|---|---|---|
| SEC-1 | Unapproved users passed `require_owner()` | Fixed in #6 |
| SEC-2 | Approved staff can change a saved remittance's service date, disposition (and so the due), driver, unit and assignment. `remittances_operational_update_policy` allows every column | US3-D1 |
| SEC-3 | Document type/holder pairing is not enforced (a driver license on a unit), and a license whose expiry differs from the driver profile is accepted through REST and `/api/v1` | US5-D1, US5-D2 |
| SEC-4 | An expense can reference another expense's receipt object | US2-D8 |

### 2. Database logic bugs

| ID | Defect | Records |
|---|---|---|
| DB-1 | Primary assignments can never be ended (`backup_shape_check` requires `ends_on is null`), so units cannot be reassigned | US1-D1 |
| DB-2 | "Insert new current row, then supersede the old one" violates the partial unique index, so `replace_tire_installation()` and `renew_compliance_document()` always fail with 23505 | US4-D1, US5-D3 |
| DB-3 | The owner cannot soft-delete expenses, parts or tires: the only SELECT policy is `deleted_at is null`, so the updated row fails RLS. Staff are blocked only as a side effect, not by an owner-only rule. Likely the same for every table with this policy shape | US2-D3, US4-D6, US7-D11 |
| DB-4 | `dashboard_monthly_unit_summary()` returns literal `0` for outstanding and net income, counts payments by service date instead of received date, and has no credit or per-category columns; `monthly_report()` has no fleet total row | US7-D1, D2, D4, D5 |
| DB-5 | `driver_outstanding_balances()` counts the due once per payment (join fan-out) | US3-D2 |
| DB-6 | A driver operating one unit can be booked as backup on another unit on the same date | US3-D3 |
| DB-7 | A back-dated mileage reading higher than a later reading is accepted | US4-D5 |
| DB-8 | Dates use UTC instead of Asia/Manila: the dashboard `asOf`, the `current_date` defaults, and the client-side expiry badge. Wrong between 00:00 and 08:00 Manila, or on devices in other time zones | US4-D11, US5-D7, US5-D8 |

### 3. Shared UI bugs (one fix each, applied across forms and pages)

| ID | Defect | Records |
|---|---|---|
| UI-1 | Forms report failure after a successful save: `event.currentTarget.reset()` runs after `await` | US1-D5, US2-D1, US3-D5 |
| UI-2 | Lists and detail pages show "Unknown" names: many-to-one embeds are read as arrays (`[0]`) | US1-D3, US2-D2, US3-D4 |
| UI-3 | CSV export writes `0` for body/plate (wrong field names) and does not neutralise leading `= + - @` | US7-D3, US7-D6 |
| UI-4 | Raw Zod JSON or wrong messages shown on validation errors; route errors all map to 403 | US2-D7, US4-D2, US5-D4, US7-D9, US7-D10 |
| UI-5 | Double-submit creates two remittances (new idempotency key per submit, button not disabled) | US3-D6 |
| UI-6 | Create-then-upload flows leave a saved record without its file (or an orphaned file) when the second step fails | US2-D6, US5-D5 |

### 4. Missing UI: tasks marked done whose screens were never built

| ID | Missing | Records |
|---|---|---|
| GAP-1 | Assignments, days off, backup coverage, current driver on unit detail, days off/backup on driver detail | US1-D2, US1-D4 |
| GAP-2 | Expense edit, owner delete, and opening an attached receipt | US2-D4, US2-D5 |
| GAP-3 | Remittance detail link, later payments, note edits, owner reversal and payment correction; overpayment credit hidden; unpaid balances lack unit and period | US3-D7, D8, D9 |
| GAP-4 | Maintenance unit picker, mileage entry, tire history, part details, mileage fields; readable positions; dashboard due panel labels | US4-D3, D4, D7, D8, D9, D10 |
| GAP-5 | Document holder field (uploads cannot succeed), renewal, history, file view/download; documents on unit/driver pages | US5-D4, US5-D6 |
| GAP-6 | Report unit picker; unknown `unitId` returns 200 | US7-D7, US7-D8 |
| GAP-7 | Staff see owner-only forms (for example "Add a unit") | US1-D6 |

### 5. Test coverage

Several pgTAP files only check that objects exist, which is why DB-2, DB-3 and DB-4 were not
caught. Each fix in groups 1–2 should add a behavioural pgTAP test that fails before the fix.

## Validation scripts

The journeys are kept untracked under `.git/` (`us1-journey.mjs`, `us2-expenses-journey.mjs`,
`us3-journey.mjs`, `us4-journey.mjs`, `us5-journey.mjs`, `t108-journey.mjs`). Rerun them against
`rolnet-dev` after fixes. Test records in `rolnet-dev` are tagged with each run id.
