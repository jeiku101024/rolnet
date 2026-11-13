# Contract: Route, URL state, and UI

## Route and navigation

- `app/(operations)/sinking-fund/page.tsx`: any approved user. Owner-only controls are hidden or disabled
  with an "Owner only" tooltip based on `profile.role`; the server enforces regardless.
- Navigation item: id `sinkingFund`, label "Sinking fund", href `/sinking-fund`, icon `PiggyBank`, group
  `operations`, order 3 (Documents becomes 4, Reports 5), access `approved`, `matchDescendants: true`.
- `pageContext.sinkingFund`: title "Sinking fund", eyebrow "Savings and loans".

## Query parameters

| Param | Values | Default | Notes |
|---|---|---|---|
| `view` | `transactions`, `top`, `participants` | `transactions` | Unknown values fall back to default |
| `q` | text | empty | Transactions: participant name or notes. Participants: name |
| `type` | multi: `deposit`,`loan`,`payment`,`loan_withdrawal`,`savings_withdrawal`,`interest_share` | none | Filter chip |
| `participant` | uuid | none | Transactions filter only. The detail sheet uses `detail` |
| `from`, `to` | `YYYY-MM-DD` | none | Date range; Payments received card follows it |
| `loan_status` | `open`,`overdue`,`paid`,`withdrawn` | none | Filters loan rows and their payments |
| `sort`, `dir` | `date`,`amount`; `asc`,`desc` | `date`,`desc` | Ties: newest entry first |
| `n` | 25, 50, 75... | 25 | "Load more" adds 25 |
| `rank` | `savings`,`deposits` | `savings` | Top view |
| `period` | `all`,`month`,`week` | `all` | Top view |
| `at` | `YYYY-MM` (month) or `YYYY-MM-DD` Monday (week) | current | Previous and next arrows change it; future periods are not offered |
| `psort` | `savings`,`name`,`balance` | `savings` | Participants view sort |
| `detail` | participant uuid | none | Opens the participant detail sheet on any view |
| `hn` | 10, 20... | 10 | Detail history "Load more" |

Switching view, period, and sort are soft navigations (`router.replace(..., { scroll: false })`), so the
page does not reload.

## Page structure

1. Header (`PageHeader`): eyebrow, title, owner-only "Fund settings" gear button.
2. View toggle (`SegmentedToggle`, label "Sinking fund views").
3. Summary strip (Transactions: five cards; Participants: five cards; Top view: none).
4. Toolbar: search, Filters (Transactions), "+ Add participant", "+ Add transaction" (primary).
5. View body.

## View contracts

**Transactions**: columns Date, Participant, Type, Amount, Details, menu. Tag icons: Deposit
`ArrowDownToLine` green, Loan `HandCoins` amber, Payment `ReceiptText` blue, Withdrawal `DoorOpen` red,
Savings withdrawal `Banknote` orange, Interest share `Coins` purple. Voided rows: strikethrough plus
"Voided" tag. Menu: View participant; loans: Add payment, Mark as withdrawal (owner, overdue); payments:
Change interest part (owner, loan not withdrawn); owner: Void transaction (interest shares offer "Void
distribution" instead). Empty state text per spec §11. On a viewport under 640 px the row becomes a card
(Type tag and Amount on top, details below), as the Remittances list does.

**Top participants**: two segmented controls (Rank by, Period), arrows for month and week, ranked list with
trophy icons `Trophy` (gold, silver, bronze tokens) and `aria-label` "1st place" and so on, relative bar,
tinted top-3 cards, zero-amount rows last (collapsed behind "Show all" above 10 rows), ties share rank
(standard competition ranking: 1, 1, 3) then sort by name; clicking a row sets `detail`.

**Participants**: five-card strip, donut (top 5 plus Others) and bar chart (Deposits, Loans, Payments per
month, last 6), each with a "View as table" toggle; search and sort; cards in a grid
(`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`); empty state per spec §13.

**Detail sheet** (`components/ui/sheet`): three figures, interest shares received, loans list (principal,
interest, amount due, interest paid, principal paid, balance, due date, status, actions), history with
"Load more", "Add transaction" prefilled. Closing removes `detail`.

## Dialog contract

| Dialog | Opened from | Fields and live behavior |
|---|---|---|
| Add participant | toolbar | Import from drivers (searchable, drivers not already participants, with Clear), Name, Notes |
| Add transaction | toolbar, card, row menu, detail | Participant (searchable) with savings and balance to pay below; Type control (Deposit \| Loan \| Payment, Payment disabled with "No open loans"); Date; Amount; Notes; type previews and errors per spec §6 |
| Savings withdrawal | participant menu, detail, owner Type control | Participant, Date, Amount, Notes, "Savings after" preview, error "Withdrawal cannot be higher than total savings (₱X)." |
| Change interest part | payment menu (owner) | Payment summary, loan interest facts, field with allowed range, effect preview |
| Mark as withdrawal | overdue loan menu (owner) | Confirmation rows per spec §8, red confirm |
| Distribute interest | Interest fund card (owner) | Available amount, participant checklist (all ticked), live "Each participant gets ₱X" and remainder, Date, Notes |
| Distribution history | "View history" link | List of distributions with void action (owner) |
| Fund settings | gear (owner) | Radio: Take interest first / last, help text, read-only constants |
| Void | row menu (owner) | Confirmation and required reason |
| Edit name | card menu | Name; confirmation when the participant is driver-linked |
| Archive | card menu (owner) | Confirmation; disabled with the reason when savings are above 0 or loans are open |

Dialogs use `components/ui/dialog` (focus trap, Escape to close), toasts use `components/ui/toast`, errors
use `validation-summary` and `form-field`, destructive confirmations use `alert-dialog`. All dialogs fit a
360 px viewport without horizontal scrolling.
