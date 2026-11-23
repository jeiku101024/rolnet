# Research: Participant Loans Redesign

## R1. Where tabs, expansion and paging state live

**Decision**: Client state in `participant-loans.tsx`: active tab, expanded loan id per tab, closed-tab year and page. Nothing goes in the URL.
**Rationale**: All of a participant's loans are already on the page, so every interaction is local and instant. The History table keeps its own URL state (`q`, `sort`, `page`) untouched, and URL-driven loan paging would reload the server page for no gain.
**Alternatives**: URL params with a prefix (the shared `Pagination` supports prefixes). Rejected: a server round trip per tab or page change, plus reset rules against the History params.

## R2. 5 per page with the shared Pagination

**Decision**: Reuse `components/ui/pagination.tsx` with its `onPage` callback and a `ListPageState` built by `loan-list.ts` for a page size of 5. Do not change the shared `pageSize = 10` or `finishListPage`.
**Rationale**: The control only needs `{ page, lastPage, total, rangeLabel }`, so a local 5-per-page state gives the same look as the other lists without touching the app-wide constant.
**Alternatives**: Make `pageSize` a parameter of `list-page.ts`. Rejected: it touches every list for one exception.

## R3. Payments per loan

**Decision**: Read the participant's non-voided payments once from `sf_ledger_v` (`participant_id = id`, `type = 'payment'`, `voided_at is null`), selecting `id, loan_id, tx_date, amount_centavos, interest_part_centavos, principal_part_centavos`, ordered by `tx_date, created_at`. Group by `loan_id` in the helper. Demo mode builds the same rows from `demoSfData`.
**Rationale**: `sf_loans_v` has totals but not the individual payments the mock lists. The ledger view already exposes them, so there is no schema change and the existing read policy applies.
**Alternatives**: A new SQL view or function. Rejected: the data is already readable and the constitution prefers the simpler path.

## R4. Overdue and "days left"

**Decision**: Use the loan's existing `overdue` flag (database or `buildLoans` in demo) for status. Compute the day difference between `due_date` and `shared.today` (the fleet date already on the page) in `loan-list.ts`.
**Rationale**: One source of truth for "overdue", and no browser-clock timezone mismatch.

## R5. Row design with ROLNET tokens

**Decision**: Rows follow the mock's structure (status, loan date and amount, balance of amount due with a bar, due text, chevron) using existing tokens (`border-rule`, `text-muted`, `bg-danger-soft`, `text-danger`, `bg-brand-soft`) and the existing `LoanStatusTag`. Interest-paid segment uses `--color-violet` and principal-paid uses `--color-ok`, always with a text legend. An overdue row gets a left rule in `--color-danger` plus the "Overdue" tag and due text, so it is never color alone. Radius is 4 px, with no pill controls (DESIGN.md). Segment widths are data-driven percentages set through a CSS variable on the bar, so no arbitrary size is hard-coded in a class.
**Alternatives**: Copy the mock's pills and palette. Rejected: DESIGN.md wins over mock styling.

## R6. Accessibility

**Decision**: Tab buttons with `role="tablist"`, `role="tab"`, `aria-selected`, and a `role="tabpanel"`. Each row is a `<button aria-expanded aria-controls>` and the expanded region has the matching id. Tab and Enter/Space are enough; arrow-key tab switching is not required.
**Rationale**: Simple markup that meets FR-017 without a new library.

## R7. "Pay full balance"

**Decision**: Add optional `amountCentavos` to `TransactionDialogInitial`. The dialog seeds its amount text from it with the existing centavo formatting, with `type: "payment"` and `loanId`. The form still validates the amount and the server still decides.
**Rationale**: One optional field and no new transaction type.

## R8. Refresh after a save

**Decision**: Nothing new. Server actions already `revalidatePath("/sinking-fund", "layout")` (feature 021), so the page's `loans` and `payments` props refresh and the component re-derives its tabs. It keeps the expanded loan only if that loan is still in the same tab.
