# Feature Specification: Dashboard Refinements

**Feature Branch**: `017-dashboard-refinements`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "1. Enhance UI, the daily collections height should be level with the collected vs expenses chart. 2. The collected vs expenses chart should not expand when clicking 'show all # units'. It should be a pop-up overlay instead with the data. 3. Add a card for the unpaid loans for the sinking fund in the needs attention row so there would be 3 cards now."

## Overview

Three refinements to the Dashboard:

1. The **Daily collections** card and the **Collected vs expenses by unit** card sit side by side in "This month". Today the Daily collections card is much shorter, leaving a large empty gap beneath it. The two cards must end at the same height.
2. In **Collected vs expenses by unit**, "Show all N units" currently expands the card in place, pushing the rest of the page down and making the two cards uneven. It must instead open the full list in a pop-up overlay, leaving the dashboard layout unchanged.
3. The **Needs attention** row (Expiring documents, Unpaid balances) gains a third card for **Unpaid sinking fund loans**, so the owner sees loans still owed alongside the other follow-ups.

## Clarifications

### Session 2026-11-18

- Q: Should the Unpaid sinking fund loans card list every open loan or only overdue ones? → A: All open loans with a balance above zero; overdue ones get an "Overdue" badge.
- Q: When the pop-up closes, should the dashboard refresh its numbers? → A: No; closing changes nothing (no reload, no refresh).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Balanced "This month" row (Priority: P1)

The owner opens the Dashboard and sees Daily collections and Collected vs expenses by unit as two cards of equal height, with no large blank area under the shorter one.

**Why this priority**: It is the most visible flaw on the main screen and the pop-up change (Story 2) is what makes a stable equal height possible.

**Independent Test**: Open the Dashboard at desktop width and measure both cards; their top and bottom edges align. Repeat with 5 units and with 100 units.

**Acceptance Scenarios**:

1. **Given** the Dashboard on a wide screen, **When** it loads, **Then** the Daily collections card and the Collected vs expenses card have the same height and their bottom edges line up.
2. **Given** a fleet with many units, **When** the Dashboard loads, **Then** the heights are still equal and the page does not grow taller because of the unit count.
3. **Given** the equal-height cards, **When** the Daily collections card has less content than its neighbour, **Then** its chart area uses the available space (taller chart) rather than leaving an empty gap.
4. **Given** a narrow screen (360 px), **When** the Dashboard loads, **Then** the two cards stack vertically, each at its natural height, with no horizontal scrolling.

---

### User Story 2 - Full unit list in a pop-up (Priority: P1)

The owner clicks "Show all N units" and the complete per-unit collected vs expenses data appears in a pop-up overlay instead of stretching the card.

**Why this priority**: It is the cause of the uneven layout and is needed for Story 1 to hold after interaction.

**Independent Test**: Click "Show all 100 units"; a pop-up opens with all units; close it; the Dashboard is exactly as before.

**Acceptance Scenarios**:

1. **Given** the Collected vs expenses card showing the top units, **When** the owner clicks "Show all N units", **Then** a pop-up overlay opens listing every unit with its collected amount, expenses amount and net income, in the same order as the card.
2. **Given** the pop-up is open, **When** the list is longer than the screen, **Then** the list scrolls inside the pop-up while its title and close control stay visible.
3. **Given** the pop-up is open, **When** the owner closes it (close button, Escape key, or clicking outside), **Then** the Dashboard is unchanged: card heights, scroll position and data are as they were.
4. **Given** a 360 px screen, **When** the pop-up opens, **Then** it fits the screen width and every amount is readable without sideways scrolling.
5. **Given** the card, **When** there are no more units than the card already shows, **Then** no "Show all" control appears.

---

### User Story 3 - Unpaid sinking fund loans card (Priority: P2)

The owner sees a third card in the Needs attention row listing sinking fund participants who still owe on open loans, largest outstanding balance first, with a link to the Sinking fund page.

**Why this priority**: Adds new information, but the existing dashboard is usable without it.

**Independent Test**: With open loans in the sinking fund, the Dashboard shows the third card with each borrower and their outstanding amount; with none, it shows an "all paid" message.

**Acceptance Scenarios**:

1. **Given** participants with open sinking fund loans, **When** the Dashboard loads, **Then** the Needs attention row shows three cards: Expiring documents, Unpaid balances and Unpaid sinking fund loans.
2. **Given** the new card, **When** it lists borrowers, **Then** each row shows the participant name, the outstanding loan balance (with an "Overdue" badge when any of their open loans is past due), and is ordered largest balance first; the card header shows the total number of borrowers with a link to the Sinking fund page.
3. **Given** more borrowers than the other cards show, **When** the card renders, **Then** it shows the same number of rows as its sibling cards and the header link reaches the full list.
4. **Given** no open loans, **When** the Dashboard loads, **Then** the card shows a friendly empty message (for example "No unpaid loans.") and is still present.
5. **Given** a loan has been fully paid, withdrawn, or removed, **When** the Dashboard loads, **Then** it no longer appears in the card.
6. **Given** a 360 px screen, **When** the row renders, **Then** the three cards stack in a single column.
7. **Given** a user without access to the Sinking fund page, **When** they open the Dashboard, **Then** the card is not shown to them.

### Edge Cases

- A participant has more than one open loan: the card shows one row per participant with the combined outstanding balance, not one row per loan.
- A very long unit or participant name: it truncates or wraps without breaking the card layout or pushing amounts off-screen.
- The Collected vs expenses card has zero units: it shows its empty message, and the Daily collections card still matches its height.
- The Dashboard is in demo mode: the new card and pop-up show demo data consistently.
- Browser window resized across the stacking breakpoint: the layout switches cleanly between stacked and side by side.
- Net income can be negative for a unit: it displays as a negative amount in the pop-up exactly as it does in the card.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On screens wide enough to place them side by side, the Daily collections card and the Collected vs expenses by unit card MUST have equal height.
- **FR-002**: The Daily collections card MUST use its extra height for a taller chart area so it does not show an empty gap.
- **FR-003**: The equal heights MUST hold regardless of the number of units, and MUST NOT change when the unit list is opened or closed.
- **FR-004**: "Show all N units" MUST open a pop-up overlay containing every unit's collected amount, expenses amount and net income, ordered the same way as the card.
- **FR-005**: Opening the pop-up MUST NOT expand the card or move other Dashboard content.
- **FR-006**: The pop-up MUST be closable by a visible close control, the Escape key, and clicking outside it; closing MUST NOT reload, re-fetch or refresh the Dashboard.
- **FR-007**: The pop-up MUST keep its title and close control visible while the list scrolls.
- **FR-008**: The "Show all N units" control MUST appear only when there are more units than the card displays.
- **FR-009**: The Needs attention row MUST contain a third card, "Unpaid sinking fund loans", alongside Expiring documents and Unpaid balances.
- **FR-010**: The new card MUST list participants with open loan balances, one row per participant with the combined outstanding balance, largest first, marked "Overdue" when any of their open loans is past its due date, showing the same number of rows as the other Needs attention cards.
- **FR-011**: The new card header MUST show the total number of borrowers and link to the Sinking fund page.
- **FR-012**: The new card MUST show an empty-state message when no open loans exist, and MUST exclude loans that are fully paid, withdrawn or deleted.
- **FR-013**: The new card MUST be shown only to users who can access the Sinking fund page.
- **FR-014**: All amounts MUST be shown in pesos with the same formatting used elsewhere on the Dashboard.
- **FR-015**: Every changed element MUST work at a 360 px viewport: cards stack, the pop-up fits, and nothing scrolls sideways.
- **FR-016**: The changes MUST use the existing visual style (colors, spacing, card look) and introduce no new look.

### Key Entities

- **Unit income row**: A unit's name with its collected, expenses and net income for the current month (existing data, now also shown in the pop-up).
- **Unpaid loan borrower**: A sinking fund participant with at least one open loan, shown with the total outstanding balance across their open loans.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a desktop-width Dashboard, the vertical difference between the bottom edges of the Daily collections and Collected vs expenses cards is 0 for fleets of 5, 20 and 100 units.
- **SC-002**: Clicking "Show all N units" changes the Dashboard page height by 0 and displays all N units in the pop-up.
- **SC-003**: An owner can open the full unit list, find a specific unit, and close the pop-up in under 15 seconds.
- **SC-004**: An owner can see how many sinking fund borrowers still owe, and the largest balance, within 5 seconds of opening the Dashboard, without visiting the Sinking fund page.
- **SC-005**: The Dashboard is fully usable at 360 px width with no sideways scrolling, including the open pop-up.
- **SC-006**: The Dashboard's loading time shows no noticeable slowdown compared with before the change.

## Assumptions

- "Unpaid loans" means all sinking fund loans that are still open (outstanding balance above zero); overdue ones are flagged with a badge, and paid and withdrawn loans are excluded.
- The new card follows the same conventions as the sibling cards: most urgent (largest balance) first, a short list with a "View all" link, and an empty-state message.
- The pop-up uses the app's existing dialog look and behaviour (as used by other pop-ups such as the Sinking fund add-transaction modal).
- The pop-up shows the full list in the card's existing order rather than adding new sorting or filtering.
- Equal height applies from the tablet/desktop width where the two cards are side by side; on phones they stack at natural heights.
- Sinking fund access follows the existing role rules; no new permissions are introduced.
- No data or storage changes are needed for the pop-up; the new card reads existing sinking fund loan data.
