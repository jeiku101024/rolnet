# Contract: Server Actions and Routes

All actions live in `app/actions/documents.ts`, start with `requirePermission("manage_documents")`,
return the existing `run()` result shape (`{ ok: true, data } | { ok: false, code, message }`), and
revalidate `/documents`, `/dashboard`, and the holder's unit or driver page.

| Action | Input (Zod in `lib/validation/documents.ts`) | Calls | Returns |
|--------|----------------------------------------------|-------|---------|
| `prepareDocumentUpload` | unchanged (`documentType`, `mimeType`, `sizeBytes`) | — | `{ objectPath }` |
| `finalizeDocumentUpload` | adds `fileName` (1–200 chars) and optional `expectedCurrentId` | `save_compliance_document` | `{ id, renewed, previousId }` |
| `revertDocumentUpload` | `{ currentId: uuid }` | `revert_document_upload` | `{ result: "previous" \| "removed", restoredId }` |
| `restoreDocumentVersion` | `{ versionId, currentId }` | `restore_document_version` | `{ id, movedId }` |
| `bringBackDocumentVersion` | `{ versionId, currentId: uuid \| null }` | `bring_back_document_version` | `{ result: "swapped" \| "recreated", id, movedId }` |
| `getDocumentDetails` | `{ id: uuid }` (any version id of the document) | reads | `DocumentDetails` (below) |
| `getDocumentUrl` | `{ id: uuid }` (any version with a kept file) | signed URL, 300 s | `{ url }` |
| `softDeleteDocument` | — | **removed** (replaced by revert) | — |

`getDocumentUrl` refuses versions whose file is deleted or past `purge_after` ("This file was
deleted after 30 days.").

Undo on the toast calls `revertDocumentUpload({ currentId: <id just saved> })`. A `STALE_RECORD`
result shows "Nothing changed. This document was updated since." (spec edge case).

## `DocumentDetails`

```ts
{
  current: { id, documentType, holder: { kind: "unit" | "driver", id, name }, documentNumber, issuedOn,
             expiresOn, fileName, status: "expired" | "due" | "valid", canRevert: boolean,
             hasPrevious: boolean } | null,          // null when the document was removed
  history: { id, fileName, expiresOn, documentNumber, issuedOn }[],            // newest first
  reverted: { id, fileName, expiresOn, revertedAt, revertedBy, keptUntil, fileKept: boolean }[],
  activity: { kind, summary, occurredAt, actorName }[],                        // newest 5
}
```

## Page data (server component `app/(owner)/documents/page.tsx`)

Built by `lib/documents/page-query.ts` (with a demo branch):
- `unitDocs`: current rows for non-archived units, each with `fileName` (shown), `status`, and
  `unitName`.
- `units`: non-archived units `{ id, name, body_number }`, including units with no documents.
- `licenses`: current `driver_license` rows for non-deleted drivers, with `driverName`.
- `drivers`: non-deleted drivers (upload targets).
- `recentlyReverted`: as defined in the data model, with `holderName`, `documentType`,
  `removed: boolean`, `revertedByName`, and `keptUntil`.
- `purgeOverdue: boolean`: true when any reverted row has `purge_after <= now() - interval '2 days'`
  and `file_deleted_at is null` (a backstop for a stopped schedule, research R10).
- `today`: the fleet date.

## Route: `POST /api/cron/purge-document-files`

- Auth: `Authorization: Bearer ${CRON_SECRET}`. A wrong or missing secret returns `401`, and when
  `CRON_SECRET` isn't set the route returns `503`.
- Uses `lib/supabase/service.ts` (server-only, `SUPABASE_SERVICE_ROLE_KEY`). It is never imported from
  a client module; an ESLint `no-restricted-imports` rule enforces this.
- Takes up to 100 due rows, removes their objects (a missing object counts as removed), then calls
  `mark_document_files_deleted`.
- Response: `200 { purged: n, failed: m }`. Failures are kept for the next run.
- Called daily by `.github/workflows/purge-document-files.yml` (`schedule: "0 18 * * *"` and
  `workflow_dispatch`) with the repository secrets `PURGE_URL` and `CRON_SECRET`.

## Redirect: `app/(owner)/documents/[id]/page.tsx`

The page becomes a redirect to `/documents?doc=<current version id>` for the same type and holder.
If the document has no current row, it redirects to `/documents` instead.
