# Contract: SQL functions

All functions are in `public`, `security definer`, `set search_path = public`. Each starts with no EXECUTE for `public`, `anon`, or `authenticated`, then grants `authenticated` explicitly because the app calls it. Every function checks the caller (`require_owner()` unless noted). Raised errors use `errcode P0001` with a plain-language message, as in feature 015.

## Changed

### `sf_distribute_interest(p_date date, p_participants uuid[], p_notes text, p_key uuid, p_expected_total bigint default null) returns uuid`

Replaces the four-argument version (drop it in the same migration, re-grant the new signature). Owner only.

- Shares: proportional, floor, see research R1. Validation rules 1 to 7 in [data-model.md](../data-model.md).
- Writes in one transaction: `sf_distributions`, `sf_distribution_participants`, `interest_share` rows, `cycle_close` rows, audit event `sf_distributions / insert`.
- Idempotent on `p_key` (returns the existing distribution id).
- Errors (examples): "Tick at least one participant.", "{name} still has an unpaid loan. Pay it or mark it as a withdrawal first.", "No ticked participant has savings.", "{amount} is too little to share.", "The figures changed. Review them and confirm again.", "The distribution date cannot be before {date}, when {name} last had activity."

### `sf_void_distribution(p_id uuid, p_reason text, p_expected_updated_at timestamptz) returns uuid`

Owner only, same signature as 015. Also voids the distribution's `cycle_close` rows. Raises "This distribution cannot be voided because {name} has new transactions since it." when a participant of the distribution has a non-voided transaction dated after the distribution date (nothing can be dated on or before a close, so that is exactly the activity recorded since).

### `sf_void_transaction(p_id uuid, p_reason text, p_expected_updated_at timestamptz) returns uuid`

Owner only, same signature as 015. New rejections: a `cycle_close` row ("A year-end close is voided with its distribution. Void the distribution instead."), and any row of a participant with a non-voided close whose `tx_date` is on or before the close date ("{name}'s year was closed on {date}. Void the distribution first."). Spec FR-050.

### `sf_savings_delta(t sf_transactions) returns bigint`

Adds `when 'cycle_close' then -t.amount_centavos`.

### Close guard (trigger `sf_transactions_closed_cycle`, function `sf_guard_closed_cycle()`)

A `before insert` trigger on `sf_transactions`: raises "{name}'s year was closed on {date}. Use a later date." when a new non-`cycle_close` row of a participant is dated on or before that participant's latest non-voided close (spec FR-049). It covers every write function. The function gets no grant.

### `sf_fund_summary(p_from date, p_to date)`

Payments received and interest collected count only the cycle (`tx_date > cycle_start`, the latest non-voided year-end close). One new column `cycle_start date`. Readable by approved users. `sf_participant_summaries` is unchanged: loans and balance are derived from open loans, and savings from the ledger including the close.

### `sf_ranking(p_rank_by text, p_start date, p_end date)`

When `p_rank_by = 'deposits'` and `p_start is null`, start after the cycle start. The savings ranking is unchanged (it now reflects the reset).

## New or replaced reads (owner only)

### `sf_distribution_history() returns table (...)`

Replaces the 015 function: it now calls `require_owner()` (the 015 version allowed any approved user). Columns:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `dist_date` | date | |
| `year` | integer | `extract(year from dist_date)` |
| `available_before_centavos` | bigint | |
| `total_distributed_centavos` | bigint | |
| `remainder_centavos` | bigint | |
| `participant_count` | integer | participants who took part |
| `share_count` | integer | participants who received a share above ₱0.00 |
| `per_participant_centavos` | bigint null | legacy equal rows only |
| `notes`, `voided_at`, `void_reason`, `updated_at` | | |

Ordered `dist_date desc, created_at desc`.

### `sf_distribution_details(p_id uuid) returns table (...)`

Owner only. One row per participant who took part, **sorted by `ended_total_centavos desc nulls last, participant_name asc`**:

| Column | Type |
|--------|------|
| `participant_id` | uuid |
| `participant_name` | text |
| `savings_before_centavos` | bigint null |
| `share_centavos` | bigint |
| `ended_total_centavos` | bigint null (null = "Not recorded", legacy) |

An unknown id returns no rows (the action turns that into "This distribution was not found").

## Unchanged

`sf_record_*`, `sf_void_transaction`, `sf_mark_loan_withdrawal`, `sf_change_interest_part`, `sf_monthly_flows` (all months, deliberately unchanged, spec FR-033a).

## pgTAP coverage (`supabase/tests/constraints/440_sf_proportional_distribution.sql` and `supabase/tests/rls/110_sf_distribution_rls.sql`)

1. ₱300 fund; savings ₱1,000/₱2,000/₱3,000 → shares 50/100/150; snapshot rows; savings 0 after; remainder 0.
2. Floor and remainder: ₱100 fund, equal savings across three participants → shares 33.33 each, remainder 0.01; shares + remainder = fund.
3. An unticked participant is unchanged; a ticked ₱0-savings participant has a snapshot row with share 0 and no ledger rows.
4. An Open or Overdue loan on a ticked participant blocks; paid and withdrawn loans do not.
5. A stale `p_expected_total` is rejected; a matching one is accepted; the same `p_key` twice returns one distribution.
6. Owner only: staff and anon are denied for distribute, history, and details.
7. Dates: a date before last activity is rejected; a later transaction dated on or before the close is rejected.
8. Void: allowed with no later activity and restores savings; blocked with later activity; both distribution and close rows are voided.
9. A legacy (pre-migration style) distribution without snapshot rows returns `ended_total_centavos` null from details.
10. Details ordering: highest ended total first, ties by name, nulls last.
11. Constraint tests: shape check for `cycle_close`, `ended = before + share`, remainder rules; no EXECUTE for `anon`.
12. Cards: payments received and interest collected count only after the cycle start.
13. Void guards: voiding a `cycle_close` row alone is rejected; voiding a pre-close transaction of a closed participant is rejected; voiding a post-close transaction is allowed; voiding the whole distribution (no later activity) clears both.
14. Table columns: `sf_distribution_participants` has `created_*`, `updated_*`, `deleted_*` columns and an owner-only select policy.
