# Contract: Paged and Searchable Lists

## URL parameters

| Parameter | Meaning | Default (omitted from URL) |
|---|---|---|
| `{prefix}page` | 1-based page number | `1` |
| `{prefix}q` | free-text search | empty |
| `sort` and filters | per list; see "Sort and filter" below | default order, no filter |

- Invalid page (`0`, `-2`, `abc`) → page 1. Beyond last page → last page.
- Editing search replaces `{prefix}q` and deletes `{prefix}page`; other lists' params on the page
  are kept.
- Page links keep `{prefix}q` and all other params.

## Shared UI

**`ListSearch`** (client) — props: `param` (e.g. `"q"` or `"assignments_q"`), `pageParam`,
`placeholder`, `label`.
- Leading search icon (decorative, `aria-hidden`), visible-to-screen-reader label, `type="search"`.
- Updates the URL with `router.replace` after typing pauses (~300 ms) or on Enter; no full
  reload; `scroll: false`.
- "Clear" button appears when text is present; clears `q` and page.

**`Pagination`** (server) — props: `page`, `lastPage`, `total`, `pageParam`, `searchParams`.
- Renders `First`, `Previous`, `Page x of y`, `Next`, `Last` as links; disabled ones render as
  non-interactive `aria-disabled` text. Wrapped in `<nav aria-label="Pagination">`.
- Range label `"11–20 of 87 records"` (en dash), singular for 1.
- Hidden when `lastPage = 1`; the record count in the toolbar stays.
- Each control ≥ `--space-touch`; wraps onto two lines at 360 px without horizontal scroll.

**`DataTable`** (changed) — adds `toolbar` (search + count) above and `pagination` below.
- Toolbar has its own padding and bottom rule; the table header never touches the search field.
- Empty with search → "No records match "{q}"." + Clear search link. Empty without search →
  existing per-list empty text.

## Page inventory

| Page | List | Prefix | Order (keep the existing order; listed for reference) | Search covers |
|---|---|---|---|---|
| `/units` | Units | — | body number | body number, plate, make/model; `status` filter |
| `/drivers` | Drivers | — | full name | name, license no., phone; `kind` filter |
| `/remittances` | Remittances (removes 50-row cap) | — | service date desc | unit body no., driver name, notes, date |
| `/expenses` | Expenses | — | expense date desc | category, unit body no., notes, date |
| `/maintenance` | Units for maintenance | — | body number | body number, plate |
| `/documents` | Documents (grouped) | — | holder, type | type, document no., holder name/body no. |
| `/audit` | Audit events (removes 100-row cap) | — | occurred at desc | entity type, action |
| `/settings/staff` | Staff | — | registered desc | display name |
| `/units/[id]` | Assignment history | `assignments_` | starts on desc | driver name |
| `/units/[id]` | Days off and backup coverage (removes 30-row cap) | `daysoff_` | date desc | driver name |
| `/units/[id]` | Documents | `documents_` | type | type, document no. |
| `/drivers/[id]` | Primary assignments | `assignments_` | starts on desc | unit body no. |
| `/drivers/[id]` | Backup coverage | `backup_` | date desc | unit body no. |
| `/drivers/[id]` | Days off (removes 30-row cap) | `daysoff_` | date desc | — (no search) |
| `/drivers/[id]` | License documents | `documents_` | expires desc | document no. |
| `/documents/[id]` | History | `history_` | expires desc | document no. |
| `/remittances/[id]` | Payment history | `payments_` | paid at (oldest first, as today) | date, amount, notes |
| `/maintenance/[unitId]` | Parts | `parts_` | installed desc | part name |
| `/maintenance/[unitId]` | Tire history | `tires_` | installed desc | brand, position |
| `/maintenance/[unitId]` | Mileage readings (removes 10-row cap) | `mileage_` | read at desc | — (no search) |

Not paged: "Current tires" on `/maintenance/[unitId]` (fixed set of wheel positions), form
dropdown options, report exports.

## Sort and filter (User Story 8)

Main list pages only. Every value is optional; an unknown value is ignored. Changing any of them
drops `page`. The first sort listed is the default and is left out of the URL.

| Page | `sort` values | Filters (param: values) |
|---|---|---|
| `/units` | `body` (Body no. A–Z), `body-desc`, `mileage-desc`, `mileage` | `status`: `active`, `in_repair`, `retired` |
| `/drivers` | `name` (A–Z), `name-desc`, `license` (expiry soonest), `license-desc` | `kind`: `primary`, `backup` · `status`: `active`, `inactive` · `license`: `expired`, `soon` (within 30 days), `later` |
| `/remittances` | `newest`, `oldest`, `amount-desc`, `amount` | `from`, `to` (service date) · `unit`: unit id · `driver`: driver id · `disposition`: `returned`, `overnight_overtime` · `balance`: `unpaid` (owner) |
| `/expenses` | `newest`, `oldest`, `amount-desc`, `amount` | `from`, `to` (expense date) · `unit` · `category`: category id · `receipt`: `attached`, `missing` |
| `/maintenance` | `body`, `body-desc`, `mileage-desc`, `mileage` | `status` · `due`: `1` (owner) |
| `/documents` | `expiry` (soonest), `expiry-desc`, `type`, `newest` (uploaded) | `type`: document type · `holder`: `unit`, `driver` · `expiry`: `expired`, `soon`, `due` (expired or within 30 days), `later` |
| `/audit` | `newest`, `oldest` | `from`, `to` (Manila date of the change) · `action`: audit action · `entity`: record type |
| `/settings/staff` | `newest`, `oldest`, `name` | `status`: `pending`, `approved`, `rejected`, `deactivated` |

- Dates are `YYYY-MM-DD` fleet dates; `from` is inclusive from the start of that day and `to`
  inclusive to its end. A date that is not real is ignored.
- `soon` = from today to today + 30 days; `later` = after today + 30 days; `expired` = before today.
- Dashboard "View all" targets: `/units?status=in_repair`, `/drivers?kind=backup`,
  `/maintenance?due=1`, `/remittances?balance=unpaid`, `/documents?expiry=due`.

**`ListControls`** (client) sits in the list toolbar under the search box:
- A "Sort" select and one labelled control per filter (select, or two date inputs for a range).
  Choosing a value updates the URL at once (`router.replace`, no full reload).
- "Clear filters" appears when any filter or a non-default sort is on; it keeps `q`.
- Below 48rem the controls are folded behind a "Sort and filter" button showing "(N on)".

## Demo mode

`NEXT_PUBLIC_DEMO_MODE=true` pages and searches the demo arrays in memory with the same helper
(`pageRows(rows, request, textOf)`), so the e2e suite can exercise paging without Supabase.
