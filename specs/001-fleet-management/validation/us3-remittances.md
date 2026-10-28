# US3 Remittances Validation

Original implementation: 2026-10-20. Checkpoint T065 run: 2026-10-28. **Result: not passed (open defects).**

## Implementation (2026-10-20)

- Remittance and payment migrations enforce unit/date and driver/date uniqueness, the
  assignment/date check, trigger-set 18,000 or 30,000 centavo dues, positive payments and
  idempotency keys. RLS and pgTAP files are present.
- Server actions for create, note edits, payments and owner reversal, the mobile daily form, and the
  list/detail pages are implemented. `typecheck`, `lint` and `build:vinext` passed.
- The database-backed checkpoint was blocked (no Docker/WSL2 runtime).

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
