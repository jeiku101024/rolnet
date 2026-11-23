# Feature Specification: Participant Loans Redesign

**Feature Branch**: `022-participant-loans-redesign`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "In the participant detail page, loans are not readable and user friendly; redesign the Loans section. Use the mock `sinking_fund_many_loans_compact.html` as the reference (a participant with many loans must stay compact and scannable). Current state: each loan is a large card with a 2-column grid of 7 labeled figures (Principal, Interest, Amount due, Interest paid, Principal paid, Balance, Due date) plus Add payment / Mark as withdrawal buttons."

## Clarifications

### Session 2026-11-23

- Q: Should the redesign include the mock's "Pay full balance" button or only keep "Add payment"? → A: Include it next to "Add payment" on every active loan with a balance (FR-011).
- Analysis follow-up: all loan rows start collapsed (FR-007, SC-001); "overdue" is a flag on an open loan, shown as the Overdue status.
- Q: Should the Paid and closed tab reveal loans with "Show more" or numbered page controls? → A: Numbered page controls, 5 loans per page (FR-014).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan a participant's open loans at a glance (Priority: P1)

An owner or staff member opens a participant who has several loans. Today every loan is a tall card with seven figures, so the page becomes a long wall of numbers and it is hard to tell which loan needs attention. In the redesign, the Loans section opens on an **Active** tab. Each active loan is one compact row showing its status (Open or Overdue), loan date with the amount borrowed, what is still owed (balance out of amount due) with a small progress bar, and when it is due ("12 days left", "Overdue by 34 days"). Rows are ordered by urgency: overdue first, then the soonest due date. A summary line above the list shows the number of active loans, the total balance still to pay, and the number overdue.

**Why this priority**: This is the complaint itself. Without a compact, scannable list nothing else in the redesign matters, and it delivers value on its own.

**Independent Test**: Open a participant with five active loans (one overdue). All five rows are visible with minimal scrolling at 360 px, the overdue loan is first and visually distinct, and the summary line matches the rows.

**Acceptance Scenarios**:

1. **Given** a participant with several active loans, **When** the participant page loads, **Then** the Loans section shows a summary (active count, total balance to pay, overdue count) and one compact row per active loan, ordered with overdue loans first and then by nearest due date.
2. **Given** an active loan that is past its due date, **When** its row is shown, **Then** it displays an "Overdue" status, a due text such as "Overdue by 34 days", and a visual marker that sets it apart from open loans.
3. **Given** an active loan with partial payments, **When** its row is shown, **Then** the progress bar reflects how much of the amount due has been paid, split between interest paid and principal paid, and the balance shown equals amount due minus both.
4. **Given** a participant with no loans, **When** the page loads, **Then** the Loans section shows "No loans yet." instead of tabs.

---

### User Story 2 - Open a loan to see the details and act on it (Priority: P1)

From the list, the user taps a loan row to see everything that the old card showed, but only for that loan. Exactly one loan is expanded at a time so the page stays short. The expanded area shows how the amount due is made up (principal plus interest equals amount due), how much interest and principal have been paid against what is owed, the percentage paid, the loan's payment list (date, total, and the interest and principal portions), and the loan's actions: **Add payment**, and **Mark as withdrawal** for overdue loans (owner only, as today). Tapping the row again collapses it.

**Why this priority**: The old card carried seven figures and the actions; the redesign must not lose any of them or the ability to act, so this is as important as the list itself.

**Independent Test**: Tap a loan row; confirm every figure from the old card (principal, interest, amount due, interest paid, principal paid, balance, due date) is available, the payment list is shown, and Add payment opens the existing Add transaction flow with that loan selected. Tap another row; the first collapses.

**Acceptance Scenarios**:

1. **Given** a collapsed loan row, **When** the user taps it, **Then** it expands in place showing the amount-due breakdown, interest and principal paid versus owed, percent paid, the payment list, and the action buttons; any previously expanded loan collapses.
2. **Given** an expanded loan with no payments, **When** it is shown, **Then** the payment list says "No payments yet."
3. **Given** an expanded active loan, **When** the user chooses Add payment, **Then** the existing Add transaction dialog opens for that participant and loan, as it does today.
4. **Given** an expanded overdue loan, **When** an owner views it, **Then** Mark as withdrawal is available and works as today; **When** staff views it, **Then** the control is shown disabled with the "owner only" explanation, as today.
5. **Given** an expanded active loan with a balance, **When** the user chooses "Pay full balance", **Then** the Add transaction dialog opens for that loan with the amount prefilled to the remaining balance.
6. **Given** the participant page is opened with the keyboard or a screen reader, **When** the user moves through the rows, **Then** each row is reachable, announces whether it is expanded, and can be toggled without a pointer.

---

### User Story 3 - Keep paid and closed loans out of the way (Priority: P2)

Loans that are fully paid or were closed as a withdrawal move to a second tab, **Paid and closed**, so they no longer crowd the active list. The tab shows the count of such loans. Each row shows its status (Paid or Withdrawn), loan date, principal plus interest, and when it was paid off or closed. Tapping a row shows the principal plus interest breakdown ("repaid in full" or "due, closed as withdrawal"). When there are many, the tab lists 5 at a time with numbered page controls (the same style as the Expenses and Sinking fund lists), and offers a year filter. The tab header shows how many loans match and the total repaid.

**Why this priority**: A participant with a long history would otherwise make the list long again; this keeps the redesign compact over time, but a participant with only open loans is already well served by P1/P2.

**Independent Test**: Open a participant with 14 closed loans across 2 years; the Paid and closed tab shows 5 rows with page controls for 3 pages; going to page 2 shows the next 5; choosing a year reduces the list, returns to page 1, and updates the repaid total accordingly.

**Acceptance Scenarios**:

1. **Given** a participant with paid and withdrawn loans, **When** the user opens the Paid and closed tab, **Then** those loans are listed newest first, each showing status, loan date, amount, and the date it was paid off or closed.
2. **Given** more than 5 closed loans, **When** the tab is opened, **Then** only 5 are shown with numbered page controls, and choosing a page shows that page's 5 loans; a page beyond the last falls back to the last page.
3. **Given** closed loans from several years, **When** the user picks a year in the filter, **Then** only that year's loans and their totals are shown; "All years" restores the full list.
4. **Given** a participant with no closed loans, **When** the tab is opened, **Then** it says there are no paid or closed loans yet.
5. **Given** a withdrawn loan, **When** its row is expanded, **Then** the breakdown makes clear how much was paid and that the rest was closed as a withdrawal.

---

### Edge Cases

- A participant with exactly one loan: the Active tab (or Closed tab) shows one collapsed row, with no layout jump when it is expanded.
- All loans closed: the Active tab shows "No active loans." with the closed count still visible on the other tab.
- A loan due today or tomorrow: due text reads "Due today" / "1 day left" and uses the "soon" emphasis, not "overdue".
- A loan with an overpaid or zero balance edge (rounding in centavos): the balance never displays negative and a zero balance moves the loan to Paid and closed.
- Long names or large amounts at 360 px: figures wrap or shorten without horizontal page scroll.
- Adding a payment from the page: after saving, the active list, summary, progress bar and payment list refresh without leaving the page, and a loan that becomes fully paid moves to the Paid and closed tab.
- Dark mode: status colors, the progress bar and the overdue marker stay readable.
- Reduced motion preference: expanding and collapsing has no required animation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The participant page MUST present the Loans section as two tabs, **Active** and **Paid and closed**, each showing its loan count, with Active selected by default.
- **FR-002**: The section MUST show a summary line for the participant's active loans: number of active loans, total balance still to pay, and the number overdue (omitted when zero).
- **FR-003**: Each loan MUST appear as one compact row. Active rows show: status (Open or Overdue), loan date with amount borrowed, balance out of amount due with a progress bar, and a due text with the due date.
- **FR-004**: Active loans MUST be ordered by urgency: overdue first, then nearest due date.
- **FR-005**: The progress bar MUST show interest paid and principal paid as separate segments of the amount due, and a legend in the expanded area MUST name each with its paid-of-owed figures plus the overall percent paid.
- **FR-006**: Overdue rows MUST be visually distinguished from open rows by more than color alone (status text plus a marker).
- **FR-007**: All rows MUST start collapsed. Exactly one row MUST be expandable at a time per tab; expanding a row collapses the previous one, and tapping an expanded row collapses it.
- **FR-008**: An expanded active loan MUST show the amount-due breakdown (principal + interest = amount due), interest paid versus interest owed, principal paid versus principal, balance, due date, and the loan's payment list (date, total, interest part, principal part), or "No payments yet."
- **FR-009**: Every figure available on the current loan card MUST remain available in the redesign (principal, interest, amount due, interest paid, principal paid, balance, due date, and the withdrawal note for withdrawn loans).
- **FR-010**: An expanded active loan MUST offer Add payment, which opens the existing Add transaction flow for that participant and loan, preserving today's behavior.
- **FR-011**: An expanded active loan with a positive balance MUST offer "Pay full balance", which opens the same flow with the amount prefilled to the remaining balance; the user can still change it before saving.
- **FR-012**: For overdue loans, Mark as withdrawal MUST behave as today: usable by owners, shown disabled with the owner-only explanation for staff.
- **FR-013**: The Paid and closed tab MUST list fully paid and withdrawn loans newest first with status (Paid or Withdrawn), loan date, principal plus interest, and the paid-off or closed date; expanding a row shows the principal plus interest breakdown and, for withdrawn loans, the amount paid and the amount closed as withdrawal.
- **FR-014**: The Paid and closed tab MUST show 5 loans per page with numbered page controls matching the Expenses and Sinking fund lists, and MUST offer a year filter with an "All years" option (changing the year returns to page 1); the tab header MUST show the number of matching loans and the total repaid.
- **FR-015**: The Loans section MUST show "No loans yet." when the participant has no loans, and a short empty message in a tab that has none.
- **FR-016**: After a payment, withdrawal or any other change from this page, the Loans section MUST reflect the new figures and tab placement without a manual refresh.
- **FR-017**: The section MUST be fully usable at a 360 px viewport with no horizontal page scroll, in light and dark mode, with tap targets sized for touch and keyboard operation of rows, tabs and filter.
- **FR-018**: The redesign MUST NOT change how loans, payments, balances or statuses are calculated or stored, and MUST NOT change what staff versus owners are permitted to do.

### Key Entities

- **Loan**: A sum lent to a participant: loan date, principal, interest, amount due, due date, status (open, overdue, paid, withdrawn), interest paid, principal paid, balance, and for withdrawn loans the date it was closed.
- **Loan payment**: A payment made against one loan: date, total amount, and how it was split between interest and principal.
- **Participant**: The person who holds the loans; the page already shows their savings, total loans, balance to pay and interest shares.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a participant with 5 active loans, all 5 rows and the summary are visible within one screen height at 360 px before any loan is expanded (versus roughly 3 screens for the current cards).
- **SC-002**: A user can identify which loans are overdue and the total still owed within 5 seconds of the page loading, without expanding anything.
- **SC-003**: A user can go from the page loading to the Add payment dialog open for a chosen loan in 2 taps or fewer.
- **SC-004**: 100% of the figures shown on the current loan card are reachable in the redesign within one tap on that loan.
- **SC-005**: For a participant with 50 closed loans, the page height with the Active tab selected is the same as for a participant with none, and the Paid and closed tab shows at most 5 rows per page.
- **SC-006**: No horizontal page scroll and no clipped text at 360 px width, in light and dark mode, with loan amounts up to ₱9,999,999.99.

## Assumptions

- The mock `sinking_fund_many_loans_compact.html` is the visual and interaction reference (tabs, compact rows, one-open-at-a-time, urgency order, paged closed list with year filter); ROLNET's own design rules and tokens (`DESIGN.md`) take precedence over the mock's literal colors and sizes.
- The mock's fixed "5%" interest label is illustrative; the redesign shows each loan's actual interest amount and does not assume a rate.
- "Pay full balance" is included because the mock shows it; it only prefills the existing Add transaction flow and introduces no new transaction type.
- A loan's payment list is built from the transactions already recorded against that loan; no new data needs to be captured.
- Overdue and "days left" are calculated against the current date in the business timezone already used elsewhere in the app.
- The Paid and closed tab uses numbered page controls like the rest of the app, deliberately with 5 loans per page (smaller than the 10 used on other lists, to keep this section compact); this replaces the mock's "Show more" button.
- Scope is limited to the Loans section of the participant page. The page header, figures, action buttons, History table, and the main Sinking fund screens are unchanged.
- Permissions are unchanged: owners may mark loans as withdrawals; staff may add payments and transactions as today.
