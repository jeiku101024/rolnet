# US5 Documents Validation

Original implementation: 2026-10-19. Checkpoint T090 run: 2026-10-28. **Result: not passed (open defects).**

## Implementation (2026-10-19)

- `documents` table, owner-only RLS, dormant `notification_outbox`, private `documents` bucket with a
  5 MB limit and owner-only Storage policies, and `expiring_documents()` are present.
- `renew_compliance_document()` was added later (`20261027000300`); `20261028000200` made
  `expiring_documents()` owner-only (`is_owner()` filter) and granted EXECUTE to `authenticated` only.
- Owner actions, Zod schemas, the upload form, list/detail pages and expiry badges are implemented.
- The database-backed checkpoint was blocked (no local Supabase runtime).

## T090 run (2026-10-28)

Environment: `rolnet-dev` Supabase project with all migrations through `20261028000200`,
`next dev` (Next.js 16.4.3) in backend mode, Chromium at a 360 × 800 mobile viewport
(time zone Asia/Manila), E2E owner, approved-staff and pending-staff accounts. Run id `TZYQ`,
fleet date 2026-10-28, run at about 20:10 Manila (12:10 UTC, same calendar date).

- Three units (`DTZYQ1`–`DTZYQ3`) and three drivers (`Doc A/B/C TZYQ`, license expiry 2027-05-16)
  were created as the owner through the Supabase REST API.
- UI checks drive the real pages. Because the upload form cannot save (D4), document rows and
  Storage objects for the remaining checks were created as the owner through Supabase REST/Storage
  with the owner's own JWT, so RLS, constraints and bucket limits apply.
- Denial checks use each user's own JWT (REST/Storage) or browser session (`/api/v1`, pages).

**60 of 81 checks passed.**

### Private upload and download

| Check | Result |
|---|---|
| Owner uploads a PNG and a PDF to the private `documents` bucket | Pass |
| Owner downloads the PDF (authenticated) byte-for-byte | Pass |
| Owner creates a 300 s signed URL (Storage, and `/api/v1/documents/:id/signed-url`) that returns the file | Pass |
| Public URL, anonymous download, anonymous signed URL | Pass: all denied (400) |
| 5 MB + 1 byte PDF | Pass: rejected, 413 `EntityTooLarge` |
| `text/plain` upload | Pass: rejected by the bucket MIME list |
| Metadata with `size_bytes` 5,242,881 | Pass: rejected (`23514`) |
| Upload an image and a PDF through the `/documents` form | **Fail (D4):** both show `[{"code":"custom","path":[],"message":"Choose a holder"}]` |
| A failed form upload leaves no Storage object | **Fail (D5):** the file is uploaded before the save fails and stays in the bucket |

### Holder rules and driver licenses

| Check | Result |
|---|---|
| Both a unit and a driver / neither | Pass: rejected (`document_holder_check`) |
| OR/CR (PDF), MTOP franchise and insurance (PNG) for a unit | Pass |
| Second current OR/CR for the same unit | Pass: rejected (409 `23505`) |
| Driver license held by a unit; OR/CR held by a driver | **Fail (D1):** both saved (201) |
| Driver license matching the profile expiry | Pass |
| License whose expiry differs from the profile (REST, and `/api/v1/documents/:id/finalize`) | **Fail (D2):** both saved (201) |

### Renewal history

| Check | Result |
|---|---|
| Owner renews the driver license with `renew_compliance_document` | **Fail (D3):** 409 `23505` on `documents_current_driver_unique` |
| Previous license kept as superseded and linked; profile license expiry updated | **Fail (D3):** nothing changed (one current row, profile still 2027-05-16) |
| Owner renews a unit OR/CR | **Fail (D3):** 409 `23505` on `documents_current_unit_unique` |
| Manual supersession at table level keeps the old row | Pass (supports the history checks below) |
| Detail page shows superseded history; detail offers a renew control | **Fail (D6)** |

### Expiry boundaries (Manila date 2026-10-28)

| Expires | `expiring_documents('2026-10-28')` (owner) | Detail badge |
|---|---|---|
| +31 d (2026-11-28) | Pass: not listed (valid) | Pass: Valid |
| +30 d (2026-11-27) | Pass: `due_30` | Pass: Due within 30 days |
| +7 d (2026-11-04) | Pass: `due_7` | Pass: Due within 7 days |
| +1 d (2026-10-29) | Pass: `due_7` | Pass: Due within 7 days |
| 0 d (2026-10-28) | Pass: `due_7` | Pass: Due within 7 days |
| −1 d (2026-10-27) | Pass: `expired` | Pass: Expired |

| Check | Result |
|---|---|
| `expiring_documents()` without `as_of` agrees with the Manila date | Pass at run time only; latent defect between 00:00 and 07:59 Manila (D8) |
| Superseded rows excluded from `expiring_documents()` | Pass |
| Same document (expires today) viewed from a device in another time zone (UTC+14) | **Fail (D7):** badge shows "Expired" |

### Owner screens

| Check | Result |
|---|---|
| Upload form lets the owner choose the unit or driver | **Fail (D4):** no holder field |
| List rows link to the detail; list labels/groups by unit or driver | **Fail (D6)** |
| Detail offers a file view/download | **Fail (D6):** no control; `getDocumentUrl` is never called |
| Unit detail lists the unit's documents; driver detail lists the license | **Fail (D6)** |
| `/documents` and `/documents/[id]` at 360 px: no page-level horizontal overflow | Pass |

### Role denial

| Check | Result |
|---|---|
| Approved and pending staff read the run's document rows | Pass: 0 rows |
| Anonymous read of `documents` | Pass: 401 `42501` |
| Staff insert / change document metadata | Pass: 403 `42501` / 0 rows updated |
| Staff download, signed URL, folder listing, upload in the `documents` bucket | Pass: all denied (400 or empty list) |
| Staff / anonymous `renew_compliance_document` | Pass: 403 "Owner access is required" / 401 |
| Staff / anonymous `expiring_documents()` | Pass: none of the run's rows / 401 |
| Staff open `/documents` and `/documents/[id]` | Pass: redirected to `/forbidden` |
| Staff `GET /api/v1/documents`, signed-url, uploads/prepare | Pass: 403 |

## Defects

| ID | Area | Defect | Cause |
|---|---|---|---|
| D1 | Database | A driver license can belong to a unit and an OR/CR/MTOP/insurance document to a driver (data model: holder "must match the document type") | `document_holder_check` in `supabase/migrations/20261019005000_create_documents.sql` checks only that exactly one holder is set |
| D2 | Database / API | A driver license whose expiry differs from the profile is accepted by direct API and by `/api/v1/documents/:id/finalize` | The match is checked only in `finalizeDocumentUpload` (`app/actions/documents.ts`); there is no trigger, and `createRow` (`lib/domain/crud.ts`) inserts directly. `updateFields` in `lib/domain/resource-config.ts` also allows changing `expires_on` afterwards |
| D3 | Database | Renewal always fails, so no document can be renewed, history is never created through renewal, and the license renewal never updates the driver profile | `renew_compliance_document` (`supabase/migrations/20261027000300_add_master_data_crud_functions.sql`) inserts the replacement as `current` before marking the previous row `superseded`; the non-deferrable partial unique indexes `documents_current_unit_unique` / `documents_current_driver_unique` reject the insert. No action, API route or screen calls the function |
| D4 | UI | Every upload through `/documents` fails with a raw Zod JSON message | `components/forms/document-form.tsx` has no unit/driver field, so `documentSchema`'s "Choose a holder" refine fails; the server action's error text is shown verbatim. The form also sends a fixed `sha256` of 64 zeros |
| D5 | UI / Storage | A failed save leaves an orphaned private object | `document-form.tsx` uploads to Storage before `finalizeDocumentUpload` and does not remove the object when it fails |
| D6 | UI | List is not grouped or labelled by unit/driver and has no links; detail shows no superseded history, no file view/download and no renew control; unit and driver detail pages do not list documents (FR-024, scenario 1) | `app/(owner)/documents/page.tsx` and `app/(owner)/documents/[id]/page.tsx` select no holder or history; `getDocumentUrl` is unused; `app/(owner)/units/[id]/page.tsx` and `app/(owner)/drivers/[id]/page.tsx` do not query documents |
| D7 | UI | Expiry badge depends on the device's clock and time zone, not the fleet date (Asia/Manila) or the derived query output (T089) | `components/documents/expiry-status.tsx` computes days from `new Date().setHours(0,0,0,0)` in the browser |
| D8 | Query (latent, by code reading) | Between 00:00 and 07:59 Manila the dashboard and the default `expiring_documents()` use the previous (UTC) date, shifting every boundary by one day | `lib/dashboard/queries.ts` passes `new Date().toISOString().slice(0, 10)`; `expiring_documents(as_of date default current_date)` uses the database time zone. Not observed in this run (20:10 Manila) |

Also noted: T083's `notification_candidates` query does not exist in any migration, and the US5 pgTAP
files (`supabase/tests/constraints/050_documents.sql`, `supabase/tests/rls/050_documents_storage_rls.sql`)
check only object existence, not the boundaries, supersession or denial listed in T084.

T090 stays unchecked until D1–D7 are fixed (and D8 is addressed) and this journey passes.
