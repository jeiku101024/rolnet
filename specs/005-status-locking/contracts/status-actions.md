# Contract: Status actions, API behaviour and UI

## Server Actions

Both actions are owner-only (`requirePermission("manage_master_data")`). Each returns the app's
standard `ActionResult` from `lib/actions/errors.ts`.

### `setUnitStatus(input)` in `app/actions/units.ts`

```ts
input: { id: string /* uuid */; status: "active" | "in_repair" | "retired"; expectedUpdatedAt: string /* ISO timestamp */ }
ok:    { ok: true; data: { id: string; status: UnitStatus; updatedAt: string } }
```

| Case | Result |
|---|---|
| The status differs and `updated_at` matches | Row updated; `/units` and `/units/{id}` revalidated |
| The status equals the current one | `ok: true` with the current row; nothing written |
| `updated_at` differs and the current status equals the requested one (a retry) | `ok: true` |
| `updated_at` differs otherwise | `ok: false`, `STALE_RECORD`: "This unit was changed by someone else. It is now {Label}." |
| Unit not found or archived | `ok: false`, `NOT_FOUND` |
| Invalid input | `ok: false`, `INVALID_INPUT` |
| Staff or pending user | Redirect to `/forbidden` (existing guard) |

### `setDriverStatus(input)` in `app/actions/drivers.ts`

```ts
input: { id: string; status: "active" | "inactive"; expectedUpdatedAt: string }
ok:    { ok: true; data: { id: string; status: "active" | "inactive"; updatedAt: string } }
```

It handles the same cases as `setUnitStatus`, plus one more:

| Case | Result |
|---|---|
| Inactive refused because of a current or upcoming assignment | `ok: false` with the trigger's message: "This driver still has current or upcoming assignments. End or remove them before setting the driver to Inactive." |

### Changed: `updateUnit(id, input)` and `updateDriver(id, input)`

- `updateUnit` validates with `unitDetailsSchema` (body number, plate number, make/model) and no
  longer writes `status`.
- `updateDriver` keeps its current fields.
- Both add `expectedUpdatedAt` and refuse stale writes with `STALE_RECORD`.
- On a locked record, both return the trigger's message, for example: "This unit is In repair.
  Set the unit to Active before editing its details."

## `/api/v1` (unchanged routes, new database behaviour)

`PATCH /api/v1/units/{id}` and `PATCH /api/v1/drivers/{id}` keep their fields and `If-Match`
handling.

| Request | Response |
|---|---|
| A detail field on a locked record | `409` (the existing generic mapping of `23514`) |
| `{"is_active": false}` for a driver with current or upcoming assignments | `409` (the existing mapping of `23503`) |
| A status-only change | Allowed for owners, as today |

The plain-language trigger messages are not shown through `/api/v1`. This is the existing known
limit of the generic 409 mapping, and this feature does not change it.

## UI

### `StatusSelect` (`components/forms/status-select.tsx`, client)

- **Props:** `kind: "unit" | "driver"`, `id`, `value`, `updatedAt`, and an optional `label` (the
  accessible name, for example "Status for Body 12").
- **Rendering:** a native `<select>` (`Select` from `components/ui/form-field.tsx`), touch-sized,
  with the options from `lib/status/record-status.ts`.
- **On change:**
  1. Show the new value at once and disable the control while it saves.
  2. Call the action.
  3. On `ok: false`, revert to the saved value and show the message in an inline `role="alert"`
     text under the control.
- **Search and filters:** unaffected. The control does not navigate, and the list's search state
  is client-side.
- **Visibility:** rendered only when the viewer is the owner. Otherwise the existing
  `StatusBadge` is shown.

### Lists: `/units` and `/drivers`

- **`/units`:** the Status column renders `StatusSelect` for each row.
- **`/drivers`:** the existing Status column renders `StatusSelect`.
- At 360 px the select fits inside the cell (`w-full`, no fixed width), and the table keeps its
  existing scroll-free layout.

### Detail pages: `/units/{id}` and `/drivers/{id}`

- **Header:** shows `StatusSelect` next to the status badge.
- **While Active:**
  - The owner sees "Edit details" (`UnitDetailsForm` or `DriverDetailsForm`).
  - The forms are pre-filled and save through `updateUnit` or `updateDriver`.
- **While locked:**
  - Details are shown as read-only text.
  - `LockedNotice` is shown: "This driver is Inactive. Set the status to Active to edit their
    details." For a unit: "This unit is In repair." or "This unit is Retired."
  - No edit form is rendered.
- **Status history:** the latest 10 status changes from `audit_events`, each with the old and new
  label, who made the change, and when (Manila time).
- **After a status change:** the page re-renders through `revalidatePath`, so the form appears or
  disappears without a manual reload (SC-005).
