# Data Model: Participant Loans Redesign

No tables, columns, views or functions change. The feature adds one read-model type and derives view fields in the browser.

## Existing: `SfLoan` (`sf_loans_v`)

`id, participant_id, loan_date, principal_centavos, interest_centavos, amount_due_centavos, due_date, interest_paid_centavos, principal_paid_centavos, unpaid_interest_centavos, unpaid_principal_centavos, balance_centavos, status ("open" | "paid" | "withdrawn"), overdue, withdrawn_on, updated_at`.

## New: `SfLoanPayment`

One non-voided payment against a loan.

| Field | Type | Source |
|---|---|---|
| `id` | string | `sf_ledger_v.id` |
| `loan_id` | string | `sf_ledger_v.loan_id` (never null for a payment) |
| `tx_date` | string (YYYY-MM-DD) | `sf_ledger_v.tx_date` |
| `amount_centavos` | integer | `sf_ledger_v.amount_centavos` |
| `interest_part_centavos` | integer | `sf_ledger_v.interest_part_centavos` |
| `principal_part_centavos` | integer | `sf_ledger_v.principal_part_centavos` |

`SfParticipantPageData` gains `payments: SfLoanPayment[]` (oldest first).

## Derived in the browser (`loan-list.ts`)

| Name | Rule |
|---|---|
| Active loan | `status === "open"` (includes overdue) |
| Closed loan | `status === "paid"` or `"withdrawn"` |
| Active order | overdue first, then `due_date` ascending, then `loan_date` ascending |
| Closed order | `loan_date` descending |
| Days left | whole days from `today` to `due_date`; negative means overdue by that many |
| Due text | negative: "Overdue by N days"; 0: "Due today"; 1: "1 day left"; otherwise "N days left"; "soon" emphasis at 7 days or fewer |
| Summary | active count, sum of active `balance_centavos`, overdue count |
| Percent paid | `round((interest_paid + principal_paid) / amount_due * 100)`, 0 when amount due is 0 |
| Bar segments | interest paid and principal paid as shares of `amount_due_centavos` |
| Closed year | calendar year of `loan_date`; years newest first, plus "All years" |
| Closed header | filtered count, and total repaid = sum of `amount_due_centavos` of `paid` loans in the filter |
| Closed paging | 5 per page; page clamped to `1..lastPage`; a year change resets to page 1 |

## State transitions

Unchanged. A payment that brings `balance_centavos` to 0 changes `status` to `paid`, which moves the loan from the Active tab to the Paid and closed tab after the page refreshes.
