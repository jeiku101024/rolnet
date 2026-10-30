# Feature Specification: Remittances Daily View

**Feature Branch**: `008-remittances-daily-view`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Update the Remittances page. Remittance records in the database must not change (same schema, same data). This is a UI change only. Add a 'Daily view' toggle to the Remittances page. Daily view is where all remittance recording and correcting happens, one card per unit for a selected date (today by default). List view becomes a read-only history of all records." (Full description, including the view toggle, date picker, historical drivers, card layout, save-and-lock behavior, edge cases, read-only List view, search-field contrast fix, and acceptance criteria, was supplied with the `/speckit-specify` command and is reflected requirement by requirement below.)

## Clarifications

### Session 2026-10-30

- Q: Can Edit remittance change a saved record's disposition, given that the database locks it and the schema must not change? → A: No. The disposition stays locked in Edit for everyone, and owners fix a wrong disposition by reversing the record on its details page (FR-026).
- Q: Can Edit remittance lower a recorded payment, given that only owners can void payments? → A: Owners only. They give a reason, the earlier payments are voided, and the new total is recorded. Staff can only raise the amount (FR-027).
- Q: Should a unit that didn't run on the selected date (in repair today, or primary driver off with no backup) still count in "N of M recorded"? → A: No. It shows as a muted "Not operating" card that is left out of the count and the progress bar. Owners keep the "Assign driver" prompt on no-driver cards (FR-008, FR-014).
- Q: Which view should Remittances open in when someone goes to the page? → A: Daily view on today, for owners and staff alike (FR-001a).
- Q: When an owner presses "Assign driver", do they pick the backup right on the card or go to the unit's page? → A: On the card, from a picker listing the drivers free that day. The card becomes recordable right away (FR-014b).
- Q: When a payment is entered on a past date's card, which date counts as the day the money was received? → A: The card's selected date, so the money counts on the day the boundary was owed (FR-020a).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record today's remittances unit by unit (Priority: P1)

At the end of the day, staff (or the owner) open Remittances, switch to **Daily view**, and see one card per scheduled unit for today. Each card shows the unit, the driver who operated it today with a **Primary** or **Backup** tag, and the amount due. They choose the disposition, type the payment received and an optional note, and press **Save remittance**. The card locks, shows whether the driver paid, owes, or has credit, and the header count moves forward ("5 of 9 recorded").

**Why this priority**: Recording the day's remittances is the main daily job on this page. Today it means picking a driver/unit pair from a long dropdown, one entry at a time. Cards remove that step, show at a glance which units are still missing, and on their own already make a usable MVP.

**Independent Test**: With three units scheduled today, open Daily view, save a ₱180 payment on a Returned card, ₱250 on an Overnight / overtime card, and ₱200 on a Returned card. Confirm the badges read "Paid", "Owes ₱50.00", and "Credit ₱20.00", that all three cards are locked and muted, and that the header reads "3 of 3 recorded" and "₱630.00 received".

**Acceptance Scenarios**:

1. **Given** any signed-in user opens Remittances without a view or date in the page address, **When** the page loads, **Then** Daily view opens on today.
2. **Given** the user is on Remittances in List view, **When** they pick **Daily view** in the "List view | Daily view" control, **Then** the page shows today's cards without a full page reload, and the search, Filters, and Sort controls are hidden.
3. **Given** Daily view is open on today, **When** the cards load, **Then** there is exactly one card per scheduled unit. Each card shows, top to bottom: the unit name, the driver name with its Primary/Backup tag, the amount due (the largest figure on the card), a disposition dropdown set to "Returned", a Payment received (₱) field, a Notes field, and a **Save remittance** button.
4. **Given** a card shows "Returned" and a due of ₱180.00, **When** the user changes the disposition to "Overnight / overtime", **Then** the due shows ₱300.00 at once, before anything is saved.
5. **Given** a filled-in card, **When** the user presses **Save remittance** and the save succeeds, **Then** the disposition, payment, and notes fields are disabled, the button is replaced by a result badge and a "Saved" label with a lock icon, the card background becomes muted, a 3-dot "Card options" menu appears in the card's top-right corner, and the header count and received total update.
6. **Given** a card is saved with a payment equal to, below, or above the due, **When** it locks, **Then** the badge reads "Paid", "Owes ₱X" (X = due − payment), or "Credit ₱X" (X = payment − due) respectively.
7. **Given** the primary driver of a unit has a day off today and a backup driver is assigned, **When** the card loads, **Then** it shows the backup driver with a "Backup" tag, and hovering over or focusing the tag shows "Covering for [primary driver's name], day off."
8. **Given** the primary driver of a unit is off today and no backup is assigned, **When** the card loads, **Then** the card is muted and marked "Not operating", an "Assign driver" prompt replaces the driver tag, the card cannot be saved until a driver is assigned, and the card is left out of the header count and progress bar.
9. **Given** a unit with a primary assignment is currently in repair, **When** today's cards load, **Then** its card is muted and marked "Not operating (in repair)", has no editable fields, and is left out of the header count and progress bar.
10. **Given** a save fails (for example, the connection drops or someone else already recorded that unit for the date), **When** the error returns, **Then** the card stays unlocked with the user's entries kept and shows a plain-language message explaining how to recover.

---

### User Story 2 - Correct a saved remittance (Priority: P2)

A driver comes back with the rest of the boundary, or a note was typed wrong. The user opens the saved card's 3-dot menu, chooses **Edit remittance**, makes the change, and saves again. The card relocks with an updated badge, and the header totals update.

**Why this priority**: Corrections happen often (partial payments are settled later), and the user asked for Daily view to be the only place where they happen. It relies on User Story 1's save-and-lock card.

**Independent Test**: Save a Returned card with ₱100 (badge "Owes ₱80.00"). Choose **Edit remittance**, change the payment to ₱180, and save. Confirm the badge reads "Paid" and the received total rises by ₱80.00.

**Acceptance Scenarios**:

1. **Given** a card is locked, **When** the user opens "Card options" and picks **Edit remittance**, **Then** the payment and notes fields unlock with the saved values filled in, the disposition stays locked, and the **Save remittance** button returns.
2. **Given** an unlocked saved card, **When** the user saves again, **Then** the card relocks, the badge reflects the new values, and the header count and received total update.
3. **Given** a card is not yet saved, **When** the user looks at its top-right corner, **Then** there is no 3-dot menu.
4. **Given** the user is viewing a past date (for example, Oct 28), **When** they pick **Edit remittance** for the first time in this session, **Then** a small confirmation asks "You're editing a record from Oct 28. Continue?". Cancelling keeps the card locked; continuing unlocks it, and later past-date edits in the same session do not ask again.
5. **Given** a saved card is being edited, **When** the user looks at the disposition dropdown, **Then** it stays disabled with the hint "Disposition can't be changed after saving." For owners the hint adds that they can reverse the record from its details page and record it again.
6. **Given** an owner is editing a saved card that has ₱180.00 received, **When** they change the payment to ₱100 and save, **Then** they are asked for a reason. On confirming, the earlier payments are voided with that reason, a ₱100.00 payment is recorded, the badge reads "Owes ₱80.00", and the received total drops by ₱80.00.
7. **Given** a staff member is editing a saved card that has ₱180.00 received, **When** they enter ₱100, **Then** saving is blocked with a message that only the owner can lower a recorded payment. Raising it to ₱200 records an extra ₱20.00 payment.

---

### User Story 3 - Review and fill in a past date (Priority: P2)

The owner notices that Wednesday's numbers look short. They use the date control to go back to Wednesday and see which units were recorded (locked cards) and which were missed (unlocked cards they can still fill in). Every card shows the driver who was actually assigned on Wednesday, not today's driver.

**Why this priority**: Missed days must be caught and fixed, and historical drivers keep balances correct. It reuses the cards from User Story 1 with a different date.

**Independent Test**: Reassign a unit's primary driver today. Then open Daily view on a date before the change and confirm that the unit's card shows the earlier driver, that a record already saved on that date shows the driver it was saved under, and that an unrecorded unit on that date can be saved.

**Acceptance Scenarios**:

1. **Given** Daily view opens, **When** it loads, **Then** today's date is selected and shown in full (for example, "Friday, October 30, 2026") with a small "Today" label next to it.
2. **Given** today is selected, **When** the user looks at the date control, **Then** the "Next day" arrow is disabled. Pressing "Previous day" shows yesterday's cards, header count, and received total.
3. **Given** the user opens the calendar from the date button, **When** they move to previous or next months and pick a day, **Then** that day's cards load. Days after today cannot be selected.
4. **Given** a past date is selected, **When** the user presses **Today**, **Then** today's cards load.
5. **Given** a past date has some records, **When** its cards load, **Then** units with a record appear as locked saved cards, and units without one appear as unlocked cards that can be filled in and saved.
6. **Given** a record was saved under driver A and the unit's schedule was later changed so that driver B covers that date, **When** that date is shown, **Then** the saved card still shows driver A and the tag it was saved under.
7. **Given** a unit's primary assignment started after the selected date, **When** that date is shown, **Then** the card shows the driver assigned to it on that date, or the unit does not appear if it had no assignment then.
8. **Given** a date with no scheduled units and no records, **When** it is selected, **Then** the page shows "No units scheduled for this date."

---

### User Story 4 - Browse the read-only remittance history (Priority: P3)

The owner uses **List view** to scan or search every remittance, newest first, in a full-width table. Nothing in the table can be edited. A note under the record count explains that recording and corrections happen in Daily view, and each row's date takes them straight to that day in Daily view.

**Why this priority**: Moving all entry into Daily view leaves List view as a clean history. It changes the existing page rather than adding value of its own, so it follows the stories above.

**Independent Test**: Open Remittances in List view and confirm there is no "Record daily remittance" panel, that the table fills the content width, that rows have no pointer cursor or edit action, that the note sits under the record count, and that pressing "Daily view" in the note, or a row's date, opens Daily view (on that row's date for the date link).

**Acceptance Scenarios**:

1. **Given** the user opens Remittances in List view, **When** the page loads, **Then** there is no recording form, heading, or helper text from the old side panel, and the table spans the full content width.
2. **Given** the List view table, **When** the user hovers over a row, **Then** it may highlight subtly, but the cursor stays the default and no row opens an editor, drawer, or modal. There is no "Add" button.
3. **Given** List view, **When** it loads, **Then** the records are sorted newest to oldest by default, and search, the date filter, Filters, and Sort still work as before.
4. **Given** List view, **When** the user reads under the record count, **Then** secondary text says "Turn on Daily view to record or correct each unit's remittance. List view shows all records, newest to oldest.", and "Daily view" in it is a link that switches views.
5. **Given** a row dated 2026-10-28, **When** the user activates that date, **Then** Daily view opens with Wednesday, October 28, 2026 selected.
6. **Given** List view, **When** the user looks for "Open an entry to add a payment or edit notes", **Then** that text is gone.

---

### User Story 5 - Read the search field easily (Priority: P3)

Anyone using List view can read the search placeholder, tell typed text apart from it, and see where keyboard focus is.

**Why this priority**: It is an accessibility fix with small scope and no dependency on the other stories.

**Independent Test**: Measure the placeholder color against the field background with a contrast checker (at least 4.5:1), type into the field and confirm the typed text is visibly darker, and tab into the field to confirm a visible focus ring.

**Acceptance Scenarios**:

1. **Given** an empty search field, **When** the user looks at it, **Then** the placeholder reads "Search by driver or unit" in a solid (not semi-transparent) color with a contrast ratio of at least 4.5:1 against the field background.
2. **Given** the user types in the search field, **When** text appears, **Then** it is clearly darker than the placeholder.
3. **Given** the user tabs to the search field, **When** it receives focus, **Then** a visible focus ring appears.
4. **Given** the Any date, Filters, and Sort controls, **When** they are measured, **Then** their text has at least 4.5:1 contrast and their icons and borders at least 3:1.

---

### Edge Cases

- **Midnight rollover while viewing today**: The selected date does not change on its own. A banner says "It's now a new day. Switch to today?" with a button. If any card has unsaved edits, switching first warns the user that those edits will be lost and lets them stay.
- **Unsaved edits when leaving a date or view**: Changing the date, switching to List view, or leaving the page while a card has unsaved changes asks for confirmation first. Unsaved edits are never dropped silently.
- **Unit with no driver on the date**: The card is muted and marked "Not operating". An "Assign driver" prompt replaces the tag, saving is blocked, and the card is left out of the count. Owners can assign a backup from the card's picker without leaving the page. Once one is assigned, the card becomes a normal unrecorded card and joins the count. Staff, who cannot assign drivers, are told to ask the owner.
- **Unit in repair today**: The card is muted, marked "Not operating (in repair)", and left out of the count. Past dates ignore repair status, because only the current status is stored.
- **Every card not operating**: The header reads "0 of 0 recorded", and the progress bar is empty rather than showing an error.
- **Two people record the same unit and date**: The second save is rejected, the card keeps that user's entries, the message explains that the unit was already recorded, and the card offers to reload and show the saved record.
- **Record changed by someone else while being edited**: Saving tells the user the record changed and offers to reload it, instead of overwriting the other person's change.
- **Saved record whose driver is no longer assigned**: The card still shows the saved driver and tag, taken from the record itself.
- **Long unit or driver names at 4 cards per row**: The unit name is cut off with an ellipsis and its full text appears in a tooltip. The tag stays on the driver's line and wraps only when it does not fit.
- **Empty payment on first save**: The record is saved with ₱0.00 received and the badge reads "Owes ₱180.00" (or "Owes ₱300.00").
- **Payment entered late for a past date**: A payment entered on Nov 2 from Oct 31's card is dated Oct 31 and counts in October's totals. Payments recorded before this feature, or on the record's details page, keep their own dates.
- **Invalid payment text** (letters, negative numbers, more than two decimals): The save is blocked with a message next to the field explaining the accepted format.
- **Date in the page address set to a future date or an invalid value**: Daily view falls back to today.
- **Very small screens (360 px)**: Cards stack one per row, and the date control and header fit without horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

**View toggle**

- **FR-001**: The Remittances page MUST show a segmented control at the top labelled "List view | Daily view" that switches views without a full page reload.
- **FR-001a**: Opening Remittances without a view in the page address MUST show Daily view on today, for every role. List view is reached through the toggle.
- **FR-002**: The selected view and Daily view's selected date MUST be kept in the page address, so reloading, bookmarking, and the browser's Back button return the user to the same view and date.

**Daily view: date control and header**

- **FR-003**: Daily view MUST show a date control made of a "Previous day" arrow, a date button that opens a calendar, a "Next day" arrow, and a **Today** button, with "Previous day" and "Next day" as the arrows' accessible names.
- **FR-004**: Every time the user switches into Daily view from the toggle, it MUST open on today's date in the fleet's time zone, except when opened from a List view row date (FR-039).
- **FR-005**: The date button MUST show the full date (for example, "Friday, October 30, 2026") and, when the date is today, a small "Today" label next to it.
- **FR-006**: Dates after today MUST NOT be selectable. The "Next day" arrow MUST be disabled when today is selected.
- **FR-007**: The calendar MUST let the user move to previous and next months and pick any day up to and including today.
- **FR-008**: The header MUST show the selected date's progress as "N of M recorded" (M = number of cards that are not "Not operating", N = number of saved cards), the total payment received for remittances of that date, and a thin progress bar showing N/M.
- **FR-009**: Daily view MUST NOT show search, Filters, or Sort. The selected date is its only filter.

**Daily view: which units and drivers appear**

- **FR-010**: Daily view MUST show exactly one card per unit that, on the selected date, either had a primary driver assignment in effect or has a saved remittance. When today is selected, a retired unit gets no card unless it already has a saved remittance for today.
- **FR-011**: For a unit without a saved remittance on the selected date, the card MUST show the driver assigned to that unit on that date: the backup driver with a "Backup" tag when a backup covers that date, otherwise the primary driver with a "Primary" tag. The current assignment MUST NOT be used for past dates.
- **FR-012**: When a backup driver is shown because the primary has a day off, the "Backup" tag MUST show a tooltip "Covering for [primary driver's name], day off." that keyboard focus can also reach.
- **FR-013**: For a unit with a saved remittance on the selected date, the card MUST show the driver and Primary/Backup tag the record was saved under, even if the schedule for that date changed afterwards.
- **FR-014**: When a unit's primary driver has a day off on the selected date and no backup is assigned, the card MUST show an "Assign driver" prompt in place of the driver tag and MUST block saving. For owners the prompt MUST open the on-card backup picker (FR-014b). For staff it MUST explain that the owner needs to assign a driver. Such a card MUST be muted, marked "Not operating", and left out of the header count and progress bar (FR-008) until a driver is assigned.
- **FR-014a**: When today is selected, a unit whose current status is in repair MUST show a muted "Not operating (in repair)" card with no editable fields, left out of the header count and progress bar. If such a unit already has a saved remittance for today, the saved card MUST be shown as usual and counted. Repair status MUST NOT affect past dates.
- **FR-014b**: The owner's "Assign driver" picker MUST list only drivers who can cover that unit on the selected date under the existing backup rules (active, license valid on that date, not operating another unit that day). Choosing one MUST record them as that unit's backup for that date, covering the primary's day off, without leaving Daily view or discarding unsaved entries on other cards. The card MUST then show the driver with a "Backup" tag and the "Covering for…" tooltip, become a normal unrecorded card, and join the header count. If no driver is available, the picker MUST say so. If the assignment is rejected, the card MUST stay "Not operating" and show a plain-language reason. The picker MUST be keyboard-accessible.
- **FR-015**: Primary and Backup tags MUST use different colors and also differ by their text, so color is not the only cue.

**Daily view: card layout and contents**

- **FR-016**: Cards MUST be laid out in a grid of 4 per row at viewport widths of 1200 px and up, 2 per row from 768 to 1199 px, and 1 per row on phones (including 360 px). It MUST NOT be a table.
- **FR-017**: Each card MUST show, top to bottom: (1) the unit name, (2) the driver with a Primary/Backup tag, (3) the amount due as the largest figure on the card, (4) a disposition dropdown with "Returned" and "Overnight / overtime", (5) a "Payment received (₱)" field, (6) a "Notes" field, and (7) a **Save remittance** button.
- **FR-018**: Long unit names MUST be cut off with an ellipsis and show the full name in a tooltip. The tag MUST stay on the driver's line and wrap only when it does not fit.
- **FR-019**: The amount due MUST follow the selected disposition (Returned = ₱180.00, Overnight / overtime = ₱300.00) and update immediately when the disposition changes, before saving. New cards MUST default to "Returned".

**Daily view: save and lock**

- **FR-020**: Pressing **Save remittance** on an unrecorded card MUST create that unit's remittance for the selected date under the card's driver, with the chosen disposition, notes, and (if entered) the payment received.
- **FR-020a**: Every payment recorded from a Daily view card (on first save, when raising the amount, or the owner's replacement total when lowering it) MUST be dated on the card's selected date in the fleet's time zone, not the day it was entered. On today's cards, that means the moment of entry. Monthly totals and reports that count money by payment date MUST therefore put it in the selected date's month.
- **FR-021**: After a successful save, the card MUST lock: the disposition, payment, and notes fields are disabled. The button MUST be replaced by a result badge and a "Saved" label with a lock icon, and the card background MUST become muted.
- **FR-022**: The result badge MUST read "Paid" when the total received equals the due, "Owes ₱X" when it is below the due (X = due − received), and "Credit ₱X" when it is above (X = received − due), with amounts shown to the centavo.
- **FR-023**: A 3-dot menu with the accessible name "Card options" MUST appear in the top-right corner of saved cards only, and MUST contain **Edit remittance**, which unlocks the payment and notes fields with their saved values (the disposition stays locked, FR-026).
- **FR-024**: Saving an unlocked saved card MUST apply the changes and relock it. The header count and received total MUST update after every save or edit.
- **FR-025**: The first time in a browser session that the user picks **Edit remittance** on a record from a past date, the system MUST ask "You're editing a record from [Mon D]. Continue?" and proceed only on confirmation.
- **FR-026**: When a saved remittance is edited, its disposition and amount due MUST stay locked for everyone. The disabled dropdown MUST show the hint "Disposition can't be changed after saving." For owners, the hint MUST also say that a wrong disposition is fixed by reversing the record on its details page and recording it again, and the "Card options" menu MUST offer **View record details**, which opens that page. Edit remittance MUST NOT reverse or replace records.
- **FR-027**: When a saved remittance is edited, the Payment received field MUST show the total already received, and the Notes field MUST be editable by owners and staff. Raising the payment MUST record an additional payment for the difference. Lowering it MUST be allowed for owners only: before saving, the owner MUST give a reason (at least 3 characters), then the earlier active payments are voided with that reason and one payment for the new total is recorded (none if the new total is ₱0.00). Each void is recorded in the audit trail. For staff, a value below the recorded total MUST block saving with a message that only the owner can lower a recorded payment.
- **FR-028**: Saving MUST be protected against double submission (a double press or a retry after a slow connection MUST NOT create a second remittance or payment).
- **FR-029**: A failed save MUST keep the card unlocked with the user's entries and show a plain-language message that explains how to recover.

**Daily view: edge cases and accessibility**

- **FR-030**: When the fleet's calendar day changes while today is selected, the system MUST keep the current date and cards and show a banner "It's now a new day. Switch to today?" with a button that switches to the new day.
- **FR-031**: Changing the date, switching views, following the new-day banner, or leaving the page while any card has unsaved changes MUST ask the user to confirm before discarding them.
- **FR-032**: When the selected date has no cards (FR-010), Daily view MUST show "No units scheduled for this date."
- **FR-033**: All Daily view controls (toggle, arrows, date button, calendar, Today button, card fields, menu, confirmation dialogs, banner) MUST be usable with the keyboard alone, with visible focus.

**List view (read-only history)**

- **FR-034**: List view MUST NOT include the "Record daily remittance" panel, its heading, or its helper text ("The amount due is calculated from the unit's disposition."). The table MUST span the full content width, with no two-column layout or spacing reserved for a side panel.
- **FR-035**: List view rows MUST NOT be editable or open an editor, drawer, or modal, and MUST NOT use a pointer cursor. A subtle hover highlight is allowed. There MUST be no "Add" button.
- **FR-036**: List view MUST remove the text "Open an entry to add a payment or edit notes".
- **FR-037**: List view MUST keep search, the date filter, Filters, and Sort, with newest to oldest as the default sort.
- **FR-038**: Directly under the record count, List view MUST show in secondary text: "Turn on Daily view to record or correct each unit's remittance. List view shows all records, newest to oldest." "Daily view" in that text MUST be a link that switches to Daily view.
- **FR-039**: Each row's date MUST be a link that opens Daily view on that date.

**Search field accessibility**

- **FR-040**: The List view search placeholder MUST read "Search by driver or unit" and use a solid color with a contrast ratio of at least 4.5:1 against the field background, measured, not estimated.
- **FR-041**: Text typed in the search field MUST be clearly darker than the placeholder.
- **FR-042**: The search field MUST show a visible focus ring when focused.
- **FR-043**: The Any date, Filters, and Sort controls MUST have text with at least 4.5:1 contrast and icons and borders with at least 3:1 contrast.

**Data**

- **FR-044**: This feature MUST NOT change the database schema or alter existing remittance or payment records. New entries and corrections MUST go through the existing recording, payment, notes, and correction rules, including their audit trail and soft deletion.

### Key Entities *(include if feature involves data)*

- **Remittance**: One unit's daily boundary for one service date. It stores the unit, the driver, and the driver assignment it was saved under, plus the disposition, the amount due (₱180.00 or ₱300.00, set from the disposition), notes, and audit fields. There is at most one active remittance per unit per date and per driver per date. Already stored today; this feature reads its own driver/assignment reference for FR-013.
- **Remittance payment**: An amount received against a remittance. A remittance can have several, and their total is the "Payment received" shown on the card and summed in the header. Already stored today.
- **Driver assignment**: A dated link between a driver and a unit. A primary assignment runs from a start date until it ends. A backup assignment covers one day for a primary who is off and records which primary it covers. It is the source of the historical driver and tag for unrecorded cards. Already stored today.
- **Driver day off**: A date on which a primary driver does not operate their unit. Together with backup assignments, it tells whether a card shows a backup driver or the "Assign driver" prompt. Already stored today.
- **Unit**: A tricycle with a name (shown on the card) and body number. Already stored today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Recording a remittance for a unit with no driver issue (pick disposition, type payment, save) takes no more than 3 interactions after Daily view is open, compared with choosing a driver/unit pair, date, disposition, and payment in the old form.
- **SC-002**: A user can record all of a 9-unit day from Daily view in under 3 minutes on a phone.
- **SC-003**: At a glance, a user can tell how many units remain unrecorded for a date from the header count and the muted saved cards, without scrolling the list or opening any record.
- **SC-004**: In every tested case where the schedule changed after a record was saved, Daily view shows the driver the record was saved under.
- **SC-005**: For past dates, the driver shown on every unrecorded card matches the assignment in effect on that date, including backups covering a day off.
- **SC-006**: The search placeholder and the Any date, Filters, and Sort controls pass WCAG 2.1 AA contrast (4.5:1 for text, 3:1 for icons and borders) when measured with a contrast checker.
- **SC-007**: Every Daily view and List view control can be reached and operated with the keyboard alone.
- **SC-008**: Every screen works at a 360 px viewport with no horizontal scrolling.
- **SC-009**: After release, the remittance and payment records that existed before release are unchanged, and the database schema is identical.
- **SC-010**: No remittance is created twice from a double press or a retried save.

## Assumptions

- **Who can record**: Owners and approved staff can record remittances, add payments, and edit notes in Daily view, as they can today. Anything the current rules reserve for the owner (reversing a remittance, voiding a payment, assigning drivers) stays owner-only.
- **Which units appear**: A unit appears on a date if it had a primary assignment in effect on that date or has a saved remittance for it. Units with no assignment that day are not "scheduled" and do not appear. A unit's current repair or retired status does not hide its past-date cards. A retired unit whose primary assignment is still open shows no card today (FR-010). The database already blocks new assignments on retired units.
- **Received total**: The header's "received" figure is the sum of all active payments on that date's remittances, whenever those payments were entered.
- **"Today" and day boundaries**: These follow the fleet's configured time zone (Asia/Manila by default), not the device's clock settings.
- **How far back**: Any past date can be opened. Saving an unrecorded past card is subject to the existing rule that the driver must have been assigned on that date.
- **Session**: The past-date edit confirmation resets when the browser tab or session is closed.
- **Remittance detail page**: The existing per-record detail page (payment history, owner reversal, payment voids) stays. List view rows no longer link to it; their date opens Daily view instead. It is reached from the dashboard and, for owners, from a saved card's **View record details** menu item (FR-026).
- **Design system**: Cards, the segmented control, calendar, menu, tooltip, banner, and badges use the project's existing design tokens and component set (DESIGN.md), with no new UI libraries.
- **Mockups**: The two attached screenshots show the intended List view (toggle, full-width table, note under the count) and Daily view (date control, progress, 4-column card grid) layouts.

## Constitution Compliance

| Principle | How this spec complies |
|-----------|------------------------|
| I. Free-Tier Sustainability | No new service or paid dependency |
| II. Monolithic Simplicity | Changes one page of the existing app; no new service |
| III. Data Integrity and Auditability | Amounts in centavos; due set by the database; saved facts stay locked; payment voids are audited and owner-only; no hard deletes; multi-step saves follow principle III's multi-step clause (constitution 1.1.0) (FR-026, FR-027, FR-028, FR-029, FR-044) |
| IV. Mobile-First, Human-Centered Operations | 1 card per row at 360 px; plain-language errors with a recovery step; status always has text (FR-015, FR-016, FR-029, SC-008) |
| V. Compliance Document Lifecycle | Not affected |
