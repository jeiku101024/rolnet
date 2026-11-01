# Contract: Database

The three migrations are applied in order. Every new function in `public` starts with
`revoke execute … from public, anon, authenticated`. None of the functions below is granted to
`authenticated`, because the app doesn't call them and no RLS policy uses them. "Fleet date" is
`(now() at time zone 'Asia/Manila')::date`. "App session" means `auth.uid() is not null`. Migrations
and service jobs have `auth.uid()` null.

## Migration 1: `20261101000500_expense_fixed_categories.sql`

| Object | Kind | Security | EXECUTE grant |
|--------|------|----------|---------------|
| `expense_category` | enum (8 values, [data-model](../data-model.md)) | n/a | n/a (usage on type is default) |
| `expenses.category`, `custom_category`, `replaced_date`, `needs_review`, `source_table`, `source_id` | columns | covered by the existing expenses RLS | n/a |
| backfill | `update expenses set category = 'others', custom_category = left(trim(c.name),80) from expense_categories c where c.id = expenses.category_id`, then `alter column category set not null` | migration | n/a |
| `expenses.category_id` | `drop not null` | | |
| `expenses_category_shape_check`, `expenses_amount_check`, `expenses_source_pair_check` | checks; `expenses_amount_centavos_check` dropped | | |
| indexes | see data-model; `expenses_category_idx` dropped | | |
| `normalize_expense()` + trigger `expenses_normalize` BEFORE INSERT OR UPDATE | trigger fn | invoker | none |
| `dashboard_monthly_unit_summary(date)` | rebuilt (research R10), same signature and return type, still definer with `is_owner()` filter | definer | `authenticated` (re-granted, unchanged) |

**`normalize_expense()` errors**

| Rule | Code | Message |
|------|------|---------|
| app session, `expense_date` new/changed and > fleet date | `23514` | "Dates can't be in the future." |
| app session, `replaced_date` new/changed and > fleet date | `23514` | "Dates can't be in the future." |
| shape check fails | `23514` (constraint `expenses_category_shape_check`) | mapped by the app: "Check the category, category name, and date replaced." |
| amount check fails | `23514` (constraint `expenses_amount_check`) | mapped by the app: "Enter an amount greater than ₱0.00." |

**Silent normalisation, app session only**:
- On insert: `needs_review := false`, `source_table := null`, `source_id := null`.
- On update: `source_table` and `source_id` are kept from OLD, and `needs_review := false` when
  `amount_centavos > 0`.
- Always: `custom_category` is whitespace-collapsed.

## Migration 2: `20261101000600_move_maintenance_into_expenses.sql`

| Object | Kind | Security | EXECUTE grant |
|--------|------|----------|---------------|
| `maintenance_category_for(p_name text) returns expense_category` | function, immutable SQL (research R3 table) | invoker | none |
| `move_maintenance_into_expenses() returns integer` | plpgsql function. It runs the part insert (`insert into expenses (…) select … from part_replacements where deleted_at is null on conflict (source_table, source_id) where source_table is not null do nothing`) and the same insert from `tire_installations`, and returns the number of rows inserted | invoker | none |
| `verify_maintenance_move() returns void` | plpgsql function. Compares the count and sum per unit, and raises `P0001` "Maintenance move check failed for unit {id}: {n} sources / {m} expenses, {a} / {b} centavos" | invoker | none |
| migration body | `select public.move_maintenance_into_expenses(); select public.verify_maintenance_move();` | migration | |

Calling `move_maintenance_into_expenses()` again on a database that already has the moved rows inserts
nothing, and the check still passes (FR-039).

## Migration 3: `20261101000700_retire_maintenance_writes.sql`

| Object | Change |
|--------|--------|
| policies `parts_operational_insert`, `parts_operational_update` | dropped |
| policies `tires_operational_insert`, `tires_operational_update` | dropped |
| policies `expense_categories_owner_insert_policy`, `expense_categories_owner_update_policy` | dropped |
| `soft_deletable_table(text)` | redefined without `part_replacements`, `tire_installations`, `expense_categories` |
| `soft_delete_record`, `restore_record` | the `expense_categories` system-row branch becomes unreachable. The bodies are unchanged, so the functions aren't redefined. |
| `replace_tire_installation(uuid, jsonb)` | `revoke execute … from authenticated` |
| `due_maintenance(date)` | `revoke execute … from authenticated` |

The read policies (`parts_staff_read`, `tires_staff_read`, `expense_categories_staff_read_policy`)
are kept.

## pgTAP coverage

| File | Covers |
|------|--------|
| `constraints/320_expense_fixed_categories.sql` **new** | enum order. Shape check: all 4 combos per FR-024. Amount check: 0 is rejected for an app insert, and 0 with `needs_review` is allowed only for a migration-role insert. Normalize trigger: whitespace, source fields forced or kept, needs_review cleared. Future-date rule on insert and change but not on an untouched legacy date. Backfill: existing expenses are `others` with their category name. Indexes exist. Summary function counts an expense with null `category_id` in `total_expense_centavos` and `repair_expense_centavos`. |
| `constraints/330_maintenance_move.sql` **new** | `maintenance_category_for` against the whole variant table plus non-matches. Calling `move_maintenance_into_expenses()` on fixture parts and tires: categories, dates, notes, ₱0 → needs_review, idempotency key. A second call returns 0. `verify_maintenance_move()` passes, then raises on a forced mismatch. Neither function is executable by `authenticated`. |
| `rls/220_expenses_merge_rls.sql` **new** | Staff can insert and update expenses with the new fields. Staff can't soft-delete (42501). Owner `soft_delete_record('expenses', id, stale)` returns null. Owner soft delete writes an audit `soft_delete` event with the before values. Staff and owner inserts or updates on `part_replacements`, `tire_installations`, and `expense_categories` fail. `soft_delete_record` on them raises 22023. `replace_tire_installation` and `due_maintenance` aren't executable by `authenticated`. |
| `constraints/020_expenses.sql` | updated: inserts give `category` and `custom_category` or `replaced_date`. The amount-0 assertion now names `expenses_amount_check`. |
| `constraints/040_parts_tires.sql`, `200_replacement_history.sql`, `rls/040_parts_tires_rls.sql` | updated: fixtures are inserted as the migration role (`reset role`), and write assertions flip to "denied". Pure constraint checks stay. |
| `constraints/060_dashboard_queries.sql`, `230_fleet_date_defaults.sql`, `rls/060_dashboard_rls.sql` | updated: the `due_maintenance` assertions run as the postgres role or are removed. Summary fixtures give `category`. |
| `rls/120_function_execute_rls.sql` | updated: `due_maintenance` and `replace_tire_installation` are no longer executable, and the 4 new functions have no grant |
| `rls/190_owner_soft_delete_rls.sql` | updated: parts, tires, and categories now raise `22023` |
| every other file that inserts expenses (070, 080, 090, 120, 160, 220, 300; rls 020, 090) | updated: fixtures supply `category` and the matching field |

The full suite runs on rolnet-dev through the rollback wrapper, after the owner approves the run.
