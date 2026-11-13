# Research: Sinking Fund

Decisions that settle the open technical questions in [plan.md](plan.md). Each entry: decision,
rationale, alternatives.

## R1. Money and rate representation

**Decision**: All money is `bigint` centavos (`amount_centavos`, `interest_centavos`, and so on), parsed
and formatted only through `lib/money/centavos.ts`. The 5% rate is stored on each loan as basis points
(`500`) so a later rate change never alters old loans. Loan principal must be a multiple of 10,000
centavos (₱100), so interest = principal × 500 / 10,000 is always a whole peso (a multiple of 500
centavos). Distribution share = `floor(available / participants)` in centavos; the remainder stays in the
fund.

**Rationale**: Constitution III and CLAUDE.md. Integer math makes the worked examples exact and the
remainder rule trivial.

**Alternatives**: `numeric(14,2)` as the spec's data model reads: rejected (forbidden). Storing the rate
as `0.05` numeric: rejected (non-integer).

## R2. Derived state instead of stored state; void markers as soft delete

**Decision**: Total savings, loan paid/unpaid/balance, loan status, and the Interest fund are computed
from non-voided ledger rows by SQL views and functions. "Overdue" is `balance > 0 and due_date < today`.
Loan status values: `open`, `paid`, `withdrawn` (derived: a non-voided loan Withdrawal row exists), plus
the derived overdue flag. Ledger rows are never deleted; voiding sets `voided_at`, `voided_by`,
`void_reason`, which is the "equivalent status" Principle III allows for `deleted_at`.

**Rationale**: FR-020 requires totals that can always be recalculated. A stored status or running balance
would have to be repaired by every void, back-dated entry, and interest-part change.

**Alternatives**: Stored `status` and cached savings (the spec's "or cached" option): rejected as a drift
risk with no benefit at this scale.

## R3. Back-dated entries: validate the whole timeline

**Decision**: After every mutation, the function re-validates the affected participant's complete savings
timeline and the global Interest fund timeline. Same-day entries are ordered credits first (deposit,
payment principal part, interest share), then debits (loan, savings withdrawal), then by `created_at`, so a
deposit and a loan on the same day work in either entry order. If any date's running balance is negative,
the function raises `P0001` with a plain message naming the date and the amount available then, for
example "Ana only had ₱1,000.00 on Nov 5, 2026." (clarification Q2). The TypeScript twin (`ledger.ts`)
runs the same fold so forms can show the same error before saving.

**Rationale**: Re-validating a participant's rows (typically under 500) on each write is cheap and
impossible to get wrong compared with delta reasoning for every transaction type and void.

**Alternatives**: Check current balance only: rejected by the owner (Q2). Check only dates at or after the
entry using incremental deltas: more code, more bugs, no measurable gain.

## R4. Concurrency and atomicity

**Decision**: Each user action is exactly one `security definer` SQL function (one transaction). Every
write function first takes `pg_advisory_xact_lock(hashtext('sinking_fund'))`, so sinking-fund writes are
serialized; two payments that together exceed a balance cannot both pass. Update paths also pass
`expected_updated_at` and fail with the app's stale-record message, matching expenses and drivers.
Create paths take an `idempotency_key` (unique) so a retry returns the existing row.

**Rationale**: At 1–3 users the lock costs nothing and removes whole classes of races (fund balance,
savings, loan sums). No multi-step application writes exist, so the constitution's multi-step clause is
not needed.

**Alternatives**: Row-level locks per participant plus a fund-row lock: more fragile, same behavior.
`serializable` isolation with retries: Supabase RPC retry handling adds complexity.

## R5. Reads: views plus a few read-model functions

**Decision**:

- `sf_loans_v` (invoker view): one row per loan with paid/unpaid/balance, status, overdue flag.
- `sf_ledger_v` (invoker view): ledger rows joined to participant name, driver tag, and loan columns the
  list needs, so the Transactions list is a single filtered, sorted, limited query.
- `sf_fund_summary(p_from, p_to)`, `sf_participant_summaries(p_as_of)`, `sf_ranking(...)`,
  `sf_monthly_flows(p_months)`: `stable` invoker functions returning small result sets.

**Rationale**: PostgREST caps responses at 1,000 rows by default and the Worker has a 10 ms CPU budget,
so totals, rankings, and the 6-month chart must be computed in SQL. Invoker security keeps RLS (approved
users only) in force.

**Alternatives**: Fetch every row and fold in TypeScript: exceeds row caps at 5,000 rows and burns Worker
CPU. Materialized views: need refresh logic; not needed at this scale.

## R6. List paging, filters, and URL state

**Decision**: Reuse `lib/pagination/list-controls` (filters, sort, search, chips with "Clear all") for the
Transactions list, adding a `sinkingFund` spec. The existing `pageSize = 10` is global, so the 25-row
requirement uses "Load more": `?n=25` grows by 25 per click (`n=50`, `75`...), rendered on the server,
no client fetching. The participant detail history uses the same pattern with `?hn=10`. View, period,
rank-by, sort, search, and the open participant live in query parameters so links are shareable
(`view`, `rank`, `period`, `at`, `sort`, `q`, `participant`).

**Rationale**: Matches how Expenses, Drivers, and Documents already behave; the view switch is a soft
client navigation (no full page reload).

**Alternatives**: Client-side state with fetch-on-switch: breaks shareable links and duplicates loading
code.

## R7. TypeScript twin of the rules

**Decision**: `lib/sinking-fund/rules.ts` and `ledger.ts` implement interest, due date, allowed interest
range, default prefill, timeline validation, and savings/fund folds. They drive form previews, inline
errors, the demo-mode data, and Vitest tests. The SQL functions are authoritative; the twin never decides
what is saved. Worked examples A and B (and the withdrawal variant) are encoded as fixtures in Vitest and
as scenarios in pgTAP so the two cannot diverge unnoticed.

**Alternatives**: Preview by calling the database for each keystroke: slow and unnecessary. Share code via
a DB-side JS runtime: not available on the free tier.

## R8. Charts and icons without new libraries

**Decision**: The donut (top 5 plus "Others") and the grouped 6-month bar chart are small SVG components
following `components/dashboard/*chart.tsx`, using tokens from `app/globals.css` plus distinct patterns or
direct labels so color is never the only cue. Each has a "View as table" toggle rendering the same data
in `components/ui/table`. Icons come from `lucide-react`: `PiggyBank` (nav), `Trophy` (ranks),
`ArrowDownToLine`/`HandCoins`/`ReceiptText`/`LogOut`/`Banknote`/`Coins` for type tags. The spec's Tabler
"pig-money" is an example ("e.g."); adding Tabler would add a library.

**Alternatives**: Recharts or Chart.js: new dependencies, bundle weight, forbidden by CLAUDE.md.

## R9. Migrations and permissions

**Decision**: Three new migrations (tables and views; rules and write functions; read functions), each
with pgTAP. Tables are readable by approved users through RLS and have no write policies; all writes go
through functions. Each function is created with no EXECUTE for `anon` and `authenticated`, then granted to
`authenticated` explicitly in the same migration (the app calls every one). Owner-only functions call
`public.require_owner()` first; staff-allowed functions check `public.is_approved_user()`. Helper
functions the app does not call (validators, `sf_today`, `sf_peso`) are not granted and are called only
from definer functions. The app adds a `manage_fund` permission (owner) in `lib/permissions/roles.ts` and
uses `requirePermission("manage_fund")` in owner Server Actions, giving two layers (app and database).

**Rationale**: CLAUDE.md function-grant rules; memory notes on definer helpers and EXECUTE.

## R10. "Today" and the business timezone

**Decision**: `sf_settings.timezone` (default `Asia/Manila`) feeds `sf_today()` in SQL; the app keeps using
`fleetToday()`. Both must agree, so the page passes no "today" to write functions: the database decides
whether a date is in the future and which loans are overdue.

**Alternatives**: Client-supplied today: spoofable and drifts across timezones.

## R11. Demo mode

**Decision**: In demo mode (`NEXT_PUBLIC_DEMO_MODE=true`) the page reads a seeded ledger from
`lib/sinking-fund/demo-data.ts`, built by the same `ledger.ts` fold so all three views, charts, and the
detail sheet work. Write actions throw `DEMO_MODE` ("Demo mode doesn't save changes...") as the Documents
actions do. Playwright runs in demo mode.

## R12. Distribution details

**Decision**: "Available" is the Interest fund as of the distribution date (collected through that date
minus distributions through that date), validated against the global timeline so later dated entries stay
non-negative. Only active participants may be ticked; the function re-checks. Voiding a distribution voids
the distribution row and all its shares together, blocked if any participant's timeline would go negative.
The December reminder is computed from `sf_today()`/fleet date in the page and costs no query.

## Resolved unknowns summary

| Unknown from the plan | Resolution |
|---|---|
| Centavos vs the spec's 2 decimals | R1 |
| Table-per-type vs one table | One `sf_transactions` table with per-type check constraints (data-model.md) |
| Concurrency for simultaneous actions | R4 |
| Charts under "no new libraries" | R8 |
| Back-dated check semantics (clarification Q2) | R3 |
| Savings withdrawal (clarification Q1) | New type `savings_withdrawal`, owner-only function, same timeline validation |
