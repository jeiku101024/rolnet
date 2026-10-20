# Server Action Contracts

## Common Result

Every mutation returns a serializable discriminated result:

```text
Success: { ok: true, data: T, message?: string }
Failure: { ok: false, code: string, message: string, fieldErrors?: Record<string, string[]> }
```

Rules:

- Parse untrusted inputs with the matching Zod schema before authorization-dependent work.
- Authenticate and authorize inside every action; route visibility is not authorization.
- Use a user-scoped Supabase server client for normal queries so RLS remains enforced.
- Return generic messages for unexpected failures and record safe diagnostic context server-side.
- Financial and upload-finalization actions require a caller-generated UUID idempotency key.
- Revalidate only affected routes/tags after a successful commit.

## Owner Actions

### Unit and driver administration

| Action | Input | Success output | Authorization and invariants |
|---|---|---|---|
| `createUnit` | body number, plate number, make/model, status | unit ID | Owner; normalized unique identifiers |
| `updateUnit` | unit ID, editable fields, expected update timestamp | unit summary | Owner; reject stale edit and invalid status transition |
| `softDeleteUnit` | unit ID, expected update timestamp | deletion timestamp | Owner; reject active dependencies requiring resolution |
| `createDriver` | name, kind, license, expiry, contact | driver ID | Owner; unique license |
| `updateDriver` | driver ID, fields, expected update timestamp | driver summary | Owner; reject stale edit |
| `createPrimaryAssignment` | unit, driver, start/end | assignment ID | Owner; valid license/unit; no overlapping primary range |
| `recordDayOff` | primary assignment, date, notes | day-off ID | Owner; date inside assignment |
| `assignBackupDriver` | day-off ID, backup driver | coverage assignment ID | Owner; one operating unit/driver per date |

### Documents, settings, and users

| Action | Input | Success output | Authorization and invariants |
|---|---|---|---|
| `prepareDocumentUpload` | holder, type, filename, MIME, expected bytes | document ID and allowed object path | Owner; supported holder/type/MIME/size |
| `finalizeDocumentUpload` | document ID, path, size, SHA-256, expiry metadata | document summary | Owner; object exists; path/checksum match; supersede prior current record atomically |
| `softDeleteDocument` | document ID, expected update timestamp | deletion timestamp | Owner; history retained |
| `approveStaffRegistration` | user ID | approved profile summary | Owner; pending staff only; records approving actor and timestamp |
| `rejectStaffRegistration` | user ID, reason | rejected profile summary | Owner; pending staff only; no application access |
| `setStaffActive` | user ID, active flag | profile summary | Owner; deactivates/reactivates approved staff; cannot disable final owner |
| `updateFleetSettings` | fleet name, timezone | settings summary | Owner; rates/thresholds excluded from ordinary v1 edits |

## Owner and Staff Operational Actions

RLS and action checks allow both roles unless noted.

| Action | Input | Success output | Invariants |
|---|---|---|---|
| `upsertMileageReading` | unit, date, mileage, notes | reading and current mileage | Nondecreasing mileage; staff permitted |
| `createRemittance` | assignment, service date, disposition, idempotency key | due/paid/balance/credit | Actual driver for date; one unit/driver record per date; due auto-set to 18,000 or 30,000 centavos |
| `updateRemittanceNotes` | remittance, notes, expected update timestamp | remittance summary | Owner/staff; cannot alter service date, assignment, disposition, calculated due, actor, or deletion fields |
| `addRemittancePayment` | remittance, paid timestamp, positive centavos, idempotency key | recalculated totals | No overwrite; duplicate key returns existing result |
| `createExpense` | unit, category, date, positive centavos, notes, idempotency key | expense ID and receipt status | Missing receipt allowed |
| `prepareReceiptUpload` | expense, filename, MIME, compressed bytes | allowed object path | Image only; target <=300 KB, hard reject above 500 KB |
| `finalizeReceiptUpload` | expense, path, bytes, SHA-256 | expense summary | Object exists and belongs to expense path |
| `logPartReplacement` | unit, part, cost, date/mileage, next thresholds | replacement ID and due state | Dates/mileage ordered |
| `installTire` | unit, position, brand, date/mileage, cost, next threshold | tire ID | Replaces current position atomically |

Only owners may invoke approval/rejection, soft-delete, restore, financial reversal, or audit-view
actions. Staff update actions must reject changes to immutable identity, actor, calculated amount,
service date, assignment, disposition, or deletion fields.

## Concurrency Contract

- Update forms carry the last-seen `updated_at`. A mismatch returns `STALE_RECORD` and current data;
  the UI asks the user to review rather than overwriting silently.
- Unique/exclusion constraint failures map to stable codes such as `DUPLICATE_PLATE`,
  `ASSIGNMENT_CONFLICT`, or `DUPLICATE_REMITTANCE`.
- Database functions own multi-row transitions: assignment coverage, remittance creation/payment,
  tire replacement, document supersession, and soft-delete restoration.
