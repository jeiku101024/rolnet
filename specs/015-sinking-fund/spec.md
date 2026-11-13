# Feature Specification: Sinking Fund

**Feature Branch**: `015-sinking-fund`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "SINKING FUND (client: Rolnet) — a new page where the owner tracks a sinking fund: participants save money, can borrow from their own savings at 5% interest, and repay. All loan interest goes into a shared Interest fund that the owner divides equally among active participants and adds to their savings. The owner decides when each loan's interest is taken from its payments." Visual reference: `sinking_fund_page_mockup_v2.html` (the user's Downloads folder).

## Overview

Rolnet gets a "Sinking fund" page. Participants (often, but not always, drivers) save money into a shared fund. A participant can borrow from their **own** savings at 5% interest for one month and pay it back in parts. The interest does not go to the borrower. It goes into a shared **Interest fund**. The owner shares that fund equally among active participants whenever they choose (for example at year end), and each share is added to the participant's savings.

The page lives at `/sinking-fund` with three views (Transactions, Top participants, Participants), two entry forms (add participant, add transaction), and owner-only tools (set interest part, withdrawal, distribute interest, fund settings, void, archive). It reuses the patterns of the existing pages: modal forms opened from "+" buttons beside Filters, toasts, status tags with icon and text, 3-dot menus, and the existing colors and fonts.

## Clarifications

### Session 2026-11-13

- Q: How can a participant take their own savings out of the fund (for example, when they leave)? → A: Add an owner-only "Savings withdrawal" transaction type that reduces Total savings (never below ₱0), can be voided, is audited, and has its own tag. The loan-closing record keeps the name "Withdrawal" (the loan Withdrawal); the two are always labeled distinctly.
- Q: Should the "never below ₱0" and "loan cannot exceed savings" checks use savings as of a back-dated transaction's date, or only current savings? → A: Check at the transaction's date and at every later date. Any entry or void that would make a participant's Total savings (or the Interest fund) negative on any date is blocked.

## Concepts and Definitions

- **Participant**: a person in the fund, with a name and an optional link to a driver record.
- **Transaction types**: Deposit, Loan, and Payment are entered in the Add transaction form. Withdrawal (the "loan Withdrawal") is created by the owner when closing an overdue loan. Savings withdrawal is recorded by the owner when paying a participant's savings back out to them. Interest share is created when the owner distributes the Interest fund.
- **Total savings** (per participant): running savings balance, derived from transactions.
- **Loan**: borrowed from the participant's own savings.
  - **Principal**: the amount borrowed, in steps of ₱100 only, so the interest is always a whole-peso amount.
  - **Interest rate**: 5%, stored on the loan so a later rate change never alters old loans.
  - **Interest**: principal × 5% (₱2,000 gives ₱100). **Amount due**: principal + interest (₱2,100).
  - **Due date**: loan date + 1 calendar month (Nov 3 → Dec 3). If that day does not exist, the last day of that month (Jan 31 → Feb 28).
  - **Paid**: sum of the loan's payments, split into interest paid and principal paid. **Unpaid interest** = interest − interest paid. **Unpaid principal** = principal − principal paid. **Balance** = amount due − paid (= unpaid interest + unpaid principal).
  - **Status**: Open (balance above 0, not past due), Overdue (balance above 0, past due date), Paid (balance 0), Withdrawn (closed by the owner).
- **Interest collection**: the owner decides, payment by payment, how much of each payment is interest (goes to the Interest fund) and how much is principal (returns to savings). The loan's full interest must be collected by the time its balance reaches 0. Interest can only be waived by closing the loan as a withdrawal.
- **Total loans** (per participant): principal of their Open and Overdue loans. **Balance to pay** (per participant): sum of balances of their Open and Overdue loans. A participant may have several loans open at once.
- **Interest fund**: interest collected from all payments minus what has already been distributed. It belongs to the fund, not the borrower.

## Calculation Rules

**Per participant**

- Deposit: Total savings increases by the amount.
- Loan: Total savings decreases by the principal. The amount due is added to Balance to pay.
- Payment (on one chosen loan): the loan balance decreases by the amount. The amount is split into an interest part (to the Interest fund) and a principal part (back to Total savings).
  - Allowed interest part, calculated from the loan's other non-voided payments: **at most** the smaller of the payment amount and the loan's unpaid interest; **at least** the payment amount minus the loan's unpaid principal, or 0 if negative.
  - Only the owner sets the interest part (when recording the payment or later). Payments recorded by anyone else use the default from Fund settings.
  - When the balance reaches 0 the loan becomes Paid; the allowed range guarantees the full interest is in the Interest fund and the full principal is back in savings.
- Withdrawal (owner, Overdue loan only): closes the loan, balance becomes 0, status Withdrawn. Total savings does **not** change (the principal was already deducted when the loan was taken). Unpaid interest is waived. This is the only way interest can be waived.
- Savings withdrawal (owner only): Total savings decreases by the amount. The Interest fund and any loans are unaffected. It cannot exceed the savings available on its date, and every later date must stay at ₱0 or above.
- Interest share: Total savings increases by the participant's share.

**Rules**

- A loan cannot exceed the participant's savings available on the loan's date (and every later date must stay at ₱0 or above), and must be in steps of ₱100.
- A payment cannot exceed the chosen loan's balance.
- Amounts must be greater than 0.
- Total savings and the Interest fund can never go below 0, **on any date in their history**. Any action (including a void or a back-dated entry) that would make either negative on its own date or any later date is blocked with an inline error naming the date and the amount available then (for example, "Ana only had ₱1,000 on Nov 5."). "Loan cannot exceed Total savings" and "Savings withdrawal cannot exceed Total savings" use the savings available on the transaction's date, and must also keep every later date at ₱0 or above.
- A payment's date cannot be earlier than its loan's date, and a loan Withdrawal is dated today.
- All totals are derived from transaction records (never typed in), so they can always be recalculated.

**Worked example A — default "Take interest first"**

| Step | Transaction | Total savings | Loan balance | Interest fund | Loan status |
|------|-------------|---------------|--------------|---------------|-------------|
| 1  | Deposit ₱10,000 | 10,000 | 0 | 0 | - |
| 2  | Loan ₱2,000 (interest 100, due 2,100) | 8,000 | 2,100 | 0 | Open |
| 3  | Payment ₱500 (interest 100, principal 400) | 8,400 | 1,600 | 100 | Open |
| 4a | Payment ₱1,600 (all principal) | 10,000 | 0 | 100 | Paid |
| 4b | (instead of 4a) after the due date, owner marks Withdrawal | 8,400 | 0 | 100 | Withdrawn |

**Worked example B — owner takes the interest on the second payment**

| Step | Transaction | Total savings | Loan balance | Interest fund | Loan status |
|------|-------------|---------------|--------------|---------------|-------------|
| 1 | Deposit ₱10,000 | 10,000 | 0 | 0 | - |
| 2 | Loan ₱2,000 (interest 100, due 2,100) | 8,000 | 2,100 | 0 | Open |
| 3 | Payment ₱500, owner sets interest 0 | 8,500 | 1,600 | 0 | Open |
| 4 | Payment ₱1,000, owner sets interest 100 | 9,400 | 600 | 100 | Open |
| 5 | Payment ₱600 (no interest left, so all principal) | 10,000 | 0 | 100 | Paid |

If, in example B, the loan had been closed as a withdrawal after step 3, savings would stay ₱8,500 and the ₱100 interest would be waived.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the page and add participants (Priority: P1)

The owner (or any staff member) opens "Sinking fund" from the navigation, adds participants by typing a name or importing an existing driver, and sees them listed.

**Why this priority**: Nothing else works without participants and a reachable page. It is the foundation slice.

**Independent Test**: Open `/sinking-fund` from the nav item, add one participant by name and one by importing a driver, try a duplicate name, and confirm both appear with 0 savings and the second shows a "Driver" tag.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user clicks "Sinking fund" (after Expenses, piggy-bank icon), **Then** `/sinking-fund` opens on the Transactions view, and `?view=top` or `?view=participants` opens those views directly.
2. **Given** the Add participant modal, **When** the user picks a driver in "Import from drivers", **Then** Name is filled and the participant is linked to that driver; "Clear" unlinks it and keeps the typed name.
3. **Given** a participant named "Ana" exists, **When** the user adds "ana", **Then** the form shows "A participant named ana already exists." and does not save.
4. **Given** a valid name, **When** the user saves, **Then** the modal closes, "Participant added" appears, views refresh, and the participant starts with ₱0 savings.

---

### User Story 2 - Record deposits and see savings (Priority: P1)

A user records a deposit for a participant (past dates allowed, future not) and sees Total savings update everywhere. Savings from before this system are entered as a first deposit.

**Why this priority**: Deposits are the core purpose of the fund and the base for loans and rankings.

**Independent Test**: Add a ₱10,000 deposit and confirm the form preview, the toast, the list row, the participant card, and the summary totals all show ₱10,000.

**Acceptance Scenarios**:

1. **Given** a participant with ₱0, **When** the user records a ₱10,000 deposit, **Then** the preview reads "New total savings: ₱10,000.00", the toast reads "Deposit recorded", and every view shows the new total.
2. **Given** the Add transaction form, **When** the user enters a future date or an amount of 0, **Then** saving is blocked with an inline error.

---

### User Story 3 - Borrow from own savings and repay (Priority: P1)

A user records a loan (steps of ₱100, up to the participant's savings) and later records payments. The loan shows 5% interest, amount to pay, and due date; payments reduce the balance and move the interest and principal parts as chosen.

**Why this priority**: Loans and repayments generate the Interest fund and are the main business flow.

**Independent Test**: Reproduce worked example A steps 1–4a using the Add transaction form and confirm every column of the table.

**Acceptance Scenarios**:

1. **Given** savings of ₱10,000, **When** the user enters a loan of ₱2,000 dated Nov 3, 2026, **Then** the form shows "5% interest (₱100) · To pay: ₱2,100 · Due Dec 3, 2026" and "New total savings: ₱8,000.00", and the toast reads "Loan recorded. To pay ₱2,100 by Dec 3".
2. **Given** savings of ₱8,000, **When** the user enters a loan of ₱150 or ₱9,000, **Then** saving is blocked ("Loans must be in steps of ₱100 (₱100, ₱200, ₱300...)." or "Loan cannot be higher than total savings (₱8,000).").
3. **Given** an open loan with balance ₱2,100, **When** a non-owner records a ₱500 payment with the default "Take interest first", **Then** ₱100 goes to the Interest fund, ₱400 returns to savings, and the balance is ₱1,600.
4. **Given** a loan on Jan 31, **When** it is recorded, **Then** its due date is Feb 28 (or 29 in a leap year).
5. **Given** a participant with no open loans, **When** the user opens the form, **Then** the Payment option is disabled with the hint "No open loans".
6. **Given** a payment larger than the loan's balance, **When** the user tries to save, **Then** it is blocked with "Payment cannot be higher than the balance (₱X)." and "Pay full balance" fills the exact balance.
7. **Given** a participant with two open loans, **When** they open the Payment form, **Then** the loan dropdown lists both (oldest first, oldest preselected) as "[loan date] · Due ₱[amount due] · Balance ₱[balance]".

---

### User Story 4 - Owner controls the interest part of payments (Priority: P1)

The owner chooses how much of each payment is interest, either when recording it or afterwards, within the allowed range.

**Why this priority**: This is the client's key business rule (the owner decides when interest is collected) and drives the fund integrity guarantees.

**Independent Test**: Reproduce worked example B end to end as the owner, then use "Change interest part" on step 3 and confirm all totals recalculate and the change is audited.

**Acceptance Scenarios**:

1. **Given** the owner records a payment, **When** the form opens, **Then** the interest part is editable, prefilled from the Fund settings default, shows "Allowed: ₱0 to ₱100" and "Unpaid interest: ₱X", and re-prefills when amount or loan changes until the owner edits it; "None" and "All unpaid interest" set the minimum and maximum allowed.
2. **Given** a value outside the allowed range, **When** the owner saves, **Then** it is blocked with "Interest part must be between ₱X and ₱Y for this payment."
3. **Given** a non-owner user, **When** they open the payment form, **Then** the interest part is read-only, shows the default, and reads "The owner can change this later."
4. **Given** a payment on a non-withdrawn loan, **When** the owner picks "Change interest part" from its 3-dot menu, **Then** a modal shows the payment, loan interest, interest paid by other payments, unpaid principal, the allowed range, and the effect (for example "Interest fund +₱100 · Total savings -₱100"); saving shows "Interest part updated".
5. **Given** the change would make savings or the Interest fund negative (for example the interest was already distributed), **When** the owner tries to save, **Then** it is blocked with an explanation.
6. **Given** a payment on a Withdrawn loan, **When** the owner opens its menu, **Then** "Change interest part" is not offered.

---

### User Story 5 - Distribute the Interest fund (Priority: P2)

The owner distributes the available Interest fund in equal shares to the active participants they tick, and each share is added to savings.

**Why this priority**: It closes the savings cycle and pays participants, but it only matters once interest has accumulated.

**Independent Test**: With ₱100 in the fund and three active participants, open Distribute, confirm "Each participant gets ₱33.33" and "₱0.01 stays in the fund.", confirm, and check savings, fund, history, and audit.

**Acceptance Scenarios**:

1. **Given** the Interest fund card, **When** the owner views it, **Then** it shows the available amount, "Collected ₱X all time · Distributed ₱X", "Expected ₱X from open loans", a "Distribute" button, and a "View history" link; non-owners see no Distribute button.
2. **Given** the Distribute modal, **When** it opens, **Then** all active (non-archived) participants are ticked, archived ones never appear, and unticking anyone updates "Each participant gets ₱X" live (available amount ÷ ticked participants, rounded down to the centavo) with any remainder shown as "₱0.01 stays in the fund."
3. **Given** a confirmation, **When** it succeeds, **Then** one distribution record and one Interest share transaction per ticked participant are created, savings and the fund are updated, and the toast reads "₱X distributed to N participants. Shares added to their savings."
4. **Given** December, **When** the card is shown, **Then** it may show "Year end is near. Distribute the interest fund?"

---

### User Story 6 - Overdue loans and withdrawal (Priority: P2)

Loans past their due date with a balance show as Overdue everywhere. The owner can close an overdue loan as a withdrawal.

**Why this priority**: Handles non-payment so the books close cleanly, but follows the borrow/repay flow.

**Independent Test**: Create a loan whose due date has passed with a partial payment, mark it as withdrawal, and confirm savings unchanged, balance 0, and the "Withdrawn" record text.

**Acceptance Scenarios**:

1. **Given** a loan with balance above 0 the day after its due date, **When** any list or card shows it, **Then** it carries a red "Overdue" tag, and the participant card shows an "Overdue" pill.
2. **Given** an Overdue loan, **When** the owner picks "Mark as withdrawal", **Then** a confirmation modal "Mark this loan as withdrawal?" lists Participant, Loan date, Principal, Amount due, Paid so far (interest and principal), Unpaid principal, Unpaid interest (to be waived), and "Total savings after: ₱X (unchanged)", with "Cancel" and a red "Mark as withdrawal".
3. **Given** confirmation, **When** it succeeds, **Then** a Withdrawal record dated today is created, the loan becomes Withdrawn with balance 0, savings are unchanged, and the toast reads "Loan closed as withdrawal. Savings unchanged."; the loan shows "Paid ₱500 of ₱2,100. ₱1,600 closed as withdrawal on [date]."
4. **Given** an Open, Paid, or Withdrawn loan, or a non-owner user, **When** the menu is shown, **Then** "Mark as withdrawal" is not offered (disabled with an "Owner only" tooltip for non-owners on Overdue loans).

---

### User Story 7 - Browse the Transactions view (Priority: P2)

Users see all transactions in one list with summary totals, search, filters, tags, details, sorting, and "Load more".

**Why this priority**: It is the default view and the main place to audit activity.

**Independent Test**: With a mix of all five transaction types, confirm the five summary cards, tag icons and text, details lines, filters with chips and "Clear all", sort, and paging after 25 rows.

**Acceptance Scenarios**:

1. **Given** data exists, **When** the view loads, **Then** five cards show Total savings, Loans outstanding (with "N open"), Balance to collect, Payments received (follows the date filter), and Interest fund.
2. **Given** the list, **When** it renders, **Then** columns are Date | Participant | Type | Amount | Details | 3-dot menu, with type tags that combine icon, text, and color; deposits, payments, and interest shares show "+", loans show "-", withdrawals show the closed balance with "closed" and no sign.
3. **Given** the filters (Type, Participant, Date range, Loan status) and search (name or notes), **When** applied, **Then** the list and the Payments received card follow and active filters appear as chips with "Clear all".
4. **Given** no transactions, **When** the view loads, **Then** it shows "No transactions yet. Add a participant, then record their first deposit."
5. **Given** a loan row, **When** the menu opens, **Then** "Add payment" opens the form with Payment and that loan selected.

---

### User Story 8 - Top participants ranking (Priority: P3)

Users see participants ranked by Total savings or Deposits for All time, a month, or a week, with trophies for the top three.

**Why this priority**: A motivating, read-only view that depends on data from earlier stories.

**Independent Test**: With several participants and tied amounts, confirm ranking order, shared ranks and trophies for ties, period navigation, and the zero-amount section.

**Acceptance Scenarios**:

1. **Given** the view, **When** it opens, **Then** "Rank by" defaults to Total savings and "Period" to All time; Monthly and Weekly show previous/next arrows (for example "November 2026", Monday-to-Sunday weeks).
2. **Given** Monthly or Weekly with Total savings, **When** ranked, **Then** the value is each participant's savings as of the end of that period (as of today for the current one), using transactions dated on or before the period's last day.
3. **Given** Deposits, **When** ranked, **Then** the value is the sum of deposits in the period (All time = every deposit).
4. **Given** ranks 1–3, **When** shown, **Then** gold, silver, and bronze trophies with accessible labels "1st place", "2nd place", "3rd place" and larger tinted cards appear; each row shows rank, name (with Driver tag), amount, and a bar relative to rank 1.
5. **Given** equal amounts, **When** ranked, **Then** they share the same rank and trophy and are ordered by name.
6. **Given** participants with 0, **When** ranked, **Then** they appear last without a trophy (behind "Show all" when more than 10); archived participants are never ranked.
7. **Given** a row, **When** clicked, **Then** the participant detail opens.

---

### User Story 9 - Participants overview, charts, and detail (Priority: P3)

Users see overall totals, a savings donut chart, a monthly bar chart, searchable and sortable participant cards, and a detail panel per participant.

**Why this priority**: Rich overview and navigation; useful but not required for the money flows.

**Independent Test**: With several participants, confirm the five totals, both charts and their table alternatives, card contents and responsive columns, search, sort, and the detail panel contents.

**Acceptance Scenarios**:

1. **Given** the view, **When** it loads, **Then** a summary strip shows Total savings, Total loans, Balance to collect, Interest fund, and Participants (active count).
2. **Given** the charts, **When** shown, **Then** the donut shows share of total savings by participant (top 5 plus "Others") with a legend of names and amounts, the bar chart shows Deposits, Loans, and Payments per month for the last 6 months with a legend, and each has a "View as table" toggle and does not rely on color alone.
3. **Given** the cards, **When** shown, **Then** they appear 4 per row on desktop, 2 on tablet, 1 on mobile, each with name, Driver tag, "Overdue" pill when applicable, Total savings (largest), Total loans, Balance to pay, "Last transaction: [date]", an "Add transaction" button (participant prefilled), and a 3-dot menu ("View details", "Edit name", "Archive").
4. **Given** the sort control, **When** used, **Then** options are Highest savings (default), Name A to Z, and Highest balance to pay; search filters by name; with no participants it shows "No participants yet. Add your first participant."
5. **Given** the participant detail, **When** opened from a card, row, or ranking, **Then** it shows the three figures, interest shares received (all time), each loan (principal, interest, amount due, interest paid, principal paid, balance, due date, status, and "Add payment" or "Mark as withdrawal" where allowed), transaction history (newest first, with "Load more", and "Change interest part" for the owner), and an "Add transaction" button.

---

### User Story 10 - Corrections, archive, and fund settings (Priority: P3)

The owner corrects mistakes by voiding transactions, archives finished participants, edits names, and sets the default interest prefill.

**Why this priority**: Needed for a trustworthy ledger over time, but not for first use.

**Independent Test**: Void a payment, a withdrawal, a deposit, and a distribution (including blocked cases), archive a participant with and without savings or open loans, edit a linked participant's name, and change the Fund settings.

**Acceptance Scenarios**:

1. **Given** a transaction, **When** the owner picks "Void transaction", **Then** a confirmation asks for a reason, marks it voided (struck through with a "Voided" tag), and recalculates all totals as if it never happened; the void is logged with who, when, and reason.
2. **Given** a loan with non-voided payments, **When** the owner tries to void it, **Then** it is blocked until those payments are voided.
3. **Given** a payment on a Withdrawn loan, **When** the owner tries to void it, **Then** it is blocked with "Void the Withdrawal first."
3a. **Given** a payment whose interest was already distributed, **When** the owner voids it, **Then** it is blocked because the Interest fund would go negative (void the distribution first).
4. **Given** a distribution, **When** voided, **Then** all its interest shares are voided together, blocked if any participant's savings would go negative.
5. **Given** a withdrawal, **When** voided, **Then** the loan reopens with its previous balance and status; voiding a deposit is blocked if savings would go negative.
6. **Given** a participant, **When** archived, **Then** it is allowed only with Total savings 0 and no Open or Overdue loans; archived participants disappear from views, forms, rankings, and distributions, but remain in history and in totals for past periods.
7. **Given** a driver-linked participant, **When** the name is edited, **Then** the user is asked to confirm that the driver link will be removed.
8. **Given** the gear button "Fund settings" (owner only), **When** opened, **Then** the owner can choose "Take interest first" (default) or "Take interest last" with the help text, sees read-only Interest rate 5%, Loan steps ₱100, Loan term 1 month, and saving shows "Fund settings saved." and is logged.
9. **Given** a non-owner user, **When** viewing owner-only actions, **Then** they are disabled with an "Owner only" tooltip (the gear and Distribute buttons are hidden), and any attempt is rejected by the server.

---

### User Story 11 - Pay out a participant's savings (Priority: P2)

The owner pays a participant's savings back out to them (partly or fully), for example when someone leaves the fund, and can then archive that participant.

**Why this priority**: Without it, savings could never leave the fund and participants with savings could never be archived.

**Independent Test**: Deposit ₱5,000 for a participant, record a ₱2,000 savings withdrawal, then a ₱3,000 one, confirm savings reach ₱0, archive the participant, and confirm a non-owner cannot do any of it.

**Acceptance Scenarios**:

1. **Given** the owner opens "Withdraw savings" (from the participant card's 3-dot menu, the participant detail, or the Add transaction form), **When** the form opens, **Then** it asks for participant, date (not in the future), amount, and notes, and previews "Savings after: ₱X".
2. **Given** a participant with ₱5,000 savings, **When** the owner enters ₱6,000, **Then** saving is blocked with "Withdrawal cannot be higher than total savings (₱5,000.00)."; an amount of 0 or less is also blocked.
3. **Given** a valid amount, **When** the owner saves, **Then** the modal closes, the toast reads "Savings withdrawal recorded", Total savings decreases, the Interest fund and loans are unchanged, and the list shows a "Savings withdrawal" tag (icon, text, color), a "-" amount, and "Savings after: ₱X".
4. **Given** a participant whose savings are now ₱0 with no Open or Overdue loans, **When** the owner archives them, **Then** archiving succeeds.
5. **Given** a savings withdrawal, **When** the owner voids it, **Then** the savings are restored, and the void is logged with who, when, and reason.
6. **Given** a non-owner user, **When** they view the action, **Then** it is disabled with an "Owner only" tooltip and the server rejects it.

---

### Edge Cases

- A savings withdrawal of the full Total savings is allowed (savings become ₱0). A participant with an Open or Overdue loan can still withdraw savings up to their current Total savings; the loan principal already left savings when the loan was taken.
- Voiding a deposit, payment, or distribution that a later savings withdrawal depended on is blocked when it would make savings negative (void the savings withdrawal first).
- Back-dated loan: Ana has ₱1,000 on Nov 1 and a ₱5,000 deposit on Nov 10. A ₱3,000 loan dated Nov 5 is blocked ("Ana only had ₱1,000 on Nov 5."); a ₱800 loan dated Nov 5 is allowed. To record a forgotten earlier entry, the owner enters it first, then the later one.
- Voiding the Nov 10 deposit above is blocked while a later entry (such as a savings withdrawal) depends on it ("Void the savings withdrawal first.").
- A loan equal to the participant's full savings (savings become ₱0) is allowed; a further loan is blocked.
- Quick-pick loan chips (₱500, ₱1,000, ₱2,000, ₱5,000) only show amounts within the available savings.
- A loan dated in the past may already be Overdue the moment it is recorded.
- Voiding a loan payment on an Overdue or Paid loan restores the correct balance and status (a Paid loan with a voided final payment returns to Open or Overdue).
- A distribution with nothing available, or with no participants ticked, cannot be confirmed.
- Distribution remainders (less than one centavo per participant) always stay in the fund.
- Changing a payment's interest part is blocked if it would push the loan's total interest paid above its interest or principal paid above its principal, in addition to the negative-balance checks.
- Two people saving conflicting actions at once (for example two payments that together exceed the balance) must not both succeed; the later one is rejected with a clear message.
- Editing a participant's name to one already used by another active participant is blocked; an archived participant's name can be reused.
- A participant imported from a driver cannot be linked a second time to the same driver.
- The "today" used for dates, due dates, and Overdue status follows the business timezone.

## Requirements *(mandatory)*

### Functional Requirements

**Navigation and layout**

- **FR-001**: The system MUST provide a "Sinking fund" navigation item with a piggy-bank icon placed after Expenses, with the same active and hover states as other items, opening `/sinking-fund`.
- **FR-002**: The page MUST support three views selected by a segmented control ("Transactions | Top participants | Participants") and the `view` query parameter (`transactions` default, `top`, `participants`), so links are shareable; switching views MUST NOT reload the page.
- **FR-003**: The header MUST show the eyebrow "Savings and loans" and the title "Sinking fund", and, for the owner only, a "Fund settings" gear button.
- **FR-004**: Every view MUST offer "+ Add participant" and "+ Add transaction" (primary style), beside Filters where a view has filters, each opening a modal.
- **FR-005**: The page MUST be fully usable at a 360 px viewport, and reuse existing patterns (toasts, tags with icon and text, 3-dot menus, colors, fonts).

**Participants**

- **FR-006**: Users MUST be able to add a participant by name, optionally importing from drivers who are not already participants; importing fills the name and links the driver, and "Clear" unlinks it.
- **FR-007**: Active participant names MUST be unique, case-insensitive, with the inline error "A participant named [name] already exists."
- **FR-008**: A driver MUST be linked to at most one participant; linked participants show a "Driver" tag.
- **FR-009**: Users MUST be able to edit a participant's name; for a linked participant this unlinks the driver after confirmation.
- **FR-010**: The owner MUST be able to archive a participant only when Total savings is 0 and no Open or Overdue loans exist; archived participants are hidden from views, forms, rankings, and distributions but remain in history and past-period totals.

**Transactions and calculations**

- **FR-011**: Users MUST be able to record Deposits, Loans, and Payments with participant, type, date (default today, past allowed, future not allowed), amount greater than 0, and optional notes.
- **FR-012**: The Add transaction form MUST show the selected participant's Total savings and Balance to pay, and the type-specific previews, hints, quick-picks, and error messages described in the user stories.
- **FR-013**: Loans MUST be in steps of ₱100, not exceed the savings available on the loan's date (every later date staying at ₱0 or above), carry a stored 5% rate, a whole-peso interest, an amount due, and a due date of loan date + 1 calendar month (clamped to the month's last day).
- **FR-014**: A participant MUST be able to have multiple loans at once; payments target one chosen Open or Overdue loan, listed oldest first with the oldest preselected.
- **FR-015**: A payment MUST NOT exceed its loan's balance, and each payment MUST store its interest part and principal part exactly as chosen, never recalculated by rule later.
- **FR-016**: The allowed interest part MUST be: minimum = max(0, payment − unpaid principal); maximum = min(payment, unpaid interest), both from the loan's other non-voided payments.
- **FR-017**: Only the owner MUST be able to set the interest part (when recording or later via "Change interest part"); payments by others MUST use the Fund settings default ("Take interest first" = largest allowed, "Take interest last" = smallest allowed).
- **FR-018**: A loan MUST NOT reach balance 0 unless its full interest is collected and its full principal repaid.
- **FR-019**: Total savings and the Interest fund MUST NEVER go below 0 on any date in their history; any action, including a back-dated entry or a void, that would make either negative on its own date or any later date MUST be blocked with an inline explanation that names the date and the amount available on it.
- **FR-020**: Total savings, loan figures, and the Interest fund MUST be derived from non-voided transaction records so they can always be recalculated, and every save MUST be applied all-or-nothing and re-checked on the server.
- **FR-021**: Loans MUST become Overdue the day after their due date while balance is above 0, and show a red "Overdue" tag everywhere plus an "Overdue" pill on the participant's card.
- **FR-022**: The owner MUST be able to mark an Overdue loan as withdrawal (confirmation modal, Withdrawal record dated today with the unpaid balance, loan Withdrawn with balance 0, savings unchanged, interest waived); it MUST NOT be offered for Open, Paid, or Withdrawn loans.
- **FR-023**: Saving an action MUST show the specified toast and refresh every view.

**Interest fund and distribution**

- **FR-024**: The Interest fund card MUST show available amount, collected all time, distributed, and expected interest from Open and Overdue loans (informational), plus "View history" listing past distributions (date, total, per participant, number of participants).
- **FR-025**: The owner MUST be able to distribute the available fund equally among ticked active participants (all ticked by default), rounded down to the centavo per participant, with the remainder staying in the fund and shown; shares are always added to Total savings.
- **FR-026**: A distribution MUST create one distribution record and one Interest share transaction per ticked participant, with date (default today) and optional notes, and reduce the fund by the total distributed.
- **FR-027**: The owner MUST be able to set the default interest prefill ("Take interest first" or "Take interest last") in Fund settings; the rate (5%), loan step (₱100), and loan term (1 month) are read-only system values; changes are logged.

**Views**

- **FR-028**: The Transactions view MUST show five summary cards, a searchable and filterable list (Type, Participant, Date range, Loan status) with active-filter chips and "Clear all", columns and detail lines per type, newest-first default sort (sortable by date and amount), "Load more" after 25 rows, and the specified 3-dot menu actions and empty state.
- **FR-029**: Type and status tags MUST combine icon, text, and color (Deposit green, Loan amber, Payment blue, Withdrawal red, Savings withdrawal orange, Interest share purple; statuses Open, Overdue, Paid, Withdrawn).
- **FR-030**: The Top participants view MUST rank by Total savings or Deposits over All time, Monthly (previous/next month), or Weekly (previous/next Monday-to-Sunday week), with gold, silver, bronze trophies carrying text labels, tinted top-3 cards, relative bars, tie handling (same rank, then name), a zero-amount section, and no archived participants.
- **FR-031**: The Participants view MUST show five summary figures, a donut chart (top 5 plus "Others") and a 6-month grouped bar chart (Deposits, Loans, Payments), each with a "View as table" alternative and not relying on color alone, and searchable, sortable participant cards (4/2/1 per row) with the specified content and actions.
- **FR-032**: A participant detail MUST show the three figures, interest shares received, per-loan breakdown with allowed actions, and transaction history with "Load more", and offer "Add transaction" prefilled.

**Corrections and permissions**

- **FR-033**: Transactions MUST NOT be edited in place; the only exception is the owner's "Change interest part" on a payment of a non-withdrawn loan.
- **FR-034**: The owner MUST be able to void a transaction with a confirmation and a required reason; voided items show struck through with a "Voided" tag and totals recalculate as if they never happened, subject to the void rules (loan with payments or a Withdrawal blocked; payment blocked if its loan is Withdrawn, with "Void the Withdrawal first." shown, or if the fund or savings would go negative on any date; distribution voided as a whole; withdrawal void reopens the loan; deposit void blocked if savings would go negative).
- **FR-035**: Anyone with access MUST be able to add participants, record deposits, loans, and payments (default interest part), and edit names. Setting or changing the interest part, Fund settings, Mark as withdrawal, Savings withdrawal, Distribute, Void, and Archive MUST be owner-only: disabled with an "Owner only" tooltip for others (gear and Distribute hidden) and rejected by the server.
- **FR-036**: The system MUST write an audit entry for every create, interest part change (old and new values), withdrawal, distribution, settings change (old and new), void (with reason), archive, and name edit, recording who and when.
- **FR-037**: Transactions MUST be listed and filtered efficiently by participant and date, and by type and date.

**Formatting and accessibility**

- **FR-038**: Money MUST display as ₱ with thousands separators and 2 decimals (₱2,100.00); dates in lists as "Nov 3, 2026"; the business timezone decides "today", due dates, and Overdue status.
- **FR-039**: All modals MUST be keyboard-accessible, close on Escape, and trap focus; required fields show inline errors; trophy icons and charts have text alternatives.

**Savings withdrawal**

- **FR-040**: The owner MUST be able to record a Savings withdrawal for a participant (date not in the future, amount greater than 0, optional notes) that decreases Total savings, does not touch the Interest fund or any loan, and cannot exceed the savings available on its date (every later date staying at ₱0 or above); the form shows a "Savings after: ₱X" preview and the toast reads "Savings withdrawal recorded".
- **FR-041**: Savings withdrawals MUST appear in the Transactions list and participant history with an orange tag (icon and text), a "-" amount, and "Savings after: ₱X"; they MUST be filterable by Type, offered from the participant card's 3-dot menu, the participant detail, and the Add transaction form (owner only), voidable by the owner (restoring savings), audited, and rejected by the server for non-owners. They do not count as Deposits in rankings or summary figures, and they reduce Total savings in every figure derived from it.

### Key Entities

- **Participant**: a person in the fund. Name (unique among active), optional driver link (unique when set), notes, archived marker, who created it and when.
- **Fund transaction**: one ledger entry for a participant. Type (deposit, loan, payment, withdrawal, savings withdrawal, interest share), amount greater than 0, date, notes, who created it and when, and voided marker (who, when, reason).
  - **Loan details**: stored rate, interest (whole peso), amount due, due date, status (open, paid, withdrawn; Overdue is derived), withdrawn date, waived interest.
  - **Payment details**: the loan it pays, interest part, principal part, and whether the interest part was set by the owner or by the default.
  - **Withdrawal details**: the loan it closes and the unpaid balance (including waived interest).
  - **Interest share details**: the distribution it belongs to.
- **Interest distribution**: date, available amount before, total distributed, per-participant amount, participant count, remainder, notes, who created it and when, voided marker.
- **Fund settings**: the default interest prefill (first or last), who changed it and when. Rate, loan step, and loan term are fixed system values.
- **Audit entry**: who, when, what action, and old and new values for every money action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Replaying worked examples A and B (including A's withdrawal variant) produces exactly the savings, loan balance, Interest fund, and loan status shown in the tables at every step, and a savings withdrawal after any step lowers savings by exactly its amount without changing the loan or the Interest fund.
- **SC-002**: A user can add a participant and record their first deposit in under 1 minute on a phone-sized screen.
- **SC-003**: A user can record a loan or a payment in under 45 seconds, and previews show the exact result before saving in 100% of cases.
- **SC-004**: In 100% of attempted actions, including back-dated entries and voids, Total savings and the Interest fund are never negative on any date in their history, and loans never exceed the savings available on their date or deviate from ₱100 steps.
- **SC-005**: For every Paid loan, the full interest is in the Interest fund and the full principal is back in savings; interest is waived only on Withdrawn loans.
- **SC-006**: Distributing the fund among N ticked participants adds identical shares to each, and shares plus the remainder always equal the amount available (no centavo lost or created).
- **SC-007**: Every owner-only action attempted by a non-owner is blocked and recorded as not performed in 100% of attempts, and every money action by anyone appears in the audit log with who, when, and (where applicable) old and new values or reason.
- **SC-008**: Recalculating all totals from the transaction records at any time matches every figure displayed in all three views.
- **SC-009**: All three views, both forms, and all owner modals are usable at 360 px width without horizontal scrolling, and the modals work with keyboard only (open, navigate, submit, Escape).
- **SC-010**: With 25 or more transactions, the Transactions view shows the first 25 and loads the rest on request; filters narrow the results and the Payments received card in under 1 second for a fund of up to 100 participants and 5,000 transactions.

## Assumptions

- **Roles**: "Owner" is the existing owner role in the app; "anyone with access" means any other signed-in user with access to the app. No new roles are introduced.
- **Money storage**: the app's existing rule of integer centavos applies. The "2 decimals" in the request means displayed values; precision is handled in the planning phase.
- **Drivers**: the driver list and the driver link come from the existing drivers feature. Importing a driver does not change the driver record.
- **Time**: the existing business timezone setting of the app decides "today".
- **Charts and tags**: the donut and bar charts reuse the app's existing visual tokens and any chart approach already approved for the project; no paid component is introduced.
- **Prior savings**: balances from before this system are entered as a first deposit; no bulk import is included.
- **Rate and rules**: 5% rate, ₱100 steps, and a 1 month term are fixed system values in this release; only the default interest prefill is configurable.
- **Distribution scope**: one distribution applies the whole available Interest fund (less the remainder); partial-amount distributions are out of scope.
- **Notifications**: no push, SMS, or email reminders for due dates are included; overdue is shown in the page only. The December reminder on the Interest fund card is optional and shown only on that card.
- **Mockup**: `sinking_fund_page_mockup_v2.html` is a visual guide; where it differs from this specification, this specification wins, and `DESIGN.md` wins over both on tokens and UI rules.
- **Savings withdrawal**: the owner records the payout; the app does not move real money. It is not a loan and has no interest.
- **Out of scope**: editing loan terms after creation, interest rates per participant, non-peso currencies, exports to spreadsheets, and loans between participants.
