# Server Actions Contract: Feature 012

Every action uses the existing `run()` wrapper. It returns `{ ok: true, data }` or
`{ ok: false, code, message, fieldErrors? }`. Inputs are validated with Zod in `lib/validation/`.
Writes call `revalidatePath("/drivers")`, `revalidatePath("/drivers/[id]")`, and, where assignments
change, `/units` and `/remittances`.

## `app/actions/drivers.ts`

| Action | Permission | Input | Result | Notes |
|--------|------------|-------|--------|-------|
| `createDriver` | `manage_master_data` (owner) | `fullName, driverKind, isActive, phone, licenseNumber, licenseExpiryDate, address?, notes?` | `{ id }` | Adds `isActive` and `notes`. Toast "Driver added". Revalidates `/drivers`, `/units`, `/remittances` so the new driver is offered at once (FR-013) |
| `updateDriver` | owner | `id, fullName, phone, licenseNumber, licenseExpiryDate, address?, notes?, expectedUpdatedAt` | `{ id, updatedAt }` | No `driverKind` any more (the header switch owns it). Toast "Details saved" |
| `setDriverStatus` | owner | unchanged (`id, status, expectedStatus`) | unchanged | Only Active and Inactive. Before Inactive, the UI calls `driverReleasePreview`. The existing release trigger does the release |
| `driverReleasePreview` | owner | `{ id }` | `{ assignments: { date, unitName, kept: boolean }[] }` | Today-and-later saved assignments for the Inactive confirmation. `kept` is true when a remittance is recorded (the release trigger skips those, FR-043) |
| `setDriverRole` | approved (owner or staff) | `{ id, role, expectedUpdatedAt }` | `{ changeId, role, updatedAt }` | RPC `set_driver_role` |
| `undoDriverRole` | approved | `{ changeId }` | `{ role }` | RPC `undo_driver_role_change` |
| `previewAvailability` | approved | `{ date }` | `{ available: { id, name, role }[], hidden: { absent, inactive, assigned, licenceExpired } }` | For the "Preview dropdown" panel |

## `app/actions/driver-absences.ts` (new)

| Action | Permission | Input | Result |
|--------|------------|-------|--------|
| `previewAbsence` | approved | `AbsenceInput` | `{ conflict?: string, past: { assignments, remittances }, release: { id, date, unitName }[] }` |
| `saveAbsence` | approved | `AbsenceInput & { releaseIds: string[] }` | `{ absence, toast }` |
| `cancelAbsence` | approved | `{ id, expectedUpdatedAt }` | `{ absence }` |
| `endAbsence` | approved | `{ id, expectedUpdatedAt, cancelUpcoming?: boolean }` | `{ absence, cancelledCount }` |
| `confirmLeave` | approved | `{ id }` | `{ absence }` (with `snoozedUntil`) |

`AbsenceInput`:

```ts
{
  id?: string;                 // present when editing
  driverId: string;
  type: "day_off" | "on_leave";
  startDate: string;           // YYYY-MM-DD
  endDate: string | null;      // day_off: forced = startDate; on_leave: null only when openEnded
  openEnded: boolean;          // on_leave only
  reason: "sick" | "vacation" | "family_emergency" | "personal" | "other";
  note?: string;               // ≤ 500
  expectedUpdatedAt?: string;  // when editing
}
```

Field errors (Zod, before any read): Type, Date/From, To (required unless open-ended, ≥ From), and
Reason are required.

**Save flow (client)**: `previewAbsence` runs first.
1. If there's a conflict, show it as an inline error on the dates.
2. If past counts are above zero, show the amber warning and the button reads "Save anyway".
3. If the release list isn't empty, the next click opens "Release assignments?" and Confirm calls
   `saveAbsence` with those ids.
4. Otherwise `saveAbsence` is called with an empty list.

If the result is `P0001` with "Assignments … changed", the client runs the preview again and shows
the confirmation again.

**Toasts** (built server-side with fleet-date formatting, `MMM d`):
- `[Name] is on day-off Nov 5`
- `[Name] is on leave Nov 3 to Nov 10`
- `[Name] is on leave from Nov 3 (no end date)`
- `Leave ended. [Name] is available for assignment` (End leave now / End early)
- `Marked as still on leave. Flag hidden for 7 days.` (the number comes from settings)
- `[Name] is Active again`
- `[Name] marked as Backup` / `Primary` with **Undo** for 5 s
- `Inactive drivers cannot have absences` (client-side, no call)

## Error mapping additions (`lib/actions/errors.ts`)

- `23P01` → `CONFLICT`, "This driver already has an absence on these dates. Reload to see it."
- The database messages in [database.md](database.md) pass through unchanged as `VALIDATION` (23514)
  or `STALE_RECORD` (P0001).
