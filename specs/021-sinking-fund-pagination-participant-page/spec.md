# Feature Specification: Sinking Fund Pagination and Participant Page

**Feature Branch**: `021-sinking-fund-pagination-participant-page`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "1. List of sinking fund transactions are like expenses tab. 10 per page only. paginate. use the current pagination from expenses as reference. 2. Clicking view participant should not show like this [a pop-up over the participants view]. but a specific participant page with the same card details with buttons and the history table is still 10 rows same on the current sinking fund main page with search, pagination, and sorting. just copy the logic in the main sinking fund page"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transactions list shows 10 rows per page (Priority: P1)

The owner opens the Sinking fund page and the transactions list. Today every transaction is shown in one long list ("Showing 22 of 22 transactions"). The owner wants the list to behave like the Expenses list: 10 rows at a time, with the same page controls and the same "Showing X–Y of Z" summary, so a long history stays quick to scan on a phone.

**Why this priority**: The long list is the most visible pain point and the fix is self-contained. It delivers value on its own.

**Independent Test**: With more than 10 transactions, open the transactions list and confirm only 10 rows show, the page controls look and work like the Expenses ones, and moving to page 2 shows the next rows.

**Acceptance Scenarios**:

1. **Given** 22 transactions, **When** the owner opens the transactions list, **Then** the first 10 appear, a summary reads like the Expenses one (rows shown out of the total), and page controls offer pages 1 to 3.
2. **Given** the owner is on page 2, **When** they type in search, change the date range, apply filters, or change the sort, **Then** the list returns to page 1 of the new result set.
3. **Given** 10 or fewer matching transactions, **When** the list shows, **Then** no page controls are needed and all rows appear.
4. **Given** the owner is on page 3, **When** they refresh or share the link, **Then** the same page opens again.

---

### User Story 2 - Participant opens on its own page (Priority: P1)

When the owner chooses "View participant" from a participant card, the app no longer opens a pop-up over the participants view. It opens a dedicated page for that participant, with a way back to the participants view.

**Why this priority**: This is the core change of the request; the pop-up is replaced by a real page.

**Independent Test**: From the participants view, choose View participant and confirm a full page for that participant opens (not a pop-up), and that Back returns to the participants view as it was.

**Acceptance Scenarios**:

1. **Given** the participants view, **When** the owner chooses View participant on a card, **Then** that participant's own page opens and no pop-up appears.
2. **Given** a participant page, **When** the owner uses the back control or the browser back button, **Then** they return to the participants view with the same search, sort, and page they left.
3. **Given** a link to a participant page, **When** it is opened directly or refreshed, **Then** the same participant page shows.
4. **Given** a participant that does not exist or was removed, **When** its link is opened, **Then** the owner sees a clear "not found" message with a way back.

---

### User Story 3 - Participant page shows the same card details and actions (Priority: P1)

The participant page opens with the same details the pop-up shows today: total savings, total loans, balance to pay, interest shares received, the Add transaction and Withdraw savings buttons, and the participant's loans. The buttons work exactly as they do now.

**Why this priority**: The page is only useful if nothing from the pop-up is lost.

**Independent Test**: Open a participant with a loan and confirm every figure, button, and loan card from the old pop-up is present and the buttons open the same forms for that participant.

**Acceptance Scenarios**:

1. **Given** a participant with savings and a loan, **When** their page opens, **Then** it shows the four figures, both buttons, and each loan with principal, interest, amount due, interest paid, principal paid, balance, due date, and status.
2. **Given** the participant page, **When** the owner chooses Add transaction or Withdraw savings, **Then** the same form as today opens already set to this participant.
3. **Given** a transaction is saved from the participant page, **When** the form closes, **Then** the figures, loans, and history refresh on the page.

---

### User Story 4 - Participant history works like the main transactions list (Priority: P1)

Below the card details, the participant page shows a History table with the same behavior as the main Sinking fund transactions list: 10 rows per page, search, sorting, and page controls, limited to this participant's transactions. The same row actions (such as viewing details or voiding) behave as in the main list.

**Why this priority**: The owner asked for the history to match the main list, with no new behavior to learn.

**Independent Test**: On a participant with more than 10 transactions, confirm the History table shows 10 rows, pages work, search narrows rows, sort reorders them, and only this participant's rows appear.

**Acceptance Scenarios**:

1. **Given** a participant with 25 transactions, **When** their page opens, **Then** the History table shows 10 rows and page controls for 3 pages.
2. **Given** the History table, **When** the owner searches by notes or changes the sort, **Then** only matching rows show, in the chosen order, starting on page 1.
3. **Given** the History table, **When** the owner opens a row's menu, **Then** the same actions available in the main list are available here.
4. **Given** a participant with no transactions, **When** their page opens, **Then** the History table shows the same empty message as the main list.
5. **Given** the main list and the History table, **When** compared, **Then** the date formats, type tags, amounts, details, and voided styling look the same.

---

### Edge Cases

- Voided transactions stay in both lists with their voided styling and still count toward the pages.
- If a page number in the link is past the last page (for example after a void or filter), the list shows the last available page.
- Search or filters with no matches show the existing empty-results message, not a blank table.
- Old links that opened the pop-up (with a participant detail address) open the new participant page instead.
- At a 360 px width the participant page, buttons, loan cards, History table, and page controls all fit without sideways scrolling.
- A participant page opened by a signed-in user without owner rights keeps the same access rules as the pop-up had.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Sinking fund transactions list MUST show 10 rows per page.
- **FR-002**: The transactions list MUST use the same page controls and "showing X–Y of Z" summary as the Expenses list.
- **FR-003**: Search, date range, filters, and sort on the transactions list MUST keep working and MUST reset the list to page 1 when changed.
- **FR-004**: The current page MUST be kept in the address so refresh, back, and shared links return to the same page.
- **FR-005**: Choosing View participant MUST open a dedicated page for that participant instead of a pop-up.
- **FR-006**: The participant page MUST have a back control that returns to the participants view with its previous search, sort, and page.
- **FR-007**: The participant page MUST show total savings, total loans, balance to pay, and interest shares received.
- **FR-008**: The participant page MUST show the Add transaction and Withdraw savings buttons and they MUST behave as they do today.
- **FR-009**: The participant page MUST list the participant's loans with the same details and status as the old pop-up.
- **FR-010**: The participant page MUST show a History table of only that participant's transactions with 10 rows per page, search, sorting, and page controls, reusing the main transactions list's behavior.
- **FR-011**: History rows MUST offer the same row actions as the main list.
- **FR-012**: After any transaction is added, withdrawn, or voided on the participant page, its figures, loans, and History MUST refresh.
- **FR-013**: A participant page for an unknown or removed participant MUST show a clear not-found message with a way back.
- **FR-014**: Old pop-up links MUST open the participant page.
- **FR-015**: All new and changed screens MUST work at a 360 px viewport.
- **FR-016**: Access rules and money formatting MUST stay as they are today; this feature changes layout and navigation only, not stored data.

### Key Entities

- **Sinking fund transaction**: A dated entry (deposit, withdrawal, loan, payment, interest share, year-end close) with a participant, type, amount, details, and voided state. Shown in the main list and the participant History.
- **Participant**: A person in the fund with savings, loans, balance to pay, and interest shares received; owns a dedicated page.
- **Loan**: A participant's loan with principal, interest, amount due, amounts paid, balance, due date, and status; shown on the participant page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With any number of transactions, the main list and every participant History table never show more than 10 rows at once.
- **SC-002**: An owner can reach any transaction in a 100-transaction history in at most 10 page steps, or in one search.
- **SC-003**: 100% of the details and actions in the old participant pop-up are available on the participant page.
- **SC-004**: Going from the participants view to a participant and back keeps the owner's previous search, sort, and page in every case.
- **SC-005**: Both lists and the participant page are fully usable at 360 px with no sideways scrolling.
- **SC-006**: The pagination looks and behaves identically to Expenses when the two screens are compared side by side.

## Assumptions

- The Expenses list is the reference for page controls, summary text, and page size; its 10-row size applies to every list in this feature.
- "Copy the logic of the main page" means the participant History reuses the main list's search, sort, and row actions, scoped to one participant. Date range and filter controls are included only if the main list already offers them in a form that fits one participant.
- Participant history sorting offers the same options as the main list.
- The old pop-up is removed rather than kept as an alternative.
- The participants view itself (cards, search, sort) is unchanged.
- Existing stored data, reports, and permissions are unchanged.
