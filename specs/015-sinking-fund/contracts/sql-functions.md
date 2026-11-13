# Contract: SQL functions

Every function is in schema `public`, `language plpgsql`, `security definer`, `set search_path = public`.
Created with no EXECUTE for `anon` or `authenticated`, then granted to `authenticated` explicitly in the
same migration (the app calls each one). All write functions take the advisory lock first, validate, write,
re-validate timelines, and return the new or changed row id (`uuid`) unless noted. Amounts are centavos.

Common error codes (raised as `errcode`; the Server Action maps them to messages):

| errcode | Meaning | App code |
|---|---|---|
| `42501` | Caller is not approved, or is not the owner when required | `FORBIDDEN` |
| `P0002` | Row not found or already voided | `NOT_FOUND` |
| `P0001` | Rule violation or stale record; the message is already plain language | `RULE` / `STALE_RECORD` |
| `40001` | The record changed since it was read | `STALE_RECORD` |
| `23514` | Constraint violation (should not surface; means a function bug) | `INVALID` |

## Write functions

| Function | Who | Behavior |
|---|---|---|
| `sf_add_participant(p_name text, p_driver_id uuid, p_notes text)` | approved | Trim name, reject duplicates among active (`23505`, message "A participant named X already exists."), reject a driver already linked or deleted. |
| `sf_rename_participant(p_id uuid, p_name text, p_expected_updated_at timestamptz)` | approved | Same duplicate check; clears `driver_id` (the app confirms before calling). |
| `sf_archive_participant(p_id uuid, p_expected_updated_at timestamptz)` | owner | Requires savings 0 and no open or overdue loan. |
| `sf_record_deposit(p_participant uuid, p_date date, p_amount bigint, p_notes text, p_key uuid)` | approved | Date not in future; amount > 0; active participant. |
| `sf_record_loan(p_participant uuid, p_date date, p_amount bigint, p_notes text, p_key uuid)` | approved | Amount a positive multiple of 10,000; `<=` savings on that date; sets rate, interest, amount due, due date (month add with clamp); timeline re-validation. |
| `sf_record_payment(p_loan uuid, p_date date, p_amount bigint, p_interest_part bigint, p_notes text, p_key uuid)` | approved | Date `>=` loan date and not future; amount `<=` balance (excluding nothing); loan must be open or overdue. **Owner**: `p_interest_part` must be within the allowed range and is stored with `interest_set_by = 'owner'`. **Non-owner**: `p_interest_part` is ignored; the server computes the default from `sf_settings` (`first` = maximum allowed, `last` = minimum allowed) and stores `'default'`. |
| `sf_record_savings_withdrawal(p_participant uuid, p_date date, p_amount bigint, p_notes text, p_key uuid)` | owner | Amount `<=` savings on that date; timeline re-validation. |
| `sf_mark_loan_withdrawal(p_loan uuid, p_expected_balance_centavos bigint)` | owner | Loan must be open and overdue; the balance the owner saw must still match (a payment recorded meanwhile makes it stale, since payments do not change the loan row); creates a `loan_withdrawal` dated today with amount = balance and `interest_waived = unpaid interest`; savings unchanged. |
| `sf_change_interest_part(p_payment uuid, p_interest_part bigint, p_expected_updated_at timestamptz)` | owner | Payment not voided, loan not withdrawn; allowed range from the loan's other non-voided payments; updates both parts and sets `interest_set_by = 'owner'`; timelines re-validated (savings and fund). |
| `sf_distribute_interest(p_date date, p_participants uuid[], p_notes text, p_key uuid)` | owner | Participants must be active and unique and non-empty; available = fund as of `p_date`; share = floor(available / n); creates one distribution and one `interest_share` per participant; fund and savings timelines re-validated. Returns the distribution id. |
| `sf_void_transaction(p_id uuid, p_reason text, p_expected_updated_at timestamptz)` | owner | Per the void table in [data-model.md](../data-model.md); `interest_share` rows are refused with a message to void the distribution. Writes a `reverse` audit event with the reason. |
| `sf_void_distribution(p_id uuid, p_reason text, p_expected_updated_at timestamptz)` | owner | Voids the distribution and all its shares together. |
| `sf_set_default_prefill(p_value sf_prefill)` | owner | Updates `sf_settings`; the audit trigger records old and new. |

`sf_today()` (business date) is the one helper granted to `authenticated`, because the invoker views call it.
Validators (not granted, called only by the functions above): `sf_lock()`, `sf_savings_total`, `sf_fund_total`, `sf_peso(bigint)`
for messages, `sf_assert_participant_timeline(uuid)`, `sf_assert_fund_timeline()`,
`sf_assert_loan(uuid)`, `sf_allowed_interest(p_loan uuid, p_amount bigint, p_exclude_payment uuid)` returns
`(min bigint, max bigint)`, `sf_loan_due_date(date)`. The owner form reads the allowed range through the
separate granted wrapper `sf_allowed_interest_range` (see below), which checks `is_approved_user()`.

## Read functions and views (invoker, approved users via RLS)

| Object | Returns |
|---|---|
| `sf_loans_v` | One row per loan: ids, dates, principal, interest, amount due, interest/principal paid, unpaid interest/principal, balance, `status`, `overdue`, withdrawn date |
| `sf_ledger_v` | One row per non-voided and voided transaction with participant name, driver flag, loan columns, balance after (for payments), and the parent loan date |
| `sf_savings_at(p_participant uuid, p_date date)` | `bigint`; used for the form preview and checks |
| `sf_allowed_interest_range(p_loan uuid, p_amount bigint, p_exclude_payment uuid)` | Granted read wrapper for the owner form and Change interest part dialog; returns `(min, max)`, writes nothing, checks `is_approved_user()` |
| `sf_fund_summary(p_from date, p_to date)` | Total savings, loans outstanding (principal, count), balance to collect, payments received in range, interest collected, distributed, available, expected |
| `sf_participant_summaries(p_as_of date)` | Per active participant: savings, total loans, balance to pay, overdue flag, last transaction date, interest shares received |
| `sf_ranking(p_rank_by text, p_period text, p_start date, p_end date)` | Active participants with the ranking amount (`savings` as of `p_end`, or `deposits` in range), unranked ties resolved in the app |
| `sf_monthly_flows(p_months int)` | Deposits, loans, payments per month for the last N months (includes archived participants' history) |
| `sf_distribution_history()` | Past distributions with per-participant amount and status |

Read functions are `stable` and `security invoker`, so RLS applies. They are granted to `authenticated`
because the app calls them.
