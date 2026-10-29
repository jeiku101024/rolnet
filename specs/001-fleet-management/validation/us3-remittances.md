# US3 Remittances Validation

Original implementation: 2026-10-20. Checkpoint T065 run: 2026-10-28 (not passed). Re-run T147:
2026-10-29. **Result: passed (64 / 64).**

## Implementation (2026-10-20)

- Remittance and payment migrations enforce unit/date and driver/date uniqueness, the
  assignment/date check, trigger-set 18,000 or 30,000 centavo dues, positive payments and
  idempotency keys. RLS and pgTAP files are present.
- Server actions for create, note edits, payments and owner reversal, the mobile daily form, and the
  list/detail pages are implemented. `typecheck`, `lint` and `build:vinext` passed.
- The database-backed checkpoint was blocked (no Docker/WSL2 runtime).

## Re-run 2026-10-29 (after Phase 11)

- Run id `AURM`, fleet date 2026-10-29 (Asia/Manila). D-n means n days before that date.
- Commit tested: `423c3f2` (main after PR #14), branch `test/001-checkpoint-reruns`.
- Environment: `rolnet-dev` with every migration through `20261029001500`, `next dev` in backend
  mode, Chromium at 360 × 800 (mobile, touch), E2E owner, approved-staff and pending-staff accounts.
- Setup as before (units `RAURMA`/`RAURMB`, P1/P2/B1, primaries from D-10, P1 day off D-2 covered
  by B1) through REST with the owner's JWT; the assignment screens themselves are covered by US1.
- The same 64 checks. Later payments, notes, payment correction (void and re-enter) and reversal
  now go through the remittance detail page; the database-only checks still use REST with each
  user's JWT.
- One check is verified in SQL instead: "a second remittance for the same driver on the same date".
  It used to be reached through a busy-driver backup assignment (D3); that assignment is now refused,
  so the constraint was exercised directly with `supabase db query --linked` in a rolled-back
  transaction with triggers off (`session_replication_role = replica`): the insert fails on
  `remittances_driver_date_unique`.
- Run `JUQN` earlier the same day reported 62 / 64: two script errors (it read the notes form's
  status after the page refresh had removed it, and expected a message from the voided payment's
  own form, which disappears with the row). Both actions had worked.

**64 of 64 checks passed** (47 / 64 before).

### Rates

| Check | Result | Evidence |
|---|---|---|
| Staff returned day D-5 with ₱100 in the form | Pass | due 18,000, payment 10,000, `created_by` = staff |
| Owner overnight D-4 with ₱350.00 | Pass | due 30,000, payment 35,000 |
| `amount_due_centavos = 1` sent directly | Pass | trigger stores 18,000 |
| Detail pages show ₱180.00 / ₱300.00 due | Pass | |
| Form confirms the save and clears | Pass | "Remittance and payment saved." |

### Assignment resolution

| Check | Result | Evidence |
|---|---|---|
| Date before the assignment starts (D-12) | Pass | "Remittance requires an assignment active on the service date." |
| P1 on his day off covered by B1 (D-2), form and REST | Pass | "Backup driver is the actual operating driver for this date." |
| B1's remittance for unit A on D-2 | Pass | charged to B1 |
| P1 (operating unit A) booked as backup on unit B for D-1 | Pass | 400 `23P01` "Driver already operates another unit on this date" |
| Picker names driver and unit | Pass | "P1 AURM · Body RAURMA · from 2026-10-19" |

### Uniqueness and idempotency

| Check | Result | Evidence |
|---|---|---|
| Second remittance for unit A on D-5, new key | Pass | 409 `remittances_unit_date_unique` |
| Second remittance for P1 on D-1 on the other unit | Pass | SQL (see above): `remittances_driver_date_unique` |
| Retry D-5 and D-4 with their original keys | Pass | 409 on the key; one row each, resolves to the original |
| Payment retry with the same key (key of the UI payment) | Pass | 409; still two payments |
| Double-tap Save | Pass | one row; "Remittance saved. No payment recorded yet." |

### Payments, history and balances

| Check | Result | Evidence |
|---|---|---|
| Staff adds a later ₱80 payment to D-5 | Pass | detail page Add payment: "Payment saved." |
| Add-payment control on the detail | Pass | |
| Zero and negative payments | Pass | 400 / 400 |
| Staff changes or deletes a saved payment | Pass | 0 rows updated; row kept |
| D-5 detail: due ₱180.00, paid ₱180.00, balance paid; history lists both payments | Pass | "BALANCE Paid", 2 rows |
| D-3 unpaid detail | Pass | "Owes ₱180.00" |
| D-4 overpaid detail | Pass | "Credit (overpaid) · Credit ₱50.00" |
| List and detail name the unit and driver | Pass | "Driver P1 AURM · Body RAURMA" |
| List rows link to the detail | Pass | |
| P1 outstanding per remittance | Pass | 18,000 |
| `driver_outstanding_balances` for P1 | Pass | 18,000 |
| Dashboard "Unpaid balances" for P1 | Pass | ₱180.00 |
| Unpaid balance shows unit and period | Pass | "Body RAURMA · 2026-10-26 · 1 unpaid day" with a link to the remittance |

### Owner corrections and audit

| Check | Result | Evidence |
|---|---|---|
| Staff calls `reverse_remittance` / `correct_remittance_payment` | Pass | 403 "Owner access is required" |
| Payment correction without a reason | Pass | 400 "A correction reason is required" |
| Owner voids the ₱350 payment and enters ₱300 (detail page) | Pass | voided row leaves the history; "Payment saved."; active payments [30,000] |
| Correction audited | Pass | `soft_delete`, `reverse` (owner, with reason), `insert` |
| Owner reverses D-1 (detail page); reversing again (REST) | Pass | returns to `/remittances`; second attempt refused, `P0002` (HTTP 500, see note) |
| Reversal audited | Pass | `soft_delete`, `reverse` with reason |
| Replacement D-1 entry after reversal | Pass | 30,000, paid |
| Payment against a reversed remittance | Pass | "Payment requires an active remittance" |
| Owner reversal / correction controls; none for staff | Pass | owner: Reverse remittance, Void payment; staff: neither |

### Roles and locked fields

| Check | Result | Evidence |
|---|---|---|
| Staff edits notes (REST and the detail Notes form) | Pass | saved; "Notes saved." |
| Staff writes `amount_due_centavos` directly | Pass | 400: "A saved remittance's date, disposition, amount due, unit, driver and assignment cannot be changed…" |
| Staff changes service date / disposition / driver, unit and assignment | Pass | same 400 message; row unchanged |
| Staff soft-deletes a remittance | Pass | 403 |
| Staff reads audit events / driver balances | Pass | 0 rows |
| Pending staff token: read, add a payment | Pass | 0 rows; 403 |
| Anonymous REST read/write | Pass | 401 `42501` |
| Signed-out and pending users open `/remittances` | Pass | end on `/login` |

### 360 px

| Check | Result |
|---|---|
| `/remittances` (staff and owner), remittance detail, `/dashboard`: no page-level horizontal overflow | Pass |

### Defect status

| Old ID | Status | Notes |
|---|---|---|
| D1 | Fixed | Trigger rejects changes to date, disposition, due, unit, driver and assignment |
| D2 | Fixed | `driver_outstanding_balances` = 18,000 |
| D3 | Fixed | Busy driver refused as backup (`23P01`) |
| D4 | Fixed | Names in picker, list and detail |
| D5 | Fixed | Success messages |
| D6 | Fixed | Double-tap gives one row and no error |
| D7 | Fixed | Detail link, Add payment, Notes, Reverse, Void payment |
| D8 | Fixed | Credit shown |
| D9 | Fixed | Unit, service dates and unpaid-day count in Unpaid balances |

No new defects. Observations (not counted as failures):

- "Notes saved." shows for about one second: the notes form is keyed by `updated_at`
  (`app/(operations)/remittances/[id]/page.tsx`), so the refresh remounts it and clears the message.
  The saved notes stay in the field.
- Reversing an already reversed remittance through REST returns HTTP 500 with `P0002`. It is
  refused, but a 4xx would describe it better. The UI does not offer it (the page is gone).
- Not tested, as before: the return-existing branch of `createRemittance` from the form, remittances
  on retired or in-repair units, and the 60-second payment timing.

## T065 run (2026-10-28)

Environment: `rolnet-dev` Supabase project with all migrations through
`20261028000200`, `next dev` (Next.js 16.4.3) in backend mode, Chromium at a 360 × 800 mobile
viewport, E2E owner, approved-staff and pending-staff accounts. Run id `EGLQ`, fleet date
2026-10-28 (Asia/Manila). D-n means n days before that date.

- Setup: the owner created units `REGLQA`/`REGLQB`, drivers P1/P2 (primary) and B1 (backup), primary
  assignments P1 → A and P2 → B from D-10, a P1 day off on D-2 and B1's backup assignment for it.
  This used the Supabase REST API with the owner's JWT because there is no assignment UI (US1 D2).
- UI checks drive the real `/remittances`, `/remittances/[id]` and `/dashboard` pages. Direct-access
  checks call the REST API with each user's own JWT, so RLS, triggers and constraints apply.
- Earlier runs `NQPC` and `XAPS` had script errors (waiting on Next's route announcer instead of
  the form message, case-sensitive label matching, one check order). The results below are from
  the corrected script.

**47 of 64 checks passed.**

### Rates (exact centavos and ₱ display)

| Check | Result |
|---|---|
| Staff records a returned day (D-5) with a ₱100 payment in the form | Pass: due 18,000, payment 10,000 centavos, `created_by` = staff |
| Owner records an overnight/overtime day (D-4) with ₱350.00 | Pass: due 30,000, payment 35,000 centavos |
| Client sends `amount_due_centavos = 1` directly | Pass: the trigger stores 18,000 |
| Detail pages show ₱180.00 / ₱300.00 due | Pass |
| Form confirms the save | **Fail (D5):** shows "Cannot read properties of null (reading 'reset')" after a successful save |

### Assignment resolution

| Check | Result |
|---|---|
| Date before the assignment starts (D-12) | Pass: rejected; "Could not save remittance. Check assignment, date, and duplicate submissions." |
| Primary P1 on his day off covered by backup B1 (D-2) | Pass: rejected; database reason "Backup driver is the actual operating driver for this date" |
| Backup B1's remittance for unit A on D-2 | Pass: accepted, charged to B1 |
| P1 (operating unit A) also booked as backup on unit B for D-1 | **Fail (D3):** assignment accepted |
| Assignment picker names the driver and unit | **Fail (D4):** every option reads "Driver · Body Unit" |

### Uniqueness and idempotency

| Check | Result |
|---|---|
| Second remittance for unit A on D-5 with a new key | Pass: 409 `remittances_unit_date_unique` |
| Second remittance for P1 on D-1 on the other unit (through D3's assignment) | Pass: 409 `remittances_driver_date_unique` |
| Retry the D-5 and D-4 creates with their original idempotency keys | Pass: 409 on the key; one row each; the key resolves to the original (what `createRemittance` returns) |
| Retry a payment with the same key | Pass: 409; still two payments |
| Double-tap Save | Pass: one row created. **Fail (D6):** the second submit has a new key and shows "Could not save remittance…" for an entry that was saved |

### Payments, history and balances

| Check | Result |
|---|---|
| Staff adds a later ₱80 payment to D-5 | Pass (REST only; **Fail (D7):** no add-payment control on any page) |
| Zero and negative payments | Pass: rejected (400) |
| Staff changes or deletes a saved payment | Pass: 0 rows updated / denied |
| D-5 detail: due ₱180.00, paid ₱180.00, balance ₱0.00; history lists both payments | Pass |
| D-3 unpaid detail: paid ₱0.00, balance ₱180.00 | Pass |
| D-4 overpaid detail: paid ₱350.00, ₱50.00 credit | **Fail (D8):** balance shows ₱0.00; no credit shown |
| List and detail name the unit and driver | **Fail (D4):** "Body Unknown" / "Driver Unknown" |
| List rows link to the detail page | **Fail (D7):** no links; the detail is reachable only by URL |
| P1 outstanding computed per remittance | Pass: 18,000 centavos (D-5 paid, D-4 paid, D-3 unpaid, D-1 paid) |
| `driver_outstanding_balances` for P1 | **Fail (D2):** returns 36,000 |
| Owner dashboard "Unpaid balances" for P1 | **Fail (D2):** ₱360.00 instead of ₱180.00 |
| Unpaid balance shows the related unit and period (scenario 4) | **Fail (D9):** only driver name and amount |

### Owner corrections and audit

| Check | Result |
|---|---|
| Staff calls `reverse_remittance` / `correct_remittance_payment` | Pass: 403 `42501` "Owner access is required" |
| Payment correction without a reason | Pass: rejected |
| Owner corrects the ₱350 payment and enters ₱300 | Pass: active payments = [30,000] |
| Correction audited | Pass: `reverse` event by the owner with the reason, plus `soft_delete` and `insert` |
| Owner reverses the D-1 remittance; reversing again | Pass: reversed; second attempt refused (`P0002`) |
| Reversal audited | Pass: `reverse` with reason by the owner, plus `soft_delete` |
| Replacement D-1 entry after reversal | Pass: accepted (30,000) and paid |
| Payment against a reversed remittance | Pass: rejected, "Payment requires an active remittance" |
| Owner reversal / correction controls on the detail page | **Fail (D7):** none |

### Roles and locked fields

| Check | Result |
|---|---|
| Staff edits notes (REST) | Pass. **Fail (D7):** no notes edit control in the UI |
| Staff writes `amount_due_centavos` directly | Pass: the trigger keeps 18,000 |
| Staff changes service date (D-6 → D-8) | **Fail (D1):** saved |
| Staff changes disposition | **Fail (D1):** saved; due becomes 30,000 |
| Staff moves the remittance to another driver, unit and assignment | **Fail (D1):** saved (P2/unit B → P1/unit A) |
| Staff soft-deletes a remittance | Pass: 403 |
| Staff reads audit events / driver balances | Pass: 0 rows |
| Pending staff token: read remittances, add a payment | Pass: 0 rows; 403 RLS |
| Anonymous REST read/write | Pass: 401 `42501` |
| Signed-out and pending users open `/remittances` | Pass: redirected to `/login` |

### 360 px

| Check | Result |
|---|---|
| `/remittances` (staff and owner), remittance detail, `/dashboard`: no page-level horizontal overflow | Pass |

### Not tested

- The "return existing record" branch of `createRemittance` through the UI: the form makes a new
  key on every submit, so the branch is unreachable from the form. Database-level idempotency was
  verified through REST.
- Remittances on retired or in-repair units, and after an ended assignment: primary assignments
  cannot be ended (US1 D1).
- The 60-second phone payment timing (SC) was not measured.

## Defects

| ID | Area | Defect | Cause |
|---|---|---|---|
| D1 | Database | Approved staff can change a saved remittance's service date, disposition (and so the due), driver, unit and assignment (FR-013a) | `remittances_operational_update_policy` in `supabase/migrations/20261019003100_add_remittances_rls.sql` allows any column update for `is_approved_user()`; there is no column privilege or lock trigger, and `validate_remittance()` only re-checks the assignment and recomputes the due |
| D2 | Database | Driver outstanding balance is overstated when a remittance has more than one payment (₱360 instead of ₱180) | `driver_outstanding_balances` in `supabase/migrations/20261019006200_create_driver_balance_query.sql` joins remittances to payments and then sums `amount_due_centavos`, so the due is counted once per payment row |
| D3 | Database | A driver who is operating one unit can be booked as backup on another unit the same date | `validate_driver_assignment()` in `supabase/migrations/20261019001400_create_driver_assignments.sql` only looks for rows with `starts_on = new.starts_on`, not primary assignments whose range covers the date. `remittances_driver_date_unique` still blocks a second remittance |
| D4 | UI | Picker shows "Driver · Body Unit"; list and detail show "Body Unknown" / "Driver Unknown" | `components/forms/remittance-form.tsx`, `app/(operations)/remittances/page.tsx` and `app/(operations)/remittances/[id]/page.tsx` read the embedded `units` / `drivers` as arrays (`[0]`); PostgREST returns a many-to-one embed as an object (same as US1 D3) |
| D5 | UI | Form shows an error after a successful save | `event.currentTarget.reset()` runs after `await` in `components/forms/remittance-form.tsx`; React has cleared `currentTarget`, so it throws into the catch block (same as US1 D5) |
| D6 | UI | No duplicate-submit protection: a double tap sends two creates and reports failure for the saved entry | `components/forms/remittance-form.tsx` makes a new `crypto.randomUUID()` key per submit and does not disable the button while saving |
| D7 | UI | No list-to-detail link, and no controls for later payments, note edits, owner reversal or payment correction | `app/(operations)/remittances/page.tsx` and `[id]/page.tsx` never call `addRemittancePayment` (outside the create form), `updateRemittanceNotes` or `reverseRemittance`; `correct_remittance_payment` is reachable only through `app/api/v1` (T064 scope) |
| D8 | UI | Overpayment credit is hidden; an overpaid day shows ₱0.00 balance | Both pages compute `Math.max(due - paid, 0)` and have no credit state |
| D9 | UI | Unpaid balances show only driver and amount, not the related unit and period (scenario 4, FR-016) | `driver_outstanding_balances` returns only driver id, name and total; `components/dashboard/unpaid-balances-panel.tsx` has nothing else to show |

T065 stays unchecked until D1–D9 are fixed and this journey passes.
