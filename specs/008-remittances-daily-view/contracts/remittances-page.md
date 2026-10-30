# Contract: Remittances page (URL, views, UI)

## URL

| Address | Shows |
|---------|-------|
| `/remittances` | Daily view on today (FR-001a) |
| `/remittances?date=2026-10-28` | Daily view on Oct 28, 2026 |
| `/remittances?date=2027-01-01` (after today) or `?date=garbage` | Daily view on today |
| `/remittances?view=list` | List view, newest first |
| `/remittances?view=list&q=…&from=…&to=…&unit=…&driver=…&disposition=…&balance=…&sort=…&page=…` | List view with those controls (unchanged from feature 006) |
| `/remittances?balance=unpaid` (old dashboard link) | List view, because a list-only parameter is present |
| `/remittances/[id]` | The existing detail page (unchanged) |

`parseRemittancesView(params, today) -> { view: "daily" | "list", date: string }` is the single
parser. Daily view ignores list parameters. Switching to List view drops `date`. Switching to Daily
view from the toggle or the note link drops every list parameter and `date` (FR-004). Every change
is a soft navigation (`<Link>` or `router.push`), never a full reload (FR-001).

## Shared header (both views)

- `PageHeader` with the eyebrow "Daily income" and the title "Remittances".
- `ViewToggle`: a segmented control `role="group"` named "Remittances view", with two toggle
  buttons, "List view" and "Daily view". The current one has `aria-pressed="true"`.

## Daily view

```text
[‹ Previous day] [📅 Friday, October 30, 2026 ▾] [Next day ›] [Today]  (Today)
4 of 9 recorded        ₱1,240.00 received
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬───────────  (progress)
[ new-day banner, when shown ]
[card] [card] [card] [card]      ← 4 per row from 1200 px, 2 from 768 px, 1 below
```

| Element | Accessible name and role | Behavior |
|---------|--------------------------|----------|
| Previous day | button "Previous day" | `date - 1` |
| Date button | button "Choose date, Friday, October 30, 2026" | Opens a popover with `MonthCalendar` |
| Calendar | `role="grid"`, labelled by the month heading, plus "Previous month" and "Next month" buttons | Days after today have `aria-disabled` and can't be selected. Arrow keys, Home/End, and PageUp/PageDown move focus. Enter picks the day |
| Next day | button "Next day" | Disabled (`aria-disabled` and `disabled`) when the date is today |
| Today | button "Today" | Hidden or disabled when already on today |
| "Today" label | text next to the date | Shown only when the date is today |
| Header | `role="status"` (polite) | "N of M recorded" and "₱X received", updated after each save |
| Progress | Base UI Progress, `aria-label="Recorded"`, `aria-valuenow=N`, `aria-valuemax=M` | Thin bar |
| New-day banner | `role="status"`, with the text "It's now a new day. Switch to today?" and a "Switch to today" button | Runs the unsaved-changes guard first |
| Empty state | text | "No units scheduled for this date." |

### Card (top to bottom)

| # | Element | Notes |
|---|---------|-------|
| 0 | "Card options" menu button (⋯), top right | Only on `saved` cards. Items: **Edit remittance**, and for owners **View record details** (link to `/remittances/[id]`) |
| 1 | Unit name | `truncate`. The full name is in a tooltip and in `title` |
| 2 | Driver name plus tag | Tag "Primary" (info colors) or "Backup" (brand-soft). The Backup tag is a focusable tooltip trigger: "Covering for {primary}, day off." The driver and tag sit on one line and wrap only if needed |
| 3 | Due | Label "Due", value like `₱180.00`, the largest text on the card. Updates the moment the disposition changes |
| 4 | Disposition | Native select labelled "Disposition" with the options "Returned" and "Overnight / overtime". Disabled when saved, including while editing (FR-026). While editing it shows the hint "Disposition can't be changed after saving." (owners also see "Reverse it on the record's details page to change it.") |
| 5 | Payment received (₱) | `inputMode="decimal"`, placeholder `0.00`. When editing, it shows the recorded total |
| 6 | Notes | Text input, placeholder "Add a note" |
| 7 | Action row | Unrecorded or editing: **Save remittance** (while editing, also **Cancel**). Saved: `BalanceBadge` plus "Saved" with a lock icon |

**Not-operating cards** (`no-driver` or `in-repair`) use a muted background and the label "Not
operating" or "Not operating (in repair)", with no fields. A `no-driver` card shows "{primary} is off
today. No backup assigned." For owners it adds an **Assign driver** button that opens a popover
listing the free drivers. Each is a button, and choosing one calls `assignBackupDriver`. If no
driver is free it says "No drivers are free on this date." Staff see "Ask the owner to assign a
backup driver."

**Dialogs (alert-dialog)**:

- Past-date edit (first time each session): "You're editing a record from Oct 28. Continue?"
  with Continue and Cancel.
- Owner lowering a payment: "Lower the payment from ₱180.00 to ₱100.00?", a required "Reason" field,
  and the buttons "Lower payment" and Cancel.
- Unsaved changes: "You have unsaved changes on N cards. Leave without saving?" with the buttons
  "Leave" and "Stay".

## List view

- No side panel, form, "Record daily remittance" heading, or helper text. The table spans the full
  content width (FR-034).
- The toolbar is unchanged (search, Any date, Filters, Sort), but the search placeholder is
  "Search by driver or unit" (FR-040).
- The count line reads "65 records". Under it, in `text-body-sm text-muted`: "Turn on
  [Daily view](/remittances) to record or correct each unit's remittance. List view shows all
  records, newest to oldest." (FR-038)
- Headers: Date, Unit / driver, Disposition, Due, Paid, Balance. The Date cell is a link to
  `/remittances?date={service_date}` with the accessible name "Open {long date} in Daily view"
  (FR-039).
- Rows have no click handler and no `cursor-pointer`. The existing hover tint stays (FR-035).

## Contrast targets (FR-040 to FR-043)

| Item | Foreground on background | Ratio |
|------|--------------------------|-------|
| Search placeholder | `#526174` on `#ffffff` | 6.32:1 |
| Typed text | `#0f1b2d` on `#ffffff` | 17.28:1 |
| Control borders (search, date, filters, sort) | `#7d8996` on `#ffffff` / `#fff1bd` hover | 3.56:1 / 3.15:1 |
| Toolbar text and icons | `#0f1b2d` or `#526174` on white | 17.28:1 / 6.32:1 |
| Focus ring | `#7a4b00` on `#ffffff` | 7.41:1 |
| Primary tag | `#1f4f7a` on `#e6eef7` | 7.30:1 |
| Backup tag | `#1b2a41` on `#fff1bd` | 12.77:1 |
| Muted text on saved or not-operating cards | `#526174` on `#f3f4f6` | 5.75:1 |
