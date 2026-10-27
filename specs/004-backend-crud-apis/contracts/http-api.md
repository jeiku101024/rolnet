# HTTP API Contract

## Scope and Base Rules

- Base path: `/api/v1`
- Media type: `application/json; charset=utf-8`
- Authentication: existing secure Supabase session cookie; no API keys or anonymous fleet access
- Unsafe methods: same-origin required; JSON body required unless documented otherwise
- Authenticated GET responses: dynamic/private (`Cache-Control: private, no-store`)
- Dates: `YYYY-MM-DD`; timestamps: ISO-8601 UTC; IDs/idempotency keys: UUID strings
- Money: integer centavos only

Success envelope:

```json
{ "data": {}, "meta": { "page": 1, "pageSize": 25, "total": 1 } }
```

Error envelope:

```json
{
  "error": {
    "code": "STALE_RECORD",
    "message": "This record changed. Review the latest values and try again.",
    "fieldErrors": { "field": ["Correction guidance"] },
    "current": {}
  }
}
```

`fieldErrors` and `current` are optional. Raw database/provider messages are never returned.

## Common Query and Conditional Headers

Collection routes accept `page` (default 1), `pageSize` (default 25, max 100), allow-listed `sort`,
`direction=asc|desc`, resource-specific filters, and allow-listed comma-separated `include` values.
Unknown parameters and fields return `400 INVALID_QUERY`. Sorts always add `id` as tie-breaker.

Mutable item responses include an `ETag` representing `updated_at`. PATCH, DELETE, restore,
reversal/correction, and replacement transitions require `If-Match`; missing precondition returns
`428 PRECONDITION_REQUIRED`, and a mismatch returns `409 STALE_RECORD` with current permitted DTO.

Financial creates and receipt/document finalization require UUID `Idempotency-Key`. Missing/invalid
keys return 400. Repeating the same key and equivalent request returns the original success;
reusing it for different content returns `409 IDEMPOTENCY_CONFLICT`.

## Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Successful read, update, transition, deletion, restoration, or replay |
| 201 | New resource created |
| 400 | Invalid query/body/header with optional field errors |
| 401 | No valid session |
| 403 | Authenticated but not approved/permitted |
| 404 | Missing, deleted-by-default, or inaccessible resource |
| 409 | Uniqueness/domain conflict, stale version, or conflicting idempotency key |
| 413 | Upload metadata exceeds supported size |
| 415 | Unsupported content or file type |
| 428 | Required `If-Match` is absent |
| 500 | Unexpected failure with generic message and server-side diagnostic only |

## Core Resource Routes

For rows marked CRUD, collection GET/POST and item GET/PATCH/DELETE are supported. DELETE is always
soft deletion and owner-only; `POST /{resource}/{id}/restore` restores with `If-Match`.

| Resource path | Lifecycle | Create/update authorization | Key filters/includes |
|---------------|-----------|-----------------------------|----------------------|
| `/units` | CRUD + restore | Owner | status, search; currentAssignment |
| `/drivers` | CRUD + restore | Owner | kind, active, license state, search; currentAssignment |
| `/assignments` | CRUD + restore | Owner | unitId, driverId, type, activeOn; unit, driver |
| `/driver-days-off` | CRUD + restore | Owner | assignmentId, from, to; backupAssignment |
| `/mileage-readings` | CRUD + restore | Owner/staff update; owner delete/restore | unitId, from, to |
| `/expense-categories` | CRUD + restore when eligible | Owner | search, system |
| `/expenses` | CRUD + restore | Owner/staff update; owner delete/restore | unitId, categoryId, from, to, receiptState; unit, category |
| `/part-replacements` | CRUD + restore | Owner/staff update; owner delete/restore | unitId, dueState, from, to; unit |
| `/tire-installations` | Read/create; constrained update; soft delete/restore | Owner/staff update; owner delete/restore | unitId, position, current, dueState; unit, replacement |
| `/documents` | Read/create; constrained metadata update; soft delete/restore | Owner only | holder/type/status/expiry; holder, supersededBy |

PATCH bodies contain only mutable fields plus no system/audit fields. Resource-specific Zod schemas
reject unknown or immutable fields.

## Profiles and Settings

| Method and path | Purpose | Authorization |
|-----------------|---------|---------------|
| `GET /profiles` | Paginated staff/account list | Owner |
| `GET /profiles/{userId}` | Account detail | Owner or same user with reduced DTO |
| `PATCH /profiles/{userId}` | Update display name only | Same user |
| `POST /profiles/{userId}/approve` | Pending to approved | Owner |
| `POST /profiles/{userId}/reject` | Pending to rejected; reason required | Owner |
| `POST /profiles/{userId}/deactivate` | Approved to deactivated | Owner |
| `POST /profiles/{userId}/reactivate` | Deactivated to approved | Owner |
| `GET /fleet-settings` | Read singleton DTO | Approved user, reduced for staff |
| `PATCH /fleet-settings` | Update permitted singleton fields | Owner |

Staff registration remains the existing Auth registration workflow and creates the profile through
the Auth trigger. No profile/settings POST collection or DELETE is exposed.

## Remittances and Payments

| Method and path | Purpose | Authorization |
|-----------------|---------|---------------|
| `GET /remittances` | List/filter by unit, driver, assignment, dates, balance state | Owner/staff |
| `POST /remittances` | Create for actual assignment/date; idempotency required | Owner/staff |
| `GET /remittances/{id}` | Detail with totals and optionally payments | Owner/staff |
| `PATCH /remittances/{id}` | Notes only | Owner/staff |
| `POST /remittances/{id}/reverse` | Soft-delete with reason | Owner |
| `POST /remittances/{id}/restore` | Restore after conflict validation | Owner |
| `GET /remittances/{id}/payments` | Paginated current payments | Owner/staff |
| `POST /remittances/{id}/payments` | Append positive payment; idempotency required | Owner/staff |
| `GET /remittance-payments/{id}` | Payment detail | Owner/staff |
| `POST /remittance-payments/{id}/correct` | Audited correction/reversal with reason | Owner |
| `POST /remittance-payments/{id}/restore` | Restore eligible correction | Owner |

No ordinary PATCH/DELETE exists for payments. Remittance item DELETE is replaced by the named
reverse route so a reason is mandatory.

## Upload and Replacement Transitions

| Method and path | Purpose | Authorization |
|-----------------|---------|---------------|
| `POST /expenses/{id}/receipt/prepare` | Validate metadata and return policy-valid private path | Owner/staff |
| `POST /expenses/{id}/receipt/finalize` | Verify uploaded object and attach atomically | Owner/staff |
| `DELETE /expenses/{id}/receipt` | Detach current receipt with audit; file cleanup is controlled | Owner |
| `POST /documents/uploads/prepare` | Reserve document ID/path after holder/type validation | Owner |
| `POST /documents/{id}/finalize` | Verify object and create/renew current document atomically | Owner |
| `POST /documents/{id}/signed-url` | Return short-lived authorized URL | Owner |
| `POST /tire-installations/{id}/replace` | Add replacement and close current tire atomically | Owner/staff |

File bytes continue uploading directly to private Supabase Storage and never pass through these
JSON handlers.

## Audit Events

| Method and path | Purpose | Authorization |
|-----------------|---------|---------------|
| `GET /audit-events` | Page by entityType, entityId, actorId, action, and date range | Owner |
| `GET /audit-events/{id}` | Sanitized immutable event detail | Owner |

All mutation methods return 405 for audit events. Internal notification rows, storage objects,
provider Auth identities, dashboard projections, and reports are outside general CRUD.

## Resource Error Codes

Stable codes include `INVALID_BODY`, `INVALID_QUERY`, `UNAUTHENTICATED`, `ACCOUNT_NOT_APPROVED`,
`FORBIDDEN`, `NOT_FOUND`, `STALE_RECORD`, `DUPLICATE_BODY_NUMBER`, `DUPLICATE_PLATE`,
`DUPLICATE_LICENSE`, `ASSIGNMENT_CONFLICT`, `LICENSE_EXPIRED`, `DUPLICATE_REMITTANCE`,
`IDEMPOTENCY_CONFLICT`, `CATEGORY_IN_USE`, `RESTORE_CONFLICT`, `IMMUTABLE_FIELD`,
`INVALID_MILEAGE_SEQUENCE`, `INVALID_DUE_THRESHOLD`, `UPLOAD_NOT_FOUND`, `UPLOAD_MISMATCH`,
`UNSUPPORTED_FILE`, and `INTERNAL_ERROR`.
