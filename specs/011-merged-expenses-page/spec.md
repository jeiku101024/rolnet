# Feature Specification: Merged Expenses Page

**Feature Branch**: `011-merged-expenses-page`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Merged Expenses page (Expenses + Maintenance) per client spec update. Mockup reference: expenses_page_mockup.html. Expenses and Maintenance become one page called Expenses; the Maintenance page is removed; repairs and part replacements are logged as expenses in fixed categories with a Last Replaced date; add/edit in a modal; 3-dot row menu with Edit and Delete; existing maintenance records migrate into expenses."

## Context

Today the app has two separate places for unit costs:

- **Expenses**: a table plus an "Add expense" form card on the right. Each expense has a unit, a
  category from an editable list (seeded with Fuel, Repairs, Registration, Insurance), a date, an
  amount, notes, and an optional receipt photo.
- **Maintenance**: a unit picker leading to a per-unit page where staff record part replacements
  (part name, date, mileage, cost, next due date/mileage), tire installations (position Front, Rear
  left, Rear right, with brand, cost, next due), and mileage readings. The dashboard shows overdue
  maintenance from the next-due values.

The client wants one "Expenses" page. Repairs and part replacements become expenses in a fixed set
of categories, and the main parts show when they were last replaced. The layout and interactions
follow the Units and Remittances pages: toolbar, modal, 3-dot row menu, toasts, and button styles.

## Clarifications

### Session 2026-11-01

- Q: The client wants a permanent delete, but constitution Principle III forbids physically
  deleting financial records. How should Delete work? → A: Soft delete. The expense disappears
  from every screen, total, and report, and is kept hidden with who and when. No constitution
  change.
- Q: Where do mileage readings, tire positions, and next-due reminders go once Maintenance is
  removed? → A: Mileage recording and history move to the Unit detail page. Next-due reminders
  (including the dashboard's overdue panel) and the current tire positions view are retired. The
  per-category "Last replaced" line covers parts.
- Q: What happens to the API endpoints for part replacements, tire installations, and expense
  categories after the merge? → A: They become read-only. Reads still work, and writes are rejected
  with a message pointing to expenses. The expenses endpoint gains category, custom category name,
  and date replaced.
- Q: How is the data move verified, and what happens to the old records afterward? → A: The move
  checks itself. For each unit, moved record counts and peso sums must equal the originals, or the
  whole move fails and nothing changes. Old records stay read-only indefinitely. Removing them is a
  later feature.
- Q: Is the per-category "Last replaced" list on the Unit detail page (optional in the client spec)
  part of this feature? → A: Yes. It lists the 7 main categories with the latest date replaced or
  "Never recorded". Each links to Expenses filtered to that unit and category.
- Q (planning): The Unit detail page is owner-only. Where do staff record mileage? → A: The owner
  records it on Unit detail, which also shows the history. Staff use a "Record mileage" dialog on
  each unit card in the Units Daily view.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log an expense from a modal (Priority: P1)

An owner or staff member opens Expenses, taps "Add expense" beside Filters, and records a cost for
a unit: a main-part replacement such as Change Oil or Rear Tire with its replaced date, or any other
cost under "Others" with a typed category name. The new row appears in the full-width table.

**Why this priority**: Recording costs is the page's main job. Without it, nothing else works.

**Independent Test**: On a 360 px screen, add one Change Oil expense and one Others expense
("Brake pads"). Both rows appear with the correct Last Replaced value ("N/A" for Others), and an
"Expense added" toast appears.

**Acceptance Scenarios**:

1. **Given** the Expenses page, **When** the user taps "Add expense", **Then** a modal titled
   "Add expense" opens with Unit, Category, Expense date (today), Amount, and Notes. Focus stays
   inside the modal, and Escape closes it.
2. **Given** the modal with Category "Chain", **When** the user leaves Date replaced unchanged and
   saves, **Then** the expense is saved with Date replaced equal to the expense date. The modal
   closes, the row appears, and "Expense added" shows.
3. **Given** the modal, **When** the user selects "Others", **Then** a required "Category name"
   field appears in place of "Date replaced", and the values already entered stay.
4. **Given** the modal, **When** the user saves with a required field empty or an amount of 0 or
   less, **Then** each problem shows as an inline error next to its field and nothing is saved.
5. **Given** a unit with status In repair, **When** the user opens the Unit dropdown, **Then** the
   unit is listed. Archived units are not listed.

---

### User Story 2 - Find and total expenses (Priority: P1)

The owner searches and filters expenses by unit, category, and date range, and sees how many
records match and their total.

**Why this priority**: The owner uses totals to compare costs with allowance and to spot units that
cost too much.

**Independent Test**: Filter to one unit and the category "Others" for one month. Check that the
summary line (for example "3 records · ₱1,250.00") matches the visible rows and updates when a
filter changes.

**Acceptance Scenarios**:

1. **Given** expenses exist, **When** the page opens, **Then** rows are sorted newest expense date
   first, and the user can sort by date and by amount in either direction.
2. **Given** any filter or search, **When** it changes, **Then** the record count and peso total
   below the toolbar reflect all matching records, not only the current page.
3. **Given** the Category filter, **When** it opens, **Then** it lists Change Oil, Front Tire, Rear
   Tire, Engine Sprocket, Chain, Rear Sprocket, Battery, and Others, in that order.
4. **Given** filters that match nothing, **When** the table renders, **Then** it shows "No expenses
   match these filters."

---

### User Story 3 - Edit or delete an expense from the row menu (Priority: P2)

The user corrects a mistake through the row's 3-dot menu: Edit opens the same modal pre-filled, and
Delete (owner only) removes an expense added in error, after a confirmation.

**Why this priority**: Mistakes happen and change reports. Fixing them comes right after recording.

**Independent Test**: Edit an expense's amount and check the row and totals change with an
"Expense updated" toast. Delete another as owner, confirm, and check the row disappears, totals
drop, "Expense deleted" shows, and the audit history lists the delete with the old values.

**Acceptance Scenarios**:

1. **Given** any row, **When** the user opens its 3-dot menu (label "Expense options"), **Then** it
   shows Edit and Delete. It works by keyboard and opens upward on the last rows so it is not cut
   off.
2. **Given** Edit, **When** the modal opens, **Then** it is titled "Edit expense" and shows the
   saved values. Saving updates the row and shows "Expense updated".
3. **Given** a main-category expense being edited, **When** the user switches the category to
   Others, **Then** the app asks "This removes the Last Replaced date." before continuing. If
   confirmed, saving clears the replaced date.
4. **Given** an Others expense being edited, **When** the user switches to a main category,
   **Then** Date replaced appears and is required.
5. **Given** an owner chooses Delete, **When** the confirmation "Delete this expense?" opens,
   **Then** it shows the date, unit, category, and amount, warns that the expense is removed and
   report totals for that period change, puts focus on "Cancel", and offers a red "Delete expense".
6. **Given** the owner confirms, **When** the delete completes, **Then** the row is gone, the
   count and total update, "Expense deleted" shows, and the audit history records who deleted it,
   when, and its values.
7. **Given** a staff user, **When** they open the row menu, **Then** Delete is shown disabled with
   "Only the owner can delete expenses".

---

### User Story 4 - One page replaces Maintenance (Priority: P2)

Maintenance disappears from navigation. Old Maintenance links lead to Expenses, and the Unit detail
page's "Maintenance and mileage" link opens Expenses filtered to that unit. Existing part and tire
records appear as expenses.

**Why this priority**: Users need one place to look, and old history must not be lost.

**Independent Test**: After the data move, open a unit that had part replacements and tires.
Every one appears on Expenses, filtered to that unit, with the right category, date, and amount.
Visiting the old Maintenance address lands on Expenses.

**Acceptance Scenarios**:

1. **Given** the navigation, **When** any user looks for Maintenance, **Then** it is not there.
   Visiting the old Maintenance address, or a unit's old maintenance address, opens Expenses (the
   second filtered to that unit).
2. **Given** a part replacement named like a main category (for example "Change oil", "chain"),
   **When** the data move runs, **Then** it becomes an expense in that category, using its date as
   both expense date and date replaced.
3. **Given** a part replacement with any other name, **When** the data move runs, **Then** it
   becomes an Others expense whose category name is the old part name.
4. **Given** a tire installation, **When** the data move runs, **Then** Front becomes Front Tire,
   Rear left and Rear right become Rear Tire, using the install date as both dates.
5. **Given** an old record with no cost, **When** the data move runs, **Then** it becomes an
   expense of ₱0.00 marked "Needs review" so the owner can find and fix it.
6. **Given** the data move, **When** it finishes, **Then** for every unit the moved record count and
   peso sum equal the originals, or the move fails with no changes. The original records stay
   unchanged and read-only.
7. **Given** the Maintenance page is removed, **When** the owner opens a unit's detail page,
   **Then** they can record a mileage reading there and see the unit's mileage history, newest
   first. **When** a staff member opens the Units Daily view, **Then** each unit card offers
   "Record mileage", which opens a dialog with the same rules.
8. **Given** the Maintenance page is removed, **When** the owner opens the dashboard, **Then** no
   overdue maintenance panel or next-due reminders appear, and no new next-due values are recorded.

---

### User Story 5 - Reports and unit totals follow expense changes (Priority: P3)

The Unit detail page's "Monthly expenses vs allowance" and the weekly, monthly, and yearly reports
use this one set of expenses, so adds, edits, and deletes show up there. The Unit detail page also
shows when each main part was last replaced.

**Why this priority**: These read the data the earlier stories write. They mostly need to stay
correct.

**Independent Test**: Note a unit's monthly expenses and a monthly report's Net. Add, edit, then
delete an expense in that month, and confirm both values change each time.

**Acceptance Scenarios**:

1. **Given** an expense is added, edited, or deleted, **When** the owner opens that unit's detail
   page or downloads a report for that period, **Then** expenses and Net (Allowance − Expenses)
   reflect the change.
2. **Given** a unit with main-category expenses, **When** its detail page opens, **Then** it shows
   a "Last replaced" date per main category (the most recent date replaced), or "Never recorded", each linking to Expenses filtered to that unit and category.

---

### Edge Cases

- A user opens Edit or Delete on an expense another user changed or deleted in the meantime. The
  app refuses the stale save, tells the user the record changed, and reloads the latest values.
- Date replaced is after the expense date. Allowed, because a part can be paid for before it is
  fitted. Neither date may be later than today in fleet time.
- The same main part is logged twice for one unit. Both are kept, and Last Replaced on the Unit
  detail page uses the latest date replaced.
- An Others category name matches a main category ("change oil"). The app warns and suggests the
  main category, but saves the user's choice.
- Category names typed under Others differ only in spacing or case ("Brake pads", "brake  pads").
  Leading, trailing, and repeated spaces are trimmed. Case is kept as typed.
- Existing expenses in Fuel, Registration, Insurance, Repairs, or owner-added categories become
  Others with the old category name, so no expense loses its label.
- A part cost was recorded both as a part replacement and as a "Repairs" expense. After the move it
  could be counted twice. Moved records carry a "Moved from maintenance" marker so the owner can
  filter for them and find duplicates.
- Expenses that already have a receipt photo keep it.
- Very long notes are cut off with an ellipsis in the table. The full text shows on hover or focus.
- A unit is archived after its expenses were logged. Its expenses stay visible and filterable, but
  it can't be chosen for new expenses.
- The modal must fit a 360 px screen with no sideways scrolling, and the table must not force the
  page to scroll sideways.

## Requirements *(mandatory)*

### Functional Requirements

**Page and navigation**

- **FR-001**: The app MUST have one page titled "Expenses" for unit costs, and MUST remove
  "Maintenance" from the navigation.
- **FR-002**: The old Maintenance address MUST redirect to Expenses. A unit's old maintenance
  address MUST redirect to Expenses filtered to that unit.
- **FR-003**: The Unit detail page's "Maintenance and mileage" link MUST open Expenses filtered to
  that unit. Links from the dashboard that pointed to Maintenance MUST point to Expenses.

**Layout, filters, and totals**

- **FR-004**: The page MUST NOT show the side "Add expense" form card. The table MUST use the full
  content width.
- **FR-005**: The toolbar MUST hold a search field, a Filters button, and a primary "Add expense"
  button with a plus icon beside Filters, laid out like the Units page toolbar.
- **FR-006**: Filters MUST include unit, category (7 main categories plus Others), and an expense
  date range.
- **FR-007**: Below the toolbar the page MUST show the matching record count and the peso total of
  all records that match the current search and filters, for example "42 records · ₱18,450.00".
- **FR-008**: The default sort MUST be newest expense date first. Users MUST be able to sort by
  date and by amount, ascending or descending.

**Categories**

- **FR-009**: Main categories MUST be, in this order: Change Oil, Front Tire, Rear Tire, Engine
  Sprocket, Chain, Rear Sprocket, Battery, followed by "Others". The list is fixed, and users can't
  add, rename, or remove main categories.
- **FR-010**: An Others expense MUST have a category name of 1–80 characters, trimmed.

**Table**

- **FR-011**: Columns MUST be Date, Unit, Category, Amount, Last Replaced, Notes, and a 3-dot menu.
- **FR-012**: The Category column MUST show the main category name, or the typed name with a small
  "Others" tag.
- **FR-013**: Amount MUST show a peso sign, thousands separators, and two decimals.
- **FR-014**: Last Replaced MUST show the date replaced for main categories, and "N/A" in secondary
  text for Others.
- **FR-015**: Notes MUST truncate with an ellipsis and show the full text in a tooltip. Expenses
  with a receipt MUST show a receipt indicator that opens the receipt.
- **FR-016**: When nothing matches, the table MUST show "No expenses match these filters."
- **FR-017**: On narrow screens the table MUST stay usable without horizontal page scrolling,
  following the existing list pattern for phones.

**Add and edit modal**

- **FR-018**: "Add expense" MUST open a modal titled "Add expense". "Edit" MUST open the same modal
  titled "Edit expense", pre-filled.
- **FR-019**: The modal fields MUST be: Unit* (non-archived units, including In repair), Category*,
  Category name* (Others only), Expense date* (defaults to today in fleet time), Date replaced*
  (main categories only, defaults to the expense date until the user changes it), Amount (₱)*
  (greater than 0), Notes (optional), and the existing optional receipt photo.
- **FR-020**: Switching between Others and a main category MUST swap Category name and Date
  replaced in place and keep all other entered values.
- **FR-021**: Required or invalid fields MUST show inline errors on save, in plain language, and
  the modal MUST stay open.
- **FR-022**: The modal MUST work by keyboard, trap focus, close on Escape and on its close
  control, and return focus to the button that opened it.
- **FR-023**: Saving MUST close the modal, update the table, count, and total, and show "Expense
  added" or "Expense updated".
- **FR-024**: Changing a saved main-category expense to Others MUST first confirm "This removes
  the Last Replaced date." and then clear the date replaced. Changing Others to a main category
  MUST require a date replaced.
- **FR-025**: A save MUST be rejected if the expense changed since the modal opened, with a message
  telling the user to review the latest values.
- **FR-026**: Submitting the same add twice (double tap or retry) MUST create only one expense.

**Row menu and delete**

- **FR-027**: Every row MUST end with a 3-dot button labelled "Expense options" that opens Edit and
  Delete. The menu MUST work by keyboard and open upward when it would be cut off at the bottom.
- **FR-028**: Delete MUST be available only to the owner. Staff MUST see it disabled with "Only the
  owner can delete expenses".
- **FR-029**: Delete MUST open "Delete this expense?" showing date, unit, category, and amount, and
  a note that the expense is removed and report totals for that period change. "Cancel" MUST have
  default focus, and "Delete expense" MUST be styled as destructive.
- **FR-030**: On confirm, the expense MUST be removed from the Expenses page, totals, the Unit
  detail page, and reports, and "Expense deleted" MUST show. Delete is a soft delete (constitution
  Principle III). The record is marked deleted with who and when, never shown or counted again, and
  has no restore action on any screen (owners can still restore it through the API). To the user, the delete is permanent.
- **FR-031**: Every delete MUST be recorded in the audit history with who, when, and the expense's
  values at the time of deletion.

**Unit detail and reports**

- **FR-032**: The Unit detail page's "Monthly expenses vs allowance" MUST read from these expenses.
- **FR-033**: The Unit detail page MUST list the 7 main categories in the fixed order, each with the
  most recent date replaced for that unit (ignoring deleted expenses) or "Never recorded". Each
  entry MUST link to Expenses filtered to that unit and category.
- **FR-034**: Weekly, monthly, and yearly reports MUST total expenses by expense date. Net MUST be
  Allowance − Expenses for the period.
- **FR-034a**: The Unit detail page, which only owners can open, MUST let the owner record a mileage
  reading with the same validation as today, and MUST list the unit's mileage readings, newest
  first. Staff MUST be able to record a mileage reading from a "Record mileage" dialog on each
  unit's card in the Units Daily view.
- **FR-034b**: Next-due reminders MUST be retired. The dashboard's overdue maintenance panel and
  count, the "Has maintenance due" filter, and the next-due inputs MUST be removed. Existing
  next-due values stay on the kept original records.
- **FR-034c**: The current tire positions view and the tire installation form MUST be retired.
  Tire purchases are logged as Front Tire or Rear Tire expenses.

**Data move**

- **FR-035**: Each existing part replacement MUST become an expense. If its part name matches a
  main category (ignoring case, spacing, and common variants such as "oil change", "sprocket
  (engine)"), it MUST use that category with date replaced equal to its date. Otherwise it MUST be
  Others with the part name as the category name.
- **FR-036**: Each existing tire installation MUST become a Front Tire (Front) or Rear Tire (Rear
  left/Rear right) expense, with its install date as both dates. The position and brand MUST be
  kept in the notes.
- **FR-037**: Moved records with no cost MUST be saved at ₱0.00 and marked "Needs review". The
  owner MUST be able to filter for them. Every moved record MUST keep a link to its original record
  and a "Moved from maintenance" marker.
- **FR-038**: Existing expenses MUST keep their amount, date, notes, and receipt. Their old category
  name becomes an Others category name.
- **FR-039**: The move MUST verify itself. For each unit, the count and peso sum of moved records
  MUST equal those of the original part replacements and tire installations, or the whole move MUST
  fail with no partial changes. The original records MUST stay unchanged, kept read-only
  indefinitely. Removing them is out of scope. The move MUST be safe to re-run without creating
  duplicates.
- **FR-039a**: After the merge, part replacements, tire installations, and the old editable expense
  categories MUST be read-only everywhere, including the app's API. Reads keep working. Create,
  update, and delete attempts MUST be rejected with a plain message that expenses are now recorded
  as expenses. The expenses API MUST accept and return category, custom category name, and date
  replaced, with the same rules as the modal.
- **FR-040**: The amount-greater-than-zero rule applies to new and edited expenses. Moved ₱0.00
  records may be saved only with the "Needs review" mark, and that mark clears when an owner or
  staff member saves a real amount.

### Key Entities

- **Expense**: one unit cost. Unit, category (one of 7 main categories or Others), custom category
  name (Others only), expense date, date replaced (main categories only), amount in centavos,
  notes, optional receipt, needs-review flag, origin (entered directly or moved from maintenance,
  with the original record's identity), plus creator, updater, and timestamps. Searchable and
  sortable by expense date. Filterable by unit and date.
- **Expense category (fixed)**: the ordered list of 7 main categories plus Others. It replaces the
  editable category list for new entries.
- **Audit event**: who did what and when, with before and after values. Delete events keep the full
  expense values.
- **Unit**: owns expenses. Its detail page shows monthly expenses vs allowance and last-replaced
  dates per main category.
- **Legacy maintenance records** (part replacements, tire installations): read-only sources for the
  data move, kept indefinitely.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can log a main-category expense from the Expenses page in under 45 seconds on
  a phone, with no more than 5 inputs changed from their defaults.
- **SC-002**: 100% of existing part replacements and tire installations appear as expenses after
  the data move, and the sum of their amounts equals the sum of the original costs.
- **SC-003**: For any filter, the summary total equals the sum of the matching records to the
  centavo.
- **SC-004**: After any add, edit, or delete, the Unit detail monthly expenses and the next report
  download for that period reflect the change, with no manual refresh step.
- **SC-005**: Every delete has a matching audit entry that includes the deleted expense's values.
- **SC-006**: Every Expenses screen, modal, menu, and confirmation is usable at 360 px wide with no
  horizontal page scroll, and can be completed with the keyboard alone.
- **SC-007**: No navigation item, link, or bookmark leads to a missing Maintenance page.

## Assumptions

- Owners and staff can both add and edit expenses, as today. Only the owner can delete, as the
  mockup shows.
- The existing optional receipt photo stays on the expense form (the mockup shows a receipt
  indicator), with the current file rules.
- The existing editable category list (Fuel, Repairs, Registration, Insurance, and any the owner
  added) is retired for new entries. Its names live on as Others category names.
- Moving maintenance costs into expenses raises past expense totals and lowers past Net in reports.
  The client accepts this, because those were real costs. Reports downloaded before the move will
  differ from those after.
- Mileage values on part and tire records (replacement mileage, next due mileage) are not part of
  the expense record. They stay on the kept original records and are copied into notes during the
  move when present.
- "Today" means fleet-local date, as everywhere else in the app.
- Delete keeps the meaning of "removed from every screen, total, and report" regardless of how the
  constitution question is settled.
- No new UI libraries. Modal, menu, toast, and toolbar reuse the components already used on the
  Units and Remittances pages.
