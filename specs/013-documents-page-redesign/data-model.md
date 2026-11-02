# Data Model: Documents Page Redesign

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

## Concepts

| Spec term | Stored as |
|-----------|-----------|
| Document | All `documents` rows with the same `document_type` and holder (`unit_id` or `driver_id`) (R1) |
| Current version | The single row with `lifecycle_status = 'current'` and `deleted_at is null` |
| History | Rows with `lifecycle_status = 'superseded'`, ordered by `superseded_at desc` (R4) |
| Reverted upload | Rows with `lifecycle_status = 'reverted'` (R2) |
| Removed document | A (type, holder) with reverted rows and no current row (R3) |
| Archived (legacy) | `lifecycle_status = 'void'` with `deleted_at` set. Not shown and not offered for Bring back |
| Unit folder | Derived from `units` where `archived = false and deleted_at is null`. Not stored |
| Activity | `document_events` rows for (type, holder), newest first (R7) |

## Changes to `public.documents`

| Column | Type | Rule |
|--------|------|------|
| `lifecycle_status` | enum gains `reverted` | Added in its own migration |
| `file_name` | `text null` | 1 to 200 characters after trim when present. Set at upload. Null on legacy rows (R9) |
| `superseded_at` | `timestamptz null` | Set whenever the row becomes `superseded`. Cleared when it becomes `current` again. Backfilled (R4) |
| `reverted_at` | `timestamptz null` | Set when the row becomes `reverted`. Cleared by Bring back |
| `reverted_by` | `uuid null → auth.users` | Who reverted. Cleared by Bring back |
| `purge_after` | `timestamptz null` | `reverted_at + interval '30 days'`. Cleared by Bring back |
| `file_deleted_at` | `timestamptz null` | Set by the retention job. Never cleared. Only allowed on `reverted` rows |

Constraints:
- `documents_reverted_fields_check`: `(lifecycle_status = 'reverted') = (reverted_at is not null)`,
  and when reverted, `reverted_by` and `purge_after` are not null and
  `purge_after = reverted_at + interval '30 days'`.
- `documents_file_deleted_check`: `file_deleted_at is null or lifecycle_status = 'reverted'`.
- `documents_file_name_check`: `file_name is null or length(btrim(file_name)) between 1 and 200`.
- Existing: one current row per (type, unit) and per (type, driver). The holder must match the type,
  and the MIME type and size checks still apply.

New indexes:
- `documents_reverted_recent_idx` on `(reverted_at desc)` where `lifecycle_status = 'reverted'`
  (Recently reverted).
- `documents_purge_due_idx` on `(purge_after)` where `lifecycle_status = 'reverted' and file_deleted_at is null`
  (retention job).
- `documents_history_idx` on `(document_type, unit_id, driver_id, superseded_at desc)` where
  `deleted_at is null` (details modal).

## New table `public.document_events`

| Column | Type | Rule |
|--------|------|------|
| `id` | `uuid pk default gen_random_uuid()` | |
| `document_type` | `document_type not null` | |
| `unit_id` / `driver_id` | `uuid null` | Exactly one is set, matching the type (same rule as `documents`) |
| `kind` | enum `document_event_kind` | `uploaded`, `renewed`, `reverted`, `removed`, `brought_back`, `restored` |
| `version_id` | `uuid not null → documents` | The version that became current, or the one reverted for `reverted`/`removed` |
| `related_version_id` | `uuid null → documents` | The version moved to history, or the one restored by a revert |
| `file_name` / `related_file_name` | `text null` | The names shown at the time of the event |
| `summary` | `text not null` | Plain sentence for Activity and the audit log, for example "Reverted OR-2026.pdf. OR-2025.pdf restored." |
| `occurred_at` | `timestamptz not null default now()` | |
| `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `deleted_by` | standard | `set_audit_fields`, `reject_hard_delete`, `audit_business_change` |

Index: `(document_type, unit_id, driver_id, occurred_at desc)`.
RLS: owner `select` only. There is no insert, update or delete policy: the private definer helper
`document_log_event` writes every event, so users can't add or change Activity directly.

## State transitions (one document)

```text
                upload (first)                   renew
   (none) ───────────────────────▶ current ─────────────────▶ current(new)
                                     │                          │ old → superseded
                                     │ revert (only version)    │
                                     ▼                          │ revert (has history)
                       reverted [document removed] ◀────────────┘ new → reverted,
                                     │                            newest superseded → current
                                     │ bring back (no current)
                                     ▼
                                   current
   superseded ──restore──▶ current           (current → superseded, newest in History)
   reverted   ──bring back──▶ current        (current, if any → superseded)   only while file kept
   reverted   ──retention job──▶ reverted + file_deleted_at                  (record kept)
```

Rules:
- **Revert** acts on the current version only, and only when the newest event for the document is not
  `restored` (R8). If there are `superseded` rows, the one with the newest `superseded_at` becomes
  current. Otherwise the document becomes removed.
- **Restore** works on a `superseded` row of the same document. The caller's `p_current_id` must still
  be the current row.
- **Bring back** works on a `reverted` row with `file_deleted_at is null and purge_after > now()`. If
  the document has a current row, it moves to History. The caller's `p_current_id` (or null for a
  removed document) must match.
- **Licenses**: every transition that changes the current license sets
  `drivers.license_expiry_date` to the new current expiry. Removing the only license leaves the
  profile date unchanged (FR-044a). A first license upload also sets the profile date. The order is
  demote, then the profile, then promote or insert, with the transaction-local flag
  `rolnet.document_license_sync` set so inactive drivers are allowed (R6).
- **Never deleted**: no transition deletes a row. The retention job deletes only the Storage object.

## Derived values (computed, not stored)

| Value | Rule |
|-------|------|
| Status | `expired` if `expires_on < today`, `due` if `expires_on <= today + 7`, otherwise `valid`. Uses the fleet date (Asia/Manila) (R11) |
| Folder pills | Count of the folder's current documents with status `expired` / `due` |
| File kept | `lifecycle_status = 'reverted' and file_deleted_at is null and purge_after > now()` |
| Shown file name | `file_name`, or "[Type] [holder] [created date].[ext]" for legacy rows (R9) |
| Revert allowed | A current row exists and the newest `document_events.kind` for the document is not `restored` |
| Recently reverted | `reverted` rows with `reverted_at >= now() - 30 days` that are still kept, whose unit isn't archived and whose driver isn't deleted, newest first |

## Validation (app and database)

- File: JPG, PNG, WebP, or PDF, 1 byte to 5 MB (existing checks plus the spec's messages).
- Document type: unit scope offers `or_cr`, `mtop_franchise`, `insurance`. Driver scope is
  `driver_license` only.
- Holder: a non-archived, non-deleted unit, or a non-deleted driver.
- `expires_on` is required. `issued_on` is optional. `document_number` is optional (the
  existing `documentSchema` rules).
