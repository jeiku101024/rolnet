# Feature Specification: Sinking Fund Refinements

**Feature Branch**: `016-sinking-fund-refinements`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "(Follow-up, 2026-11-14: Overall Savings counts ticked participants only; after distribution the share is added to total individual savings; "View history" lists all distributions, each clickable to a table of participants with ended total savings and distributed shares plus the Sinking fund total for the year, highest to lowest, downloadable as Excel fit to 1 page, narrow margins, A4; after distribution total savings, loans, balance, and payments reset to 0.) Original: 1. Change distribution calculation. Client said no participants should have equal distribution as it will be unfair. Calculation will be (Total Individual Savings/Overall Savings) * Total Interest Fund. 2. Remove this divider sticking at the top not only in sinking fund page but inspect also other pages. Also, remove divider sticking on paginations. 3. Viewing a participant need to scroll on the right of the pop up and not so user-friendly. Just in the center and all details fit in a pop up like the add transaction modal. closing it would not rerender too. 4. Also, dates in this deposit,loan,payment chart are not clear. the color is not suitable."

## Overview

Feedback from the client (Rolnet) on the Sinking fund page (feature 015) and the app's list screens. Six changes:

1. The Interest fund is shared **in proportion to savings**, not in equal shares. A participant who saved more gets a bigger share.
2. A distribution is a **year-end close**: the share is added to savings, the ended totals are saved, and every ticked participant starts again from ₱0.00. It is blocked while a ticked participant still has an unpaid loan.
3. "View history" lists every distribution. Opening one shows a table of participants with ended total savings and share, highest first, the Sinking fund total for the year, and a one-page A4 Excel download.
4. A stray horizontal line ("divider") shows at the top of list toolbars and at the bottom of pagination footers. It is removed everywhere it appears, not only on the Sinking fund page.
5. A participant's details open in a **centered pop-up that fits its content**, like the Add transaction pop-up, with no side scrolling. Closing it does not reload the page behind it.
6. The month labels and colors of the "Deposits, loans, and payments" chart are hard to read. They are made clear.

This feature changes how the Sinking fund page looks, how interest is shared, and what happens to totals after a distribution. It adds no new pages.

## Clarifications

### Session 2026-11-14

- Q: When the owner unticks a participant in the Distribute pop-up, does that participant's savings still count in "Overall Savings"? → A: No. "Overall Savings" is the sum of the savings of the **ticked** participants only, so the whole fund is shared among them.
- Q: What does "total savings, loans, balance, and payments reset to 0 after distribution" mean? → A: A year-end close. The share is added to each ticked participant's savings, the ended total is saved in the distribution history, and then each ticked participant starts a new cycle at ₱0.00 for savings, loans, balance, and payments. The old transactions stay in history.
- Q: What happens to loans still Open or Overdue at distribution time? → A: Distribution is blocked until every loan of the ticked participants is paid or withdrawn, so a reset never hides money owed.
- Q: After the reset, should charts and rankings show only the new cycle or keep earlier figures? → A: The summary cards, savings donut, and rankings show the current cycle only; the monthly "Deposits, loans, and payments" chart keeps all past months; closed years are read in the distribution history.
- Q: Who may open the distribution history and download its Excel file? → A: Only the owner; staff see no history list, details, or download.
- Q: Is "Sinking fund total for the year" the total of one distribution or of all distributions in the calendar year? → A: The total of that one distribution. The owner normally distributes once a year, at year end, so one distribution is one year; the page does not limit how many distributions are made.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Share the Interest fund in proportion to savings (Priority: P1)

The owner distributes the Interest fund and each participant's share depends on how much that participant has saved: **(participant's total savings ÷ overall savings) × Interest fund available**. No one gets an equal share just for being a participant.

**Why this priority**: It changes how real money is paid out, and the client called equal shares unfair. It must be right before the next distribution.

**Independent Test**: With ₱300 in the Interest fund and three active participants who saved ₱1,000, ₱2,000, and ₱3,000, open Distribute and confirm the shares read ₱50.00, ₱100.00, and ₱150.00; confirm, then check each participant's savings, the fund, the history, and the audit.

**Acceptance Scenarios**:

1. **Given** the Distribute pop-up, **When** it opens, **Then** each participant row shows that participant's savings and their calculated share, and the text "Each participant gets ₱X" is gone.
2. **Given** participants with different savings, **When** the owner views the pop-up, **Then** a participant with more savings has a larger share, and shares are in the same ratio as savings.
3. **Given** two participants with the same savings, **When** shares are calculated, **Then** their shares are the same; equal savings is the only way to get equal shares.
4. **Given** a participant with ₱0 savings, **When** shares are calculated, **Then** that participant gets ₱0.00 and is shown as "No savings, no share".
5. **Given** shares that do not divide into whole centavos, **When** they are calculated, **Then** each share is rounded down to the centavo, and the leftover centavos stay in the Interest fund and are shown (for example "₱0.02 stays in the fund.").
6. **Given** a confirmation, **When** it succeeds, **Then** one distribution record and one Interest share transaction are created for each participant with a share above ₱0.00, savings and the fund are updated, and the toast names the total distributed and the number of participants who received a share.
7. **Given** the owner unticks a participant, **When** the pop-up updates, **Then** that participant's savings no longer count in "Overall Savings" and the shares of the remaining ticked participants change at once.
8. **Given** no ticked participant has savings, **When** the owner opens Distribute, **Then** it explains that there is nothing to share and the confirm button is disabled.
9. **Given** a past distribution made with equal shares, **When** the owner opens "View history" or the participant's history, **Then** it is shown unchanged; only new distributions use the proportional rule.
10. **Given** a ticked participant has an Open or Overdue loan, **When** the owner opens Distribute, **Then** that participant is flagged "Has an unpaid loan", the confirm button is disabled, and the pop-up explains that the loan must be paid or withdrawn first.
11. **Given** a successful distribution, **When** it completes, **Then** each ticked participant's share is added to their total savings, the resulting **ended total savings** is recorded in the distribution history, and then each ticked participant's total savings, total loans, balance to pay, and payments all show ₱0.00 for the new cycle.
12. **Given** the reset, **When** the owner opens any participant, the Participants view, or the Top participants view, **Then** the summary cards, savings donut, rankings, and participant totals show the new cycle from ₱0.00, while all earlier transactions remain visible in the Transactions view and history with their original dates and amounts, and the monthly "Deposits, loans, and payments" chart keeps all past months.
13. **Given** a participant who was unticked, **When** the distribution completes, **Then** that participant's savings, loans, balance, and payments are not changed and not reset.
14. **Given** the Distribute pop-up, **When** the owner reads it, **Then** it warns in plain language that confirming also closes the year: ended totals are saved and every ticked participant starts again from ₱0.00.
15. **Given** a distribution that has been closed and reset, **When** the owner voids it, **Then** the void is allowed only if no transaction has been recorded for any of its participants since; it then restores their totals from before the distribution. Otherwise it is blocked with an explanation.
16. **Given** a participant whose year was closed on a date, **When** anyone records or edits a transaction for that participant dated on or before that date, **Then** it is blocked with "{name}'s year was closed on {date}. Use a later date."
17. **Given** the Distribute pop-up, **When** the owner picks a date earlier than the latest activity of any ticked participant, **Then** it is blocked with "The distribution date cannot be before {date}, when {name} last had activity."
18. **Given** a closed participant, **When** the owner tries to void an earlier transaction of theirs that is dated on or before the close, or tries to void the year-end close row on its own, **Then** it is blocked with a message to void the whole distribution first.

---

### User Story 2 - Review each distribution and download it as Excel (Priority: P1)

"View history" lists every past distribution. The owner picks one and sees a table of all the participants who took part, with each one's **ended total savings** and **distributed share**, arranged from highest to lowest. The details also show the **Sinking fund total for the year**. The owner can download the same table as an Excel file that prints on one A4 page.

**Why this priority**: The year-end reset removes the totals from the live page, so this history is the only place to see what each participant ended with. It must exist at the same time as the reset.

**Independent Test**: Make two distributions in different years. Open "View history", check that both are listed, open each, check the table order, the year total, and the figures, then download the Excel file and check it opens as one A4 page with narrow margins.

**Acceptance Scenarios**:

1. **Given** the Interest fund card, **When** the owner clicks "View history", **Then** a list of all distributions shows, newest first, each with its date, the year, total distributed, and number of participants who received a share, and voided ones are marked "Voided".
2. **Given** the list, **When** the owner clicks a distribution, **Then** its details open and show a table of every participant who took part.
3. **Given** the details table, **When** it shows, **Then** each row has the participant's name, **ended total savings** (savings including the share just added), and **distributed share**, and the rows are arranged from highest to lowest ended total savings, with ties ordered by name.
4. **Given** the details, **When** they show, **Then** they also show the **Sinking fund total for the year** (the sum of all participants' ended total savings in that distribution), the Interest fund distributed, the leftover that stayed in the fund, the number of participants, the distribution date, and any notes.
5. **Given** the details table, **When** the owner views it, **Then** a totals row shows the sum of ended total savings and the sum of shares.
6. **Given** the details, **When** the owner chooses "Download Excel", **Then** an Excel file of the same table and details downloads, with the distribution's year and date in its file name.
7. **Given** the downloaded file, **When** it is opened or printed, **Then** it fits on one page, A4 size, with narrow margins, shows the title, year, date, Sinking fund total for the year, the table in the same order, and the totals row, and no column is cut off.
8. **Given** a participant who has a share in a past distribution, **When** the owner opens that participant, **Then** the share still shows in their history.
9. **Given** a distribution from before this change (equal shares, no ended-savings record), **When** its details open, **Then** they show what is known (date, total, shares) and mark the missing ended totals as "Not recorded" instead of inventing figures.
10. **Given** a non-owner user, **When** they open the Sinking fund page, **Then** they see no distribution history list, no distribution details, and no Excel download, and the Distribute action stays owner-only; any attempt to reach them is rejected by the server.
11. **Given** a 360 px wide screen, **When** the list and the details table show, **Then** they are readable without sideways scrolling (for example each participant shown as a stacked row), and the download action is easy to reach.

---

### User Story 3 - Remove the stray divider lines (Priority: P2)

On list screens, a thin horizontal line sticks to the top of the toolbar (above the search box and the Filters and Add buttons) and a line sticks to the bottom of the pagination footer (below "Page 1 of 21"). They look like a leftover edge, not part of the design. They are removed on the Sinking fund page and on every other page where they appear.

**Why this priority**: It is a visual polish issue that affects every list, but it does not change any data or workflow.

**Independent Test**: Open Units, Drivers, Remittances, Expenses, Audit, Documents, and the Sinking fund page. Check that no stray line shows above the toolbar or below the pagination footer, at phone width and at desktop width.

**Acceptance Scenarios**:

1. **Given** any list or table screen, **When** it loads, **Then** no extra line shows above the search and filter row.
2. **Given** a list with more than one page, **When** the pagination footer shows, **Then** no extra line shows below it.
3. **Given** every page that has a list, table, or pagination, **When** each is reviewed, **Then** none shows these lines; the review result is recorded.
4. **Given** the cards on the page, **When** the lines are removed, **Then** the card's own outline and rounded corners stay, and the toolbar, rows, and footer keep clear spacing.
5. **Given** a 360 px wide screen, **When** any of these screens loads, **Then** nothing overlaps and nothing scrolls sideways.

---

### User Story 4 - View a participant in a centered pop-up (Priority: P2)

When the owner opens a participant, the details appear in a pop-up in the center of the screen, sized to fit its content like the Add transaction pop-up. Totals, buttons, loans, and history are all readable without scrolling sideways. Closing the pop-up returns to the page exactly as it was, with no reload, flicker, or loss of scroll position.

**Why this priority**: Today the details open in a wide side panel that scrolls to the right, which is hard to use on a phone. The page is used daily, so this matters, but money handling does not depend on it.

**Independent Test**: At 360 px width, open a participant who has loans and several history entries. Check that every detail is visible without sideways scrolling, then close it and check that the page behind it did not reload, keeps its scroll position, and keeps its search and filters.

**Acceptance Scenarios**:

1. **Given** the Participants view, **When** the user opens a participant, **Then** the details show in a centered pop-up styled like the Add transaction pop-up (title, close button, dimmed background).
2. **Given** the pop-up, **When** it shows, **Then** it contains the participant's name, role tag, Total savings, Total loans, Balance to pay, the Add transaction and Withdraw savings buttons, the Loans section, and the History section.
3. **Given** the pop-up at any width from 360 px up, **When** it shows, **Then** there is no sideways scrolling; long text wraps and each history entry shows its date, type, amount, and note without being cut off.
4. **Given** a long history, **When** it does not fit the screen, **Then** only the history area scrolls up and down inside the pop-up, and the title and close button stay visible.
5. **Given** the pop-up is open, **When** the user closes it (close button, Escape, or a tap outside it), **Then** the page behind it does not reload or flash, scroll position, search text, sort, and filters are unchanged, and focus returns to the control that opened it.
6. **Given** the user chooses Add transaction or Withdraw savings from the pop-up, **When** that form opens and is finished or cancelled, **Then** the user is brought back to the participant pop-up with the updated totals.
7. **Given** a non-owner user, **When** the pop-up shows, **Then** owner-only actions stay disabled with the "Owner only" tooltip, as before.

---

### User Story 5 - Make the monthly chart readable (Priority: P3)

The "Deposits, loans, and payments" chart shows month labels that are too pale to read, and its colors are hard to tell apart. The month labels become clearly readable and the three series use distinct, suitable colors that match the app's palette.

**Why this priority**: The chart works, but it is hard to read. It is a visual fix with no effect on data.

**Independent Test**: Open the Participants view with data in several months. Check that every month label is readable and that Deposits, Loans, and Payments can each be told apart in the chart and in the legend, including with the "View as table" option.

**Acceptance Scenarios**:

1. **Given** the chart, **When** it shows, **Then** every month label (for example "Nov 26") is clearly readable against the card background, with no faded or hidden labels.
2. **Given** the chart, **When** the three series are shown, **Then** Deposits, Loans, and Payments use clearly different colors that match the app's design colors, and the legend uses the same colors.
3. **Given** a series, **When** it is shown, **Then** the user can tell it apart without relying on color alone (for example through the legend text, the tooltip, or the "View as table" option).
4. **Given** a month with no activity, **When** the chart shows, **Then** its label still shows and the empty slot reads as empty, not as missing.
5. **Given** a 360 px wide screen, **When** the chart shows, **Then** labels do not overlap or get cut off; if there is not enough room, labels are thinned out in a clear way.
6. **Given** the other charts on the page (for example the savings donut), **When** the colors change, **Then** they stay consistent with each other.

---

### Edge Cases

- A participant's savings are tiny compared to the others: their share may round down to ₱0.00; they are shown with ₱0.00 and no transaction is created for them.
- Every participant rounds down to ₱0.00 (the fund is only a few centavos): the confirm button is disabled with a plain explanation.
- One participant holds all the savings: that participant gets the whole fund (less nothing); the others get ₱0.00.
- Savings change between opening the Distribute pop-up and confirming: the server recalculates the shares at confirmation; if they no longer match what was shown, the owner is asked to review the new figures before confirming.
- A participant has savings but nobody else is ticked: that participant gets the whole fund, ends the year with their savings plus the fund, and then resets to ₱0.00.
- A ticked participant has an Open or Overdue loan: the distribution cannot be confirmed until the loan is paid or withdrawn; unticking that participant lets the others proceed.
- A participant is not ticked: they keep their savings, loans, balance, and payments; they are not reset and do not appear in that distribution's details table.
- Two distributions in the same year: each has its own details and year total; the year total is the sum of ended total savings in that distribution only.
- A distribution is voided after totals were reset: allowed only if no new transaction exists for its participants; otherwise blocked with an explanation (see User Story 1).
- A very long participant name or many participants in the details table: text wraps, and the Excel file still fits one A4 page.
- A distribution from before this feature has no ended totals: its details show "Not recorded" for them.
- A participant's old transaction is voided after the year was closed: blocked, because it would change the saved ended total; the owner voids the distribution first (if there is no later activity).
- A deposit is entered for a closed participant with an old date: blocked with the "year was closed" message; the owner uses a date after the close.
- A participant is archived: archived participants never appear in the Distribute pop-up, as before, and their savings are not part of "Overall Savings".
- The participant pop-up is open while the data changes (a transaction is added): the totals and history in the pop-up update without closing it.
- A participant has no loans or no history: the pop-up shows "No loans yet." and "No history yet." and still fits without scrolling.
- The chart has only one month of data, or none: the chart shows an understandable empty message instead of a blank area.
- A page has no toolbar or no pagination (a detail page with a short list): no divider or gap is left behind where one was removed.

## Requirements *(mandatory)*

### Functional Requirements

**Proportional distribution**

- **FR-001**: The system MUST calculate each participant's share of a distribution as (participant's total savings ÷ overall savings) × Interest fund available, rounded down to the centavo.
- **FR-002**: The Distribute pop-up MUST show, for each participant, their savings and their calculated share, and MUST update the shares live when the owner ticks or unticks a participant.
- **FR-003**: The system MUST NOT give equal shares to participants with different savings. The "Each participant gets ₱X" wording and equal-split calculation MUST be removed.
- **FR-004**: A participant with ₱0 savings MUST receive ₱0.00 and MUST NOT get an Interest share transaction.
- **FR-005**: Centavos left over from rounding down MUST stay in the Interest fund and MUST be shown to the owner before confirming.
- **FR-006**: The shares plus the leftover MUST always equal the amount distributed from the fund (no centavo lost or created).
- **FR-007**: A confirmed distribution MUST create one distribution record and one Interest share transaction per participant who received more than ₱0.00, add each share to that participant's savings, and reduce the fund by the total distributed.
- **FR-008**: The system MUST recalculate the shares when a distribution is confirmed and MUST ask the owner to review new figures if they differ from what the pop-up showed.
- **FR-009**: The system MUST NOT allow a distribution when there is nothing to share (no savings, or the fund is empty or too small to give anyone a centavo) and MUST explain why.
- **FR-010**: Past distributions and their shares MUST remain unchanged, and the distribution history MUST show each participant's own share rather than one per-participant amount.
- **FR-011**: The distribution rules MUST keep all money in whole centavos and keep the audit entries, owner-only restriction, void behavior, and soft deletion from feature 015.
- **FR-012**: The product documentation and the Sinking fund text on screen that describe equal sharing MUST be updated to describe proportional sharing.
- **FR-012a**: "Overall savings" MUST be the sum of the total savings of the **ticked** participants only; unticked participants MUST NOT affect anyone's share.

**Year-end close and reset**

- **FR-031**: A confirmed distribution MUST add each share to the participant's total savings, record that participant's **ended total savings** (savings including the share) and **distributed share** in the distribution's record, and then reset the participant's total savings, total loans, balance to pay, and payments to ₱0.00 for a new cycle.
- **FR-032**: The reset MUST apply only to the ticked participants of that distribution; unticked participants MUST NOT be changed.
- **FR-033**: The reset MUST NOT delete or change any earlier transaction; the participant's history, the Transactions view, and audit entries MUST still show every earlier record.
- **FR-033a**: After a reset, the summary cards, savings donut, rankings, and participant totals MUST show the current cycle only, and the monthly "Deposits, loans, and payments" chart MUST keep showing all past months.
- **FR-034**: The system MUST NOT allow a distribution while any ticked participant has an Open or Overdue loan, MUST flag each such participant in the Distribute pop-up, and MUST explain that the loan must be paid or withdrawn first.
- **FR-035**: The Distribute pop-up MUST warn, in plain language, that confirming also closes the year and resets the ticked participants to ₱0.00, and MUST require the owner's explicit confirmation.
- **FR-036**: The ended totals MUST be stored with the distribution at the time it is made, so later changes (new deposits, edits, resets) never alter a past distribution's figures.
- **FR-037**: Voiding a distribution that reset totals MUST be allowed only when no transaction has been recorded for any of its participants since; it MUST then restore their totals from before the distribution, and otherwise MUST be blocked with an explanation.
- **FR-038**: The distribution, the reset, and any void MUST be written to the audit log with who did it and when, and MUST happen all together or not at all.
- **FR-048**: The distribution date MUST NOT be earlier than the latest non-voided transaction date of any ticked participant, and the system MUST explain which participant and date caused the block.
- **FR-049**: After a participant's year is closed, the system MUST NOT accept a new or edited transaction for that participant dated on or before the close date, and MUST say so in plain language.
- **FR-050**: After a participant's year is closed, the system MUST NOT allow voiding a transaction of that participant dated on or before the close date, or voiding a year-end close row on its own; the owner voids the whole distribution instead (FR-037 applies).

**Distribution history, details, and Excel download**

- **FR-039**: "View history" MUST list every distribution, newest first, with its date, year, total distributed, number of participants who received a share, and a "Voided" marker where it applies.
- **FR-040**: Each distribution in the list MUST be clickable and MUST open its details.
- **FR-041**: The details MUST show a table of every participant who took part, with name, **ended total savings**, and **distributed share**, arranged from highest to lowest ended total savings, ties ordered by name, and a totals row.
- **FR-042**: The details MUST show the **Sinking fund total for the year** (the sum of the ended total savings in that one distribution, shown with the distribution's year), the Interest fund distributed, the leftover, the number of participants, the date, and notes.
- **FR-043**: The details MUST offer "Download Excel", which downloads the same details and table in the same order, with the year and date in the file name.
- **FR-044**: The downloaded Excel file MUST print on **one A4 page** (fit to one page wide and tall) with **narrow margins**, with no column cut off.
- **FR-045**: Distributions made before this change MUST still be listed and open, showing known figures and "Not recorded" where ended totals are missing; the Excel download MUST work for them too.
- **FR-046**: The history list and the details table MUST be readable at 360 px without sideways scrolling.
- **FR-047**: The distribution history list, the distribution details, and the Excel download MUST be available to the owner only; for other users they MUST be hidden and any request for them MUST be rejected by the server.

**Divider lines**

- **FR-013**: List toolbars MUST NOT show a stray line above the search and filter row, on the Sinking fund page or on any other page.
- **FR-014**: Pagination footers MUST NOT show a stray line below them, on any page.
- **FR-015**: Every page that has a list, table, or pagination MUST be reviewed, and each stray line found MUST be removed; the pages reviewed and the result MUST be recorded.
- **FR-016**: Removing the lines MUST keep the card outline, rounded corners, and clear spacing, and MUST NOT cause overlap or sideways scrolling at 360 px width.

**Participant details pop-up**

- **FR-017**: Viewing a participant MUST open a pop-up in the center of the screen, styled and sized like the Add transaction pop-up, instead of a side panel.
- **FR-018**: The pop-up MUST show the participant's name and role, Total savings, Total loans, Balance to pay, the Add transaction and Withdraw savings actions, the Loans section, and the History section.
- **FR-019**: The pop-up MUST NOT need sideways scrolling at any width from 360 px up; content MUST wrap or reflow to fit.
- **FR-020**: When content is taller than the screen, only the pop-up's body MUST scroll vertically while its title and close button stay visible.
- **FR-021**: Closing the pop-up MUST NOT reload or redraw the page behind it, and MUST keep its scroll position, search text, sort, and filters.
- **FR-022**: The pop-up MUST close with its close button, the Escape key, and a tap outside it, and MUST return focus to the control that opened it.
- **FR-023**: Opening Add transaction or Withdraw savings from the pop-up MUST bring the user back to the participant pop-up afterwards, with updated totals.
- **FR-024**: Owner-only actions in the pop-up MUST remain disabled with an "Owner only" tooltip for non-owners.

**Monthly chart**

- **FR-025**: The "Deposits, loans, and payments" chart MUST show every month label clearly readable against its background.
- **FR-026**: The chart MUST use three clearly different colors from the app's design colors for Deposits, Loans, and Payments, and the legend MUST match.
- **FR-027**: Each series MUST be identifiable without color alone, through the legend text and tooltip or the "View as table" option.
- **FR-028**: Months with no activity MUST still show their label, and the chart MUST show an understandable message when there is no data at all.
- **FR-029**: At 360 px width, chart labels MUST NOT overlap or be cut off.
- **FR-030**: Colors used by the other charts on the page MUST stay consistent with the new chart colors.

### Key Entities *(include if feature involves data)*

- **Interest distribution**: a sharing of the Interest fund on a date. It records the amount available before, the total distributed, the leftover, the number of participants who received a share, notes, who made it, and a voided marker. It no longer has one per-participant amount; each participant's share is stored on that participant's Interest share.
- **Interest share**: the amount one participant received in a distribution. It is added to that participant's savings and is tied to its distribution. Shares in one distribution can differ.
- **Participant**: a person who saves in the fund. Total savings is the base for the proportional share. After a distribution, total savings, loans, balance, and payments start again at ₱0.00.
- **Overall savings**: the sum of the total savings of the ticked participants.
- **Distribution participant record**: for one participant in one distribution, the ended total savings (including the share) and the distributed share, saved when the distribution is made and never changed afterwards.
- **Sinking fund total for the year**: the sum of the ended total savings of all participants in one distribution.
- **Cycle**: the period from one distribution to the next; totals on the page show the current cycle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any distribution, every participant's share matches (their savings ÷ overall savings) × fund available, rounded down, in 100% of checked cases, and shares plus leftover equal the amount distributed to the centavo.
- **SC-002**: With savings of ₱1,000, ₱2,000, and ₱3,000 and a ₱300 fund, the owner sees shares of ₱50.00, ₱100.00, and ₱150.00 before confirming, and the same amounts are added to savings.
- **SC-003**: No stray divider line is visible above the toolbar or below the pagination footer on any page, at 360 px and at desktop width, verified by reviewing every page with a list.
- **SC-004**: A user can open a participant, read all details, and close the pop-up at 360 px width without any sideways scrolling.
- **SC-005**: Closing the participant pop-up leaves the page behind it unchanged: no visible reload or flash, and scroll position, search, sort, and filters are the same as before opening it.
- **SC-006**: All month labels in the chart are readable at normal viewing distance and have a text-to-background contrast ratio of at least 4.5:1, and a new user can name which color is Deposits, Loans, and Payments without help.
- **SC-008**: After a distribution, 100% of ticked participants show ₱0.00 total savings, loans, balance, and payments, unticked participants are unchanged, and every earlier transaction is still visible in history.
- **SC-009**: A distribution cannot be confirmed while any ticked participant has an Open or Overdue loan, in 100% of checked cases.
- **SC-010**: The owner can open any past distribution from "View history" in two taps or clicks and see the year total and the participant table sorted highest to lowest, matching the figures recorded at the time.
- **SC-011**: The downloaded Excel file prints on exactly one A4 page with narrow margins for distributions with up to 50 participants, with no cut-off columns, and its figures match the on-screen details.
- **SC-007**: In a plain-language review with the client, the owner confirms that the sharing rule is fair and that the participant pop-up is easier to use than the side panel.

## Assumptions

- "Total Interest Fund" in the client's formula is the **Interest fund available** (collected minus already distributed), the same amount the page shows today.
- "Total individual savings" is each participant's current Total savings at the time of the distribution.
- Past distributions made with equal shares stay as they are; the new rule applies only to distributions made after this change.
- "Sinking fund total for the year" is the sum of all participants' ended total savings (savings plus share) in that one distribution. The owner normally distributes once a year at year end; the system does not limit how many distributions are made, and it does not add several distributions together.
- The year-end reset is the intended business rule: ended savings are treated as paid out or closed at the distribution, and a new cycle starts at ₱0.00. Recording the actual cash payout is outside this feature.
- Terms: "year-end close" is the action a distribution performs; a "cycle" is the period between two closes; "reset" describes the result (totals back to ₱0.00). FR-048 to FR-050 are rules this feature adds to keep saved ended totals true; the owner confirms them during the plain-language review (SC-007).
- "Payments" and "Balance to pay" reset together with loans because loans must be closed before a distribution can happen.
- The Excel file follows the app's existing report download pattern, with money shown in pesos from whole centavos.
- The owner can still tick or untick participants before confirming, and archived participants never take part.
- The "stray divider" is the thin horizontal line shown at the top edge of list toolbars and at the bottom edge of pagination footers in the client's screenshots; it is a visual leftover, not a content separator the client wants to keep. Dividers between rows, between sections inside a card, and under table headers stay.
- The participant pop-up reuses the same pop-up look and behavior as the Add transaction pop-up and the app's existing colors, fonts, and spacing; no new design system or libraries are added.
- Everything keeps working at 360 px width, in line with the mobile-first rule.
- This feature depends on the Sinking fund page from feature 015 and on the shared list, toolbar, and pagination screens used across the app.
