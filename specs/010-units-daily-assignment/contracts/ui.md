# Contract: UI

The interactive mockup `units_assignment_blocked_states_mockup.html` is the layout reference. The spec
wins where they differ. Tokens only, and every screen works at 360 px.

## `/units`

| Param | Values | Default |
|-------|--------|---------|
| `view` | `list`, `daily` | owner: `list`; staff: always `daily` |
| `date` | `YYYY-MM-DD` (any) | fleet today; the toggle always opens Daily on today |
| list params | the existing `q`, filters, page, plus `archived=1` | archived hidden |

**Header**:
- `PageHeader` with eyebrow "Fleet register", title "Units", and on the right a `SegmentedToggle` labelled "Units view": "List view | Daily assignment view".
- Staff don't see the toggle.
- Switching uses `router.push`, with no document reload.

**List view (owner)**:
- **Toolbar**: search, Filters, and a primary "Add a unit" button with a `Plus` icon.
- **Under the toolbar**: the "N units" count, and on the right the checkbox "Show archived (N)".
- **Columns**: Unit (link), Body number, Plate, Motorcycle, Current driver (today's driver, or "Unassigned"), Mileage, Status (badge), and a menu.
- **Row menu** (`aria-label="Unit options"`): "More info" and "Archive". On archived rows it's "More info" and "Restore". An archived row is dimmed (`opacity` token) with an "Archived" tag after the name.
- **Add a unit**: a `Dialog` titled "Add a unit" with the existing `UnitForm` (Unit name*, Body number*, Plate number*, Motorcycle*, Status). Inline errors. On success it closes, refreshes, and shows the "Unit added" toast.
- **Archive**: an `AlertDialog` titled "Archive [unit name]?", with:
  - **Body**: "[Unit] will be hidden from the units list, daily assignments, and remittances. No records are deleted. Reports keep its data, and you can restore it anytime."
  - **"Tied to this unit:"** list:
    - Driver assigned today: [name (Role)] or "None"
    - Assignment records: N
    - Remittances: N
    - Expenses: N
    - Documents: N
    - Audit history entries: N
  - **Buttons**: "Cancel" (initial focus) and "Archive unit" (destructive). On success, the "Unit archived" toast.
- **Restore**: no dialog. Shows the "Unit restored" toast.

**Daily assignment view (owner and staff)**:
- **Date control**: `DateControl allowFuture` shows previous, the date button with the calendar, next, and "Today". The tag is "Today", or "Upcoming" after today. The long date reads "Sunday, November 1, 2026".
- **Progress**: "N of M units assigned" with a `Progress` bar.
- **Grid**: 1, 2 (≥768), or 4 (≥1200, `desk`) columns. Empty: "No units to assign. Add a unit in List view." (owner) or "No units to assign." (staff).

**Card**, top to bottom:
- **Title**: the unit name, truncated, with a `Tooltip` holding the full name.
- **Subheader**: "BODY · PLATE · MOTORCYCLE" in small muted text, truncated, with a tooltip.
- **"Assign driver"** select. Options read "NAME (Primary)" or "NAME (Backup)". With no options it shows "No available drivers" and Save is disabled.
- **"Notes"** input.
- **Footer**, by state:
  - **open**: "Save assignment" (primary). Under the select, the hint "Pre-filled from previous day" when pre-filled. Errors appear inline under the select: "Choose a driver first", "Driver already assigned today".
  - **saved**: inputs disabled, muted background, the "Assigned" badge and "Saved" with a `Lock` icon, plus a top-right menu (`aria-label="Card options"`) with "Edit assignment".
  - **editing**: like open, plus "Cancel". Saving sends `expectedUpdatedAt`.
  - **locked**: like saved, with no menu, and the line "A remittance is already recorded for this day."
  - **blocked**: muted, an "In repair" or "Retired" badge, disabled inputs and button, the message "Unit is in repair. Change its status on the unit page to assign a driver." (or "retired"), and an "Open unit" link (owner only).
- **Past-date edit**: on the first "Edit assignment" for a date before today in this browser session, an `AlertDialog` asks "You are editing an assignment from [Nov 1, 2026]. Continue?". A `sessionStorage` key stops it asking again.

## `/units/[id]` (owner only)

**Header**:
- "← Back to units" (`/units`), then the eyebrow "Unit history", the title [unit name], and the subtitle "Body B · PLATE · MOTORCYCLE".
- At the top right, `UnitStatusControl`, the colored `StatusSelect`. Before a change to In repair or Retired it calls `upcomingAssignmentCount`. If the count is above 0, an `AlertDialog` asks "[Unit] has driver assignments from today onward. Changing the status will release them. Continue?". Cancel restores the select.

**Details**:
- `SectionHeading` "Details" with an "Edit details" button.
- A compact grid (2 columns on phones, 3 at ≥768) with Unit name, Body number, Plate number, Motorcycle, Mileage ("12,345 km"), and Current driver ("NAME (Role)" or "No driver assigned today").
- The "Maintenance and mileage" text link.
- Edit mode turns the first four fields into inputs, with "Save details" and "Cancel".

**Then, in order**:
- **Monthly expenses vs allowance**: one block per month. Each shows the month label, an Allowance bar and an Expenses bar (widths relative to the larger of the two in that block, token colors), each amount, and "Net ₱X" (red with a minus sign when negative). Empty: "No remittances or expenses in the last 12 months."
- **Status history**: from `unit_status_changes`, "From → To", then "who · when". "Created as In repair" for creation rows that aren't Active.
- **Assignment history**: Date, Driver, Role, newest first, paged.
- **Documents**: the existing list. Empty: "No documents for this unit yet. Upload them on the Documents page."

**Removed**: the large mileage heading, "Driver on a date", "Reassign primary driver", "End driver's assignment", "Record day off", "Days off and backup coverage", and the right-side "Edit details" card.

## `/remittances` Daily view changes

- **Driver tag**: "Primary" or "Backup" from `drivers.driver_kind`. The "Covering for …, day off" tooltip is removed.
- **no-driver card**: the text "No driver assigned for this date", plus an "Assign driver" link to `/units?view=daily&date=<date>`. The save controls stay hidden.
- **blocked card**: muted, a status badge, and "Unit is in repair. No remittance for this date." (or "retired"). There's no rental, payment, notes, or Save.
- **Counts**: "N of M recorded" and the received total exclude blocked cards. Saved cards are always included.
- **Archived units**: hidden, except their saved remittances still appear in List view.

## `/drivers/[id]`

- **Removed**: the forms for primary assignments, days off, and backup coverage.
- **Kept, read-only**: their history tables, labelled "Before daily assignments".
- **New**: an "Assignment history" table (Date, Unit) from `unit_assignments`.
- **Deactivate and Archive**: confirm with "[Driver] is assigned from today onward. Deactivating will release those units. Continue?" (or "Archiving…") when the count is above 0.

## Toasts

`components/ui/toast.tsx` sits in the root layout as a polite live region. Toasts appear bottom-center
on phones and bottom-right from 768 px, and auto-dismiss after 4 s.
