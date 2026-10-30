# Contract: Server actions used by Daily view

Every action returns the existing `ActionResult` from `lib/actions/errors.ts` through `run()`:
`{ ok: true, data, message? } | { ok: false, code, message, fields? }`. Messages are plain language
and say how to recover. Each action revalidates `/remittances` and `/dashboard`, the same as
`app/actions/remittances.ts` does today. **No action changes the database schema.**

## `saveDailyRemittance(input)` (new, in `app/actions/remittances.ts`)

Records an unrecorded card (FR-020, FR-020a, FR-028).

| Field | Type | Rule |
|-------|------|------|
| `assignmentId` | uuid | The card's operating assignment, from the board |
| `serviceDate` | `YYYY-MM-DD` | The board date. Rejected if after fleet today |
| `disposition` | `"returned" \| "overnight_overtime"` | |
| `notes` | string, 1,000 characters at most, optional | |
| `paymentCentavos` | int ≥ 0, optional | 0 or missing means no payment row |
| `remittanceKey` / `paymentKey` | uuid | Idempotency keys, generated once per card draft |

Behavior: `requireApprovedSession()`, then the existing `createRemittance` logic (idempotent on
`remittanceKey`, so the database sets the due and validates the assignment), and then, if
`paymentCentavos > 0`, the existing payment insert with `paidAt = paymentTimestampFor(serviceDate,
now)` (idempotent on `paymentKey`). It returns `{ id, updatedAt, receivedCentavos }`.

Errors:

| Cause | Code | Message |
|-------|------|---------|
| The unit is already recorded for the date (`remittances_unit_date_unique`) | existing duplicate mapping | "This unit already has a remittance for this date. Reload to see it." |
| The driver is already recorded on another unit (`remittances_driver_date_unique`) | same | "This driver already has a remittance on another unit for this date." |
| The assignment is not in effect | existing check | "The driver wasn't assigned to this unit on this date. Reload the page." |
| The payment failed after the record was saved | `PARTIAL` | "The remittance was saved, but the payment was not. Edit the card to add the payment." The card shows as saved |

## `editDailyRemittance(input)` (new)

Saves an edited saved card (FR-024, FR-026, FR-027, FR-020a).

| Field | Type | Rule |
|-------|------|------|
| `remittanceId` | uuid | |
| `expectedUpdatedAt` | ISO timestamp | From the card. Guards against overwriting someone else's notes change |
| `notes` | string, 1,000 characters at most | Written only if it changed |
| `targetPaymentCentavos` | int ≥ 0 | The new total received |
| `reason` | string, 3 to 500 characters | Required only when lowering |
| `paymentKey` | uuid | Idempotency key for the payment this save adds |

Behavior:

1. `requireApprovedSession()`. Load the remittance (active) with its `service_date` and its active
   payments, and compute `current`.
2. If the notes changed, update them through the existing `updateRemittanceNotes` logic (the
   `updated_at` check). A stale record returns `STALE_RECORD`: "Someone changed this remittance after
   you opened it. Reload the card and edit again."
3. `planPaymentChange({ current, target, role })` decides the next step:
   - `none`: nothing to do.
   - `add(diff)`: insert one payment of `diff`, with `paidAt = paymentTimestampFor(service_date, now)`.
   - `replace(target)`: `requirePermission("manage_master_data")`. For each active payment, call
     `rpc("correct_remittance_payment", { p_payment_id, p_reason: reason })`. Then, if `target > 0`,
     insert one payment of `target` with the same `paidAt` rule and `paymentKey`. On failure partway
     through, return `PARTIAL`: "Some earlier payments were voided but the new amount wasn't saved.
     Save again to finish." A retry starts again from step 1 and converges (research R5).
   - `blocked`: return `FORBIDDEN`: "Only the owner can lower a recorded payment."
4. Return `{ updatedAt, receivedCentavos }`.

The disposition is not an input. It can't change after saving (FR-026, enforced by
`lock_remittance_financial_facts`).

## `assignBackupDriver(input)` (existing, unchanged)

The owner's on-card picker (FR-014b) calls it with `{ dayOffId, backupDriverId }`.
`requirePermission("manage_master_data")`. The database rejects an inactive driver, an expired
license, or a driver already operating that date ("Driver already operates another unit on this
date"), and the card shows that message while staying "Not operating". On success, the board
refreshes (`router.refresh()`) and the card becomes `unrecorded` with a Backup tag.

## Read path (server component, not an action)

`loadDailyRows(supabase | null, date, role)` returns the 5 row sets described in research R2.
`null` means demo mode, which reads from `lib/demo/mode.ts`. `buildDailyBoard(...)` turns them into
the `DailyBoard` in [data-model.md](../data-model.md). Both are pure apart from the queries, and
both are unit tested.
