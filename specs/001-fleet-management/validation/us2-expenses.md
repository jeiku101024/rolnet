# US2 Expenses Validation

Original implementation: 2026-10-20. Checkpoint T054 run: 2026-10-28 (not passed). Re-run T146:
2026-10-29. Re-run after T153–T154: 2026-10-29. **Result: not passed (82 / 83; D10 still open).**

## Re-run 2026-10-29 (after T153–T154)

The `cacheControl: "0"` change tested here did not fix D10 and was reverted before commit; T154 is
reopened with the move-on-archive approach.

- Run id `RZFN`. Same script and 83 checks as run `EDZX`, Chromium at 360 × 800 (mobile, touch).
- Code tested: `4aa3c54` on branch `fix/001-receipt-cache-and-csv-bom` plus the uncommitted T154
  change (`lib/uploads/receipts.ts` and `lib/uploads/documents.ts` upload with `cacheControl: "0"`),
  served by `next dev` against `rolnet-dev`.
- **82 of 83 checks passed** (82 / 83 before). The only failure is D10.
- **D10: not fixed.** The fix is in effect: both receipts uploaded through the form in this run
  (`receipts/951d1f56-…/de1e30e8-….webp` and `receipts/6099c59f-…/5ee6abfb-….webp`) have
  `metadata.cacheControl = max-age=0` in `storage.objects` (run `EDZX`'s receipts have
  `max-age=3600`). The CDN still caches the authenticated response:
  - Journey: after the owner archives the large-receipt expense (`soft_delete_record()` 200), the
    signed-URL request is 400, the same direct authenticated GET with the same staff JWT is
    **200** (CDN-cached), and the same GET with a cache-busting query is 400.
  - Probe (`probe-receipt5.mjs`): a receipt uploaded with supabase-js and `cacheControl: "0"` (the
    app's options) for a new expense. Before archiving: 200 `cf-cache-status: MISS`, then 200
    `HIT`, both with `cache-control: private, max-age=0, must-revalidate`. After
    `soft_delete_record()` (200): 200 `HIT`, 200 `HIT`, and still **200 `HIT` at +607 s**, when the
    probe stopped. With `?v=<timestamp>`: 400 `BYPASS`.
  - So Supabase's CDN does not follow the object's `cache-control` for authenticated reads; it keeps
    the response until its own expiry or until the object changes. Changing the upload option
    cannot close D10. A fix has to change the object when the expense is archived (move it to an
    archive path or remove it), so the CDN entry is invalidated.
- An earlier attempt the same afternoon (run `MAYU`, 81 / 83) ran at the same time as the US7
  journey; it also failed the Archive-button check (`listRowGone=false`, row already archived in the
  database; the list had not refreshed within the wait). That check passed when run alone (`RZFN`).

## Implementation (2026-10-20)

- Expense categories (seeded Fuel, Repairs, Registration, Insurance), expenses, the private
  `receipts` bucket with 500 KB / MIME limits, and RLS migrations are present, with pgTAP files.
- Client-side receipt compression (target 300 KB), idempotent create/update, owner soft-delete and
  receipt prepare/finalize actions, and the mobile expense list/form are implemented.
  `typecheck`, `lint` and `build:vinext` passed.
- The database-backed checkpoint was blocked (no Docker/WSL2 runtime).

## Re-run 2026-10-29 (after Phase 11)

- Run id `EDZX`, fleet date 2026-10-29 (Asia/Manila, same calendar date in UTC).
- Commit tested: `423c3f2` (main after PR #14), branch `test/001-checkpoint-reruns`.
- Environment: `rolnet-dev` with every migration through `20261029001500`, `next dev` in backend
  mode, Chromium at 360 × 800 (mobile, touch), E2E owner, approved-staff and pending-staff accounts.
- The same 83 checks as the T054 run, with the same receipts (a 15.7 MB canvas PNG and a 65 KB JPEG).
  Edit, receipt viewing and archiving now go through the `/expenses` screen; owner deletion also
  goes through `DELETE /api/v1/expenses/:id` and the `soft_delete_record()` RPC that the Archive
  button calls. Signed-out and forbidden redirects are streamed (HTTP 200, then a client redirect),
  so the script waits for the final URL; the first paint has no expense data.
- Earlier runs `UMJE`, `BKJT` and `XLPK` the same day had script timing errors (reading the page
  before it finished loading). Their failures were not reproducible; D10 below appeared in all four.

**82 of 83 checks passed** (68 / 83 before).

### Categories

| Check | Result | Evidence |
|---|---|---|
| Staff reads the four system categories; the form lists all four | Pass | Fuel, Insurance, Registration, Repairs |
| One staff expense in each category | Pass | right category and unit on each row |
| Staff creates a category (direct API) | Pass | 403 `42501` |
| Owner renames a system category | Pass | 0 rows updated |
| List row shows category name and body number | Pass | "Fuel · Body EEDZX · T054 EDZX fuel · ₱1,234.56 · Missing" |

### Centavos

| Check | Result | Evidence |
|---|---|---|
| `1,234.56`, `₱ 99.5`, `2500`, `0.01`, `3,000.00` (owner) | Pass | 123456, 9950, 250000, 1, 300000 |
| List shows ₱1,234.56 | Pass | |
| `12.345` and `-5` rejected, nothing saved | Pass | "Enter a peso amount such as 180 or 180.50." |
| `0` rejected, nothing saved | Pass | "Enter an amount greater than ₱0.00." |
| Fractional and zero `amount_centavos` (direct API) | Pass | `22P02`, `23514` |
| Same idempotency key twice (direct API) | Pass | 201 then 409, one row |

### Receipt upload size

| Check | Result | Evidence |
|---|---|---|
| 15.7 MB PNG through the form | Pass | one browser → Storage upload; stored 261,082 B `image/webp` under `receipts/<expense id>/<uuid>.webp`; size and sha256 match the downloaded bytes |
| 65 KB JPEG through the form | Pass | stored as 60,038 B WebP |
| 600 KB object uploaded directly | Pass | "The object exceeded the maximum allowed size" |
| 450 KB object uploaded directly | Pass | 200 |
| GIF uploaded directly | Pass | 400 |
| Metadata with `receipt_size_bytes` 600000 | Pass | `23514` |
| PDF chosen in the form | Pass | "The receipt must be a JPG, PNG or WebP photo. PDFs and other files are not accepted."; no expense saved |

### Private access

| Check | Result | Evidence |
|---|---|---|
| Public URL of a receipt | Pass | 400 |
| Anonymous read, signed-URL request, upload | Pass | all 400 |
| Pending staff read or upload | Pass | 400 |
| Approved staff and owner read the object | Pass | 200 |
| Staff gets a 60 s signed URL that works | Pass | sign 200, fetch 200 |
| Upload under a non-existent expense id, or outside `receipts/<expense id>/` | Pass | 400 |
| Staff deletes or overwrites a receipt | Pass | nothing removed; overwrite 400 |
| Expense linked to another expense's receipt (staff, direct API) | Pass | 400 (`receipt_object_path_owner_check`) |
| The UI opens an attached receipt | Pass | "View receipt" opens `/storage/v1/object/sign/receipts/…webp` (300 s token), fetch 200 |
| Receipt of a soft-deleted expense is unreadable | **Fail (D10)** | signed URL refused at once (400), but the direct authenticated download of the same URL still returns 200 from the CDN cache (`cf-cache-status: HIT`); the same request with a cache-busting query returns 400 |

### Missing receipt

| Check | Result | Evidence |
|---|---|---|
| Receipt columns null when no receipt | Pass | 4 categories |
| List flags "Missing" | Pass | |
| Form confirms "Receipt is marked missing" and clears | Pass | "Expense saved. Receipt is marked missing; you can attach it later from Edit." |

### Role

| Check | Result | Evidence |
|---|---|---|
| Staff edits amount and notes (direct API) | Pass | 200 |
| Edit control in the UI | Pass | staff opened Edit on the JPEG expense, changed ₱80.25 and notes; saved as 8025 |
| Staff soft-deletes an expense (PATCH and `soft_delete_record`) | Pass | 403 "Only the owner can delete or restore records" / 403 "Owner access is required"; row kept |
| Staff `DELETE /api/v1/expenses/:id` | Pass | 403 |
| Hard `DELETE` as staff or owner | Pass | 0 rows affected |
| Owner soft-deletes via `DELETE /api/v1/expenses/:id` | Pass | 200, row gone |
| Owner Archive button | Pass | one Archive control on the row; after archiving the row is gone from the list and from REST |
| Staff opens `/settings/staff` | Pass | `/forbidden` |
| Pending staff reads or creates expenses | Pass | 0 rows; 403 |
| Anonymous REST read; signed-out `/expenses` | Pass | 401 `42501`; ends on `/login`, no expense data in the first paint |

### 360 px

| Check | Result |
|---|---|
| `/expenses` as staff (empty and with rows) and as owner: no page-level horizontal overflow | Pass |

### Defect status

| Old ID | Status | Notes |
|---|---|---|
| D1 | Fixed | Confirmations shown, form cleared |
| D2 | Fixed | Category and body number in the list |
| D3 | Fixed | Owner soft-deletes through `soft_delete_record()`; staff are denied by an explicit owner-only trigger |
| D4 | Fixed | Edit link (staff and owner) and owner Archive button |
| D5 | Fixed | "View receipt" opens a short-lived signed URL |
| D6 | Fixed | The file type is checked before anything is saved |
| D7 | Fixed | Plain-language message for `0` |
| D8 | Fixed | Check constraint ties the receipt path to the expense id |
| D9 | Fixed | Compressed receipts are stored as `.webp` |

### New defects

| ID | Area | Defect | Steps | Expected | Actual | Cause |
|---|---|---|---|---|---|---|
| D10 | Storage | A receipt stays downloadable for a while after its expense is soft-deleted | Staff downloads a receipt (`GET /storage/v1/object/authenticated/receipts/<path>` with the staff JWT); the owner archives the expense; staff repeats the same GET | 400 (the read policy requires `deleted_at is null`) | 200 with the file. Seen in all four runs; still 200 after 65 s (separate probe) and after 309 s (run `BKJT`), 400 about ten minutes later. A signed URL is refused at once, and the same GET with any extra query string is 400 | Supabase's CDN caches the authenticated object response per URL and token (`cf-cache-status: HIT`). Soft delete leaves the object in place, so nothing invalidates the cache. The RLS policy in `20261019002400_create_receipts_storage.sql` is correct. Only someone who already downloaded the file with the same token can re-read it; the app itself only uses signed URLs. A fix would move or delete the object on archive (`softDeleteExpense` in `app/actions/expenses.ts`), or upload receipts with a short `cacheControl` (`lib/uploads/receipts.ts` uses the supabase-js default of 3600 s) |

Known limit noted: the edit form only finds expenses among the latest 50 (the edited expense was
among them).

## T054 run (2026-10-28)

Environment: `rolnet-dev` Supabase project with all migrations through `20261028000200`,
`next dev` (Next.js 16.4.3) in backend mode, Chromium at a 360 × 800 mobile viewport (touch),
E2E owner, approved-staff and pending-staff accounts. Run id `QWQK`, fleet date 2026-10-28.

- UI checks drive the real `/expenses` page as approved staff and as the owner.
- Receipts: a 15.7 MB PNG (2400 × 3200, generated by Chromium's canvas) and a 65 KB JPEG go
  through the real form; the browser compresses and uploads directly to Storage.
- Direct-access checks call Supabase REST/Storage with each user's own JWT (or no JWT), so RLS and
  Storage policies apply. Edit and deletion have no UI (D4), so they run through REST and
  `DELETE /api/v1/expenses/:id`.

**68 of 83 checks passed.**

### Categories

| Check | Result |
|---|---|
| Staff reads the four seeded system categories; form lists all four | Pass |
| Staff saves one expense in each of Fuel, Repairs, Registration, Insurance | Pass: each row saved with the right category and unit |
| Staff creates a category (direct API) | Pass: denied (403 `42501`) |
| Owner renames a protected system category | Pass: 0 rows updated |
| List row shows the category name and unit body number | **Fail (D2):** every row shows "Expense" and "Body Unknown" |

### Centavos

| Check | Result |
|---|---|
| `1,234.56` → 123456, `₱ 99.5` → 9950, `2500` → 250000, `0.01` → 1, `3,000.00` (owner) → 300000 | Pass: integer `amount_centavos` read back through REST |
| List shows 123456 as `₱1,234.56` | Pass |
| `12.345` and `-5` rejected in the form, nothing saved | Pass: "Enter a valid non-negative peso amount" |
| `0` rejected, nothing saved | Nothing saved, but **fail (D7):** the form shows raw Zod JSON |
| Fractional (12.5) and zero `amount_centavos` (direct API) | Pass: rejected (`22P02`, `23514`) |
| Same idempotency key twice (direct API) | Pass: second insert 409, one row |

### Receipt upload size

| Check | Result |
|---|---|
| 15.7 MB PNG through the form | Pass: one direct browser → Storage upload; stored object 260,596 B WebP (≤ 307,200 B); metadata path, MIME, size and sha256 finalized and match the downloaded bytes |
| 65 KB JPEG through the form | Pass: stored as 60,012 B WebP |
| 600 KB object uploaded directly | Pass: rejected, "The object exceeded the maximum allowed size" |
| 450 KB object uploaded directly | Pass: accepted (under the 500 KB hard limit) |
| GIF uploaded directly | Pass: rejected |
| Receipt metadata with `receipt_size_bytes` 600000 | Pass: rejected (`23514`) |
| PDF chosen in the form | Guidance shown ("Receipt must be JPEG, PNG, or WebP"), but **fail (D6):** the expense was already saved, without a receipt |

### Private access

| Check | Result |
|---|---|
| Public URL of a receipt | Pass: HTTP 400 |
| Anonymous (publishable key only) read, signed-URL request, upload | Pass: all denied |
| Pending staff read or upload | Pass: denied |
| Approved staff and owner read the object with their own JWT | Pass |
| Approved staff gets a 60 s signed URL that works | Pass (Storage API) |
| Upload under a non-existent expense id, or outside `receipts/<expense id>/` | Pass: denied |
| Staff deletes or overwrites a receipt object | Pass: nothing removed; overwrite rejected |
| Expense linked to another expense's receipt object (staff, direct API) | **Fail (D8):** accepted |
| The UI offers a way to open an attached receipt | **Fail (D5):** no link or signed-URL action |
| Receipt of a soft-deleted expense is unreadable | Not testable: the expense cannot be soft-deleted (D3) |

### Missing receipt

| Check | Result |
|---|---|
| Expenses without a receipt are saved with all receipt columns null | Pass (4 categories) |
| List flags them "Missing" | Pass |
| Form confirms "Expense saved. Receipt is marked missing." | **Fail (D1):** shows "Cannot read properties of null (reading 'reset')" after every successful save, with or without a receipt |

### Role

| Check | Result |
|---|---|
| Staff edits an expense amount and notes (direct API) | Pass |
| Edit control in the UI | **Fail (D4):** none |
| Staff soft-deletes an expense (direct API) | Denied (403 `42501`), but only as a side effect of D3 |
| Staff `DELETE /api/v1/expenses/:id` | Pass: 403 |
| Hard `DELETE` as staff or owner | Pass: 0 rows affected, row kept |
| Owner soft-deletes via `DELETE /api/v1/expenses/:id` or REST | **Fail (D3):** 403, "new row violates row-level security policy for table expenses" |
| Owner delete/archive control in the UI | **Fail (D4):** none |
| Staff opens `/settings/staff` | Pass: `/forbidden` |
| Pending staff reads or creates expenses | Pass: 0 rows; insert 403 |
| Anonymous REST read of `expenses`; signed-out visit to `/expenses` | Pass: 401 `42501`; redirected to `/login` |

### 360 px

| Check | Result |
|---|---|
| `/expenses` as staff (empty form and with rows) and as owner: no page-level horizontal overflow | Pass |

## Defects

| ID | Area | Defect | Cause |
|---|---|---|---|
| D1 | UI | Every successful save shows "Cannot read properties of null (reading 'reset')"; the missing-receipt and receipt-saved confirmations never appear, and the form is not cleared (a second tap creates a duplicate, since each submit gets a new idempotency key) | `components/forms/expense-form.tsx` calls `event.currentTarget.reset()` after `await`; React has cleared `currentTarget` (same as US1 D5) |
| D2 | UI | Expense list shows "Expense" / "Body Unknown" for every row | `app/(operations)/expenses/page.tsx` reads the `expense_categories` and `units` embeds as arrays (`[0]`); PostgREST returns a many-to-one embed as an object |
| D3 | Database | The owner cannot soft-delete an expense through any path; owner-only deletion is not actually encoded | `20261019002300_add_expenses_rls.sql`: the only SELECT policy requires `deleted_at is null`, so Postgres rejects an UPDATE whose new row sets `deleted_at` (`42501`). The UPDATE policy allows any approved user; staff are blocked only by this side effect. Affects `softDeleteExpense` in `app/actions/expenses.ts` and `softDeleteRow` in `lib/domain/crud.ts` |
| D4 | UI | No edit control and no owner delete/archive control on `/expenses` | `updateExpense` and `softDeleteExpense` in `app/actions/expenses.ts` are never called; T053 built only the add form and list |
| D5 | UI | Attached receipts cannot be opened in the app | T052's short-lived signed receipt URLs are not implemented in `app/actions/expenses.ts` or `lib/uploads/receipts.ts` (only `documents` has `createSignedUrl`) |
| D6 | UI | Choosing an unsupported file (PDF) shows an error but has already saved the expense without a receipt | `expense-form.tsx` calls `createExpense` before `prepareReceiptUpload` checks the MIME type, and no client-side type check runs first |
| D7 | UI | Amount `0` shows raw Zod JSON instead of guidance | `parseCentavos` (`lib/money/centavos.ts`) accepts 0; the server-side `expenseSchema.positive()` error from `app/actions/expenses.ts` is shown verbatim |
| D8 | Data integrity | An expense can be pointed at another expense's receipt object | Neither `receiptUploadSchema` (`lib/validation/expenses.ts`) / `finalizeReceiptUpload` nor a database constraint requires `receipt_object_path` to be under `receipts/<this expense id>/` |
| D9 | Uploads (minor) | Compressed WebP receipts are stored under a `.png`/`.jpeg` object name | `prepareReceiptUpload` picks the extension from the original file type; `compressReceiptImage` always outputs WebP |

Not covered: production-build behavior (Next.js hides server-action error messages in production,
so the server-side guidance in D7 would be generic), and the deleted-expense receipt check (blocked by D3).

T054 stays unchecked until D1–D8 are fixed and this journey passes.
