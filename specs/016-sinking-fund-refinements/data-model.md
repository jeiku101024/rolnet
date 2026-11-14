# Data Model: Sinking Fund Refinements

Builds on feature 015's tables (`sf_participants`, `sf_distributions`, `sf_transactions`, `sf_settings`). Everything below is a new migration; no pushed migration is edited. Money is integer centavos (`bigint`). Nothing is hard-deleted.

## Migration 1: `20261114000100_sf_cycle_close_enum.sql`

```text
alter type public.sf_transaction_type add value 'cycle_close';
```

A separate file because a new enum value cannot be used in the transaction that adds it.

## Migration 2: `20261114000200_sf_proportional_distribution.sql`

### Changed: `sf_transaction_type`

New value `cycle_close`: "Year-end close". Effect on Total savings: `-amount_centavos` (added to `sf_savings_delta`). No effect on loans, the Interest fund, deposits, or withdrawals totals.

### Changed: `sf_transactions.sf_transactions_shape`

New case: `cycle_close` requires `distribution_id` not null and every other type-specific column null (same shape as `interest_share`). `amount_centavos > 0` still applies, so a participant whose ended total is ₱0.00 gets no close row.

### Changed: `sf_distributions`

| Column | Change | Notes |
|--------|--------|-------|
| `per_participant_centavos` | drop `not null`, keep `> 0` when set | `null` for proportional distributions; set for legacy equal ones |
| `participant_count` | unchanged meaning | participants who took part (ticked) |
| `total_distributed_centavos` | unchanged | sum of shares |
| `remainder_centavos` | unchanged | `available_before - total_distributed`, always `>= 0` |

Constraints replaced:

- `sf_distributions_total`: `per_participant_centavos is null or total_distributed_centavos = per_participant_centavos * participant_count`.
- `sf_distributions_remainder`: `remainder_centavos = available_before_centavos - total_distributed_centavos and remainder_centavos >= 0`, and, when `per_participant_centavos` is set, `remainder_centavos < participant_count` (as before). For proportional rows the function proves `remainder < participant_count`.

A distribution's year is `extract(year from dist_date)`, computed on read; it is not stored.

### New: `sf_distribution_participants`

One immutable snapshot row per participant who took part in a distribution, written by `sf_distribute_interest` only.

| Column | Type | Rules |
|--------|------|-------|
| `id` | uuid | primary key, `default gen_random_uuid()` (the shared audit trigger reads each row's `id`) |
| `distribution_id` | uuid | FK `sf_distributions(id)`; with `participant_id` unique |
| `participant_id` | uuid | FK `sf_participants(id)`; unique with `distribution_id` (`sf_distribution_participants_unique`) |
| `participant_name` | text | name at that time (a later rename never changes the record) |
| `savings_before_centavos` | bigint | `>= 0`, savings on the distribution date before the share |
| `share_centavos` | bigint | `>= 0`, floor(fund × savings_before ÷ overall) |
| `ended_total_centavos` | bigint | `= savings_before_centavos + share_centavos` (check) |
| `created_at` | timestamptz | `not null default now()` |
| `created_by` | uuid | `references auth.users(id)` |
| `updated_at` | timestamptz | `not null default now()` |
| `updated_by` | uuid | `references auth.users(id)` |
| `deleted_at` | timestamptz | soft delete; never set in normal flows |
| `deleted_by` | uuid | `references auth.users(id)` |

Business-row columns: the table carries the full set (`created_*`, `updated_*`, `deleted_*`) as constitution III and CLAUDE.md require for business rows. Rows are written once by the distribute function; `updated_*` and `deleted_*` stay unused in normal flows (voiding the distribution voids the ledger rows and keeps the snapshot as history).

Access: RLS enabled; one `select` policy for `is_owner()` only; no insert/update/delete policy (writes only through the security-definer function). Owner-only reads are also exposed through the functions below.

### Legacy rows

Distributions made before this migration have no snapshot rows. Their details are built from `sf_transactions` rows of type `interest_share` for that distribution (name from `sf_participants`); `ended_total_centavos` is `null` ("Not recorded"); `savings_before_centavos` is `null`.

## Derived values (changes to 015's definitions)

| Value | Definition now |
|-------|----------------|
| Total savings | sum of `sf_savings_delta` over non-voided rows, now including `cycle_close` (`-amount`). Right after a close it is ₱0.00 for every closed participant. |
| Cycle start | the latest `dist_date` of a non-voided year-end close (a distribution with no equal `per_participant_centavos`; older equal-share distributions never closed a year), or `null` before any close. |
| Payments received (card) | payments with `tx_date > cycle_start` (and the existing date filter). |
| Interest collected (card) | payment interest parts with `tx_date > cycle_start`. "Distributed" and "Available" are unchanged (fund-wide). |
| Total loans, Balance to pay | open loans only; already ₱0.00 for a closed participant because a close needs no Open or Overdue loan. |
| Rankings (Top participants) | savings: as before (now ₱0.00 after the close); deposits: default period starts after the cycle start. |
| Monthly flows chart | unchanged: all months, all types `deposit`, `loan`, `payment`. |

## Validation rules (SQL, in `sf_distribute_interest`)

1. Owner only (`require_owner()`), serialized by the existing advisory lock, idempotent on `p_key`.
2. Date valid (`sf_check_date`), and not earlier than the latest non-voided transaction date of any ticked participant ("The distribution date cannot be before {date}, when {name} last had activity.").
3. At least one ticked participant; all ticked participants active (not archived or deleted).
4. No ticked participant has an Open or Overdue loan: error "{name} still has an unpaid loan. Pay it or mark it as a withdrawal first." (all offenders are listed).
5. `available = sf_fund_total(p_date) > 0`; `overall = sum(savings_before) > 0`; `total_distributed > 0`.
6. If `p_expected_total` is supplied and differs from the recomputed total: "The figures changed. Review them and confirm again."
7. Insert the distribution, one snapshot row per ticked participant, one `interest_share` per share above ₱0.00, one `cycle_close` per ended total above ₱0.00; run `sf_assert_participant_timeline` for each participant and `sf_assert_fund_timeline`; write one audit event with the share list and the closed totals.

Close guard: a `before insert` trigger on `sf_transactions` (`sf_guard_closed_cycle`) raises "{name}'s year was closed on {date}. Use a later date." when a new row (other than a `cycle_close`) of a participant is dated on or before that participant's latest non-voided `cycle_close` date. It covers every write function, deposits included (the timeline check does not see deposits).

## Rules that protect the saved ended totals (added by analysis findings D2, D3, D4)

- `sf_void_transaction` raises "{name}'s year was closed on {date}. Void the distribution first." when the row belongs to a participant with a non-voided `cycle_close` and the row's `tx_date` is on or before that close date.
- `sf_void_transaction` raises "A year-end close is voided with its distribution. Void the distribution instead." for rows of type `cycle_close` (same pattern 015 uses for `interest_share`).
- The distribution date and post-close date rules (validation rule 2 and the close guard above) are requirements FR-048 and FR-049 in the spec.

## State transitions

```text
Distribution:  (none) --distribute--> active --void--> voided
Participant cycle:  open cycle --distribute (ticked)--> closed at dist_date, new cycle at ₱0.00
                    closed --void distribution (no later activity)--> previous cycle restored
```

## Relationships

```text
sf_distributions 1 ──< sf_distribution_participants >── 1 sf_participants
sf_distributions 1 ──< sf_transactions (type interest_share, cycle_close)
```

## TypeScript shapes (hand-maintained `types/database.ts` and `lib/sinking-fund/types.ts`)

```text
SfTransactionType += 'cycle_close'
SfDistribution: per_participant_centavos: number | null; share_count: number; year: number
SfDistributionRow: participant_id, name, savings_before_centavos | null, share_centavos,
                   ended_total_centavos | null
SfDistributionDetail: distribution (SfDistribution) + rows (sorted) + totals
                      { ended_total_centavos | null, share_centavos, year_total_centavos | null }
```
