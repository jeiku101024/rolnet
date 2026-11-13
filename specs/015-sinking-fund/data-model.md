# Data Model: Sinking Fund

All money columns are `bigint` centavos. All tables carry `created_at`, `created_by`, `updated_at`,
`updated_by` (via `set_audit_fields`), reject hard deletes (`reject_hard_delete`), and are audited
(`audit_business_change`). RLS: `select` for approved users only (`is_approved_user()`), no insert, update,
or delete policies; every write goes through the SQL functions in
[contracts/sql-functions.md](contracts/sql-functions.md).

## Enums

- `sf_transaction_type`: `deposit`, `loan`, `payment`, `loan_withdrawal`, `savings_withdrawal`, `interest_share`.
  UI labels: Deposit, Loan, Payment, **Withdrawal** (`loan_withdrawal`), **Savings withdrawal**, Interest share.
- `sf_interest_set_by`: `owner`, `default`.
- `sf_prefill`: `first`, `last`.

## Table `sf_participants`

| Column | Type | Rules |
|---|---|---|
| id | uuid pk | default `gen_random_uuid()` |
| name | text | not null, 1–120 chars after trim |
| name_key | text | generated `lower(btrim(name))` |
| driver_id | uuid null | references `drivers(id)`; unique where not null and `deleted_at is null` |
| notes | text null | max 500 chars |
| archived_at, archived_by | timestamptz, uuid | set only by `sf_archive_participant` |
| created_*, updated_*, deleted_at, deleted_by | standard | `deleted_at` exists per convention; the app never sets it |

Unique index on `name_key` where `archived_at is null and deleted_at is null` (FR-007; an archived
participant's name can be reused).

## Table `sf_transactions`

| Column | Type | Used by | Rules |
|---|---|---|---|
| id | uuid pk | all | |
| participant_id | uuid | all | references `sf_participants` |
| type | `sf_transaction_type` | all | |
| amount_centavos | bigint | all | `> 0` |
| tx_date | date | all | not in the future (function check using `sf_today()`) |
| notes | text null | all | max 500 chars |
| loan_id | uuid null | payment, loan_withdrawal | references `sf_transactions(id)`; must point to a `loan` row of the same participant |
| distribution_id | uuid null | interest_share | references `sf_distributions` |
| interest_rate_bp | integer null | loan | `= 500` at creation (stored per loan) |
| interest_centavos | bigint null | loan | `= amount_centavos * interest_rate_bp / 10000`; amount multiple of 10,000 so it is a multiple of 500 |
| amount_due_centavos | bigint null | loan | `= amount_centavos + interest_centavos` |
| due_date | date null | loan | `= tx_date + 1 month`, clamped to the month's last day |
| interest_part_centavos | bigint null | payment | `>= 0` and `<= amount_centavos` |
| principal_part_centavos | bigint null | payment | `= amount_centavos - interest_part_centavos` |
| interest_set_by | `sf_interest_set_by` null | payment | `owner` or `default` |
| interest_waived_centavos | bigint null | loan_withdrawal | unpaid interest at closing |
| voided_at, voided_by, void_reason | | all | reason required (3–300 chars) when voided |
| idempotency_key | uuid null | creates | unique where not null |
| created_*, updated_*, deleted_at, deleted_by | standard | | `deleted_at` never set (voids are the soft delete) |

Check constraints enforce which columns are set per type (for example, a `deposit` has no `loan_id`; a
`loan` has all four loan columns; a `payment` has `loan_id`, the two parts, and `interest_set_by`; a
`loan_withdrawal` has `loan_id` and `interest_waived_centavos <= amount_centavos`; an `interest_share`
has `distribution_id`). Indexes: `(participant_id, tx_date)` and `(type, tx_date)` where `voided_at is
null` (spec §17), `(loan_id)` where not null, `(distribution_id)` where not null.

## Table `sf_distributions`

| Column | Type | Rules |
|---|---|---|
| id | uuid pk | |
| dist_date | date | not in the future |
| available_before_centavos | bigint | Interest fund as of `dist_date` before this distribution, `> 0` |
| per_participant_centavos | bigint | `> 0`, `= floor(available / participant_count)` |
| participant_count | integer | `> 0` |
| total_distributed_centavos | bigint | `= per_participant * participant_count` |
| remainder_centavos | bigint | `= available_before - total_distributed`, `>= 0` and `< participant_count` |
| notes | text null | |
| voided_at, voided_by, void_reason | | voiding voids all of its `interest_share` rows in the same transaction |
| idempotency_key | uuid null | unique |
| standard audit columns | | |

## Table `sf_settings` (single row)

| Column | Type | Rules |
|---|---|---|
| id | uuid pk | fixed value `00000000-0000-0000-0000-000000000002` (so the shared audit trigger, which reads `id` as a uuid, works); seeded by the migration |
| default_interest_prefill | `sf_prefill` | default `first` |
| timezone | text | default `Asia/Manila`; read by `sf_today()` |
| standard audit columns | | |

Rate (5%), loan step (₱100), and loan term (1 month) are constants in `sf_constants()` (a SQL function) and
in `lib/sinking-fund/rules.ts`, shown read-only in Fund settings.

## Derived values

Savings effect per non-voided row (`sf_savings_delta`):

| Type | Savings effect | Interest fund effect |
|---|---|---|
| deposit | `+amount` | none |
| loan | `-amount` | none |
| payment | `+principal_part` | `+interest_part` |
| loan_withdrawal | none | none (interest waived) |
| savings_withdrawal | `-amount` | none |
| interest_share | `+amount` | `-amount` (counted through the distribution) |

- **Total savings** (participant, as of date) = sum of effects with `tx_date <= date`.
- **Interest fund** (as of date) = sum of payment interest parts − sum of non-voided distribution totals
  with dates `<= date`. Collected all time = sum of interest parts; Distributed = sum of distribution
  totals; Expected = sum of unpaid interest on Open and Overdue loans.
- **`sf_loans_v`** per loan: `interest_paid`, `principal_paid` (sum of non-voided payment parts),
  `unpaid_interest = interest - interest_paid`, `unpaid_principal = principal - principal_paid`,
  `balance = amount_due - paid` (zero when withdrawn), `status` (`withdrawn` if a non-voided
  `loan_withdrawal` exists; else `paid` if balance is 0; else `open`), `overdue = status = 'open' and
  due_date < sf_today()`.
- **Total loans** (participant) = principal of loans with status `open`; **Balance to pay** = sum of their
  balances.

## Invariants (enforced in SQL, re-checked after every write)

1. A participant's running savings is `>= 0` on every date (timeline order: date, credits before debits,
   `created_at`).
2. The Interest fund is `>= 0` on every date.
3. Per loan: `0 <= interest_paid <= interest`, `0 <= principal_paid <= principal`, payment dates are not
   before the loan date, a payment never exceeds the balance, and balance 0 implies both fully paid.
4. A loan principal is a positive multiple of ₱100 and `<=` the savings available on its date.
5. A loan Withdrawal is allowed only on an overdue open loan, dated today, amount = balance, and only one
   non-voided Withdrawal per loan.
6. A payment's interest part lies within the allowed range computed from the loan's other non-voided
   payments: minimum `max(0, amount - unpaid_principal_excluding_this)`, maximum
   `min(amount, unpaid_interest_excluding_this)`.

## State transitions

**Loan**: `open → paid` (final payment brings balance to 0); `open/overdue → withdrawn` (owner,
overdue only); voiding the last payment returns `paid → open` (or overdue); voiding the Withdrawal
returns `withdrawn → open/overdue` at its previous balance. `overdue` is a derived flag on `open`.

**Void rules** (`sf_void_transaction`, owner):

| Target | Blocked when |
|---|---|
| deposit | any date's savings would go negative |
| loan | any non-voided payment or Withdrawal references it |
| payment | its loan is withdrawn (void the Withdrawal first); Interest fund or savings negative on any date |
| loan_withdrawal | never blocked by balances (reopens the loan); loan must not already be voided |
| savings_withdrawal | never blocked (restores savings) |
| interest_share | not voidable alone; use `sf_void_distribution` |
| distribution | any participant's savings negative on any date |

**Participant**: active → archived (owner; savings 0 and no open loans, which includes overdue). Name edit
on a linked participant clears `driver_id` after the app confirms.

## Audit

`audit_business_change` records before and after JSON for every insert and update on the four tables
(creates, name edits, archive, interest-part changes, voids, settings changes). The functions also call
`write_audit_event` with `action = 'reverse'` and the reason for voids, and with entity type
`sf_distributions` for distributions, so the audit page can show a reason.
