# Data Model: Backend CRUD APIs

This feature retains the existing PostgreSQL tables as the source of truth. The API exposes DTOs,
not raw rows. Every mutable business table carries `created_at`, `created_by`, `updated_at`,
`updated_by`, `deleted_at`, and `deleted_by`; current reads require `deleted_at IS NULL`. UUIDs are
used unless a field says otherwise. All money fields are integer centavos.

## Shared Lifecycle Rules

- Creation sets actor/timestamps through database triggers.
- PATCH and lifecycle transitions compare the submitted `If-Match` value with `updated_at`.
- DELETE marks deletion metadata; restoration clears it only after current constraints are checked.
- Audit triggers write safe before/after field changes for insert, update, soft-delete, restore, and
  reverse actions. Passwords, tokens, checksums, and private object paths are never copied to audit.
- Foreign keys continue referencing soft-deleted history; current workflows reject deleted parents.
- Unique indexes apply to current records so a deleted value may be reused, while restoration can
  fail with `RESTORE_CONFLICT`.

## Entities

### Profile

Fields: `user_id`, `display_name` (1-120 chars), `role` (`owner|staff`), `account_status`
(`pending|approved|rejected|deactivated`), `approved_at`, `approved_by`, and audit fields.

Relations: one Auth identity; approval actor references another Auth identity.

Transitions: registration creates pending staff; owner may approve/reject pending staff and
deactivate/reactivate approved staff. The final approved owner cannot be removed or deactivated.
General deletion and role escalation are not API operations.

### Fleet Setting

Fields: singleton `id=true`, `fleet_name` (1-160 chars), IANA `timezone`, positive
`standard_remittance_centavos`, larger `overnight_remittance_centavos`, fixed warning thresholds,
and audit fields.

Transitions: owner PATCH only. No collection create/delete/restore.

### Unit

Fields: `id`, normalized unique `body_number` (1-40), normalized unique `plate_number` (1-20),
`make_model` (1-120), `status` (`active|in_repair|retired`), derived `current_mileage`, audit fields.

Relations: has mileage readings, assignments, expenses, remittances, parts, tires, and documents.
The API does not directly patch `current_mileage`; database mileage transitions recalculate it.

### Driver

Fields: `id`, `full_name` (1-160), `driver_kind` (`primary|backup`), unique `license_number`,
`license_expiry_date`, `phone`, optional `address`, `is_active`, audit fields.

Relations: has assignments, remittances, and driver-license documents. License renewal that changes
an existing current document expiry is atomic across both records.

### Driver Assignment

Fields: `id`, `unit_id`, `driver_id`, `assignment_type` (`primary|backup`), `starts_on`, optional
`ends_on`, optional `covered_primary_assignment_id`, `reason`, audit fields.

Rules: primary ranges cannot overlap for a unit or driver. Backup coverage lasts one date, references
a primary assignment, and cannot double-book a unit or driver. Drivers must be active/licensed and
units non-retired. Ending/replacing, deleting, and restoring re-run conflict checks.

### Driver Day Off

Fields: `id`, `primary_assignment_id`, `day_off_date`, optional `notes`, audit fields.

Rules: unique per assignment/date and date must lie inside the active primary range. A backup
assignment may cover the day-off record.

### Mileage Reading

Fields: `id`, `unit_id`, `reading_date`, non-negative `mileage`, optional `notes`, audit fields.

Rules: unique per unit/date and nondecreasing by date. Create/update/delete/restore recalculates the
unit's current mileage from the greatest active latest reading inside the same transaction.

### Expense Category

Fields: `id`, unique `name` (1-80), optional `system_key`, `is_system`, audit fields.

Rules: system categories retain immutable keys. Deletion is blocked while active expenses refer to
the category; historical expense links are never rewritten.

### Expense

Fields: `id`, `unit_id`, `category_id`, `expense_date`, positive `amount_centavos`, optional `notes`,
optional receipt metadata (`receipt_object_path`, MIME type, bytes, SHA-256), unique
`idempotency_key`, new optional unique `receipt_finalize_key`, audit fields.

Rules: receipt metadata is all-null or complete; MIME is JPEG/PNG/WebP and size is 1-512000 bytes.
The API never returns the private path to unauthorized DTOs. Receipt finalization verifies ownership,
object metadata, checksum, and retry key atomically.

### Remittance

Fields: `id`, `assignment_id`, denormalized `unit_id`/`driver_id`, `service_date`, `disposition`
(`returned|overnight_overtime`), derived positive `amount_due_centavos`, optional `notes`, unique
`idempotency_key`, audit fields.

Rules: one current remittance per unit/date and driver/date. Assignment/service identity,
disposition, due, creator, and service date are immutable. Owner reversal soft-deletes with a reason;
restore rechecks assignment and uniqueness constraints.

### Remittance Payment

Fields: `id`, `remittance_id`, `paid_at`, positive `amount_centavos`, unique `idempotency_key`,
optional `notes`, audit fields.

Rules: append-only for ordinary users. Owner correction soft-deletes the payment with a required
reason through a narrow function; it is not a general DELETE and can be restored only when the
parent remittance is current.

### Part Replacement

Fields: `id`, `unit_id`, `part_name` (1-120), non-negative `cost_centavos`, `replaced_on`, optional
`replacement_mileage`, `next_due_date`, `next_due_mileage`, `notes`, audit fields.

Rules: at least one next-due threshold; due date follows replacement date; due mileage exceeds the
replacement mileage when both are present.

### Tire Installation

Fields: `id`, `unit_id`, `position` (`front|rear_left|rear_right`), `brand` (1-80), `installed_on`,
optional `installed_mileage`, non-negative `cost_centavos`, next-due fields, `replaced_by_id`, audit
fields.

Rules: at least one due threshold and only one current active tire per unit/position. Replacement
inserts the new tire and links the former current tire atomically. Historical installation identity
is not overwritten.

### Compliance Document

Fields: `id`, `document_type` (`or_cr|driver_license|mtop_franchise|insurance`), exactly one of
`unit_id`/`driver_id`, optional `document_number`/`issued_on`, required `expires_on`,
`lifecycle_status` (`current|superseded|void`), private object metadata, `superseded_by_id`, new
unique `idempotency_key`, audit fields.

Rules: one current active document per holder/type. Driver-license documents belong to drivers and
match the profile expiry; other supported types belong to units. Renewal inserts a new current row,
supersedes the prior row, and synchronizes driver expiry when applicable in one transaction.

### Audit Event

Fields: bigint `id`, `occurred_at`, optional `actor_user_id`, `entity_type`, `entity_id`, `action`,
and sanitized `changed_fields`.

Rules: append-only from trusted triggers/functions; owner read only, ordered newest first. No API
creation, update, deletion, or restoration.

## Derived Values and DTOs

- Remittance `paid_centavos`, `balance_centavos`, and `credit_centavos` are derived from current
  payments using integer arithmetic.
- Document expiry status is derived from fleet-local date: `expired`, `due_7`, `due_30`, or `valid`.
- Maintenance due status is derived from fleet-local date/current mileage and active thresholds.
- DTOs use camelCase JSON names, ISO-8601 timestamps/dates, string UUIDs, and JSON numbers only while
  values stay within the safe integer range; centavo validation enforces the supported bound.
- Staff DTOs omit owner-only audit/profile/document fields. Signed file URLs are produced only by
  dedicated authorized transitions and are never stored in DTOs.

## Migration Set

1. Add `expenses.receipt_finalize_key` and `documents.idempotency_key` with partial/unique indexes.
2. Add filter/order indexes proven necessary by the route matrix and acceptance dataset.
3. Add safe business-audit triggers and action classification for every business table.
4. Add narrow atomic functions for restore, payment correction, mileage recalculation, assignment
   coverage, tire replacement, document/license renewal, and upload finalization.
5. Tighten grants/RLS for new functions and owner-only history reads.
6. Regenerate `types/database.ts` from the migrated local database.
