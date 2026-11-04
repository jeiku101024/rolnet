# Feature Specification: Drivers Page, Primary/Backup Role Switch, Dated Absences, and Stale Leave Flag

**Feature Branch**: `012-drivers-absences-roles`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Spec update per client (ROLNET): Drivers page enhancement. Hide the Add driver form behind an 'Add a driver' button, add a Primary / Backup switch to the driver profile, redesign the driver profile so key details are visible without long scrolling, add dated absences (Day-off for a single date, On-leave for a date range or open-ended) that remove the driver from assignment dropdowns on the dates they cover, and flag open-ended leaves that stay open too long." (The full description, with the list page, Add driver modal, profile redesign, role switch, status and absence rules, stale leave flag, cross-page effects, data model, and acceptance criteria, was supplied with the `/speckit-specify` command together with the interactive mockup `drivers_page_stale_leave_mockup.html`. The mockup is the visual source of truth for layout and interaction; where it differs from this spec, this spec wins. Its sample data is a placeholder and its Add driver fields are a guess. Each requirement below reflects the description.)

## Clarifications

### Session 2026-11-02

- Q: Who should be able to do each driver action? → A: Owner and staff switch Primary/Backup and manage absences (schedule, edit, cancel, end early, "Still on leave"). Adding a driver, editing details, and marking Inactive or reactivating stay owner-only (FR-050).
- Q: What if an absence is added for today after today's remittance is already recorded? → A: Not a real-world case. Absences are agreed in advance or by message before the shift, the absent driver drops out of the dropdowns, and the unit shows unassigned so the owner assigns someone else. No special flow; the system only refuses to release a locked assignment, as a plain safeguard (FR-044).
- Q: Which fields should the Add driver modal have? → A: The existing fields (full name, role, contact number, licence number and licence expiry required, address optional) plus Status (default Active) and Notes from the mockup (FR-010).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Schedule a day-off or leave and keep the driver out of assignment dropdowns (Priority: P1)

A driver tells the owner he is sick tomorrow, or going home to the province for a week, or leaving for an unknown length of time. The owner opens the driver's profile, picks Day-off or On-leave in the Status dropdown (or "Add absence" on the Absences tab), enters the date or date range (or ticks "No end date yet"), picks a reason, and saves. On the dates the absence covers, the driver no longer appears in any unit's Assign driver dropdown on the Units Daily assignment view. When the absence ends, he is Active again with no manual step.

**Why this priority**: Day-offs and leaves happen every week and today they can't be recorded at all since the old day-off records were retired with daily assignments (feature 010). Without them the owner can assign a driver who isn't coming, and the Drivers list can't say who is available.

**Independent Test**: With driver A Active and no assignments, open his profile and add an On-leave from tomorrow to 3 days later, reason Sick. On the Units Daily assignment view, A appears in dropdowns today, is missing tomorrow through the end date, and appears again the day after. The Drivers list shows A as Active today with "Next: On-leave [range]".

**Acceptance Scenarios**:

1. **Given** an Active driver's profile, **When** the user chooses Day-off in the Status dropdown, **Then** the "Add absence · [driver]" modal opens with Type set to Day-off; cancelling it leaves the status unchanged.
2. **Given** the Add absence modal with Type Day-off, **When** the user enters a date and a reason and saves, **Then** the absence is saved for that single date and a toast reads "[Driver] is on day-off Nov 5".
3. **Given** Type On-leave, **When** the user enters From and To and a reason and saves, **Then** the toast reads "[Driver] is on leave Nov 3 to Nov 10"; both the first and last day are covered.
4. **Given** Type On-leave, **When** the user ticks "No end date yet (open-ended)", **Then** the To field is cleared and disabled; saving shows "[Driver] is on leave from Nov 3 (no end date)", and the leave covers every date from its start until it is ended or given an end date.
5. **Given** Type On-leave with the box unticked, **When** To is empty or earlier than From, **Then** an inline error appears on To and nothing is saved. A missing Type, Date/From, or Reason likewise shows an inline error.
6. **Given** a leave from Nov 5 to Nov 9, **When** the Units Daily assignment view is opened on Nov 4, Nov 5 through Nov 9, and Nov 10, **Then** the driver is offered on Nov 4 and Nov 10 and not offered on Nov 5 through Nov 9.
7. **Given** a day-off on Nov 5, **When** Nov 6 arrives in the business timezone, **Then** the driver's status today is Active and he is offered in dropdowns, with no one having changed anything.
8. **Given** the driver already has an active absence Nov 5 to Nov 9, **When** the user tries to save another absence that touches any of those dates, **Then** an inline error reads "[Driver] is already on leave Nov 5 to Nov 9." and nothing is saved. An open-ended leave conflicts with any date on or after its start.
9. **Given** an Inactive driver, **When** the user chooses Day-off or On-leave in the Status dropdown, **Then** no modal opens and the toast "Inactive drivers cannot have absences" appears; the "Add absence" button on the Absences tab is disabled with a tooltip saying why.
10. **Given** the previous day's driver for a unit is absent on a future date, **When** that date is opened on the Units Daily assignment view, **Then** that unit's dropdown is not pre-filled with him.

---

### User Story 2 - Release saved assignments when an absence covers them (Priority: P1)

The owner had already planned the week on the Units Daily assignment view when a driver calls in sick for three days. Saving the leave shows which saved assignments it would release, and confirming releases them so those units show as unassigned and can be given to another driver.

**Why this priority**: Without this, an absent driver would stay saved on a unit and block the 1:1 rule, and the owner would have to find and clear each card by hand.

**Independent Test**: Save driver A on unit 1 for today and tomorrow. Add a Day-off for A tomorrow: a "Release assignments?" confirmation lists tomorrow and unit 1. Confirm: tomorrow's unit 1 card is unassigned, today's assignment is untouched.

**Acceptance Scenarios**:

1. **Given** an absence that covers today or future dates on which the driver has saved assignments, **When** the user saves it, **Then** a "Release assignments?" confirmation lists each date and unit and states that past records are not affected.
2. **Given** that confirmation, **When** the user confirms, **Then** the absence is saved and those assignments are released, so the units show as unassigned on those dates.
3. **Given** that confirmation, **When** the user chooses Cancel or Back, **Then** the user returns to the form with their entries kept and nothing is saved.
4. **Given** an absence being edited to cover more dates, **When** it is saved, **Then** the same check runs for the newly covered today-and-future dates only.
5. **Given** the owner marks a driver Inactive, **When** the driver has saved assignments today or later, **Then** the same confirmation lists them and confirming releases them. An assignment that already has a remittance is listed as "kept (remittance recorded)" and isn't released, as in feature 010.
6. **Given** the driver is absent on a date, **When** the Remittances daily view is opened for that date, **Then** his released unit shows as unassigned, prompting the owner to assign another available driver.

---

### User Story 3 - See who is available today from the Drivers list (Priority: P1)

The owner opens Drivers and sees a full-width table: each driver's name, role tag, today's unit, contact, and status today, with a second line for leave end dates or the next scheduled absence. Filters narrow by role and status today. "Available for assignment: N of M" tells them at a glance how many drivers they can put on units today.

**Why this priority**: This is the page the owner opens every morning. Status today and the next absence are what they plan assignments from.

**Independent Test**: With one Active assigned driver, one Active unassigned driver, one on day-off today, one on open-ended leave, and one Inactive, open Drivers: Current unit shows the unit name, "Unassigned", "—", "—", "—"; Status today shows Active, Active, Day-off, On-leave with "open-ended", Inactive; the availability line reads "Available for assignment: 1 of 5".

**Acceptance Scenarios**:

1. **Given** the Drivers page, **When** it loads, **Then** there is no Add driver form card, and the table fills the full content width with columns Driver, Role, Current unit, Contact, Status today.
2. **Given** the toolbar, **When** it is shown, **Then** it has a search field, a Filters button with a count badge of active filters, and an "Add a driver" primary button with a plus icon beside Filters, laid out as on the Units and Expenses pages.
3. **Given** the Filters panel, **When** the user filters by Role (Primary, Backup) and/or Status today (Active, Day-off, On-leave, Inactive), **Then** only matching drivers are listed and the badge shows the number of active filters; with no matches the table shows "No drivers match."
4. **Given** the Role column, **When** it is shown, **Then** Primary uses the blue tag and Backup the amber tag used on the Remittances page.
5. **Given** the Status today column, **When** it is shown, **Then** badges are Active (green), Day-off (blue, moon icon), On-leave (blue, calendar icon), Inactive (gray). On-leave adds a second line "until Nov 9" for a leave with an end date or "open-ended" for an open-ended leave (or the stale warning from User Story 6).
6. **Given** a driver with an upcoming absence, **When** the list is shown, **Then** a small second line reads "Next: Day-off Nov 3" or "Next: On-leave Nov 5–Nov 9" (the soonest one).
7. **Given** the line under the toolbar, **When** it is shown, **Then** the record count is on the left and "Available for assignment: N of M" with a "Preview dropdown" link is on the right.
8. **Given** "Preview dropdown", **When** the user opens it, **Then** a panel shows a date field (default today), the drivers the Assign driver dropdown would offer on that date with each one's role, and how many drivers are hidden on that date and why (on day-off or leave, inactive, already assigned to a unit, licence expired), plus a note that stale leave flags do not change availability. Changing the date updates the panel.
9. **Given** a driver's name, **When** the user clicks it, **Then** the driver profile opens.

---

### User Story 4 - Switch a driver between Primary and Backup (Priority: P2)

On the driver profile header, a "Primary | Backup" switch shows the driver's role. One click changes it, saves immediately, and shows a toast with Undo. Each change is logged in Role history, and past remittance records keep showing the role the driver had on their date.

**Why this priority**: Roles change as drivers prove themselves or step back, and the Remittances page shows the role tag. It is a label only, so it is lower risk than absences.

**Independent Test**: On a Primary driver's profile, click Backup: the toast "[Driver] marked as Backup" with Undo appears, Role history gains "Primary → Backup" with who and when, the Drivers list shows the Backup tag, and a remittance recorded for him yesterday still shows Primary. Click Undo within 5 seconds: the role is Primary again and the history entry is gone.

**Acceptance Scenarios**:

1. **Given** the profile header, **When** it is shown, **Then** a labelled two-option control "Primary | Backup" highlights the current role, is announced as a radio group named "Driver role", and supports arrow-key switching.
2. **Given** the switch, **When** the user picks the other role, **Then** the role saves immediately and a toast reads "[Driver] marked as Backup" (or Primary) with an "Undo" action available for 5 seconds.
3. **Given** the toast, **When** the user clicks Undo within 5 seconds, **Then** the role reverts and the Role history entry created by that switch no longer appears.
4. **Given** a role change, **When** it saves, **Then** no assignment is changed or released, and a Backup driver can still be assigned to any unit.
5. **Given** Role history, **When** it is shown, **Then** each entry has the date, the change (for example "Backup → Primary"), who made it, and the time, newest first.
6. **Given** a driver switched from Primary to Backup today, **When** a remittance from an earlier date is shown on the Remittances page or the profile's Remittances tab, **Then** it shows the role he had on that date (Primary); today's and later records show Backup.
7. **Given** the Units Daily assignment dropdowns, **When** they are shown, **Then** each driver is labelled with his current role, for example "RA SHAA (Primary)".

---

### User Story 5 - Read a driver's profile at a glance (Priority: P2)

The driver profile becomes a single column: header with role switch, status dropdown, and notices; a strip of four summary cards; a compact details grid with inline editing; and history tabs (Assignments, Remittances, Role history, Absences, and Documents for the owner) that each show 8 rows with Load more.

**Why this priority**: The old profile puts most details in a right-hand column and stacks long read-only lists, which forces long scrolling, especially on phones.

**Independent Test**: At 1440 × 900, open a driver with 30 assignments: the header, summary strip, and details are visible without scrolling; the Assignments tab shows 8 rows; Load more shows 16. At 360 px, the summary cards are two per row and the tabs scroll sideways with no page-level horizontal scroll.

**Acceptance Scenarios**:

1. **Given** the profile, **When** it loads, **Then** it shows "Back to drivers", the eyebrow "Driver profile", the driver's name as title, a subtitle with contact number and licence number, and at top right the role switch and a Status dropdown (Active, Day-off, On-leave, Inactive) showing his status today. There is no right-hand column.
2. **Given** the driver's state, **When** the profile loads, **Then** a notice below the header reads, as applicable: "Inactive: this driver has left. Hidden from assignment dropdowns. Past records stay visible."; "On day-off today. Returns tomorrow. Reason: [reason]."; "On leave Nov 3 to Nov 10. Returns Nov 11. Reason: [reason]."; or "On leave since Nov 1. No end date yet. Reason: [reason]." (with "Checked Nov 1. Flag returns Nov 8 if still open." after a "Still on leave" confirmation). An upcoming absence adds "Day-off scheduled Nov 5." or "Leave scheduled Nov 5 to Nov 9.", plus "+N more upcoming." when there are more.
3. **Given** the summary strip, **When** it is shown, **Then** four compact cards show Today's unit (unit name, "Unassigned", or "—" when absent or Inactive), Remittances (last 30 days) count, Balance owed (in the danger colour when above zero), and Next absence (date or range) or, if none is scheduled, Last assignment (date).
4. **Given** the details grid, **When** it is shown, **Then** it lists full name, contact number, licence number, licence expiry, address, role, status today, date joined, and notes.
5. **Given** "Edit details", **When** the owner clicks it, **Then** name, contact, licence number, licence expiry, address, and notes become inline inputs with "Save details" and "Cancel"; saving shows the toast "Details saved". Role and status change only through the header controls; date joined is read-only.
6. **Given** the history tabs, **When** the user moves between them by click or arrow keys, **Then** one tab panel is visible at a time; Assignments lists date, unit, and the role he had that day; Remittances lists date, unit, rental, paid, balance, and role that day, highlighting rows with a balance and showing "Owes ₱X"; Role history and Absences are as in User Stories 4 and 1; all newest first.
7. **Given** any tab with more than 8 rows, **When** it loads, **Then** it shows 8 rows and a "Load more" button that adds 8 at a time.
8. **Given** the old profile sections for primary assignments, days off, and backup coverage from before daily assignments, **When** the new profile loads, **Then** those sections are gone.

---

### User Story 6 - Catch open-ended leaves that have gone on too long (Priority: P2)

An open-ended leave can quietly keep a driver off the roster for weeks. After 14 days the Drivers list, a banner, the profile, and the Absences tab flag it in amber; after 30 days in red with a nudge to consider marking him Inactive. From the profile notice the owner can set an end date, end the leave now, or confirm "Still on leave", which hides the flag for 7 days.

**Why this priority**: It prevents silent drift, but it is informational and depends on open-ended leave (User Story 1) existing.

**Independent Test**: Create an open-ended leave that started 16 days ago. The Drivers list shows "Open for 16 days" in amber under On-leave, the banner reads "1 driver has been on open-ended leave for 14 days or more.", and the profile notice offers Set end date, End leave now, and Still on leave. Click Still on leave: the list shows "open-ended · checked", the banner disappears, and the profile reads "Checked Nov 2. Flag returns Nov 9 if still open."

**Acceptance Scenarios**:

1. **Given** an open-ended leave open 14 or more days (counted from its start date to today in the business timezone) and not snoozed, **When** the Drivers list is shown, **Then** under the On-leave badge "open-ended" is replaced by a warning line with a warning icon, "Open for N days", in amber; at 30 or more days it is red.
2. **Given** one or more such leaves, **When** the Drivers list is shown, **Then** a banner above the record count reads "N drivers have been on open-ended leave for 14 days or more." (singular for one), in red if any has reached the red level and amber otherwise, with "Show them" and a dismiss (X) button. Snoozed leaves are not counted.
3. **Given** the banner, **When** the user clicks "Show them", **Then** the list shows only those drivers and a "Showing stale leaves. Clear" link appears beside the count; Clear returns the full list.
4. **Given** the banner, **When** the user dismisses it, **Then** it stays hidden for the rest of the browser session and returns on the next visit while any unsnoozed stale leave exists.
5. **Given** a stale leave, **When** its driver's profile is shown, **Then** the notice reads "On leave since Oct 15. Open-ended for 17 days. Set an end date or end the leave." in amber, or at the red level "Open for N days. Consider marking Inactive if this driver is not returning." in red, with three actions.
6. **Given** "Set end date", **When** it is clicked, **Then** the Edit absence modal opens with open-ended unticked, To empty, and focus on To.
7. **Given** "End leave now", **When** it is clicked, **Then** the leave is ended early (same as End early), the driver is available for assignment today, and the toast reads "Leave ended. [Driver] is available for assignment".
8. **Given** "Still on leave", **When** it is clicked, **Then** the confirmation is logged with who and when, the flag is hidden for 7 days, and the toast reads "Marked as still on leave. Flag hidden for 7 days." (the number is the snooze setting); after the snooze period, if the leave is still open-ended, the flag returns at its current level.
9. **Given** the Absences tab, **When** a stale leave is shown, **Then** its status reads "Active now" with an "Open N days" tag in amber or red, and a leave confirmed with "Still on leave" shows "Checked [last date]" under the status.
10. **Given** any stale flag, **When** it is shown or snoozed, **Then** the driver's availability is unchanged, and the system never ends a leave on its own. The flag disappears as soon as the leave gets an end date, is ended, or is cancelled. Leaves with an end date are never flagged.

---

### User Story 7 - Manage absences from the Absences tab (Priority: P2)

The Absences tab lists every absence for the driver with its status, and lets the user edit or cancel upcoming ones and edit or end early the current one. Choosing Active in the Status dropdown while an absence covers today asks whether to end it now.

**Why this priority**: Plans change: a driver returns early, a trip is postponed, a day-off was entered on the wrong date.

**Independent Test**: Create an upcoming day-off and an active leave. On the Absences tab, the day-off shows Upcoming with Edit and Cancel; the leave shows Active now with Edit and End early. Choose Active in the Status dropdown: "Return [driver] to Active?" shows the leave dates, "Keep absence", "End absence now", and "Also cancel 1 upcoming absence". End now with the box ticked: the leave shows Ended early, the day-off shows Cancelled, and the driver is offered in today's dropdowns.

**Acceptance Scenarios**:

1. **Given** the Absences tab, **When** it is shown, **Then** columns are Type, Dates, Reason, Status, and row actions; Dates read "Nov 5", "Nov 5 to Nov 9", or "from Nov 1 (open-ended)"; the note shows as a tooltip; rows are newest start date first, 8 at a time with Load more; an "Add absence" button sits above the table.
2. **Given** an absence, **When** its status is computed, **Then** it is Upcoming (starts after today), Active now (covers today), Completed (its last covered date has passed), Cancelled, or Ended early.
3. **Given** an Upcoming absence, **When** the user picks Cancel and confirms, **Then** it shows Cancelled and no longer covers any date. **Given** Edit, **Then** the "Edit absence" modal opens with its values and saving applies the same validation, overlap, past-date, and release rules as adding.
4. **Given** an Active now absence, **When** the user picks End early, **Then** it stops covering today and later dates, shows Ended early, and the driver is available for assignment today.
5. **Given** Completed, Cancelled, or Ended early rows, **When** shown, **Then** they have no actions.
6. **Given** an Inactive driver, **When** the user chooses Active in the Status dropdown, **Then** he is reactivated with the toast "[Driver] is Active again".
7. **Given** an absence covering today, **When** the user chooses Active in the Status dropdown, **Then** "Return [driver] to Active?" shows the absence dates with "Keep absence" and "End absence now", plus "Also cancel N upcoming absences" when any are upcoming.

---

### User Story 8 - Add a driver from a modal (Priority: P3)

"Add a driver" opens an "Add driver" modal with the existing driver fields. Saving adds the row, closes the modal, and shows "Driver added". The new Active driver is immediately offered on the Units Daily assignment view.

**Why this priority**: Adding drivers is rare; moving the form into a modal mainly frees the list to use the full width.

**Independent Test**: Click "Add a driver", save with Full name empty: an inline error appears. Fill the required fields and save: the modal closes, the toast "Driver added" appears, the driver is in the table, and he is offered in today's Assign driver dropdowns.

**Acceptance Scenarios**:

1. **Given** the modal, **When** it opens, **Then** it is titled "Add driver" and has Full name*, Role* (Primary or Backup, default Primary), Status (Active or Inactive, default Active), Contact number*, Licence number*, Licence expiry*, Address, and Notes, plus a hint that Day-off and On-leave are scheduled from the driver profile.
2. **Given** missing required fields, **When** the user saves, **Then** each shows an inline error and nothing is saved.
3. **Given** the modal, **When** the user presses Escape or closes it, **Then** it closes and returns to the table; focus is trapped inside while open and the modal is fully keyboard-operable.

### Edge Cases

- **Absence entered after the fact**: a past start date is allowed. If assignments or remittances already exist on past dates in the range, an amber warning gives the counts ("Past dates selected. 3 assignments and 3 remittances already exist in this range. They will not be changed.") and the save button reads "Save anyway". Past assignments and remittances are never changed or deleted.
- **Absence entirely in the past**: it saves (after the warning if needed) and shows as Completed; it releases nothing.
- **Ending early an absence that starts today**: it then covers no dates at all, and it still shows Ended early.
- **Driver marked Inactive while he has absences**: his absences stay as recorded and can't be edited while he is Inactive; Inactive takes precedence for status today. If he is reactivated, any absence still in the future (or covering today) applies again.
- **Editing an Active now absence**: its end date (if set) cannot be moved before today; to stop it today, the user uses End early. Its start date may be moved earlier, with the past-date warning.
- **Overlap with ended-early or cancelled absences**: only dates an absence actually covers count. A cancelled absence, and dates after an absence was ended early, never conflict.
- **Two leaves back to back**: Nov 5 to Nov 9 and Nov 10 to Nov 12 do not overlap and are both allowed.
- **Driver with an expired licence**: still excluded from dropdowns as today; the preview panel counts him under "licence expired".
- **Role switch while the driver is on leave or Inactive**: allowed; it only changes the label.
- **Undo after 5 seconds or after leaving the page**: no longer available; the user switches the role back, which logs a new history entry.
- **Two role switches within 5 seconds**: Undo on the latest toast reverts only the latest change.
- **Stale threshold days crossed while the page is open**: the flag updates on the next page load; no live push.
- **Snooze period ends while the leave has an end date**: no flag returns, since leaves with an end date are never flagged.
- **Timezone**: "today", days open, and absence coverage use the fleet's business timezone (Asia/Manila), not the device clock.
- **Driver archived/soft-deleted**: absences and role history stay stored with the driver and are not shown anywhere new.
- **Search on the Drivers list** matches name, contact number, and licence number, combined with the filters.

## Requirements *(mandatory)*

### Functional Requirements

#### Drivers list page

- **FR-001**: The Drivers list MUST NOT show an inline Add driver form; the table MUST span the full content width.
- **FR-002**: The toolbar MUST have a search field, a Filters button with a badge counting active filters, and an "Add a driver" primary button with a plus icon beside Filters, matching the Units and Expenses toolbars.
- **FR-003**: Filters MUST include Role (Primary, Backup) and Status today (Active, Day-off, On-leave, Inactive), combinable with search.
- **FR-004**: The table MUST have columns Driver (linking to the profile), Role (Remittances page tags: Primary blue, Backup amber), Current unit, Contact, and Status today, and show "No drivers match." when nothing matches.
- **FR-005**: Current unit MUST show today's saved assignment's unit; "Unassigned" for drivers Active today with no saved assignment today; "—" for drivers absent or Inactive today.
- **FR-006**: Status today MUST show Active (green), Day-off (blue, moon icon), On-leave (blue, calendar icon), or Inactive (gray). On-leave MUST add a second line: "until [end date]", "open-ended", "open-ended · checked" (snoozed), or the stale warning (FR-052).
- **FR-007**: A driver with an upcoming absence MUST show a second line for the soonest one: "Next: Day-off [date]" or "Next: On-leave [start]–[end]" (or "Next: On-leave from [start]" when open-ended).
- **FR-008**: Below the toolbar the page MUST show the record count on the left and "Available for assignment: N of M" with a "Preview dropdown" link on the right, where N is the number of drivers available today (FR-040) and M is the number of drivers listed without filters.
- **FR-009**: "Preview dropdown" MUST open a panel with a date field (default today) that lists the drivers the Assign driver dropdown would offer on that date, each with his role, and the number hidden on that date grouped by reason: on day-off or leave, inactive, already assigned to a unit, licence expired. It MUST note that stale leave flags do not change availability.

#### Add driver modal

- **FR-010**: "Add a driver" MUST open a modal titled "Add driver" with Full name (required), Role (required; Primary or Backup; default Primary), Status (Active or Inactive; default Active), Contact number (required), Licence number (required), Licence expiry (required), Address (optional), and Notes (optional), and a hint that Day-off and On-leave are scheduled from the driver profile.
- **FR-011**: Saving with missing or invalid required fields MUST show inline errors and save nothing; a successful save MUST close the modal, add the row, and show the toast "Driver added".
- **FR-012**: The modal MUST be keyboard-accessible, close on Escape, and trap focus while open.
- **FR-013**: A newly added Active driver MUST be offered immediately in the Units Daily assignment dropdowns.

#### Driver profile

- **FR-014**: The profile MUST be a single main column with no right-hand column, in this order: header, notices, summary strip, details, history tabs.
- **FR-015**: The header MUST show "Back to drivers", the eyebrow "Driver profile", the driver's name as title, a subtitle with contact number and licence number, and at top right the role switch (FR-024) and a Status dropdown (Active, Day-off, On-leave, Inactive) showing the status today.
- **FR-016**: The profile MUST show notices below the header as listed in User Story 5 scenario 2 and User Story 6 scenario 5, including an upcoming-absence notice (in addition to any other) with "+N more upcoming." when more than one is upcoming.
- **FR-017**: The summary strip MUST show four compact cards: Today's unit (unit name, "Unassigned", or "—" when absent or Inactive), Remittances (last 30 days) count, Balance owed (total outstanding, in the danger colour when above zero), and Next absence (date or range) or, when none is scheduled, Last assignment (date, or "None").
- **FR-018**: The details grid MUST show full name, contact number, licence number, licence expiry, address, role, status today, date joined, and notes.
- **FR-019**: "Edit details" MUST turn name, contact number, licence number, licence expiry, address, and notes into inline inputs with "Save details" and "Cancel"; saving MUST validate as the Add driver modal does and show the toast "Details saved". Role and status MUST change only through the header controls; date joined MUST be read-only.
- **FR-020**: The profile MUST show history tabs, one visible at a time, built as an accessible tab list with arrow-key navigation: Assignments (date, unit, role that day), Remittances (date, unit, rental, paid, balance, role that day; rows with a balance highlighted with "Owes ₱X"), Role history (date, change, who, time), Absences (FR-046), and, for the owner, Documents (the driver's licence documents, as today). All newest first.
- **FR-021**: Each tab MUST show 8 rows and a "Load more" button that adds 8 rows at a time while more exist.
- **FR-022**: The profile MUST NOT show the old primary assignment, day-off, or backup coverage sections or forms from before daily assignments. The existing active/inactive status change history MUST remain available on the profile (for example within or beside the Role history tab).
- **FR-023**: At 1440 × 900 the header, summary strip, and details MUST be visible without scrolling. At 360 px the summary cards MUST stack two per row, the tabs MUST scroll horizontally, and the page MUST have no horizontal scrolling.

#### Primary / Backup role

- **FR-024**: The role switch MUST be a labelled two-option control "Primary | Backup" with the current role highlighted, exposed as a radio group named "Driver role", supporting arrow-key switching.
- **FR-025**: Switching MUST save immediately and show the toast "[Driver] marked as Backup" (or Primary) with an "Undo" action available for 5 seconds (the server accepts the undo a little longer to absorb network delay). Undo MUST revert the role and withdraw the history entry that switch created so it no longer appears in Role history; the withdrawal itself MUST stay in the audit log.
- **FR-026**: Every role change MUST be logged with driver, previous role, new role, who changed it, and when.
- **FR-027**: The role MUST be a label only: changing it MUST NOT change or release any assignment, and a Backup driver MUST be assignable to any unit.
- **FR-028**: The role a driver had on a date MUST be the new role of the latest logged change on or before that date; for a date before his first logged change, the previous role of that first change; with no logged changes, his current role.
- **FR-029**: The Remittances daily cards, the profile's Assignments and Remittances tabs, the unit detail page's assignment history, and any other record that shows a driver's role for a past date MUST show the role on that date (FR-028), so switching roles never rewrites old records.
- **FR-030**: Units Daily assignment dropdowns MUST label each driver with his current role, for example "RA SHAA (Primary)".

#### Statuses and absences

- **FR-031**: A driver's stored status MUST be only Active or Inactive. Day-off and On-leave MUST NOT be stored on the driver; they MUST be derived from absence records.
- **FR-032**: Status today MUST be derived: Inactive if the driver is Inactive; otherwise Day-off or On-leave if an absence covers today; otherwise Active. "Today" MUST be the current date in the fleet's business timezone.
- **FR-033**: An absence MUST have a type (Day-off or On-leave), a start date, an end date (equal to the start date for Day-off; empty for open-ended On-leave), a reason from the fixed list Sick, Vacation, Family emergency, Personal, Other, an optional note, and who created it and when.
- **FR-034**: An absence MUST cover a date when it is not cancelled, the date is on or after its start date, and the date is on or before the earlier of its end date and the day before it was ended early (no upper limit when it has no end date and was not ended early). Date ranges include both the first and last day.
- **FR-035**: The system MUST reject an absence for an Inactive driver; choosing Day-off or On-leave for an Inactive driver MUST show the toast "Inactive drivers cannot have absences" and open nothing.
- **FR-036**: The system MUST reject an absence whose covered dates overlap another absence's covered dates for the same driver, with an inline error naming the conflict, for example "[Driver] is already on leave Nov 5 to Nov 9." or "[Driver] is already on day-off Nov 5."; an open-ended leave covers every date from its start until ended.
- **FR-037**: Choosing Day-off or On-leave in the Status dropdown, or "Add absence" on the Absences tab, MUST open the same modal titled "Add absence · [driver]" ("Edit absence" when editing) with: Type (two-option control: Day-off, one date | On-leave, date range); Date for Day-off; From, To, and "No end date yet (open-ended)" for On-leave (ticking it clears and disables To; otherwise To is required and must be on or after From); Reason (required, fixed list); Note (optional). Cancelling MUST leave the status unchanged.
- **FR-038**: When any covered date is before today and assignments or remittances exist for the driver on those past dates, the modal MUST show an amber warning with the counts and change the save button to "Save anyway". Absences MUST NOT change, release, or hide any past assignment or remittance.
- **FR-039**: Saving MUST show the toast "[Driver] is on day-off [date]", "[Driver] is on leave [start] to [end]", or "[Driver] is on leave from [start] (no end date)".
- **FR-040**: A driver MUST be available for assignment on a date only if he is Active (not Inactive), no absence covers that date, his licence is valid on that date, and he is not already assigned to another unit on that date. Only available drivers MUST be offered in the Units Daily assignment dropdowns, and the system MUST reject saving an assignment for a driver who is absent on that date.
- **FR-041**: Pre-fill (today and future dates) on the Units Daily assignment view MUST leave the dropdown empty when the previous day's driver is not available on the selected date.

#### Releasing assignments

- **FR-042**: When an absence being added or edited newly covers today or future dates on which the driver has saved assignments, the system MUST show a "Release assignments?" confirmation listing each date and unit and stating that past records are not affected. Confirming MUST save the absence and release those assignments together (so the units become unassigned on those dates); Cancel or Back MUST return to the form without saving.
- **FR-043**: Marking a driver Inactive MUST apply the same confirmation and release his today-and-future saved assignments, except assignments that already have a remittance, which are kept and shown in the confirmation as "kept (remittance recorded)" (feature 010 FR-029b).
- **FR-044**: Safeguard only (not an expected workflow): assignments with a recorded remittance are locked (feature 010) and MUST NOT be released. If saving an absence would require releasing one, the absence save MUST be refused with a plain message naming the date and unit. (An Inactive change keeps the locked assignment instead, FR-043.)

#### Returning to Active and managing absences

- **FR-045**: Choosing Active for an Inactive driver MUST reactivate him with the toast "[Driver] is Active again". Choosing Active while an absence covers today MUST open "Return [driver] to Active?" with the absence dates and "Keep absence" and "End absence now" buttons, and, when he has upcoming absences, a checkbox "Also cancel N upcoming absences". "End absence now" MUST end the absence early so it no longer covers today or later and, if ticked, cancel the upcoming absences.
- **FR-046**: The Absences tab MUST list the driver's absences, newest start date first, 8 rows with Load more, with columns Type, Dates ("Nov 5", "Nov 5 to Nov 9", or "from Nov 1 (open-ended)"; note as tooltip), Reason, Status, and row actions, and an "Add absence" button above the table (disabled with an explanatory tooltip for Inactive drivers).
- **FR-047**: Absence status MUST be Upcoming, Active now, Completed, Cancelled, or Ended early. Upcoming rows MUST offer Edit and Cancel; Active now rows Edit and End early; the others MUST be read-only.
- **FR-048**: Editing MUST apply the same validation, overlap, past-date warning, and release rules as adding. For an Active now absence the end date MUST NOT be set before today.
- **FR-049**: Cancelling an absence and ending one early MUST keep the absence record (marked cancelled or ended early with who and when) rather than removing it. The system MUST NEVER end or cancel an absence on its own.
- **FR-050**: Owner and staff MUST both be able to switch roles and schedule, edit, cancel, end early, and confirm ("Still on leave") absences, including choosing Active in the Status dropdown while an absence covers today (which only ends the absence, FR-045). Adding a driver, editing driver details, marking a driver Inactive, and reactivating an Inactive driver MUST remain owner-only, as today; staff see Inactive (and, for an Inactive driver, Active) disabled with the tooltip "Only the owner can change this.", and no Add a driver or Edit details buttons.

#### Stale open-ended leave

- **FR-051**: Days open for an open-ended leave MUST be the number of days from its start date to today in the business timezone. It MUST be flagged amber when days open is at least the amber threshold (default 14) and red when at least the red threshold (default 30), unless snoozed. Leaves with an end date and open-ended leaves below the amber threshold MUST NOT be flagged.
- **FR-052**: The Drivers list MUST show a flagged leave's second line as a warning icon and "Open for N days" in amber or red instead of "open-ended".
- **FR-053**: When any unsnoozed flagged leaves exist, the Drivers list MUST show a banner above the record count: "N drivers have been on open-ended leave for [amber threshold] days or more." (singular for one), red if any is at the red level and amber otherwise, with a "Show them" button that filters the list to those drivers and shows "Showing stale leaves. Clear" beside the count, and a dismiss (X) that hides the banner for the current browser session only.
- **FR-054**: The profile notice for a flagged leave MUST read "On leave since [start]. Open-ended for N days. Set an end date or end the leave." (amber) or "Open for N days. Consider marking Inactive if this driver is not returning." (red), with "Set end date" (opens Edit absence with open-ended unticked, To empty, focus on To), "End leave now" (ends early; toast "Leave ended. [Driver] is available for assignment"), and "Still on leave".
- **FR-055**: "Still on leave" MUST log who confirmed and when, and hide the flag for that leave until the confirmation date plus the snooze period (default 7 days), with the toast "Marked as still on leave. Flag hidden for [snooze days] days." While snoozed, the list MUST show "open-ended · checked", the banner MUST NOT count the leave, and the profile notice MUST read "Checked [date]. Flag returns [date] if still open." After the snooze period, a still-open leave MUST be flagged again at its current level.
- **FR-056**: The Absences tab MUST show a flagged leave's status as "Active now" with an "Open N days" tag in amber or red, and any leave confirmed with "Still on leave" MUST show "Checked [last date]" under its status.
- **FR-057**: Stale flags MUST NOT change availability or end a leave. A flag MUST disappear as soon as the leave gets an end date, is ended early, or is cancelled. No email, SMS, or push notification is sent.
- **FR-058**: The amber threshold, red threshold, and snooze period MUST be fleet settings with defaults 14, 30, and 7 days, not fixed values; the red threshold MUST be greater than the amber threshold and all three MUST be positive.

#### Cross-page and data rules

- **FR-059**: Absences and role changes MUST NOT change or hide past assignments and remittances; past records MUST stay visible for drivers in any status.
- **FR-060**: Driver names MUST keep linking to the driver profile wherever they already do.
- **FR-061**: Absences, absence confirmations, and role history MUST carry creation and update timestamps and actor IDs, MUST be soft-deleted only, and every create, edit, cancel, end-early, confirm, role change, undo, and release MUST be recorded in the audit log.
- **FR-062**: No historical role entries MUST be created for existing drivers; each existing driver's current role applies to all past dates until his first logged change.
- **FR-063**: Every screen and modal in this feature MUST work at a 360 px viewport with no horizontal page scrolling.
- **FR-064**: The dashboard's list of available backup drivers MUST leave out backup drivers who are absent today, using the same availability rule as FR-040.

### Key Entities

- **Driver**: an existing person record. Keeps role (Primary or Backup), stored status (Active or Inactive only), licence, contact, address, and gains optional notes. Date joined is when the record was created.
- **Role change**: one logged switch of a driver's role: driver, previous role, new role, who changed it, when. Used to answer "what role did he have on this date?". An undone change is withdrawn but kept for audit.
- **Driver absence**: a scheduled absence for one driver: type (Day-off or On-leave), start date, end date (same as start for Day-off, empty for open-ended leave), reason (fixed list), note, who created it and when, when and by whom it was cancelled or ended early, and the date until which its stale flag is snoozed. Effective coverage follows FR-034. Covered dates of a driver's absences never overlap.
- **Leave confirmation**: one "Still on leave" click on an absence: who confirmed and when. Each one sets that absence's snooze-until date in the same save.
- **Fleet settings**: gain the stale leave amber threshold (14), red threshold (30), and snooze period (7), in days.
- **Unit assignment** (existing, feature 010): one driver on one unit for one date. Released assignments become unassigned; availability rules now also exclude absent drivers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can record a day-off or a leave for a driver in under 30 seconds from the driver profile, including choosing the reason.
- **SC-002**: On every date tested, 100% of drivers covered by an absence, Inactive, holding an expired licence, or already assigned are absent from the Assign driver dropdowns, and 100% of other Active drivers are present.
- **SC-003**: Once an absence's last covered date passes, the driver shows Active and is offered for assignment the next day with zero manual steps.
- **SC-004**: Zero past assignments or remittances are changed, released, or hidden by any absence, role change, or stale flag action.
- **SC-005**: After any role switch, 100% of records dated before the switch still show the role the driver had on their date.
- **SC-006**: At 1440 × 900 the profile's header, summary strip, and details are fully visible without scrolling; at 360 px no screen in the feature scrolls horizontally.
- **SC-007**: No history tab renders more than 8 rows until the user asks for more.
- **SC-008**: Every open-ended leave reaching the amber threshold is flagged on the list, the banner, the profile, and the Absences tab on the first page load that day, and no leave with an end date is ever flagged.
- **SC-009**: The owner can tell from the Drivers list alone, without opening any profile, who is available today, who is absent and until when, and who has an absence coming up.

## Assumptions

- **Add driver fields** (confirmed in Clarifications): phone is labelled "Contact number"; licence number and expiry stay required because assignment depends on a valid licence.
- **Permissions** (confirmed in Clarifications): staff already see the Drivers list and profiles; the split of actions is in FR-050.
- **No stored Day-off status exists**: the current driver record stores only active/inactive, so no status conversion is needed.
- **Old day-off and backup coverage records** (from before daily assignments) stay stored but are no longer shown on the profile, as the client asked to remove those lists.
- **Release means the existing feature 010 release** (the assignment is retired, not physically deleted, and the unit shows as unassigned).
- **Absences are agreed before the shift** (in person, by text, or by Messenger), so an absence normally never meets a day that already has a remittance.
- **Remittances (last 30 days)** is a rolling 30 days ending today, as the client suggested to avoid a near-empty figure early in the month.
- **Balance owed** is the driver's total outstanding remittance balance, already computed for the dashboard.
- **Stale thresholds** are stored as fleet settings with their defaults; there is no fleet settings screen today, so changing them in the app is out of scope.
- **Business timezone** is the fleet setting already used elsewhere (Asia/Manila).
- **Preview dropdown** is included; the client marked it as optional and droppable.
- **Out of scope**: recurring day-offs, absence reports, notifications, automatic ending of leaves, and role-based restrictions on which units a driver may take.
- **Dependencies**: feature 010 (daily unit assignments, 1:1 rule, release, remittance lock, pre-fill) and the Remittances daily cards' role tags (feature 008/010).

## Constitution Compliance

| Principle | How this spec complies |
|-----------|------------------------|
| I. Free-Tier Sustainability | No new service or paid dependency; absences, role history, and the stale flag run in the existing app and database. No notifications are sent (FR-057) |
| II. Monolithic Simplicity | Status today, absence status, the stale level, and the role on a date are derived, not stored (FR-031, FR-032, FR-028). Nothing runs on a schedule; absences end by date and leaves are never ended automatically (FR-049) |
| III. Data Integrity and Auditability | Overlapping absences are refused (FR-036). Cancel, end early, and Undo keep the records (FR-025, FR-049). Every change is audited with actor and time (FR-026, FR-061). Releases touch only today-and-later assignments, locked assignments are never released, and past assignments and remittances never change (FR-038, FR-042–FR-044, FR-059). No money values change |
| IV. Mobile-First, Human-Centered Operations | Every screen and modal works at 360 px (FR-023, FR-063). The modals, radio group, and tabs are keyboard-accessible (FR-012, FR-020, FR-024). Every refusal names the conflict and what to do next (FR-035, FR-036, FR-044) |
| V. Compliance Document Lifecycle | Driver licence documents stay on the profile in an owner-only Documents tab (FR-020), and a valid licence is still required for assignment (FR-040) |
