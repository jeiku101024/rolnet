# Data Model: Remittances Daily View

**There are no schema changes.** This feature reads and writes existing tables only. The first
section lists the stored data it relies on. The rest describes the in-memory view models that
`lib/remittances/daily-board.ts` builds from it.

## Stored data used (unchanged)

| Table | Columns used | Rules this feature depends on |
|-------|--------------|-------------------------------|
| `units` | `id, name, body_number, status, deleted_at` | `status = 'in_repair'` gives a "Not operating (in repair)" card, for today only |
| `drivers` | `id, full_name, is_active, license_expiry_date, deleted_at` | Picker candidates must be active, with a license valid on the date |
| `driver_assignments` | `id, unit_id, driver_id, assignment_type, starts_on, ends_on, covered_primary_assignment_id, deleted_at` | A primary covers `[starts_on, ends_on or ∞]`, and a backup covers only `starts_on` and points to the primary it covers. The database rejects a driver on two units on one date |
| `driver_days_off` | `id, primary_assignment_id, day_off_date, deleted_at` | A day off without a backup gives a "Not operating" (no driver) card |
| `remittances` | `id, unit_id, driver_id, assignment_id, service_date, disposition, amount_due_centavos, notes, updated_at, deleted_at` | At most one active record per unit and date, and per driver and date. The due is set by the database (18000 or 30000). Date, disposition, due, unit, driver, and assignment are locked after insert. Notes stay editable, checked against `updated_at` |
| `remittance_payments` | `id, remittance_id, paid_at, amount_centavos, deleted_at` | `amount_centavos > 0`. Voids go only through `correct_remittance_payment` (owner, audited) |

## View models (TypeScript, not stored)

### `DailyBoard`

| Field | Type | Notes |
|-------|------|-------|
| `date` | `string` (YYYY-MM-DD) | The selected date. Never after `today` |
| `today` | `string` | Today in the fleet time zone, frozen when the board loads (R10) |
| `isToday` | `boolean` | `date === today` |
| `cards` | `DailyCard[]` | Ordered by unit name, using the units register's natural order |
| `recorded` | `number` | Count of `saved` cards |
| `countable` | `number` | Count of `saved` and `unrecorded` cards. Not-operating cards are left out (FR-008) |
| `receivedCentavos` | `bigint`-safe `number` | Sum of active payments on the date's remittances |
| `freeDrivers` | `{ id, name }[]` | Owners only. Drivers free to cover on `date` (FR-014b) |

Header text: `${recorded} of ${countable} recorded` and `${formatPesos(receivedCentavos)} received`.
They are two separate elements, not joined with a middle dot. The progress value is
`countable ? recorded / countable : 0`.

### `DailyCard` (discriminated by `kind`)

Every kind shares these fields: `key = ${date}:${unitId}`, `unitId`, `unitName`, `bodyNumber`.

| `kind` | When | Extra fields | Counted |
|--------|------|--------------|---------|
| `saved` | An active remittance exists for the unit on `date` | `remittanceId`, `updatedAt`, `disposition`, `dueCentavos`, `receivedCentavos`, `notes`, `driver: DriverOnCard` (from the record, R3) | Yes |
| `unrecorded` | No remittance. `coverageOn(date)` gives an operator. Not in repair today | `assignmentId`, `driver: DriverOnCard` (from the schedule) | Yes |
| `no-driver` | No remittance. The primary has a day off on `date` and no backup | `dayOffId`, `primaryDriverName` | No |
| `in-repair` | No remittance. `isToday` and `units.status = 'in_repair'` | none | No |

Precedence for a unit with no remittance: `in-repair` (today only), then `no-driver`, then
`unrecorded`. A unit with no primary in effect on `date` and no remittance gets no card (FR-010). When `isToday`, a retired unit with no saved remittance for today also gets no card.
If no unit gets a card, the board shows the empty state "No units scheduled for this date." (FR-032).

### `DriverOnCard`

| Field | Type | Notes |
|-------|------|-------|
| `driverId` | `string` | |
| `name` | `string` | |
| `role` | `"primary" \| "backup"` | From `assignment_type` |
| `coveringFor` | `string \| null` | For a backup, the name of the covered primary's driver. Gives the tooltip "Covering for {name}, day off." |

### Card states on the client (`daily-card.tsx`)

```text
unrecorded ──save ok──▶ saved(locked)
     ▲  │ save failed: stays unrecorded with entries kept and an error (FR-029)
     │
no-driver ──owner assigns backup (assignBackupDriver ok)──▶ unrecorded (board refreshes)
in-repair: no transitions (no fields)

saved(locked) ──menu "Edit remittance"──▶ [past date and first time this session: confirm] ──▶ editing
editing ──save ok──▶ saved(locked)          (notes and/or payment change, R5)
editing ──cancel──▶ saved(locked)           (values reset)
editing ──save blocked──▶ editing           (staff lowering the payment, or invalid amount)
```

While a card is `editing`, or an `unrecorded` card's fields differ from their defaults, it is in
the board's `dirty` set (R10).

### Draft values and validation

| Field | Rule | Message |
|-------|------|---------|
| Disposition | `returned` or `overnight_overtime`. Defaults to `returned`. Locked once saved (FR-026) | none |
| Due (shown) | `returned` is 18000 and `overnight_overtime` is 30000, computed on the client, display only | none |
| Payment received | Empty means ₱0.00. Otherwise `parsePositiveCentavos`-style parsing with at most 2 decimals and no sign | "Enter an amount like 180 or 180.50." |
| Payment (edit, staff) | Must be at least the recorded total | "Only the owner can lower a recorded payment." |
| Lowering reason (owner) | Trimmed, 3 to 500 characters (the existing `correctionSchema`) | "Give a reason of at least 3 characters." |
| Notes | 1,000 characters at most | the existing label "notes (1,000 characters at most)" |

### Result badge

The card reuses `BalanceBadge` (`components/remittances/balance-badge.tsx`) with
`remittanceTotals(due, payments)` from `lib/remittances/totals.ts`. That gives "Paid" (success),
"Owes ₱X" (warning), or "Credit ₱X" (success), the same as List view, so the two views never
disagree.
