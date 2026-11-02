# Feature Specification: Documents Page Redesign

**Feature Branch**: `013-documents-page-redesign`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Documents page redesign per client spec update (ROLNET). Mockup reference: documents_page_mockup_v5.html. Hide the Upload document form behind per-pane Upload buttons; split the page into a Unit documents folder tree and a Driver licenses list, each with its own search and filters and a shared sort; remove the Holder filter; let anyone revert a mistaken upload, bring a reverted file back within 30 days, and restore any earlier version."

## Context

Today the Documents page (owner-only) shows one paged list of current documents grouped under
"Units" and "Drivers", with one search, shared filters including a Holder filter, and an
"Upload document" form card on the right. Uploading a type the holder already has renews it and
keeps the old record as a superseded version. Each document opens a separate detail page with a
"View or download file" button, an Archive action, a renewal form, and a history table. Badges use
four tiers (Expired, Due within 7 days, Due within 30 days, Valid).

The client wants a two-pane page that behaves like a file explorer for unit documents, a modal for
details and uploads, and a safe way to undo mistaken uploads. The interactive mockup
`documents_page_mockup_v5.html` is the visual source of truth for layout and interaction; where it
and this spec differ, this spec wins. The mock's sample data is a placeholder. Modal style, status
badges, toasts, and button styles reuse the patterns already built on the Units, Remittances,
Expenses, and Drivers pages.

Documents stay identified by their category (document type). There is no rename feature and no
change-type option. Anyone with access to the Documents page can upload, renew, revert, undo, bring
back, and restore; the audit log is the safeguard.

## Clarifications

### Session 2026-11-02

- Q: What should "Revert upload" do when the current version was put back by Restore? → A: Hide
  "Revert upload" until the next upload or renewal; to go back, use Restore again. A valid older file
  is never marked reverted or deleted. (FR-029, Edge Cases)
- Q: Does the 3-tier status rule replace the "Due within 30 days" tier everywhere, or only on the
  Documents page? → A: Everywhere. A document shows the same status on every page, and the dashboard's
  expiring-documents panel covers 7 days instead of 30. (FR-011a)
- Q: When a driver's license is reverted, restored, or brought back and its expiry changes, does the
  driver profile's license expiry follow? → A: Yes, in the same all-or-nothing step. When the only
  license is removed, the profile keeps its last date. (FR-044a)
- Q: Can each Status and Document type filter take several values at once? → A: Yes, checkboxes. Each
  chosen value is its own chip and counts toward the badge; the dashboard link opens both panes with
  Expired and Due within 7 days chosen. (FR-005, FR-006, User Story 4, Edge Cases)
- Q: Should History rows and kept reverted files have their own View file link? → A: Yes. The current
  version, every History row, and every reverted file still kept can be opened; "File deleted"
  entries have no link. (FR-026, FR-027, FR-027a)
- Q: Should each pane's search, filters, and the shared Sort survive reload, Back, and shared links? →
  A: Yes, they are kept in the page address. Folder expand state and modals reset on reload, except a
  link to one document opens its modal. (FR-009a)

### Session 2026-11-03

- Q: The folder list is too long. How many folders should show at once? → A: Up to 10 folders per
  page, with First, Previous, Next and Last controls under the tree, like the other lists.
  (FR-012a)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse unit documents as a folder tree (Priority: P1)

The owner opens Documents and sees a "Unit documents" pane with one collapsed folder per active
unit. Each folder shows the unit name, red "N expired" and amber "N due" pills when applicable, and
a document count. Opening a folder shows its documents indented under it, each with a file icon,
the document type, the status badge, and "[number] · Expires [date]" (or "No number"). A unit with
no documents still appears as a folder with a count of 0 and expands to "Empty. Add or upload a
document." The owner can expand or collapse all folders at once and can operate the whole tree from
the keyboard.

**Why this priority**: This is the core of the redesign. Seeing every unit and which ones are
expired or due at a glance is the main compliance job of the page.

**Independent Test**: With several units (one with no documents, one archived) and documents of
each status, open the page and confirm folder order, pills, counts, the empty-folder message, the
hidden archived unit, and keyboard navigation, without using search, filters, or upload.

**Acceptance Scenarios**:

1. **Given** three active units and one archived unit, **When** the page loads, **Then** three
   folders show, all collapsed, and the archived unit does not appear.
2. **Given** a unit with one expired and two due documents, **When** the folder row is shown,
   **Then** it shows a red "1 expired" pill, an amber "2 due" pill, and a count of 3.
3. **Given** a collapsed folder, **When** the owner clicks anywhere on its row, **Then** it expands,
   the chevron points down, the folder icon changes to an open folder, and its documents show
   indented with a vertical guide line.
4. **Given** a unit with no documents, **When** its folder is expanded, **Then** it shows "Empty.
   Add or upload a document." and the "upload a document" link opens the upload modal with that unit
   preselected.
5. **Given** the tree has focus, **When** the owner presses Down, Up, Right, Left, and Enter,
   **Then** focus moves between visible rows, Right expands a folder, Left collapses it, and Enter
   toggles a folder or opens a document; the tree is a single tab stop with a visible focus ring.
6. **Given** some folders are open, **When** the owner uses Expand all or Collapse all, **Then**
   every folder opens or closes.

---

### User Story 2 - Open a document's details and renew it (Priority: P1)

Clicking a document (in the tree or the driver list) opens a Document details modal titled
"[Document type] · [holder]" with the status badge, holder, document number, issued on, expiry
date, file name, a View file action, the version history, any reverted uploads, and the most recent
5 activity events. From the modal the owner can renew the document, which opens the upload modal
with the type and holder prefilled.

**Why this priority**: The modal replaces the separate detail page and is the entry point for
renewal and every recovery action.

**Independent Test**: Open a document that has two earlier renewals and confirm every field, the
history order, the activity list, View file, and that Renew opens a prefilled upload modal.

**Acceptance Scenarios**:

1. **Given** a unit's OR/CR renewed twice, **When** the owner opens it, **Then** the modal shows the
   current values and a History list of the two earlier versions, newest first, each with its file
   name, "expired [date]", and a Restore button.
2. **Given** a document with no earlier versions, **When** its modal opens, **Then** History shows
   "No previous versions." and the Reverted uploads section is not shown.
3. **Given** the modal is open, **When** the owner chooses Renew, **Then** the upload modal opens
   with the document type and holder fixed to this document's and the renewal banner showing.
4. **Given** the modal is open, **When** the owner chooses View file, **Then** the current file opens
   or downloads.

---

### User Story 3 - Upload or renew from a modal (Priority: P1)

The right-hand form card is gone. Each pane has an "Upload" button with a plus icon beside its
Filters button. Both open the same "Upload document" modal, scoped by the pane: unit types and a
"Unit*" field for the Unit documents pane, or a fixed Driver's license type and a "Driver*" field
for the Driver licenses pane. If the chosen type and holder already have a document, a blue banner
says the upload renews it and the button reads "Renew document". After saving, the toast offers Undo
for 7 seconds.

**Why this priority**: Uploading and renewing are the page's main write actions and must keep
working after the form card is removed.

**Independent Test**: Upload a first document for a unit, then renew it, then upload a driver's
license; confirm scoping, the renewal banner, inline validation, the folder expanding, and the
toasts.

**Acceptance Scenarios**:

1. **Given** the Unit documents pane, **When** the owner clicks Upload, **Then** the modal's type list
   shows only OR/CR, MTOP franchise, and Insurance, and the holder field is "Unit*" listing
   non-archived units, disabled until a type is chosen.
2. **Given** the Driver licenses pane, **When** the owner clicks Upload, **Then** the type is fixed to
   Driver's license and the holder field is "Driver*".
3. **Given** a unit that already has Insurance, **When** the owner picks Insurance and that unit,
   **Then** a blue banner reads "[Unit] already has a Insurance. This upload renews it." and the
   button reads "Renew document".
4. **Given** the owner picks a 6 MB file or a .docx file, **When** the file is selected, **Then** an
   inline error reads "File is larger than 5 MB." or "Use a JPG, PNG, WebP or PDF file." and the file
   is not accepted.
5. **Given** required fields are empty, **When** the owner saves, **Then** each shows an inline
   error and nothing is saved.
6. **Given** a valid first upload for a unit, **When** it saves, **Then** the modal closes, that
   unit's folder expands, an Activity entry is added, and a toast reads "Document uploaded for
   [holder]." with Undo.
7. **Given** a valid renewal, **When** it saves, **Then** the previous file, number, issued date, and
   expiry move to History and the toast reads "Renewed [type] for [holder]. Previous file kept in
   history." with Undo.
8. **Given** the modal is open, **When** the owner presses Escape, **Then** it closes; while open,
   focus stays inside it.

---

### User Story 4 - Search, filter, and sort each pane (Priority: P2)

Each pane has its own search field, its own Filters panel with chips and Clear all, and a summary
line. The unit pane filters by Document type and Status; the driver pane filters by Status. One
Sort control in the header orders both panes, and in the tree it orders both the folders and the
documents inside them. Unit search behaves like a file explorer: live, case-insensitive, matching
folders auto-expand, matches are highlighted, and clearing restores the previous expand state.

**Why this priority**: Needed once the fleet has many documents, but the tree and modal are useful
without it.

**Independent Test**: With a known data set, type searches and set filters in each pane and confirm
results, summaries, chips, independence of the two panes, and sort order.

**Acceptance Scenarios**:

1. **Given** unit "Bravo" and a search of "bra", **When** the owner types, **Then** Bravo's folder
   shows expanded with all of its documents that pass the filters, "Bra" is highlighted, and the
   summary reads "N results in 1 folder".
2. **Given** a search "2026-10", **When** typed, **Then** only documents whose expiry text contains
   it show, inside their expanded folders; folders with no match are hidden.
3. **Given** no document or unit matches, **When** the search runs, **Then** the pane shows "No
   documents match."
4. **Given** the owner had opened two folders and then searched, **When** the search is cleared,
   **Then** exactly those two folders are open again.
5. **Given** the unit pane Status filter is "Expired", **When** applied, **Then** a chip "Status:
   Expired" shows, the Filters button shows a count of 1, folders with no expired documents (including
   empty ones) are hidden, and the driver list is unchanged.
6. **Given** the unit pane Status filter has Expired and Due within 7 days chosen, **When** applied,
   **Then** two chips show, the Filters button shows 2, and documents with either status show.
7. **Given** a search "expired" in the driver pane, **When** typed, **Then** only expired licenses
   show with an "N results" summary, and the unit tree is unchanged.
8. **Given** Sort "Expiry, soonest first", **When** applied, **Then** folders are ordered by their
   earliest visible expiry and documents inside each folder by expiry; with "Name, A to Z" or
   "Document type", folders are ordered A to Z by unit name.
9. **Given** a search plus a filter in the same pane, **When** both are active, **Then** only
   documents matching the search and passing the filter show.

---

### User Story 5 - Revert a mistaken upload (Priority: P2)

After an upload or renewal, the owner can tap Undo on the toast within 7 seconds to revert it
immediately, or later use the red "Revert upload" link in the Document details modal. Reverting a
renewal puts the previous version back as current. Reverting a first upload removes the document
from the pane. The reverted file is kept for 30 days.

**Why this priority**: Mistaken uploads (wrong unit, wrong file) are the client's main pain point,
but the page works without it.

**Independent Test**: Renew a document and Undo from the toast; renew again and revert from the
modal; upload a first document and revert it; confirm the resulting current version, the removed
document, the toasts, and the audit entries.

**Acceptance Scenarios**:

1. **Given** a renewal just saved, **When** the owner taps Undo within 7 seconds, **Then** the
   previous version is current again without a confirmation, and a toast reads "Upload reverted. You
   can bring it back from Recently reverted."
2. **Given** a document renewed again after the toast appeared, **When** Undo on the older toast is
   tapped, **Then** nothing changes.
3. **Given** a renewed document, **When** the owner chooses Revert upload, **Then** a modal titled
   "Revert to the previous version?" shows "Current file" and "Will be restored" (name and expiry);
   on "Revert upload" the previous version becomes current with its original file, number, issued
   date, and expiry, its status is recalculated (it may show Expired), the mistaken file appears in
   Reverted uploads, and a toast reads "Upload reverted. [Holder]'s [type] is back to the previous
   version."
4. **Given** a document with only one version, **When** the owner chooses Revert upload, **Then** a
   modal titled "Remove this upload?" appears; on "Remove upload" the document disappears from its
   folder or the driver list, the folder shows "Empty" if it was the last document, and a toast reads
   "Upload removed for [holder]."
5. **Given** either revert confirmation, **When** the owner chooses Cancel, **Then** the Document
   details modal is shown again unchanged.
6. **Given** a document with three versions, **When** Revert upload is used twice, **Then** it steps
   back one version each time.

---

### User Story 6 - Bring back a reverted file (Priority: P2)

A "Recently reverted" button with a count badge in the page header opens a list of every revert in
the last 30 days across both panes, newest first. Each entry, and each kept entry in a document's
Reverted uploads, has a "Bring back" button that makes the file current again (moving the current
file to history) or recreates a removed document.

**Why this priority**: Completes the safety net for reverts made by mistake.

**Independent Test**: Revert a renewal and a first upload, open Recently reverted, bring both back,
and confirm the lists, toasts, and audit entries.

**Acceptance Scenarios**:

1. **Given** two reverts in the last 30 days and one older, **When** the owner opens Recently
   reverted, **Then** it lists the two, newest first, each with file name, "[Holder] · [type]" (with
   "· document removed" for a removed first upload), "Reverted [date] by [name] · kept until [date]",
   and Bring back; the header badge shows 2.
2. **Given** a reverted renewal, **When** the owner confirms "Bring back this file?", **Then** the
   file becomes current, the current file moves to History, the entry leaves both lists, and a toast
   reads "Brought back [file] for [holder]'s [type]."
3. **Given** a removed first upload and no document of that type for the holder now, **When** the
   owner confirms "Bring back this document?", **Then** the document returns to its folder (which
   expands) or the driver list with its stored file, number, issued date, and expiry.
4. **Given** a removed first upload and the holder has since uploaded a new document of that type,
   **When** the owner chooses Bring back, **Then** the "Bring back this file?" confirmation is used
   and the newer document moves to History.
5. **Given** no reverts in 30 days, **When** the list opens, **Then** it shows "Nothing reverted in
   the last 30 days." and the footnote "Older reverts no longer have a file. Each document's Activity
   keeps the record."
6. **Given** a revert older than 30 days, **When** the document's Reverted uploads is viewed,
   **Then** the entry shows "File deleted" with no Bring back button.

---

### User Story 7 - Restore any earlier version (Priority: P3)

Every History row has a Restore button. Restoring makes that version current and moves the current
version into History, deleting nothing.

**Why this priority**: Lets the owner go back several versions in one step; reverting covers the
common case.

**Independent Test**: With three versions, restore the oldest and confirm the swap, the recalculated
status, the toast, and Activity.

**Acceptance Scenarios**:

1. **Given** a History row, **When** the owner chooses Restore, **Then** a modal "Restore this
   version?" shows "Will become current" and "Moves to history" (file and expiry), with Cancel and
   Restore version.
2. **Given** the owner confirms, **When** the restore completes, **Then** the chosen version's file,
   number, issued date, and expiry are current, the former current version is the newest History
   entry, status is recalculated, lists refresh, and a toast reads "Restored [file] as the current
   version of [holder]'s [type]."
3. **Given** Cancel in the restore modal, **When** chosen, **Then** the Document details modal returns
   unchanged.
4. **Given** a version was just restored, **When** the details modal shows, **Then** "Revert upload"
   is hidden until the document is uploaded or renewed again.

---

### User Story 8 - Browse driver licenses (Priority: P3)

The "Driver licenses" pane is a flat list of current driver's licenses: driver name in bold with
the status badge, license number, and "Expires [date]". It follows the shared Sort, its own search
and Status filter, and opens the same details modal.

**Why this priority**: Fewer records than unit documents and a simple list, but required for parity.

**Independent Test**: With licenses for active and inactive drivers, confirm rows, sorting, search,
filter, and empty states.

**Acceptance Scenarios**:

1. **Given** licenses for an active and an inactive driver, **When** the pane loads, **Then** both
   show with no special treatment.
2. **Given** no licenses, **When** the pane loads, **Then** it shows "No driver licenses yet."; with
   licenses but no match, it shows "No licenses match."

---

### Edge Cases

- **Status boundary**: a document expiring today, or exactly 7 days from today (business timezone),
  is "Due within 7 days"; yesterday is "Expired"; 8 days out is "Valid".
- **Dashboard link**: the dashboard's "View all" link to Documents opens the page with both panes'
  Status filter set to Expired and Due within 7 days, matching what the dashboard panel lists.
- **Old detail links**: existing links to a single document (from the dashboard, unit, and driver
  pages) open the Documents page with that document's details modal open. A link to a version that
  is no longer current opens the current document of that type and holder.
- **Revert after restore**: after a Restore, "Revert upload" is hidden until the next upload or
  renewal, so a valid older file is never marked reverted. To go back, the owner uses Restore again.
  Bring back of a reverted upload counts as an upload, so Revert upload is offered again after it.
- **Undo after another change**: Undo does nothing if the document changed since the toast appeared
  (renewed, reverted, restored, or brought back); the toast says nothing changed.
- **Bring back after file deletion**: if the retention date passes while a Bring back confirmation is
  open, confirming fails with a plain message and the entry shows "File deleted".
- **Concurrent edits**: if two people act on the same document at once, the second action is
  rejected with a message to reload, and nothing is half-applied.
- **Archived unit**: an archived unit is hidden from the tree, the upload unit list, and Recently
  reverted, but its records and audit history remain.
- **Deleted driver**: a soft-deleted driver's licenses are not listed and the driver is not an upload
  target.
- **Other driver document types**: any existing driver documents that are not licenses keep their
  records but are not shown in the driver pane.
- **Search with filters**: an empty folder appears during a search only if its unit name matches and
  no filter is active.
- **Small screens**: at 360 px the panes stack (Unit documents first), all modals fit without
  horizontal scrolling, and row text wraps rather than overflowing.
- **Many units**: the tree shows every active unit without paging; a fleet of 100 units with 400
  documents must stay responsive.

## Requirements *(mandatory)*

### Functional Requirements

**Layout**

- **FR-001**: The page MUST remove the "Upload document" form card and show a header with the
  eyebrow, the title "Documents", and on the right a "Recently reverted" button with a count badge
  followed by the shared Sort control labelled "Sort (both panes)".
- **FR-002**: The page MUST show two bordered panes, "Unit documents" (about 55% width) and "Driver
  licenses" (about 45%) on desktop, stacked with Unit documents first on tablet and phone.
- **FR-003**: Each pane MUST show, top to bottom: title and count ("13 documents · 6 units", "6
  licenses · 6 drivers") with a Filters button (with count badge) and a primary "Upload" button with
  a plus icon on the right; the filter panel; active chips with Clear all; the search field; a
  summary line (with Expand all and Collapse all icon buttons in the unit pane); and the tree or list.
- **FR-004**: The Upload buttons MUST have accessible names "Upload unit document" and "Upload driver
  license"; the Expand all and Collapse all buttons MUST have tooltips and accessible names.

**Filters and sort**

- **FR-005**: The unit pane MUST filter by Document type (OR/CR, MTOP franchise, Insurance) and Status
  (Expired, Due within 7 days, Valid); the driver pane MUST filter by Status only. The Holder filter
  MUST be removed. Each filter MUST allow several values at once (checkboxes); a document passes a
  filter if it matches any chosen value, and it must pass every filter that has values chosen.
- **FR-006**: Each chosen filter value MUST show as its own removable chip (e.g., "Status: Expired",
  "Status: Due within 7 days") with Clear all, and the Filters button MUST show the number of chosen
  values. Filters in one pane MUST NOT affect the other.
- **FR-007**: Within a pane, a document MUST be shown only if it matches the pane's search and passes
  the pane's filters.
- **FR-008**: The shared Sort MUST offer "Expiry, soonest first" (default), "Expiry, latest first",
  "Name, A to Z" (holder name, then document type), and "Document type", and apply to both panes.
- **FR-009**: In the tree, Sort MUST order the documents within each folder and the folders
  themselves: expiry sorts by each folder's earliest (or latest) expiry among its visible documents,
  name and type sorts A to Z by unit name. Folders with no visible documents sort after those with
  documents under expiry sorts.
- **FR-009a**: Each pane's search text, each pane's chosen filter values, and the shared Sort MUST be
  kept in the page address, so they survive reload, Back, and shared links, and the two panes' values
  MUST be kept separately. Folder expand state and open modals MUST NOT be kept, except that a link to
  a single document opens the page with that document's details modal.

**Status**

- **FR-010**: Status MUST be computed from the current version's expiry date against today in the
  business timezone: Expired if before today; Due within 7 days if today through 7 days ahead
  inclusive; Valid otherwise.
- **FR-011**: Status badges MUST show text and an icon as well as color: Expired (red, circle-x),
  Due within 7 days (amber, warning), Valid (green, check).
- **FR-011a**: The 3-tier rule MUST replace the "Due within 30 days" tier everywhere document status
  appears (dashboard, unit detail, driver detail, and any other list), so a document shows the same
  status on every page. The dashboard's expiring-documents panel MUST list expired documents and those
  due within 7 days.

**Unit documents tree**

- **FR-012**: The tree MUST show one folder per non-archived unit, named with the unit name, collapsed
  by default, including units with no documents. Folders are a display grouping only.
- **FR-012a**: The tree MUST show at most 10 folders per page, after search, filters and sort, with
  "1–10 of N folders" and First, Previous, Next and Last controls under it (hidden when one page is
  enough). The page MUST be kept in the page address (`upage`) and MUST go back to page 1 when the
  search, filters or sort change. After an upload or a bring back opens a folder, the tree MUST show
  the page that holds it.
- **FR-013**: A folder row MUST show a chevron, a folder icon (open-folder when expanded), the unit
  name in bold, a red "N expired" pill and an amber "N due" pill when those counts are above zero, and
  the document count at the right. Clicking anywhere on the row MUST toggle it.
- **FR-014**: Document rows MUST be indented under their folder with a vertical guide line and show a
  file icon (PDF or image), the document type, the status badge, and a second line "[number] · Expires
  [YYYY-MM-DD]" or "No number · Expires [YYYY-MM-DD]". Clicking a row MUST open the details modal.
- **FR-015**: An expanded folder with no documents MUST show "Empty. Add or upload a document.", where
  "upload a document" opens the upload modal with that unit preselected.
- **FR-016**: While any unit-pane filter is active, folders with no documents passing the filters
  (including empty folders) MUST be hidden.
- **FR-017**: The tree MUST follow the tree accessibility pattern: a tree container, tree items for
  rows, expanded state on folders, grouped children, a single tab stop with roving focus, Up/Down
  between visible rows, Right to expand, Left to collapse, Enter or Space to activate, and a visible
  focus ring.

**Search**

- **FR-018**: The unit search ("Search unit documents") MUST filter live and case-insensitively on
  unit name, document type, document number, expiry date text, status text, and file name.
- **FR-019**: If a unit name matches, its folder MUST show with all its documents that pass the
  filters; otherwise a folder MUST show only its matching documents, and folders with no match MUST be
  hidden. An empty folder MUST appear during a search only if its unit name matches.
- **FR-020**: While a unit search is active, folders with results MUST be shown expanded regardless of
  manual state; matching text MUST be highlighted in unit name, document type, number, and date; the
  summary MUST read "N results in M folders" (correctly pluralized) or "No documents match."
- **FR-021**: Clearing the unit search MUST restore the folder expand state from before the search
  began.
- **FR-022**: The driver search ("Search driver licenses") MUST filter only the driver list, matching
  driver name, document number, date text, status text, and file name, with highlighting and an "N
  results" summary.

**Driver licenses list**

- **FR-023**: The driver pane MUST list current driver's licenses of non-deleted drivers, including
  inactive drivers with no special treatment; each row shows the driver name in bold with the status
  badge, the license number, and "Expires [YYYY-MM-DD]". Rows follow the shared Sort; clicking a row
  opens the details modal.
- **FR-024**: The driver pane MUST show "No driver licenses yet." when there are none and "No licenses
  match." when search or filters exclude all.

**Document details modal**

- **FR-025**: The details modal MUST show the title "[Document type] · [holder]", the status badge,
  and rows for Holder, Document number, Issued on, Expiry date, and File name, plus a View file action
  that opens or downloads the current file.
- **FR-026**: The modal MUST show History (earlier versions newest first, each with file name,
  "expired [date]", a View file link, and a Restore button with accessible name "Restore [file name]")
  or "No previous versions."
- **FR-027**: The modal MUST show a Reverted uploads section only when the document has reverted
  uploads; each entry shows the file name, "Reverted [date] by [name]", and either "File kept until
  [date]" with a View file link and Bring back, or "File deleted" with no link or button.
- **FR-027a**: View file links on History rows and kept reverted files MUST be named for their file
  (e.g., "View [file name]") and open or download that file under the same access rules as the current
  file.
- **FR-028**: The modal MUST show the 5 most recent Activity events for the document (uploaded,
  renewed, reverted, brought back, restored), each with date and actor, or "No activity yet."
- **FR-029**: The modal footer MUST show a red "Revert upload" link on the left and Close and Renew on
  the right; Renew opens the upload modal with type and holder prefilled. The "Revert upload" link
  MUST be shown only when the current version became current through an upload, a renewal, or a Bring
  back; after a Restore it MUST be hidden until the next upload or renewal.

**Upload modal**

- **FR-030**: Both Upload buttons, the empty-folder link, and Renew MUST open the same "Upload
  document" modal with helper text "Uploading a type the holder already has renews it. The previous
  file stays in the history." Unit scope shows unit types and a "Unit*" field of non-archived units;
  driver scope fixes the type to Driver's license and shows "Driver*" of non-deleted drivers.
- **FR-031**: Fields MUST be Document type*, Unit*/Driver* (disabled until type is known), Document
  number, Issued on, Expiry date*, and File*.
- **FR-032**: The file MUST be a JPG, PNG, WebP, or PDF of at most 5 MB, checked on selection with
  inline errors "Use a JPG, PNG, WebP or PDF file." and "File is larger than 5 MB."; the chosen file's
  name MUST show with a Remove option. The same limits MUST be enforced when saving.
- **FR-033**: When the chosen type and holder already have a document, the modal MUST show a blue
  banner "[Holder] already has a [type]. This upload renews it." and the button MUST read "Renew
  document"; saving moves the old file, number, issued date, and expiry into History.
- **FR-034**: Required fields MUST show inline errors on save; the modal MUST be keyboard-accessible,
  close on Escape, and keep focus inside while open.
- **FR-035**: On success the modal MUST close, the unit's folder MUST expand (for units), an Activity
  entry MUST be recorded, and a toast with Undo MUST show for 7 seconds.

**Revert, bring back, restore**

- **FR-036**: Undo on an upload or renewal toast MUST revert that upload immediately without
  confirmation and show "Upload reverted. You can bring it back from Recently reverted." Undo MUST do
  nothing if the document has changed since.
- **FR-037**: Revert upload on a document with a previous version MUST, after confirmation ("Revert to
  the previous version?", rows "Current file" and "Will be restored", button "Revert upload"), make the
  previous version current with its original file, number, issued date, and expiry, and list the
  reverted file in the document's Reverted uploads.
- **FR-038**: Revert upload on a document with no previous version MUST, after confirmation ("Remove
  this upload?", button "Remove upload"), remove the document from all lists and counts with no
  placeholder row, keeping its records.
- **FR-039**: Revert MUST step back one version per use. Cancel in any confirmation MUST return to
  where it was opened.
- **FR-040**: "Recently reverted" MUST list every revert from the last 30 days across both panes,
  newest first, with file name, "[Holder] · [type]" (plus "· document removed" for removed first
  uploads), "Reverted [date] by [name] · kept until [date]", and Bring back; its count badge MUST equal
  the number of entries; empty state and footnote as in User Story 6.
- **FR-041**: Bring back MUST be offered only while the reverted file still exists. For a reverted
  renewal, or when the holder already has a document of that type, it MUST confirm "Bring back this
  file?" (rows "Will become current" and "Moves to history") and swap; for a removed first upload with
  no current document of that type, it MUST confirm "Bring back this document?" (row "File") and
  recreate the document with its stored values, expanding the unit's folder.
- **FR-042**: After Bring back the entry MUST leave Reverted uploads and Recently reverted, lists MUST
  refresh, and a toast MUST read "Brought back [file] for [holder]'s [type]."
- **FR-043**: Restore MUST, after confirmation ("Restore this version?", rows "Will become current"
  and "Moves to history", buttons Cancel and "Restore version"), make the chosen History version
  current and move the former current version to the top of History, deleting and creating no files.
- **FR-044**: Every upload, renewal, revert (including Undo), bring back, and restore MUST be recorded
  in the document's Activity and the audit log with actor, time, document, file names, and result
  (e.g., "Restored version X. Y moved to history"; "Reverted X. Y restored"; "Reverted X. Document
  removed").
- **FR-044a**: When an upload, renewal, revert, Undo, bring back, or restore changes which driver's
  license version is current, the driver profile's license expiry date MUST be set to the new current
  version's expiry in the same step, so the two dates always match. When the driver's only license is
  removed by a revert, the profile MUST keep its last license expiry date.
- **FR-045**: Each of these actions MUST be all-or-nothing: either the whole swap, removal, or
  recreation happens, or nothing changes and the user sees a plain-language error.
- **FR-046**: Uploading, renewing, reverting, undoing, bringing back, and restoring MUST NOT apply role
  checks beyond access to the Documents page.

**Retention**

- **FR-047**: A reverted file MUST be kept in file storage for 30 days after the revert and then
  permanently deleted by a daily scheduled job, which records when it was deleted. Only files are
  deleted; version records, Reverted uploads entries, Activity, and audit entries MUST be kept
  permanently.
- **FR-048**: Files of versions in History (not reverted) MUST be kept for as long as the document
  exists.
- **FR-049**: Status, counts, pills, and the "current version" MUST be derived only from the current,
  non-reverted version of a non-removed document.

### Key Entities

- **Document**: one compliance record per holder and document type (OR/CR, MTOP franchise, Insurance
  for units; Driver's license for drivers). Holder type follows from document type. Has a current
  version, and is removed (with who and when, from its reverted version) when its only version is reverted. A removed document has no current version and is excluded from every list and count; its records are kept. It is restored
  by Bring back. No name field; identified by its type.
- **Document version**: one uploaded file with its document number, issued date, expiry date, file
  name, file type and size, and uploader. It is either current, in History (earlier renewal), or
  reverted. A reverted version records when and by whom it was reverted, its retention date (revert
  plus 30 days), and when its file was deleted, if it has been. Version records are never deleted.
- **Unit folder**: a display grouping of a unit's documents, derived from non-archived units; not
  stored.
- **Activity / audit entry**: a permanent record of an upload, renewal, revert, bring back, or restore
  with actor, time, document, file names, and result.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can find whether any unit has an expired or due document within 5 seconds of
  opening the page, without opening any folder.
- **SC-002**: The owner can upload or renew a document in under 1 minute from the page, on a 360 px
  phone screen, without horizontal scrolling.
- **SC-003**: A mistaken upload can be undone in one tap within 7 seconds, or reverted in at most 3
  taps any time later, and in every case the previous version is current again exactly as it was.
- **SC-004**: Any revert from the last 30 days can be brought back in at most 3 taps from the page
  header.
- **SC-005**: Unit search results update with each keystroke with no noticeable delay for a fleet of
  100 units and 400 documents.
- **SC-006**: 100% of uploads, renewals, reverts, bring backs, and restores appear in the audit log
  with actor, time, and file names; no version, activity, or audit record is ever removed.
- **SC-007**: No reverted file remains in storage more than 31 days after its revert, and no file of a
  current or History version is ever deleted.
- **SC-008**: The whole page, including the tree, filters, and every modal, can be operated with the
  keyboard alone.

## Assumptions

- **Access**: the Documents page stays owner-only (only the owner has document access today). "Anyone
  with access" therefore means owner accounts; no new role checks are added.
- **Unit name**: folders use the unit's name (added in feature 007); the body number may appear as
  secondary text if needed to tell units apart.
- **Detail page**: the separate document detail page is replaced by the modal; its Archive action is
  replaced by Revert upload. Old links open the page with the modal (see Edge Cases).
- **Loading**: both panes load all current documents for active units and drivers at once; the tree
  pages its folders in the browser (FR-012a), 10 at a time.
- **File name**: the original file name is stored at upload. For existing documents uploaded before
  this feature, a readable name is derived from the type, holder, and upload date.
- **Activity history**: Activity shows events recorded from this feature onward; existing documents
  show their original upload (and renewals) derived from their existing version records.
- **Existing "void" versions**: versions archived through the old Archive action are treated as
  removed and are not offered for Bring back.
- **Retention job**: the daily deletion job runs within the existing free-tier platform (no new paid
  service), consistent with the constitution's free-tier rule.
- **Toasts, modals, badges, and buttons** reuse the existing components and tokens; no new component
  or animation libraries.
- **Mockup**: `documents_page_mockup_v5.html` defines layout and interaction details not stated here;
  its sample data is not used.
