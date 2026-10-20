# Data Model: Tricycle Fleet Management

## Conventions

- PostgreSQL UUID primary keys use `gen_random_uuid()` unless the key is supplied by Supabase Auth.
- Money is always `bigint` centavos. Values displayed as pesos are formatted only in the UI or CSV.
- Business timestamps are `timestamptz` in UTC; operating and expiry dates are `date` interpreted in
  the fleet timezone stored in settings.
- Every mutable business table includes `created_at`, `created_by`, `updated_at`, `updated_by`,
  `deleted_at`, and `deleted_by`. Database triggers set timestamps and reject hard deletes.
- Current application queries require `deleted_at IS NULL`. Owner audit queries may include deleted
  records. Storage objects are retained when metadata is soft-deleted unless an explicit retention
  workflow safely removes both.
- Enum-like values use PostgreSQL enums or check constraints created in migrations.
- All foreign-key, RLS predicate, date-range, due-date, and report-filter columns are indexed.

## Identity and Settings

### `profiles`

Application identity linked one-to-one to `auth.users`.

| Field | Type | Rules |
|---|---|---|
| `user_id` | `uuid` | Primary key; references `auth.users(id)` |
| `display_name` | `text` | Required |
| `role` | `app_role` | `owner` or `staff`; required |
| `account_status` | `profile_status` | `pending`, `approved`, `rejected`, or `deactivated`; defaults `approved` for the seeded owner and `pending` for self-registered staff |
| `approved_at` | `timestamptz` | Required when status is `approved`; set by the approving owner |
| `approved_by` | `uuid` | References the approving owner when status is `approved` |
| audit fields | mixed | Standard audit/soft-delete fields |

Rules:

- At least one approved owner must remain; owner demotion/deactivation that would remove the last owner
  is rejected by a transactional database function.
- Staff self-registration creates a pending profile and cannot create an application session with data
  access until an owner approves it. Only an owner may approve, reject, deactivate, or change roles.
- Staff can read the minimum profile identity needed to show record encoders; only owners see account
  management details.

### `fleet_settings`

Singleton configuration row.

| Field | Type | Rules |
|---|---|---|
| `id` | `boolean` | Primary key constrained to `true` |
| `fleet_name` | `text` | Required |
| `timezone` | `text` | Required IANA zone; default `Asia/Manila` |
| `standard_remittance_centavos` | `bigint` | Fixed v1 value `18000`; positive |
| `overnight_remittance_centavos` | `bigint` | Fixed v1 value `30000`; greater than standard |
| `document_warning_days` | `smallint[]` | V1 value `{30,7}` |
| audit fields | mixed | Standard audit fields; not deletable |

Only the owner may update general settings. Remittance values and alert thresholds are seeded and
treated as fixed v1 business rules; changing them requires a reviewed migration/spec amendment so
historical calculations remain interpretable.

## Fleet and Driver Operations

### `units`

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `body_number` | `text` | Required; case-insensitive unique among non-deleted rows |
| `plate_number` | `text` | Required; normalized uppercase; unique among non-deleted rows |
| `make_model` | `text` | Required |
| `status` | `unit_status` | `active`, `in_repair`, or `retired` |
| `current_mileage` | `integer` | Non-negative; maintained from mileage readings |
| audit fields | mixed | Standard fields |

State transitions:

- `active -> in_repair -> active` is normal.
- `active|in_repair -> retired` ends open primary assignments and blocks new assignments/remittances.
- Reactivation from `retired` is owner-only and requires an explicit confirmation/audit event.

### `mileage_readings`

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `unit_id` | `uuid` | Required; references `units` |
| `reading_date` | `date` | Required |
| `mileage` | `integer` | Required; non-negative and not below the unit's prior reading |
| `notes` | `text` | Optional |
| audit fields | mixed | Standard fields |

Unique active reading per unit/date. An insert/update transaction also updates
`units.current_mileage` from the latest non-deleted reading.

### `drivers`

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `full_name` | `text` | Required |
| `driver_kind` | `driver_kind` | `primary` or `backup` |
| `license_number` | `text` | Required; normalized and unique among non-deleted rows |
| `license_expiry_date` | `date` | Required; authoritative for assignment eligibility and must match the current uploaded driver-license document |
| `phone` | `text` | Required |
| `address` | `text` | Optional |
| `is_active` | `boolean` | Defaults true |
| audit fields | mixed | Standard fields |

Expired or inactive drivers cannot receive a new assignment or day-off coverage. A driver-license
document with a different expiry date is rejected; renewal updates the driver profile and document
metadata in one transaction.

### `driver_assignments`

Primary ranges and one-day backup coverage in one history.

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `unit_id` | `uuid` | Required; references `units` |
| `driver_id` | `uuid` | Required; references `drivers` |
| `assignment_type` | `assignment_type` | `primary` or `backup` |
| `starts_on` | `date` | Required |
| `ends_on` | `date` | Nullable only for an open primary assignment |
| `covered_primary_assignment_id` | `uuid` | Required for backup; null for primary |
| `reason` | `text` | Required for backup; defaults to `day_off` |
| audit fields | mixed | Standard fields |

Constraints:

- Primary ranges cannot overlap for the same unit and cannot overlap another primary assignment for
  the same driver. Use an exclusion constraint over inclusive date ranges for non-deleted rows.
- Backup coverage has `starts_on = ends_on`, references the primary assignment it covers, and must
  fall inside that primary range.
- At most one backup coverage exists for a unit/date and a driver/date.
- A backup driver cannot cover a unit while operating another unit on that date.
- New assignments require an active unit that is not retired and a driver whose license is valid on
  the assignment start/service date.

### `driver_days_off`

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `primary_assignment_id` | `uuid` | Required; references a primary `driver_assignments` row |
| `day_off_date` | `date` | Required; within the assignment range |
| `notes` | `text` | Optional |
| audit fields | mixed | Standard fields |

Unique non-deleted day-off row per primary assignment/date. A backup assignment may reference the
day-off row; an uncovered day off remains visible to the owner.

## Remittances

### `remittances`

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `assignment_id` | `uuid` | Required; actual primary or backup assignment for the date |
| `unit_id` | `uuid` | Required; copied and trigger-verified from assignment |
| `driver_id` | `uuid` | Required; copied and trigger-verified from assignment |
| `service_date` | `date` | Required; within assignment range |
| `disposition` | `remittance_disposition` | `returned` or `overnight_overtime` |
| `amount_due_centavos` | `bigint` | Trigger-set to `18000` or `30000`; positive |
| `notes` | `text` | Optional |
| `idempotency_key` | `uuid` | Required; unique per submitting client request |
| audit fields | mixed | Standard fields |

Constraints and derived values:

- Unique active remittance per unit/date and per driver/date.
- The assignment must be the actual operating assignment on `service_date`; backup coverage wins over
  the covered primary assignment.
- `amount_paid_centavos = sum(active remittance_payments.amount_centavos)`.
- `balance_centavos = greatest(amount_due_centavos - amount_paid_centavos, 0)`.
- `credit_centavos = greatest(amount_paid_centavos - amount_due_centavos, 0)`.
- A transactional function creates a remittance, verifies assignments/status, chooses the rate, and
  returns the existing row for a repeated idempotency key.
- After creation, service date, assignment, driver, unit, disposition, and calculated due are
  immutable to staff. Staff may edit notes and add payments; owner corrections use an audited reversal
  and replacement entry.

### `remittance_payments`

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `remittance_id` | `uuid` | Required; references `remittances` |
| `paid_at` | `timestamptz` | Required |
| `amount_centavos` | `bigint` | Required; positive |
| `idempotency_key` | `uuid` | Required; unique |
| `notes` | `text` | Optional |
| audit fields | mixed | Standard fields |

Payments are never overwritten to change financial history. Corrections are owner-only reversal
entries with a negative signed adjustment in a dedicated correction function and linked audit event;
the normal payment action accepts positive amounts only.

## Expenses and Maintenance

### `expense_categories`

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `name` | `text` | Required; unique among non-deleted rows |
| `system_key` | `text` | Seeded values: `fuel`, `repairs`, `registration`, `insurance` |
| `is_system` | `boolean` | System categories cannot be deleted |
| audit fields | mixed | Standard fields |

### `expenses`

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `unit_id` | `uuid` | Required |
| `category_id` | `uuid` | Required |
| `expense_date` | `date` | Required |
| `amount_centavos` | `bigint` | Required; positive |
| `notes` | `text` | Optional |
| `receipt_object_path` | `text` | Optional private Storage path |
| `receipt_mime_type` | `text` | Required when path exists |
| `receipt_size_bytes` | `integer` | Required when path exists; image target <= 307,200 bytes |
| `receipt_sha256` | `text` | Required when path exists |
| `idempotency_key` | `uuid` | Required; unique |
| audit fields | mixed | Standard fields |

Missing receipt paths are allowed and displayed as missing-receipt warnings.

### `part_replacements`

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `unit_id` | `uuid` | Required |
| `part_name` | `text` | Required |
| `cost_centavos` | `bigint` | Required; non-negative |
| `replaced_on` | `date` | Required |
| `replacement_mileage` | `integer` | Optional; non-negative |
| `next_due_date` | `date` | Optional; after replacement date |
| `next_due_mileage` | `integer` | Optional; above replacement mileage |
| `notes` | `text` | Optional |
| audit fields | mixed | Standard fields |

At least one of the two next-due values may be supplied; an item is due when either supplied
threshold is reached.

### `tire_installations`

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `unit_id` | `uuid` | Required |
| `position` | `tire_position` | `front`, `rear_left`, or `rear_right` |
| `brand` | `text` | Required |
| `installed_on` | `date` | Required |
| `installed_mileage` | `integer` | Optional |
| `cost_centavos` | `bigint` | Required; non-negative |
| `next_due_date` | `date` | Optional |
| `next_due_mileage` | `integer` | Optional |
| `replaced_by_id` | `uuid` | Optional self-reference |
| audit fields | mixed | Standard fields |

At least one next-due threshold is required. Only one non-replaced, non-deleted current tire exists
for each unit/position. Installing a replacement links and closes the prior current tire in one
transaction.

## Compliance Documents and Storage

### `documents`

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `document_type` | `document_type` | `or_cr`, `driver_license`, `mtop_franchise`, `insurance` |
| `unit_id` | `uuid` | Required for unit documents; otherwise null |
| `driver_id` | `uuid` | Required for driver license; otherwise null |
| `document_number` | `text` | Optional |
| `issued_on` | `date` | Optional |
| `expires_on` | `date` | Required |
| `lifecycle_status` | `document_lifecycle` | `current`, `superseded`, or `void` |
| `object_path` | `text` | Required private Storage path |
| `mime_type` | `text` | Allowed image/PDF types only |
| `size_bytes` | `integer` | Positive and within bucket policy |
| `sha256` | `text` | Required |
| `superseded_by_id` | `uuid` | Optional self-reference |
| audit fields | mixed | Standard fields |

Exactly one of `unit_id` or `driver_id` is non-null and must match the document type. Only one current,
non-deleted document of a type exists per holder. Renewal inserts the new document and marks the old
one superseded transactionally.

Expiry status is derived, never manually edited:

- `expired`: `expires_on < fleet_today`
- `due_7`: `fleet_today <= expires_on <= fleet_today + 7`
- `due_30`: `fleet_today + 7 < expires_on <= fleet_today + 30`
- `valid`: later than 30 days

### Storage buckets

- `receipts` private bucket: JPEG/WebP/PNG only; 500 KB hard bucket limit, application target 300 KB.
- `documents` private bucket: compressed image or PDF; 5 MB hard bucket limit.
- Paths are immutable and unpredictable:
  - `receipts/{expense_id}/{uuid}.{ext}`
  - `documents/{document_id}/{uuid}.{ext}`
- Owners may read all objects. Staff may create/read receipt objects for accessible expenses but
  cannot access compliance documents. Signed URLs are short lived.
- Storage object policies validate bucket, authenticated role, path ownership, and related active
  metadata. The application never directly edits `storage` schema rows.

## Notifications and Dashboard Queries

### `notification_outbox`

Dormant in v1; included for the explicit future-notification compatibility requirement.

| Field | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key |
| `event_type` | `text` | Example: `document_expiry` |
| `entity_type` | `text` | Example: `document` |
| `entity_id` | `uuid` | Required |
| `threshold_key` | `text` | Example: `30_day` or `7_day` |
| `channel` | `text` | Nullable in v1; future `telegram` |
| `scheduled_for` | `timestamptz` | Required |
| `status` | `notification_status` | `pending`, `processing`, `sent`, `failed`, `cancelled` |
| `attempt_count` | `smallint` | Defaults zero |
| `last_error` | `text` | Optional |
| `sent_at` | `timestamptz` | Optional |
| `deduplication_key` | `text` | Required unique key |
| audit fields | mixed | Standard timestamps; no normal hard delete |

No v1 application flow inserts or sends outbox rows. The initial schema also exposes a stable
`notification_candidates` query returning document, holder, threshold, due date, and deduplication
key. The dashboard reads this candidate query. A future pg_cron job and Telegram sender can use the
same contract without altering business tables.

### Reporting/query contracts

- `dashboard_monthly_unit_summary(month_start date)`: owner-only rows per unit with due, paid,
  balance, credit, expense categories, total expenses, and net income.
- `expiring_documents(as_of date)`: owner-only current documents in expired, 7-day, and 30-day
  buckets.
- `due_maintenance(as_of date)`: owner-only parts/tires due by date or current unit mileage.
- `driver_outstanding_balances(as_of date)`: owner-only balances grouped by actual operating driver.
- All functions exclude soft-deleted rows and use stable SQL aggregation shared by UI and CSV.

## Audit Events

### `audit_events`

Append-only owner-visible log populated by triggers and privileged database functions. Owners can
review it globally and from each related record; staff cannot view audit history.

| Field | Type | Rules |
|---|---|---|
| `id` | `bigint` | Generated primary key |
| `occurred_at` | `timestamptz` | Defaults now |
| `actor_user_id` | `uuid` | References Auth identity when available |
| `entity_type` | `text` | Required |
| `entity_id` | `uuid` | Required |
| `action` | `text` | `insert`, `update`, `soft_delete`, `restore`, `reverse` |
| `changed_fields` | `jsonb` | Field names and safe before/after values; excludes file content/secrets |

The table denies updates/deletes to application roles and is pruned only through a future explicit
retention migration if the free database limit requires it.

## RLS Matrix Summary

| Resource | Owner | Staff |
|---|---|---|
| Profiles/settings | Full application access | Pending self-registrants: no data; approved staff: read own profile and required display identity |
| Units/drivers/assignments | Create/read/update/soft-delete | Read operational fields only |
| Remittances/payments | Full application access | Create/read/update; no delete/reversal |
| Expenses/receipts | Full application access | Create/read/update; no delete |
| Mileage/parts/tires | Full application access | Create/read/update; no delete |
| Documents/document files | Full application access | No access |
| Dashboard/reports/audit | Full access | No access |
| Notification outbox | Owner read only in v1 | No access |

All tables deny `anon`. Policies explicitly target `authenticated`, use `auth.uid()`, and call small
indexed role helpers. Secret/service credentials never appear in browser code.
