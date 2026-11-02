# Contract: UI

The visual reference is `documents_page_mockup_v5.html`. The spec wins where they differ. Use only
the tokens from `app/globals.css` and `DESIGN.md`, the shadcn `base-nova` components in
`components/ui/`, and lucide icons. No hex colours, no arbitrary sizes, and no new libraries.

## URL parameters (FR-009a, R13)

| Param | Values | Default |
|-------|--------|---------|
| `sort` | `expiry`, `expiry-desc`, `name`, `type` | `expiry` |
| `usearch` / `dsearch` | text | empty |
| `utype` | comma list of `or_cr`, `mtop_franchise`, `insurance` | none |
| `ustatus` / `dstatus` | comma list of `expired`, `due`, `valid` | none |
| `doc` | version id: opens the details modal | none |
| `expiry=due` (legacy) | mapped to `ustatus=expired,due&dstatus=expired,due` | — |

Unknown values are ignored. Search params are written after 300 ms of no typing, with
`router.replace` and no scroll.

## Components (new, `components/documents/`)

| Component | Role |
|-----------|------|
| `documents-workspace.tsx` | Client root: URL state, both panes, header actions, modals |
| `documents-header-actions.tsx` | "Recently reverted" button with count badge, and the Sort select labelled "Sort (both panes)" |
| `pane.tsx` | Bordered card: title and count, Filters button with badge, Upload button (plus icon and aria-label), filter panel, chips with Clear all, search, summary |
| `filter-panel.tsx` | Checkbox groups (multi-select) for Document type and Status |
| `unit-tree.tsx` | Folder tree (ARIA tree, roving focus), pills, indent guide, empty-folder message, highlight |
| `driver-license-list.tsx` | Flat rows: driver name, badge, number, expiry |
| `document-details-dialog.tsx` | Details, View file, History with Restore, Reverted uploads with Bring back, Activity, footer |
| `confirm-version-dialog.tsx` | One component for Revert (2 variants), Restore, and Bring back (2 variants): title, text, comparison rows, buttons |
| `recently-reverted-dialog.tsx` | List, empty state, footnote |
| `upload-document-dialog.tsx` | Wraps `forms/document-form.tsx`: scope, presets, renewal banner, file chip with Remove |
| `highlight.tsx` | `<mark>` with token classes for search matches |
| `expiry-status.tsx` (updated) | 3 tiers with icons (R11) |

Pure logic in `lib/documents/`: `status.ts`, `tree.ts` (group, filter, search, sort, counts, summary
text), `search.ts` (match fields and ranges for highlight), `url-state.ts` (parse and serialize
params), `file-label.ts` (shown file name), and `page-query.ts` (reads).

Hook: `hooks/use-tree-keyboard.ts`.

## Layout

- From `lg` up: `lg:grid-cols-20` with the Unit pane at `lg:col-span-11` (55%) and the Driver pane at
  `lg:col-span-9` (45%). Tailwind v4 numeric utilities, not arbitrary values. Below `lg`, the panes
  stack with Unit documents first.
- At 360 px: the header actions wrap below the title, pane header buttons stay on one line
  (icon plus short label), and every modal is full-width with an internally scrolling body.

## Copy (exact strings)

| Where | Text |
|-------|------|
| Pane counts | "{n} document(s) · {m} unit(s)", "{n} license(s) · {m} driver(s)" |
| Search placeholders | "Search unit documents", "Search driver licenses" |
| Unit summary | "{n} result(s) in {m} folder(s)", or "No documents match." |
| Driver summary | "{n} result(s)", or "No licenses match." / "No driver licenses yet." |
| Empty folder | "Empty. Add or upload a document." ("upload a document" is a button styled as a link) |
| Document line 2 | "{number or 'No number'} · Expires {YYYY-MM-DD}" |
| Upload helper | "Uploading a type the holder already has renews it. The previous file stays in the history." |
| Renewal banner | "{Holder} already has a {type}. This upload renews it." Button: "Renew document" |
| File errors | "Use a JPG, PNG, WebP or PDF file.", "File is larger than 5 MB." |
| Toasts | "Document uploaded for {holder}." / "Renewed {type} for {holder}. Previous file kept in history." (Undo, 7 s); "Upload reverted. You can bring it back from Recently reverted."; "Upload reverted. {Holder}'s {type} is back to the previous version."; "Upload removed for {holder}."; "Restored {file} as the current version of {holder}'s {type}."; "Brought back {file} for {holder}'s {type}."; "Nothing changed. This document was updated since." |
| Revert (has previous) | Title "Revert to the previous version?", rows "Current file" / "Will be restored", confirm "Revert upload" |
| Revert (first upload) | Title "Remove this upload?", confirm "Remove upload" |
| Restore | Title "Restore this version?", rows "Will become current" / "Moves to history", confirm "Restore version" |
| Bring back | "Bring back this file?" (rows "Will become current" / "Moves to history") or "Bring back this document?" (row "File"), confirm "Bring back" |
| Recently reverted | Entry lines "{file}", "{Holder} · {type}[ · document removed]", "Reverted {date} by {name} · kept until {date}"; empty "Nothing reverted in the last 30 days."; footnote "Older reverts no longer have a file. Each document's Activity keeps the record." |
| Reverted uploads entry | "Reverted {date} by {name}", then "File kept until {date}" or "File deleted" |
| History | "expired {date}", or "No previous versions." |
| Activity | "No activity yet." |
| Cleanup overdue notice (owner, above the panes) | "File cleanup is overdue. Re-enable the daily purge workflow in GitHub Actions." |

Every confirmation's Cancel returns to the dialog that opened it. Escape closes the top dialog only.

## Keyboard (unit tree, FR-017)

| Key | Action |
|-----|--------|
| Tab | Enters the tree at the last focused row (or the first) and leaves the tree |
| Down / Up | Next / previous visible row |
| Right | Expands a closed folder; on an open folder, moves to its first child |
| Left | Collapses an open folder; on a document, moves to its folder |
| Home / End | First / last visible row |
| Enter / Space | Toggles a folder, or opens a document |
