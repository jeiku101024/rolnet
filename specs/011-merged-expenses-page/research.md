# Research: Merged Expenses Page

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-01

The Technical Context had no open unknowns. Each item below records a design choice the spec leaves
to planning, checked against the current code and migrations at `6a69324` (the merge of feature 010).

## R1. Categories are an enum column on `expenses`; `expense_categories` is kept but frozen

**Decision**: Add the enum `public.expense_category` with the values `change_oil`, `front_tire`,
`rear_tire`, `engine_sprocket`, `chain`, `rear_sprocket`, `battery`, and `others`. The enum's declared
order is the display order (FR-009). New columns on `expenses`:
- `category expense_category not null`
- `custom_category text`
- `replaced_date date`

One check constraint, `expenses_category_shape_check`, ties them together:
- `category = 'others'`: `custom_category` is not null, its trimmed length is 1–80, and
  `replaced_date` is null.
- Any other category: `custom_category` is null and `replaced_date` is not null.

`category_id` becomes nullable, and the app stops writing it. `expense_categories` stays, read-only
(R9).

**Rationale**: The list is fixed in order and meaning (FR-009). An enum gives type-safe values in
`types/database.ts`, a natural sort order, and enum search through the existing
`matchingEnumValues` helper. It also needs no join. Keeping `category_id` and the old table means no
data is dropped (constitution: migrations must preserve data). Old reports and the audit trail can
still resolve the old names.

**Alternatives considered**:
- (a) Re-seed `expense_categories` with the 8 rows and keep the FK. Rejected: the order, the "Others"
  rule, and the date rule would live in data that owners could edit. The check constraint would
  need a join or a trigger.
- (b) A text column with a check. Rejected: no generated union type and no natural sort.

## R2. Existing expenses become Others with their old category name

**Decision**: The first migration sets these values on every existing expense, including
soft-deleted ones, so the check constraint holds for all rows:
- `category = 'others'`
- `custom_category = left(trim(expense_categories.name), 80)`

`replaced_date` stays null. `category_id` is kept as is.

**Rationale**: This follows the spec's edge case ("no expense loses its label"). Old Fuel or
Registration costs aren't part replacements, so they get no Last Replaced date.

## R3. Moving parts and tires: deterministic, idempotent, self-checking

**Decision**: The second migration inserts one expense per non-deleted `part_replacements` row and one
per non-deleted `tire_installations` row. Soft-deleted rows were already removed from the app, so
they aren't moved.

Fields on each moved expense:
- `source_table` (`'part_replacements'` or `'tire_installations'`) and `source_id`, the original id.
  A partial unique index on `(source_table, source_id)` makes `insert … on conflict do nothing`
  safe to re-run (FR-039).
- `idempotency_key = source_id`. The column is not-null and unique, and source ids are uuids that
  were never used as expense keys.
- `expense_date = replaced_date = replaced_on / installed_on` for main categories.
  `replaced_date` is null for Others.
- `amount_centavos = cost_centavos`.
- `needs_review = (cost_centavos = 0)` (R4).
- `created_at` and `created_by` copied from the source. `updated_at = now()`.
- `notes`, built from the parts that exist, joined by " · ":
  - Parts: original notes, `"{replacement_mileage} km"`, `"Next due {next_due_date}"`,
    `"Next due {next_due_mileage} km"`.
  - Tires: `"{position label} · {brand}"`, `"{installed_mileage} km"`, and the next-due parts.

**Name mapping** (FR-035) is done by `public.maintenance_category_for(p_name text)`, an immutable
SQL function with no EXECUTE grant (migrations and pgTAP only). It normalizes the name: lower case,
`&` becomes "and", everything except letters is stripped. It then matches exactly against a fixed
variant list:

| Category | Normalized keys |
|----------|-----------------|
| change_oil | `changeoil`, `oilchange`, `engineoil`, `oil`, `motoroil` |
| front_tire | `fronttire`, `fronttyre` |
| rear_tire | `reartire`, `reartyre` |
| engine_sprocket | `enginesprocket`, `sprocketengine`, `frontsprocket`, `drivesprocket` |
| chain | `chain`, `drivechain` |
| rear_sprocket | `rearsprocket`, `sprocketrear`, `drivensprocket` |
| battery | `battery` |

Any other name maps to `others`, with `custom_category = left(trim(part_name), 80)`. Tires map by
position: `front` becomes `front_tire`, `rear_left` and `rear_right` become `rear_tire`. A TypeScript
twin, `mainCategoryFor(name)` in `lib/expenses/categories.ts`, is used for demo data and tested
against the same table.

**Functions, so the tests run the real code**: the inserts live in
`public.move_maintenance_into_expenses() returns integer`, and the check lives in
`public.verify_maintenance_move() returns void`. Both are plpgsql, invoker, and have no EXECUTE
grant. The migration calls one, then the other. pgTAP file 330 calls the same functions, so the test
can't drift from the migration.

**Self-check** (FR-039, SC-002): after the inserts, `verify_maintenance_move()` compares, per unit, the count and
`sum(cost_centavos)` of the non-deleted sources with the count and `sum(amount_centavos)` of the
expenses whose `source_table` is set. Any difference raises an exception. The migration runs in one
transaction, so it rolls back completely.

**Alternatives considered**:
- Fuzzy matching (trigram similarity). Rejected: it's unpredictable, and a wrong match would invent
  a false Last Replaced date. The Others fallback loses nothing.
- Moving soft-deleted rows as soft-deleted expenses. Rejected: they add noise, and the original rows
  are kept anyway.

## R4. ₱0 moved records: `needs_review` relaxes the amount rule

**Decision**:
- Add `needs_review boolean not null default false`.
- Replace the inline amount check, `expenses_amount_centavos_check`, with
  `expenses_amount_check: amount_centavos > 0 or (amount_centavos = 0 and needs_review)`.
- A BEFORE INSERT OR UPDATE trigger, `normalize_expense()`, runs for app sessions
  (`auth.uid() is not null`). On insert it forces `needs_review = false`, `source_table = null`, and
  `source_id = null`. On update it keeps `source_*` from OLD, and sets `needs_review = false` once
  `amount_centavos > 0`.
- The app never sends `needs_review`.

**Rationale**: FR-040 lets only moved rows hold ₱0. Saving a real amount clears the mark. The trigger
stops an API client from creating ₱0 rows or faking a "moved" origin.

## R5. Validation rules live in the database and are mirrored in Zod

**Decision**: `normalize_expense()` also:
- collapses whitespace in `custom_category`: `regexp_replace(trim(x), '\s+', ' ', 'g')`. Case is
  kept.

The check constraint covers the shape rules. `lib/validation/expenses.ts` mirrors all of these as
Zod refinements, so the modal shows inline errors before a round trip (FR-021). The two dates aren't
ordered against each other (spec edge case).

**Implementation note (2026-11-01)**: the "no future dates" rule is enforced by the app's Zod
validation (modal and server actions), not by the database. Existing pgTAP fixtures insert
expenses as staff with far-future dates (2030s) on purpose, to stay isolated from real data on
rolnet-dev; a database rule would break them. The API keeps accepting any date, as it did before.

## R6. The "Others" name that matches a main category is a warning only

**Decision**: When the typed Category name normalizes to a main category through
`mainCategoryFor`, the modal shows a non-blocking hint under the field: "This looks like
{label}. Choose it from Category to track Last Replaced." Saving is still allowed. The database
doesn't care.

## R7. Delete uses the existing `soft_delete_record` with a stale check

**Decision**: A new server action, `deleteExpense(id, expectedUpdatedAt)`:
- replaces `softDeleteExpense`
- requires `manage_master_data` (owner)
- calls `soft_delete_record('expenses', id, expectedUpdatedAt)`. A null result means
  `STALE_RECORD`: "This expense was changed or deleted by someone else. Reload to see the latest."

`audit_business_change()` already writes a `soft_delete` event with the full `before` row and actor
(FR-031, SC-005), with receipt paths stripped. Every reader already filters `deleted_at is null`:
- the page
- `monthlyAllowanceBlocks`
- `loadReportData`
- `dashboard_monthly_unit_summary`

So a delete leaves every total at once (FR-030).

**Rationale**: Constitution III. The user chose soft delete. There's no new SQL.

## R8. Filtered peso total: sum the same filtered query, paged

**Decision**: `lib/expenses/list-total.ts` exports `loadExpenseTotal(supabase, request, controls)`.
It builds the exact query the page uses:
- the same `buildSearchFilter(searchSpecs.expenses)` result
- the same `applyFilters`
- `select("amount_centavos")`

It reads in pages of 1000, which is the pattern in `lib/reports/report-data.ts`, and sums with
integer math. If the count is 0 it skips the read. It runs in parallel with the page read. The
result goes into the existing `ListView.hint`, so the toolbar shows "42 records · ₱18,450.00"
(FR-007). Demo mode sums `controlRows(...)`.

**Rationale**: Sharing one filter builder guarantees SC-003. A second SQL implementation of the
search would drift. The fleet is about 12 units, and a busy year is about 2,000 expense rows, so the
total takes 1–2 reads. That's well within free-tier limits.

**Alternatives considered**:
- PostgREST aggregates (`amount_centavos.sum()`). Rejected: they need `db-aggregates-enabled`, a
  project-wide setting change.
- An RPC that reimplements search. Rejected: two search implementations would drift.

## R9. Legacy writes are closed in the database, not only in the app

**Decision**: The third migration:
- drops `parts_operational_insert` and `parts_operational_update`.
- drops `tires_operational_insert` and `tires_operational_update`.
- drops `expense_categories_owner_insert_policy` and `expense_categories_owner_update_policy`.
- redefines `soft_deletable_table` without `part_replacements`, `tire_installations`, and
  `expense_categories`, so `soft_delete_record` and `restore_record` refuse them with the existing
  `22023` message.
- revokes EXECUTE on `replace_tire_installation` and `due_maintenance` from `authenticated`. Both are
  kept, unused.

Read policies stay.

In the API, `resource-config.ts` marks `part-replacements`, `tire-installations`, and
`expense-categories` as `readOnly` with empty create and update fields, and removes `ownerWrite`
from categories so callers get the read-only 405, not a 403. The special route
`POST tire-installations/{id}/replace` returns the same 405 (FR-039a). The message becomes
"This resource is read only. Record costs as expenses." for these three resources, set by a new
optional `readOnlyMessage` on `ResourceConfig`.

**Rationale**: This gives FR-039a for every path (app, API, SQL). The tables keep their history
read-only indefinitely, as clarified.

## R10. `dashboard_monthly_unit_summary` must survive a null `category_id`

**Decision**: Rebuild the function in migration 1. The return type is unchanged. Changes:
- left-join the categories
- `fuel_expense_centavos`, `registration_expense_centavos`, `insurance_expense_centavos`: legacy
  system keys, as before
- `repair_expense_centavos`: legacy `repairs` plus every main category
- `other_expense_centavos`: everything else
- `total_expense_centavos`: all non-deleted expenses in the month, the same as before

The app reads only the total (`monthTotals`, `unitIncomeBars`). `monthly_report` wraps it and needs no
change. Existing pgTAP files 060 and 220 must still pass.

**Rationale**: Today the join is inner, so a moved part with `category_id` null would vanish from
dashboard totals. That would break SC-004.

## R11. The page reuses the 010 components; no new UI library

**Decision**:
- **Toolbar**: `listView(..., { controls, action: <AddExpenseDialog/>, hint: formatPesos(total) })`
  gives search, the date-range button, Filters, the primary "Add expense" with `Plus`, and the
  count line.
- **Modal**: `components/ui/dialog.tsx`. It traps focus, closes on Escape, and returns focus to the
  trigger (FR-022).
- **Row menu**: `components/ui/dropdown-menu.tsx`. The positioner flips upward near the bottom, as on
  `UnitRowMenu` (FR-027).
- **Delete**: `components/ui/alert-dialog.tsx`, the `ArchiveUnitDialog` pattern. Cancel has
  `initialFocus`, and the confirm button is `bg-danger text-surface` (FR-029).
- **Toasts**: `useToast()`.
- **Notes**: the existing `Truncated` helper and `Tooltip` (FR-015).
- **Table**: `DataTable`. At 360 px it scrolls inside its own region, which is the app's existing
  phone pattern (FR-017).

One form component, `ExpenseFormFields`, serves add and edit. Category switching keeps the other
values in React state (FR-020). The main-to-Others confirmation is a nested `AlertDialog` shown when
the user picks Others while editing a saved main-category expense (FR-024). The receipt input and
upload flow are kept from `expense-form.tsx` (`useActionForm`, keys, `attachReceipt`).

## R12. Redirects are pages, not `next.config` redirects

**Decision**: Keep `app/(operations)/maintenance/page.tsx` and `[unitId]/page.tsx` as tiny server
pages:
- `/maintenance` calls `permanentRedirect("/expenses")`.
- `/maintenance/{id}` calls `permanentRedirect("/expenses?unit={id}")` when `{id}` is a uuid, and
  `/expenses` otherwise.

Their `loading.tsx` files are deleted.

**Rationale**: The vinext Workers build is a gate (`corepack pnpm check`). Page-level
`permanentRedirect` is plain App Router and already works under vinext. `next.config` `redirects()`
support would be one more compatibility risk. See `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/permanentRedirect.md`.

## R13. Mileage: owner on Unit detail, staff from the Daily card

**Decision**:
- **Unit detail**: a new `MileageSection` holds the existing `MileageForm`, and below it a
  `PagedList` of readings with prefix `mileage_`.
- **Daily view**: `components/units/record-mileage-dialog.tsx` puts `MileageForm` in a `Dialog`.
  It's reachable from a "Record mileage" button on every assignment card, including blocked
  (In repair) cards and staff cards. Archived units have no card.
- **Action**: `upsertMileageReading` keeps its rules. Its revalidation drops `/maintenance` paths and
  adds `/units`.

**Rationale**: Staff can open the Daily view (010), and Unit detail stays owner-only. The rule is
unchanged because it lives in the `validate_mileage_reading` trigger.

## R14. Retiring next-due reminders

**Decision**: Remove:
- the `due_maintenance` call, `describeDueItems`, `orderDueMaintenance`, and `dueText`
- `FleetStats.maintenanceDue`, the "Maintenance due" stat tile, and the attention panel
- the "maintenance" recent glimpse, along with the dashboard's parts and tires reads
- `demoDueMaintenance`, and `listControlSpecs.maintenance` with its `due` filter

The dashboard band copy changes from "Expired documents, overdue maintenance and unpaid balances" to
"Expired documents and unpaid balances". The recent "expenses" glimpse shows the category label.

## R15. Last Replaced on Unit detail is computed in TypeScript

**Decision**: The Unit detail page reads:

```
expenses.select("category, replaced_date").eq("unit_id").neq("category","others").is("deleted_at", null)
```

`lastReplacedByCategory(rows)` in `lib/expenses/last-replaced.ts` reduces that to the latest date per
main category, in enum order, with null meaning "Never recorded". Each entry links to
`/expenses?unit={id}&category={value}`. A partial index `expenses_unit_category_replaced_idx
(unit_id, category, replaced_date desc) where deleted_at is null and category <> 'others'` keeps it
cheap.

## R16. Indexes

**Decision**:
- Add `expenses_date_idx (expense_date desc) where deleted_at is null` (spec §8 and FR-008).
- `expenses_unit_date_idx` already covers `(unit_id, expense_date)`.
- Add `expenses_source_unique (source_table, source_id) where source_table is not null` (R3).
- Add the Last Replaced index (R15).
- Drop `expenses_category_idx`, because the app no longer filters on `category_id`.
- Add `expenses_category_date_idx (category, expense_date desc) where deleted_at is null` for the
  category filter.

## R17. Search and filters

**Decision**: `searchSpecs.expenses` becomes:
- `columns: ["notes", "custom_category"]`
- `related: [unitLink]`
- `enums: [{ column: "category", labels: expenseCategoryLabels }]`
- `dateColumn` and `amountColumn` as before

`RelatedSearch.table` no longer needs `expense_categories`.

`listControlSpecs.expenses` filters:
- `range expense_date`
- `eq unit`
- `eq category`: fixed options in enum order, "Others" last
- `presence receipt`: kept
- new `eq review`: "Needs review" (`needs_review = true`) and "Moved from maintenance"
  (`source_table` not null). This is a `page`-kind filter mapped to two query shapes.

The sorts are unchanged: newest (the default), oldest, amount high to low, and amount low to high.
The empty text for this list is "No expenses match these filters." `SearchEmpty` gains an optional
`emptyText` on `ListView`.
