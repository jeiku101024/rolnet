# Feature Specification: Units Daily Assignment, Archiving, and Blocked Units

**Feature Branch**: `010-units-daily-assignment`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Spec update per client (ROLNET): Units enhancement. Units are no longer tied to a permanent primary driver. The client assigns drivers to units day by day. This update adds a Daily assignment view to the Units page, simplifies the list view, redesigns the unit detail page, replaces deleting a unit with archiving, and updates the Remittances Daily view to read drivers from the daily assignments and to gray out blocked units." (The full description, with the list view, daily assignment, blocked-card, release, archive, unit detail, remittance, and data-model rules and the acceptance criteria, was supplied with the `/speckit-specify` command together with the interactive mockup `units_assignment_blocked_states_mockup.html`. Each requirement below reflects it.)

## Clarifications

### Session 2026-11-01

- Q: On release day, should units start with their current driver already assigned, or start unassigned? → A: Copy today's drivers. Release creates a saved assignment for the release day from each unit's current driver (the primary, or the backup covering the primary's day off; nobody if the primary is off with no backup), so remittances can be recorded straight away (FR-053).
- Q: Who can open the Daily assignment view and save assignments? → A: Owner and staff. Staff can view, save, and edit assignments (including the past-date confirmation). List view, Add a unit, archive and restore, status changes, and the unit detail page stay owner-only (FR-056, FR-057).
- Q: Can a unit's driver for a date be changed after a remittance is saved for that unit and date? → A: No. The assignment locks for good: its card shows no "Edit assignment" and says "A remittance is already recorded for this day." Status changes and archiving never release it (FR-019a, FR-029).
- Q: What happens to a driver's saved assignments from today onward when the driver is deactivated or archived? → A: They are released (except ones with a saved remittance), after a confirmation naming the driver, and those units become unassigned (FR-029b).
- Q: Should a unit appear in the daily views on dates before it was added? → A: No. It appears only on and after the date it was added, in the fleet time zone, and is left out of earlier dates' cards and counts (FR-011a).
- Q: Which months does "Monthly expenses vs allowance" show? → A: Only months within the last 12 calendar months (including the current one) that have remittances or expenses for the unit, newest first. Older months are in the Yearly report (FR-041).


### Session 2026-11-04

- Q: Should today's unsaved cards be pre-filled like future dates? → A: Yes. Today and future dates pre-fill each unsaved card with the unit's latest earlier driver (usually yesterday's). Past dates still start empty, because they record what already happened (FR-021, US2 scenario 3).
## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assign a driver to each unit for the day (Priority: P1)

Each morning (or ahead of time), the owner opens Units, switches to **Daily assignment view**, and sees one card per unit for the chosen date. On each card they pick a driver from the "Assign driver" dropdown, optionally add a note, and click **Save assignment**. The card locks and shows "Assigned". A driver already saved on another unit that day no longer appears in any other card's dropdown. The header shows "N of M units assigned" with a progress bar.

**Why this priority**: The client now decides who drives which unit day by day. Without saved daily assignments, the Remittances Daily view has no driver to record a remittance under, so nothing else in this feature works.

**Independent Test**: With three active units and three drivers, open Daily assignment view on today. Assign driver A to unit 1 and save: the card locks, the header reads "1 of 3 units assigned", and driver A is missing from the other two dropdowns. Use the card's 3-dot menu, choose Edit assignment, switch to driver B, and save: driver A reappears in the other dropdowns.

**Acceptance Scenarios**:

1. **Given** the Units page, **When** the owner clicks "Daily assignment view" in the segmented control, **Then** the view switches without a page reload, the search field and Filters button are hidden, and the date picker shows today's full date (for example "Sunday, November 1, 2026") with a "Today" tag.
2. **Given** the date picker, **When** the owner uses the previous-day arrow, next-day arrow, the calendar (with month navigation), or the "Today" button, **Then** the cards reload for that date, and a future date shows an "Upcoming" tag.
3. **Given** an unsaved card, **When** the owner opens the dropdown, **Then** it lists only active drivers who are not saved on another unit for that date, each labelled with the driver's role, for example "RA SHAA (Primary)" or "RA LJFD (Backup)".
4. **Given** an unsaved card with no driver chosen, **When** the owner clicks Save assignment, **Then** the inline error "Choose a driver first" appears and nothing is saved.
5. **Given** two unsaved cards that both picked driver A, **When** the owner saves the first and then the second, **Then** the first saves, the second shows the inline error "Driver already assigned today", and its selection resets to empty.
6. **Given** a saved card, **When** it is shown, **Then** its dropdown, notes, and button are disabled, the button is replaced by an "Assigned" badge and a "Saved" label with a lock icon, the card has a muted background, and a 3-dot menu (labelled "Card options") offers "Edit assignment".
7. **Given** a saved card on a past date, **When** the owner picks Edit assignment for the first time in the session, **Then** a confirmation asks "You are editing an assignment from [date]. Continue?". Later past-date edits in the same session don't ask again.
8. **Given** any save or edit, **When** it completes, **Then** the header count and progress bar update immediately.
9. **Given** a 1200 px or wider screen, **When** the view loads, **Then** cards show 4 per row; on a tablet 2 per row; on a phone (360 px) 1 per row, with no horizontal scrolling. Long unit names and subheaders are cut with an ellipsis and show the full text in a tooltip.

---

### User Story 2 - Plan future days with pre-filled drivers (Priority: P1)

When the owner opens today or moves to a future date, each unsaved card suggests the driver that unit had most recently, marked "Pre-filled from previous day". The owner reviews, changes any that differ, and saves each card. Nothing is stored until Save assignment is clicked.

**Why this priority**: Most days repeat the previous day's pairings, so pre-fill makes planning a full fleet a few clicks instead of a dozen dropdowns.

**Independent Test**: Save driver A on unit 1 for today. Move to tomorrow: unit 1's dropdown shows driver A with the hint "Pre-filled from previous day", and the header still reads "0 of M units assigned". Leave the page and come back to tomorrow: still nothing saved. Click Save assignment: the card locks and the count becomes 1.

**Acceptance Scenarios**:

1. **Given** today or a future date and an unsaved card whose unit has an earlier saved assignment, **When** the date loads, **Then** the dropdown is pre-filled with the driver from that unit's latest saved assignment before the date, with the hint "Pre-filled from previous day".
2. **Given** a pre-filled driver who is already saved on another unit for that date, **When** the date loads, **Then** the dropdown is left empty and no hint is shown.
3. **Given** a past date (yesterday or earlier), **When** the date loads, **Then** unsaved cards start empty with no pre-fill.
4. **Given** a pre-filled card, **When** the owner leaves without saving, **Then** no assignment is stored and the progress count does not include it.
5. **Given** two cards whose pre-fills name the same driver, **When** the owner saves both, **Then** the first save wins and the second fails with "Driver already assigned today", as in User Story 1.

---

### User Story 3 - Record remittances under the day's assigned driver (Priority: P1)

On the Remittances Daily view, each unit card shows the driver assigned to that unit for the selected date, tagged "Primary" or "Backup" from the driver record. A unit with no assignment shows an "Assign driver" prompt that takes the owner straight to the Units page's Daily assignment view on that date. Saving a remittance stays blocked until a driver is assigned.

**Why this priority**: Remittances are the core daily money record. They must follow the new daily assignments from the first day of release.

**Independent Test**: Assign driver B (a backup driver) to unit 2 for today. Open Remittances, Daily view, today: unit 2's card shows driver B with a "Backup" tag and no "Covering for…" tooltip. Unit 3, unassigned, shows "Assign driver"; clicking it opens Units in Daily assignment view on today.

**Acceptance Scenarios**:

1. **Given** a unit with a saved assignment on the selected date, **When** the Remittances Daily view loads, **Then** the card shows that driver and a tag reading "Primary" or "Backup" from the driver record, with no day-off or coverage tooltip.
2. **Given** a unit with no assignment on the selected date, **When** the card loads, **Then** it shows the "Assign driver" prompt, which links to the Units page's Daily assignment view for the same date, and the remittance cannot be saved.
3. **Given** a remittance saved under driver A, **When** the Daily assignment view shows that unit and date, **Then** the assignment is locked with no "Edit assignment" option and the note "A remittance is already recorded for this day.", and the remittance shows driver A everywhere (card, List view, reports).

---

### User Story 4 - Block units that are in repair or retired (Priority: P2)

When a unit goes to the shop, the owner sets its status to **In repair** on the unit detail page. From that day until someone sets it back to **Active**, the unit appears as a grayed-out, blocked card in both daily views: it can't get a driver or a remittance, and it is left out of the progress counts and totals. Any driver assignments it had from today onward are released, so those drivers can take other units. Earlier days are untouched.

**Why this priority**: Repairs are frequent. Blocking stops the owner from planning a driver or expecting rental for a unit that isn't on the road, and releasing frees those drivers immediately.

**Independent Test**: Unit 4 has driver C saved for today and tomorrow. On unit 4's page, change status to In repair: a confirmation warns that its assignments from today onward will be released. Confirm. In Daily assignment view, today and tomorrow show unit 4 as a blocked "In repair" card with "Open unit", driver C appears in other units' dropdowns, and the count's total drops by one. Yesterday's view still shows unit 4's saved assignment, locked as usual.

**Acceptance Scenarios**:

1. **Given** a unit whose status on the selected date is In repair or Retired, **When** the Daily assignment view loads, **Then** the card is shown (not hidden) with a muted background, an "In repair" or "Retired" badge, a disabled dropdown, notes field, and Save button, and in place of the Save area the message "Unit is in repair. Change its status on the unit page to assign a driver." (or "…is retired…") with an "Open unit" link to the unit detail page.
2. **Given** a blocked card, **When** the header counts are shown, **Then** the unit is excluded from both N and M, and it receives no pre-fill.
3. **Given** a unit changed to In repair today, **When** the owner views any date before today, **Then** the unit's cards show their normal state for those dates, including any saved locked assignment or remittance.
4. **Given** a unit with saved assignments from today onward, **When** the owner changes its status to In repair or Retired, **Then** a confirmation reads "[Unit] has driver assignments from today onward. Changing the status will release them. Continue?". Cancel leaves the status and assignments unchanged. Continue changes the status, releases those assignments, and makes the drivers available at once.
5. **Given** a unit with no assignments from today onward, **When** the owner changes its status, **Then** no release confirmation is shown.
6. **Given** a unit set to In repair on Nov 1 and back to Active on Nov 5, **When** the owner views Nov 1 to Nov 4, **Then** the unit is blocked on those dates; from Nov 5 on it is assignable again. The released assignments are not restored.
7. **Given** the Remittances Daily view on a date when a unit is blocked and has no saved remittance, **When** it loads, **Then** the card is muted with a status badge and the message "Unit is in repair. No remittance for this date." (or "…retired…"), with no rental due, payment field, notes field, or Save button, and the unit is excluded from "N of M recorded" and the received total.
8. **Given** a remittance saved for a unit on a date that later became blocked, **When** the Remittances Daily view shows that date, **Then** the saved locked card is shown as usual and counted as before.

---

### User Story 5 - Archive and restore units instead of deleting them (Priority: P2)

From the list view's row menu, the owner archives a unit that has left the fleet. A confirmation shows what is tied to the unit (today's driver, assignment records, remittances, expenses, documents, audit history entries) and explains that nothing is deleted. Archived units disappear from the units list, daily assignments, and the Remittances Daily view, but their history stays in remittance records and reports. The owner can show archived units and restore one at any time.

**Why this priority**: The client must never lose a unit's financial history. Archiving replaces the risk of a permanent delete while keeping the daily views clean.

**Independent Test**: Archive a unit with remittances and a driver saved for today. Confirm the modal lists the counts, then confirm: a "Unit archived" toast shows, the row disappears, the unit is gone from both daily views, its driver is free for today, and its remittances still appear in Remittances List view and the monthly report. Tick "Show archived (1)", open the row menu, choose Restore: a "Unit restored" toast shows and the unit returns as an unassigned card.

**Acceptance Scenarios**:

1. **Given** a non-archived row, **When** the owner opens its 3-dot menu (labelled "Unit options"), **Then** it offers "More info" and "Archive", and no Delete option exists anywhere in the interface.
2. **Given** the owner chooses Archive, **When** the modal opens, **Then** it is titled "Archive [unit name]?", states that the unit will be hidden from the units list, daily assignments, and remittances, that no records are deleted, that reports keep the data, and that it can be restored anytime, and lists: driver assigned today (or "None"), assignment records, remittances, expenses, documents, and audit history entries, each with a count.
3. **Given** the archive modal, **When** it opens, **Then** "Cancel" has focus, focus stays inside the modal, Escape closes it without changes, and the "Archive unit" button is red.
4. **Given** the owner confirms, **When** archiving completes, **Then** the unit is marked archived, its assignments from today onward are released, the modal closes, the row leaves the default list, and a "Unit archived" toast shows.
5. **Given** "Show archived (N)" is ticked, **When** the list shows, **Then** archived rows are dimmed with an "Archived" tag and their menu offers "More info" and "Restore". Choosing Restore unhides the unit and shows a "Unit restored" toast.
6. **Given** an archived unit, **When** the owner opens Remittances List view or downloads any report covering its dates, **Then** its remittances and expenses are included exactly as before archiving.

---

### User Story 6 - Simplified units list with an Add a unit modal (Priority: P2)

The units list fills the page width. The toolbar has the search field, Filters button, and an **Add a unit** button that opens the add form in a modal. Each row shows the unit, body number, plate, motorcycle, today's driver (or "Unassigned"), mileage, and a read-only status badge.

**Why this priority**: It frees space and makes the list match the new model: drivers come from today's assignment and status is changed only on the unit's page.

**Independent Test**: Open Units, List view. No "Add a unit" side card exists. Click Add a unit, leave Plate number empty, and save: an inline error shows on Plate number. Fill it and save: the modal closes, the new row appears with "Unassigned", a "Unit added" toast shows, and the unit appears in Daily assignment view as an unassigned card.

**Acceptance Scenarios**:

1. **Given** List view, **When** it loads, **Then** the columns are, in order: Unit, Body number, Plate, Motorcycle, Current driver, Mileage, Status, and a menu column; Status is a badge, not a dropdown; and the record count is on the left with a "Show archived (N)" checkbox on the right, unticked by default.
2. **Given** a unit with a saved assignment for today, **When** List view loads, **Then** Current driver shows that driver; otherwise it shows "Unassigned".
3. **Given** the Add a unit modal, **When** the owner saves with a required field (Unit name, Body number, Plate number, Motorcycle) empty, **Then** each empty required field shows an inline error and nothing is saved.
4. **Given** the row menu on one of the last rows, **When** it opens, **Then** it opens upward so it is not cut off, and it can be opened, navigated, and closed with the keyboard.

---

### User Story 7 - Redesigned unit detail page (Priority: P3)

From "More info", the owner sees the unit's name, body number, plate and motorcycle in the header, a colored status dropdown at the top right, a compact Details grid with an inline "Edit details" mode, and read-only sections: monthly expenses vs allowance, status history, assignment history, and documents. The old driver forms are gone.

**Why this priority**: It's where status is now changed and where the owner reviews one unit's history. It depends on the daily assignments and status history above.

**Independent Test**: Open a unit's page. Mileage shows as a normal detail field, Current driver shows today's driver with role (or "No driver assigned today"). Click Edit details, change the plate, click Save details: the grid shows the new plate. No "Driver on a date", "Reassign primary driver", "End driver's assignment", or "Record day off" form exists.

**Acceptance Scenarios**:

1. **Given** the unit detail page, **When** it loads, **Then** it shows, top to bottom: a "Back to units" link, the eyebrow "Unit history", the unit name as title, the subtitle "Body [body] · [plate] · [motorcycle]", and a status dropdown (Active, In repair, Retired) at the top right, colored like the status badges.
2. **Given** the Details section, **When** it loads, **Then** a compact grid shows unit name, body number, plate number, motorcycle, mileage, and current driver at the same text size, plus an "Edit details" button and the "Maintenance and mileage" text link.
3. **Given** the owner clicks Edit details, **When** the grid switches to inputs, **Then** only unit name, body number, plate number, and motorcycle are editable, with "Save details" and "Cancel"; Cancel restores the shown values without saving.
4. **Given** the owner changes the status dropdown, **When** the change is saved, **Then** a Status history entry (from, to, who, when) is added, the new status applies from today, and the release rule and confirmation from User Story 4 apply when switching to In repair or Retired.
5. **Given** the sections below Details, **When** they load, **Then** they show: Monthly expenses vs allowance (one block per month with Allowance and Expenses bars, their amounts, and the Net), Status history, Assignment history (date, driver, role; newest first), and Documents (with the empty state "No documents for this unit yet. Upload them on the Documents page.").

---

### Edge Cases

- **Two people save the same driver at the same moment**: The database accepts only one; the other sees "Driver already assigned today" and the card resets.
- **Two people save the same unit for the first time at the same moment**: The first save wins. The second sees "This unit was just assigned by someone else. Reload to see it." and nothing is overwritten. Overwriting happens only through Edit assignment (FR-018).
- **Editing details of a unit that is In repair or Retired**: Only the unit name can change. Body number, plate number, and motorcycle wait until the unit is Active again (FR-040).
- **Saving over an existing assignment for the same unit and date** (Edit assignment): The record is overwritten, not duplicated, and the change is audited.
- **Editing an assignment for a date that already has a saved remittance**: Not allowed. The card stays locked with "A remittance is already recorded for this day.", so the assignment and the remittance always name the same driver. A unit set to In repair or archived later that day keeps that assignment.
- **Driver later deactivated or archived**: After a confirmation, their assignments from today onward are released (except any with a saved remittance), and the driver no longer appears in any dropdown or pre-fill. Past assignments stay as history (FR-029b).
- **Driver whose licence expires**: The driver isn't offered or pre-filled for dates after expiry. Assignments already saved for those dates stay, and the existing licence rule blocks recording a remittance under that driver, so the owner reassigns the unit.
- **Status set to In repair on a past date's view**: Status changes always take effect from today. They never change a past date's blocked state or records.
- **Unit created today with status In repair or Retired**: It is blocked from today, and its creation counts as its first status entry.
- **Dates before a unit was added**: The unit doesn't appear in either daily view and can't be assigned for those dates (FR-011a).
- **Release day**: Each available unit already shows its current driver as a saved, locked assignment, so the Remittances Daily view works as before that morning. Blocked or archived units, units without a current driver, and units whose primary is on a day off with no backup start unassigned. Future days get only the usual pre-fill.
- **Unit that was already In repair or Retired before release and has no history entry**: It is blocked from the release day forward only. Earlier dates are not blocked.
- **Blocked unit on a past date that already has a saved assignment**: The saved locked assignment is shown as usual, because only assignments from today onward are released.
- **Restoring an archived unit or returning a unit to Active**: Released assignments are not brought back; the unit starts unassigned on today and later dates.
- **Archived unit on a past date**: It is hidden from both daily views on every date. Its remittances still appear in Remittances List view and reports, so a past day's Daily view total can be lower than that day's List view total.
- **Archiving a unit that is In repair or Retired**: Allowed; it is hidden instead of grayed out. Restoring it brings back its status at that time.
- **No drivers available**: When every eligible driver is saved elsewhere for the date, an unsaved card's dropdown shows a "No available drivers" empty state and Save is disabled.
- **No units yet, or all archived**: Daily assignment view shows a plain empty state pointing to List view's Add a unit button, and the header reads "0 of 0 units assigned".
- **Calendar far from today**: Any date can be chosen; dates without data show unsaved (or blocked) cards as usual.
- **Business time zone**: "Today", the effective date of a status change, and every date comparison use the fleet time zone (Asia/Manila by default), so a change at 11:30 PM local time takes effect that local day.

## Requirements *(mandatory)*

### Functional Requirements

**Units page: view toggle**

- **FR-001**: The Units page header MUST show a segmented control at the top right reading "List view | Daily assignment view". Switching MUST NOT reload the page. List view is the default.
- **FR-002**: Daily assignment view MUST hide the search field and Filters button. Its date picker is its only filter.

**List view**

- **FR-003**: The "Add a unit" side card MUST be removed; the table MUST fill the content width.
- **FR-004**: The toolbar MUST show the search field, the Filters button, and a primary "Add a unit" button with a plus icon. Below the toolbar, the record count MUST be on the left and a "Show archived (N)" checkbox on the right, where N is the number of archived units. Archived units MUST be hidden unless the box is ticked.
- **FR-005**: The columns MUST be, in order: Unit, Body number, Plate, Motorcycle, Current driver, Mileage, Status, and a 3-dot menu column. Current driver MUST be the driver saved for the unit for today, or "Unassigned". Status MUST be a read-only badge.
- **FR-006**: "Add a unit" MUST open the add-unit form in a modal with fields Unit name*, Body number*, Plate number*, Motorcycle*, and Status. Empty required fields MUST show inline errors on save. A successful save MUST close the modal, add the row, and show a "Unit added" toast.
- **FR-007**: Each row MUST have a 3-dot menu labelled "Unit options". On non-archived rows it MUST offer "More info" (opens the unit detail page) and "Archive" (opens the archive confirmation). On archived rows, which MUST be dimmed with an "Archived" tag, it MUST offer "More info" and "Restore". The menu MUST be keyboard-accessible and MUST open upward when there isn't room below.
- **FR-008**: Deleting a unit MUST be removed from the interface entirely.

**Daily assignment view: date and layout**

- **FR-009**: The date picker MUST match the Remittances page: previous-day arrow, a date button that opens a calendar with month navigation, next-day arrow, and a "Today" button. It MUST open on today each time the view is opened, show the full date (for example "Sunday, November 1, 2026"), and show a "Today" tag for today or an "Upcoming" tag for a future date. Past and future dates MUST be allowed.
- **FR-010**: The header MUST show "N of M units assigned" and a thin progress bar, where M is the number of non-archived units not blocked on that date and N is how many of those have a saved assignment for it. Both MUST update after every save, edit, or release.
- **FR-011**: The view MUST show one card per non-archived unit that exists on the selected date (FR-011a), 4 per row at 1200 px and wider, 2 per row on tablets, and 1 per row on phones. Archived units MUST never appear.
- **FR-011a**: In both the Daily assignment view and the Remittances Daily view, a unit MUST appear only on dates on or after the date it was added (in the fleet time zone). On earlier dates it MUST be left out of the cards, counts, and totals, and assignments for those dates MUST be rejected. A unit with a remittance saved on an earlier date (recorded before this rule) MUST still show that saved card on that date.
- **FR-012**: Each card MUST show, top to bottom: the unit name as its title; a subheader in small secondary text "body number · plate · motorcycle"; an "Assign driver" dropdown; a Notes input; and a "Save assignment" button. The unit name and subheader MUST be truncated with an ellipsis when too long, with the full text in a tooltip. Cards MUST NOT have an In Repair toggle.

**Daily assignment view: driver choice and saving**

- **FR-013**: On any date, a unit MUST have at most one saved driver, and a driver MUST be saved on at most one unit. Both rules MUST be enforced by the database, not only by the dropdown, so simultaneous saves cannot double-book a driver or a unit.
- **FR-014**: A card's dropdown MUST list only drivers who are eligible to drive (active, not archived, licence valid on that date) and are not saved on another unit for the selected date. The driver saved on this card's own unit MUST remain listed for it. A driver MUST reappear in other dropdowns as soon as the assignment holding them is edited to someone else or released.
- **FR-015**: Each option MUST show the driver's name and role from the driver record, for example "RA SHAA (Primary)" or "RA LJFD (Backup)".
- **FR-016**: Availability MUST be based on saved assignments only. If a save fails because the driver was saved elsewhere first, the card MUST show "Driver already assigned today" and reset its selection.
- **FR-017**: Saving without a driver MUST show the inline error "Choose a driver first" and save nothing.
- **FR-018**: Saving MUST store one assignment for that unit and date with its driver and notes. Saving again for the same unit and date MUST overwrite it.
- **FR-019**: After saving, the card MUST lock: dropdown, notes, and button disabled, the button replaced by an "Assigned" badge and a "Saved" label with a lock icon, and a muted background. A 3-dot menu labelled "Card options" MUST appear only on saved cards, with "Edit assignment", which unlocks the card.
- **FR-019a**: Once a remittance is saved for a unit and date, that unit's assignment for that date MUST NOT be edited or released by anyone. Its card MUST show no "Card options" menu and the note "A remittance is already recorded for this day." The system MUST reject such edits even if attempted directly. If the remittance is later reversed, the assignment becomes editable again.
- **FR-020**: Editing an assignment on a past date MUST first ask "You are editing an assignment from [date]. Continue?", once per session.

**Daily assignment view: pre-fill**

- **FR-021**: On today or a future date (never a past date), each unsaved, non-blocked card MUST be pre-filled with the driver from that unit's latest saved assignment before the selected date, with the hint "Pre-filled from previous day". It MUST be left empty if that driver is saved on another unit for the selected date or is no longer eligible (FR-014).
- **FR-022**: A pre-fill MUST be only a suggestion the owner can change. It MUST NOT be stored or counted as assigned until Save assignment is clicked.

**Unit status over time and blocked units**

- **FR-023**: Every unit status change MUST be recorded with the unit, the previous status, the new status, who changed it, and when. Its effective date is the date of the change in the fleet time zone.
- **FR-024**: A unit's status on a date MUST be the new status of its latest change on or before that date; dates before its first recorded change use that change's previous status. For future dates, the current status applies.
- **FR-025**: For units that are In repair or Retired at release and have no matching recorded change, the status MUST be treated as starting on the release date. Earlier dates MUST NOT be blocked.
- **FR-026**: On a date when a non-archived unit's status is In repair or Retired, the Daily assignment view MUST show a blocked card (not hidden): muted background, an "In repair" or "Retired" badge, a disabled dropdown, notes field, and Save button, and in place of the Save area the message "Unit is [in repair / retired]. Change its status on the unit page to assign a driver." with an "Open unit" link to the unit detail page. Blocked cards MUST hold no driver, get no pre-fill, and be excluded from the progress count.
- **FR-027**: A saved assignment on a date before a unit became blocked MUST still be shown as a locked assignment on that date.
- **FR-028**: A unit MUST stay In repair or Retired until its status is set back to Active. From that day on it is assignable again; the days it was blocked stay blocked.

**Releasing assignments**

- **FR-029**: When a unit's status changes to In repair or Retired, or the unit is archived, all its saved assignments dated today or later MUST be released, making those drivers available immediately. Assignments dated before today, and any assignment whose unit and date already have a saved remittance (FR-019a), MUST stay unchanged and are shown locked and counted as assigned. Released assignments MUST be kept in the audit trail, not physically deleted.
- **FR-030**: If a unit has saved assignments dated today or later, a status change to In repair or Retired MUST first ask "[Unit] has driver assignments from today onward. Changing the status will release them. Continue?". Cancel MUST leave the status and assignments unchanged.
- **FR-029b**: When a driver is deactivated or archived, all their saved assignments dated today or later MUST be released under the same exceptions as FR-029, and those units become unassigned. If any exist, the action MUST first ask "[Driver] is assigned from today onward. Deactivating will release those units. Continue?" (or "Archiving…"). Cancel MUST leave the driver and assignments unchanged. Reactivating or restoring the driver MUST NOT bring the assignments back.
- **FR-031**: Released assignments MUST NOT be restored when the unit returns to Active or is restored from the archive.

**Archive**

- **FR-032**: Archiving MUST replace deleting a unit. It MUST mark the unit archived and record when, and MUST NOT remove or change any of its records (assignments before today, remittances, payments, expenses, mileage, parts, tires, documents, audit history).
- **FR-033**: "Archive" MUST open a modal titled "Archive [unit name]?" stating that the unit will be hidden from the units list, daily assignments, and remittances; that no records are deleted; that reports keep the data; and that the unit can be restored anytime. It MUST list, with counts: driver assigned today (name, or "None"), assignment records (active daily assignments; the retired primary and backup records aren't counted), remittances, expenses, documents, and audit history entries.
- **FR-034**: The modal MUST have "Cancel" (focused by default) and a red "Archive unit" button, keep focus inside while open, close on Escape, and be fully keyboard-operable.
- **FR-035**: On confirm, the system MUST archive the unit, apply FR-029, close the modal, remove the row from the default list, and show a "Unit archived" toast.
- **FR-036**: Archived units MUST be hidden from the Units list (unless "Show archived" is ticked), the Daily assignment view, and the Remittances Daily view. Their records MUST still appear in Remittances List view and in the Weekly, Monthly, and Yearly report exports, including the reports' unit choice, as before.
- **FR-037**: "Restore" MUST unhide the unit, keep its current status, and show a "Unit restored" toast.

**Unit detail page**

- **FR-038**: The header MUST show, in order: a "Back to units" link, the eyebrow "Unit history", the unit name as the title, and the subtitle "Body [body] · [plate] · [motorcycle]". A status dropdown (Active, In repair, Retired), colored like the status badges, MUST be at the top right. Changing it MUST follow FR-023, take effect from today, and apply FR-029 and FR-030.
- **FR-039**: A "Details" section MUST show a compact grid of unit name, body number, plate number, motorcycle, mileage, and current driver, all at the same size, plus the existing "Maintenance and mileage" link as a normal text link. Current driver MUST show today's assigned driver with role, or "No driver assigned today".
- **FR-040**: An "Edit details" button MUST switch unit name, body number, plate number, and motorcycle to inline inputs with "Save details" and "Cancel". Mileage, current driver, and status MUST NOT be editable there. Existing validation (required fields, unique body and plate numbers) MUST apply with inline errors. The existing lock MUST also apply: while the unit is In repair or Retired, body number, plate number, and motorcycle can't change. Saving such a change shows "This unit is [In repair / Retired]. Set the unit to Active before editing its details". The unit name stays editable.
- **FR-041**: Below Details, read-only sections MUST show: **Monthly expenses vs allowance** (one block per month, newest first, for each month within the last 12 calendar months, including the current one, that has remittances or expenses for the unit; months with neither are skipped, and an empty state shows when none qualify; each block has Allowance and Expenses bars, their amounts, and Net = Allowance − Expenses, where Allowance is the total stored allowance on the unit's active remittances that month and Expenses the total of the unit's active expenses that month); **Status history**; **Assignment history** (one row per saved daily assignment: date, driver, role; newest first); and **Documents** (the existing list, empty state "No documents for this unit yet. Upload them on the Documents page.").
- **FR-042**: The page MUST NOT show the large "Current mileage" heading, the "Driver on a date" lookup, the "Reassign primary driver" form, the "End driver's assignment" form, the "Record day off" form, the "Days off and backup coverage" list, or the right-side "Edit details" card.

**Remittances Daily view**

- **FR-043**: Each unit card MUST read its driver from the unit's saved assignment for the selected date and show a "Primary" or "Backup" tag from the driver record's role. The "Covering for [driver], day off" tooltip MUST be removed.
- **FR-044**: A unit with no assignment on the selected date MUST show the "Assign driver" prompt, linking to the Units page in Daily assignment view on that date. Saving a remittance MUST stay blocked until a driver is assigned.
- **FR-045**: A saved remittance MUST keep the driver it was saved under. Its unit's assignment for that date is locked (FR-019a), so the two always agree for remittances saved after release.
- **FR-046**: On a date when a unit is In repair or Retired (FR-024) and has no saved remittance, its card MUST be muted with a status badge, show "Unit is [in repair / retired]. No remittance for this date.", and show no rental due, payment field, notes field, or Save button. It MUST be excluded from "N of M recorded" and from the received total.
- **FR-047**: If a remittance already exists for a unit and date that is blocked, the saved locked card MUST be shown and counted as usual.
- **FR-048**: Archived units MUST be hidden from the Remittances Daily view on every date.

**Retired driver model**

- **FR-049**: Permanent primary-driver assignments, days off, and backup coverage MUST no longer be created anywhere in the app. Their existing records MUST be kept unchanged for history, and existing remittances linked to them MUST keep working in List view, details, and reports.
- **FR-050**: Everywhere the app shows a unit's current driver or a driver's current unit, it MUST use the saved daily assignment for today.
- **FR-051**: Each driver keeps their role (Primary or Backup) on the driver record. It is display-only in this feature and does not limit which units or dates they can be assigned to.
- **FR-052**: Releasing, archiving, blocking, restoring, and status changes MUST NOT change any saved remittance, payment, expense, or report figure.

**Go-live**

- **FR-053**: At release, the system MUST create one saved daily assignment for the release day for each non-archived unit that is not blocked that day, using the driver operating it under the old model on that day: the current primary driver, unless that driver has a recorded day off that day, in which case the backup covering it. A unit whose primary is off with no backup, a unit with no primary, and drivers who aren't eligible that day (FR-014) get no assignment. These copied assignments behave like any saved assignment (locked, editable, counted, used for pre-fill from the next day on). No assignments are created for days after the release day.

**General**

- **FR-054**: Every screen in this feature (both Units views, the modals, the unit detail page, and the Remittances Daily view) MUST work at a 360 px viewport with no horizontal page scrolling, and every message MUST use plain language with a recovery path.
- **FR-055**: Saving, editing, and releasing assignments, archiving, restoring, and status changes MUST be recorded in the audit history with who and when.

**Access**

- **FR-056**: The owner and staff MUST both be able to open the Daily assignment view and save and edit assignments on any date, under the same rules (FR-013 to FR-022). For staff, the Units page MUST open straight in Daily assignment view with no view toggle, and blocked cards MUST show the blocked message without the "Open unit" link.
- **FR-057**: List view, Add a unit, archive and restore, unit status changes, editing unit details, and the unit detail page MUST stay owner-only, and the system MUST reject these actions from staff even if they are attempted directly.

### Key Entities *(include if feature involves data)*

- **Unit assignment** (new): One driver on one unit for one date, with optional notes. At most one per unit per date and one per driver per date among active records. Only saved assignments exist; pre-fills are never stored. Released assignments are soft-deleted and stay in the audit trail. Quick to look up by date.
- **Unit** (existing): Gains an **archived** flag and the time it was archived. Keeps its status (Active, In repair, Retired), name, body number, plate number, motorcycle, and mileage. Its current driver is no longer stored on it; it comes from today's unit assignment.
- **Unit status change** (existing status history, made authoritative): Unit, previous status, new status, who changed it, and when. The effective date is the change's date in the fleet time zone. Determines whether the unit is blocked on any date.
- **Driver** (existing): Keeps its role (Primary or Backup), shown next to the name. Its current unit comes from today's unit assignment.
- **Remittance** (existing): Keeps the unit and driver it was saved under. Recording one for a unit and date requires that unit's saved assignment on that date, and the unit not being blocked.
- **Primary assignment, day off, backup coverage** (existing, retired): Kept read-only for history; no new ones are created.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can assign drivers to a 12-unit fleet for a day in under 3 minutes, and for a future day that repeats the previous pairings in under 1 minute using pre-fill.
- **SC-002**: Across any number of simultaneous saves, no date ever has one driver on two units or two drivers on one unit (0 violations in concurrent-save testing).
- **SC-003**: After a unit is set to In repair, Retired, or archived, 100% of its assignments dated today onward that have no saved remittance are released and those drivers can be chosen for other units within one refresh, while 100% of its earlier assignments and all its remittances are unchanged.
- **SC-004**: Weekly, Monthly, and Yearly reports and Remittances List view totals for a period are identical before and after archiving, blocking, releasing, or restoring any unit.
- **SC-005**: Blocked units never count toward "N of M units assigned", "N of M recorded", or the received total on dates they are blocked, and always count normally on earlier dates.
- **SC-006**: Switching between List view and Daily assignment view, and moving between dates, shows the new content in under 1 second on a typical connection, without a page reload.
- **SC-007**: Every screen in this feature works at a 360 px viewport with no horizontal page scrolling, and the archive modal and row and card menus can be operated with the keyboard alone.
- **SC-008**: On first review, the owner confirms the Units views and unit detail page match the mockup's layout, spacing, and interactions, except where this spec differs.

## Assumptions

- **Who can use it**: Owner and staff can both use the Daily assignment view (FR-056), so the Remittances "Assign driver" link works for both. Everything else on the Units page and the unit detail page stays owner-only (FR-057).
- **Mockup**: The interactive mockup is the visual reference for layout, spacing, and interaction. Its sample data and expense figures are placeholders, and it omits the Mileage column only for width.
- **Remittance requirement**: A remittance can be recorded only for a unit with a saved daily assignment on its date and only under that driver, replacing the old "assignment active on the service date" rule for new remittances. Remittances saved before release keep their existing links.
- **Driver eligibility**: The existing rules apply: a driver must be active, not archived, and have a licence valid on the date to be assigned. Role (Primary or Backup) does not restrict assignment.
- **Release scope**: "Today onward" means dates on or after today in the fleet time zone at the moment of the change, including future planned dates.
- **Status changes take effect from today**: The status dropdown cannot back-date a change. Status set at unit creation is that unit's first status entry.
- **Monthly expenses vs allowance**: Uses the stored per-remittance allowance from feature 009 and covers at most the last 12 calendar months (FR-041). Older months are in the Yearly report.
- **Driver detail page and dashboard**: Their existing history (primary assignments, days off, backup coverage) stays readable. Forms that create primary assignments, days off, or backup coverage are removed wherever they appear. "Current unit" and "current driver" figures come from today's daily assignment.
- **Archived units and new records**: Archived units aren't offered when adding new expenses, maintenance, parts, tires, mileage, or documents. Their existing records stay visible everywhere. To record something new for an archived unit, the owner restores it first.
- **Units already deleted**: Units soft-deleted before release stay hidden and are not shown as archived.
- **Filters**: List view keeps its existing search and status filters; "Show archived" is separate from them.
- **Schema change**: This feature changes the database (new unit assignment record with two uniqueness rules and a date index, archive fields on units, status-history-based blocking, and changed remittance rules). It's delivered through ordered migrations with database tests, as the constitution requires.

## Constitution Compliance

| Principle | How this spec complies |
|-----------|------------------------|
| I. Free-Tier Sustainability | No new service or paid dependency; everything runs in the existing app and database |
| II. Monolithic Simplicity | New view and rules live on the existing Units and Remittances pages; pre-fill is computed, not stored |
| III. Data Integrity and Auditability | Uniqueness of driver and unit per day is enforced by the database (FR-013). Archiving replaces deletion (FR-032), released assignments are soft-deleted and audited (FR-029, FR-055), and no money record changes (FR-045, FR-052). Status history is the source for blocking (FR-023, FR-024) |
| IV. Mobile-First, Human-Centered Operations | Cards stack to 1 per row at 360 px, menus and the modal are keyboard-accessible, and every error and blocked message says what to do next (FR-016, FR-017, FR-026, FR-054) |
| V. Compliance Document Lifecycle | Unit documents stay listed on the detail page and are kept when a unit is archived (FR-032, FR-041) |
