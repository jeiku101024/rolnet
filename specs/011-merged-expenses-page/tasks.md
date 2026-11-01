---

description: "Task list for feature 011: Merged Expenses Page"
---

# Tasks: Merged Expenses Page

**Input**: Design documents from `specs/011-merged-expenses-page/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. CLAUDE.md requires lint, typecheck, and tests to pass for every task, plus pgTAP
coverage for schema changes. Write each story's tests first and confirm they fail.

**Organization**: Tasks are grouped by user story (US1 to US5 from spec.md), so each story can be
built, tested, and demonstrated on its own once Phase 2 is done.

**Constitution compliance**: [plan.md](plan.md) "Constitution Check" passes for principles I–V and
the workflow gates. The rules below are how every task keeps it passing, and T061 records the
acceptance checks Principle IV requires.

**Hard rules for every task** (CLAUDE.md, constitution 1.1.0, memory):
- **Schema**: schema, RLS, and SQL functions change only in the three new migrations named below,
  each with pgTAP coverage. Never edit a pushed migration.
- **Grants**: new `public` functions (`normalize_expense`, `maintenance_category_for`,
  `move_maintenance_into_expenses`, `verify_maintenance_move`) start with
  `revoke execute … from public, anon, authenticated` and get **no** grant.
  `dashboard_monthly_unit_summary` keeps `grant execute … to authenticated`.
- **rolnet-dev needs the user's approval**: pushing migrations to rolnet-dev and running pgTAP there
  needs the user's explicit approval (there's no local Supabase). Ask before T012. Back up
  `expenses`, `part_replacements`, and `tire_installations` before migration 2 runs on any database
  with real data. Run the **full** pgTAP suite.
- **Soft delete only**: expenses are never hard-deleted. "Delete" calls `soft_delete_record`.
- **Money**: integer centavos. Parse and format only with `lib/money/centavos.ts`.
- **Fleet date**: `(now() at time zone 'Asia/Manila')::date` in SQL, `fleetToday()` in TypeScript.
- **UI**: no new npm packages. Use the existing `components/ui/*` (dialog, alert-dialog,
  dropdown-menu, toast, tooltip, paged-list, data-table) and tokens only. Every screen works at
  360 px.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1 to US5)

---

## Phase 1: Setup

- [ ] T001 Confirm branch `011-merged-expenses-page` (cut from `main` at 6a69324) is checked out and `.specify/feature.json` points to `specs/011-merged-expenses-page`
- [ ] T002 [P] Create `lib/expenses/categories.ts` (data-model "Enum", research R3). Exports:
  - `expenseCategoryOptions`: `["change_oil","front_tire","rear_tire","engine_sprocket","chain","rear_sprocket","battery","others"]` in this order.
  - `mainCategories`: the first 7.
  - `expenseCategoryLabels`: Change Oil, Front Tire, Rear Tire, Engine Sprocket, Chain, Rear Sprocket, Battery, Others.
  - `isMainCategory(c)`.
  - `categoryText(row)`: the label, or `custom_category` for Others.
  - `mainCategoryFor(name)`: lower-case it, turn `&` into "and", strip non-letters, then exact-match the variant table in research R3; return null on no match.

  Until T013 regenerates the types, use a local string union.
- [ ] T003 [P] Write `tests/unit/expense-categories.test.ts`. Cover the order and labels, `isMainCategory`, `categoryText`, and `mainCategoryFor` for every key in the research R3 table, plus mixed case and punctuation ("Change-Oil", "Oil change", "Drive Chain", "Sprocket (rear)"), and plus non-matches ("Brake pads", "Spark plug", "Air filter", "Rear left tire (Dunlop)")

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The three migrations, regenerated types, and the expense write path the new `not null category` forces. Every story depends on these.

**⚠️ CRITICAL**: No user story work starts until this phase is complete. After migration 1, inserts without `category` fail, so T016 must land with the migrations.

### Database tests first

- [ ] T004 [P] Write `supabase/tests/constraints/320_expense_fixed_categories.sql` (contracts/database.md, migration 1). It must check:
  - `enum_range(null::expense_category)` is in the data-model order.
  - The shape check (all 4 combos): `others` with `custom_category` set and `replaced_date` null passes. `others` with `replaced_date` set fails, and so does `others` with no name or with a name of more than 80 characters. A main category with `replaced_date` set and no `custom_category` passes. A main category without `replaced_date`, or with `custom_category`, fails.
  - The amount check: `0` from an app session (`set local role authenticated` with jwt claims) fails with `expenses_amount_check`, even with `needs_review = true`. `0` with `needs_review = true` as the postgres role passes.
  - `normalize_expense`:
    - `'  Brake   pads '` is stored as `'Brake pads'`.
    - An app insert with `needs_review = true`, `source_table`, or `source_id` stores false, null, null.
    - An app update can't change `source_table` or `source_id`.
    - Updating a moved ₱0 row to an amount > 0 clears `needs_review`.
  - Future dates: an app insert with `expense_date` or `replaced_date` = fleet date + 1 raises `23514` "Dates can't be in the future.". Updating only `notes` on a row whose stored date is in the future (inserted as postgres) passes.
  - The backfill: a fixture expense created before the migration can't be built in a test, so assert that every row has a non-null `category` and that rows with a `category_id` have `custom_category` = that category's name.
  - Indexes `expenses_date_idx`, `expenses_category_date_idx`, `expenses_unit_category_replaced_idx`, and `expenses_source_unique` exist. `expenses_category_idx` doesn't.
  - `dashboard_monthly_unit_summary` counts an expense with `category_id` null in `total_expense_centavos` and (main category) in `repair_expense_centavos`. An `others` row with null `category_id` counts in `other_expense_centavos`.
  - `normalize_expense()` has no EXECUTE for `anon` or `authenticated`.
- [ ] T005 [P] Write `supabase/tests/constraints/330_maintenance_move.sql` (research R3, contracts/database.md migration 2). It must check:
  - `maintenance_category_for` against every row of the research R3 table, and `others` for "Brake pads" and "Spark plug".
  - It has no EXECUTE for `anon` or `authenticated`.
  - `move_maintenance_into_expenses()` and `verify_maintenance_move()` have no EXECUTE for `anon` or `authenticated`.
  - Calling `select public.move_maintenance_into_expenses()` on fixtures, as the postgres role, inside the test (the same function the migration calls, so the test can't drift from it):
    - A part "Engine oil" with cost 45000 and `replaced_on` 2026-09-01 becomes `change_oil` with `expense_date = replaced_date = 2026-09-01`, amount 45000, `needs_review` false, `source_table` `'part_replacements'`, `source_id` = the part id, `idempotency_key` = the part id, and `category_id` null.
    - A part "Brake shoes" with cost 0 becomes `others` / "Brake shoes", `replaced_date` null, amount 0, `needs_review` true.
    - Tires `front` and `rear_left` become `front_tire` and `rear_tire`. Their notes contain the position label and the brand.
    - A soft-deleted part isn't moved.
  - A second call returns 0 inserted rows and adds nothing.
  - `verify_maintenance_move()` passes after the move. It raises `P0001` "Maintenance move check failed…" after a moved fixture expense's `amount_centavos` is changed (as postgres) to break the sum.
- [ ] T006 [P] Write `supabase/tests/rls/220_expenses_merge_rls.sql` (contracts/database.md). It must check:
  - Staff can insert and update expenses with `category`, `custom_category`, and `replaced_date`.
  - A staff update setting `deleted_at` raises `42501`.
  - Owner `soft_delete_record('expenses', id, <stale timestamp>)` returns null, and with the current `updated_at` returns the row.
  - The owner's soft delete writes one `audit_events` row with `action = 'soft_delete'`, `entity_type = 'expenses'`, and `changed_fields->'before'` containing `amount_centavos`, `category`, and `expense_date`.
  - Inserts and updates by staff and owner on `part_replacements`, `tire_installations`, and `expense_categories` affect 0 rows or raise (RLS).
  - `soft_delete_record` on those three tables raises `22023`.
  - `replace_tire_installation` and `due_maintenance` aren't executable by `authenticated`.
  - Their reads still work for approved users.
- [ ] T007 Update the existing pgTAP files to the new schema (contracts/database.md "pgTAP coverage"):
  - Expense fixtures in `supabase/tests/constraints/020_expenses.sql`, `070_monthly_reports.sql`, `080_business_audit.sql`, `090_operational_crud.sql`, `120_concurrency_idempotency.sql`, `160_receipt_path_ownership.sql`, `220_monthly_report_reconciliation.sql`, and `300_unit_archive_release.sql`, and in `supabase/tests/rls/020_expenses_storage_rls.sql` and `090_operational_crud_rls.sql`, must supply `category` plus `custom_category` or `replaced_date`. 020's amount assertion names `expenses_amount_check`.
  - `constraints/040_parts_tires.sql`, `200_replacement_history.sql`, and `rls/040_parts_tires_rls.sql` insert fixtures as the postgres role, and their write assertions flip to denied.
  - The `due_maintenance` assertions in `constraints/060_dashboard_queries.sql`, `230_fleet_date_defaults.sql`, and `rls/060_dashboard_rls.sql` run as the postgres role.
  - `rls/120_function_execute_rls.sql` expects no EXECUTE on `due_maintenance` or `replace_tire_installation`, and none on the 4 new functions (`normalize_expense`, `maintenance_category_for`, `move_maintenance_into_expenses`, `verify_maintenance_move`).
  - `rls/190_owner_soft_delete_rls.sql` expects `22023` for parts, tires, and categories.

### Migrations

- [ ] T008 Write `supabase/migrations/20261101000500_expense_fixed_categories.sql` (contracts/database.md migration 1, data-model `expenses`):
  - **Enum**: create `expense_category` with the 8 values in order.
  - **Columns**: add `category expense_category`, `custom_category text`, `replaced_date date`, `needs_review boolean not null default false`, `source_table text`, `source_id uuid`.
  - **Backfill**: `update public.expenses e set category = 'others', custom_category = left(trim(c.name), 80) from public.expense_categories c where c.id = e.category_id`, then `alter column category set not null` and `alter column category_id drop not null`.
  - **Checks**: drop `expenses_amount_centavos_check`. Add these three:
    - `expenses_category_shape_check`: "(category = 'others' and custom_category is not null and length(trim(custom_category)) between 1 and 80 and replaced_date is null) or (category <> 'others' and custom_category is null and replaced_date is not null)"
    - `expenses_amount_check`: "amount_centavos > 0 or (amount_centavos = 0 and needs_review)"
    - `expenses_source_pair_check`: "(source_table is null) = (source_id is null) and (source_table is null or source_table in ('part_replacements','tire_installations'))"
  - **Indexes**: create `expenses_date_idx (expense_date desc) where deleted_at is null`, `expenses_category_date_idx (category, expense_date desc) where deleted_at is null`, `expenses_unit_category_replaced_idx (unit_id, category, replaced_date desc) where deleted_at is null and category <> 'others'`, and unique `expenses_source_unique (source_table, source_id) where source_table is not null`. Drop `expenses_category_idx`.
  - **Trigger**: `normalize_expense()` (invoker, `set search_path = public`) and trigger `expenses_normalize before insert or update`, with the rules in data-model "Triggers" 1–3. The future-date rule only fires in app sessions, on new or changed dates. Revoke its EXECUTE from public, anon, and authenticated.
  - **Summary function**: `create or replace` `dashboard_monthly_unit_summary(date)` with a left join to categories and the buckets from research R10. The signature, return columns, definer, and `is_owner()` filter are unchanged. Re-grant EXECUTE to `authenticated`.
- [ ] T009 Write `supabase/migrations/20261101000600_move_maintenance_into_expenses.sql` (research R3, data-model "Move mapping"):
  - **`maintenance_category_for(text) returns expense_category`**: immutable SQL that normalizes with `regexp_replace(replace(lower(p_name),'&','and'),'[^a-z]','','g')` and a `case` over the research R3 keys, defaulting to `'others'`. Revoke its EXECUTE.
  - **`move_maintenance_into_expenses() returns integer`**: plpgsql, invoker, `set search_path = public`, revoke EXECUTE. It runs the two inserts below and returns the number of rows inserted. The migration calls it once.
  - **Part insert** (inside the function): from `part_replacements where deleted_at is null`, insert into `expenses (unit_id, category, custom_category, expense_date, replaced_date, amount_centavos, notes, needs_review, source_table, source_id, idempotency_key, created_at, created_by)`. `notes` is `concat_ws(' · ', nullif(trim(notes),''), replacement_mileage || ' km', 'Next due ' || next_due_date, 'Next due ' || next_due_mileage || ' km')` and is null when empty. Use `on conflict (source_table, source_id) where source_table is not null do nothing`.
  - **Tire insert** (inside the function): the same, mapping `front` to `front_tire`, else `rear_tire`. Notes start with the position label (Front, Rear left, Rear right) and the brand.
  - **`verify_maintenance_move() returns void`**: plpgsql, invoker, `set search_path = public`, revoke EXECUTE. The migration calls it right after the move. It compares per unit the count and sum of the non-deleted sources with the expenses where `source_table is not null`. On mismatch, raise `P0001` "Maintenance move check failed for unit %: % sources / % expenses, % / % centavos".
- [ ] T010 Write `supabase/migrations/20261101000700_retire_maintenance_writes.sql` (research R9):
  - Drop the policies `parts_operational_insert`, `parts_operational_update`, `tires_operational_insert`, `tires_operational_update`, `expense_categories_owner_insert_policy`, and `expense_categories_owner_update_policy`.
  - `create or replace` `soft_deletable_table(text)` with the array `['units','drivers','driver_assignments','driver_days_off','mileage_readings','expenses']`.
  - `revoke execute on function public.replace_tire_installation(uuid, jsonb) from authenticated` and `revoke execute on function public.due_maintenance(date) from authenticated`.
- [ ] T011 Add the business rules to `docs/DEVELOPMENT.md`: the fixed categories, how the maintenance move maps names and is checked, the retired maintenance writes, where mileage is recorded now, and the backup step before migration 2
- [ ] T012 **Ask the user for approval.** Then push the three migrations to rolnet-dev and run the full pgTAP suite through the rollback wrapper (`node run-pgtap-linked.mjs <repo> supabase/tests/**/*.sql`). Fix failures in the migrations (not yet pushed elsewhere) or in the tests until everything passes
- [ ] T013 Regenerate `types/database.ts` with `corepack pnpm exec supabase gen types typescript --linked > types/database.ts`. In `lib/expenses/categories.ts`, switch to `Database["public"]["Enums"]["expense_category"]`

### Shared app code

- [ ] T014 [P] Rewrite `lib/validation/expenses.ts` (contracts/actions.md). The `expenseSchema` fields are:
  - `unitId` uuid
  - `category` enum of `expenseCategoryOptions`
  - `customCategory` optional, trimmed, whitespace-collapsed, "1–80 characters"
  - `expenseDate` YYYY-MM-DD, `≤ fleetToday()`
  - `replacedDate` optional, YYYY-MM-DD, `≤ fleetToday()`
  - `amountCentavos` positive int
  - `notes` ≤ 1000
  - `idempotencyKey` uuid

  A `superRefine` enforces: Others requires `customCategory` ("Enter a category name") and forbids `replacedDate`; a main category requires `replacedDate` ("Enter the date replaced") and forbids `customCategory`. A future date gets "Dates can't be in the future.". `expenseUpdateSchema` drops `idempotencyKey` and adds `expectedUpdatedAt`. Keep `receiptUploadSchema`
- [ ] T015 [P] Write `tests/unit/expense-validation.test.ts` for every rule in T014, including the whitespace collapse and the today boundary (use the fake fleet date helper the other tests use)
- [ ] T016 Update `app/actions/expenses.ts` (contracts/actions.md):
  - **`createExpense` and `updateExpense`**: write `category`, `custom_category`, and `replaced_date`; never write `category_id`; send null for the field that doesn't apply.
  - **Unit check**: reject an archived or deleted unit with field error `unitId` "This unit is archived. Choose another unit.".
  - **Stale message**: "This expense was changed or deleted by someone else. Reload to see the latest.".
  - **Revalidation**: revalidate the old and the new unit.
  - **`deleteExpense(id, expectedUpdatedAt)`**: requires `manage_master_data`, calls `soft_delete_record` with `p_expected_updated_at`, and treats null as STALE_RECORD. Keep `softDeleteExpense` for now, because the old page still binds it. T039 removes it.
  - **Bridge the old form** so the app keeps working until US1 replaces it. In `components/forms/expense-form.tsx` and `app/(operations)/expenses/page.tsx`, make these minimal changes:
    - Replace the `categoryId` select with a `category` select over `expenseCategoryOptions` and its labels.
    - Show a "Category name" input for Others and a "Date replaced" date input (defaulting to the expense date) for main categories.
    - Map field errors to the new names.
    - In the page, read `category, custom_category, replaced_date` instead of `category_id, expense_categories(name)`, and show `categoryText(row)`.

  No styling work; T024 and T025 replace both files.

  Map the constraints in `lib/actions/errors.ts` per contracts/database.md: `expenses_category_shape_check` gives "Check the category, category name, and date replaced.", `expenses_amount_check` gives "Enter an amount greater than ₱0.00.", and the `23514` future-date message passes through
- [ ] T017 [P] Update `lib/demo/mode.ts`. `demoExpenses` gains `category`, `custom_category`, `replaced_date`, `needs_review`, and `source_table`:
  - at least one row per main category
  - three Others rows (Fuel, Brake pads, Registration)
  - two moved rows (`source_table: "part_replacements"`), one of them ₱0 with `needs_review: true`

  Remove the `expense_categories` embeds from `demoExpenses`. **Keep** `demoCategories` until T033 removes its last use on the Expenses page. Keep `demoDueMaintenance` until T046 and T047 remove the dashboard and Maintenance uses, and delete each export in the task that removes its last import
- [ ] T018 [P] Update `tests/unit/action-errors.test.ts` for the new `expenseSchema` and the constraint-name mappings. Remove the `tireSchema` cases

**Checkpoint**: The migrations are applied, the types are regenerated, and creating and editing an expense uses the new fields. Lint, typecheck, and tests are green.

---

## Phase 3: User Story 1 - Log an expense from a modal (Priority: P1) 🎯 MVP

**Goal**: The "Add expense" button opens a modal that saves a main-category or Others expense into a full-width table.

**Independent Test**: At 360 px, add a Change Oil expense and an Others "Brake pads" expense. Both rows appear, Last Replaced shows the date or "N/A", and the toast "Expense added" shows.

### Tests for User Story 1

- [ ] T019 [P] [US1] Write `tests/unit/expense-dialog.test.tsx` (Testing Library, like `tests/unit/unit-dialogs.test.tsx`). It must check:
  - The trigger "Add expense" opens a dialog titled "Add expense".
  - Expense date defaults to the fleet date.
  - Choosing Chain shows "Date replaced", following the expense date until edited.
  - Choosing Others shows "Category name" and hides "Date replaced". Notes and amount survive switching back and forth (FR-020).
  - Saving empty shows inline errors for Unit, Category, and Amount, and keeps the dialog open.
  - A name "oil change" under Others shows the hint "This looks like Change Oil. Choose it from Category to track Last Replaced.".
  - On success, `toast("Expense added")` and `router.refresh()` are called (mock the action).
  - Only units that aren't archived appear in Unit, with In repair included.
  - FR-026: two quick submits while pending call `createExpense` once. A retry after a failed save reuses the same `idempotencyKey`. The key changes only after a successful save or when the dialog is reopened.
- [ ] T020 [P] [US1] Write the add-flow part of `tests/e2e/expenses-merged.spec.ts` (demo build). It runs quickstart steps 3–6 at 360 px and at desktop size. It also checks that no element is wider than the viewport, and that Escape closes the dialog and returns focus to "Add expense"

### Implementation for User Story 1

- [ ] T021 [P] [US1] Create `components/expenses/expense-form-fields.tsx` (contracts/ui.md "Fields" 1–8). It's a client component with controlled state for every field, built on `FormField`, `Input`, `Select`, and `Textarea` from `components/ui/form-field.tsx`. It includes:
  - the "Date replaced" auto-follow until touched
  - the "looks like" hint through `mainCategoryFor`
  - amount parsing through `parsePositiveCentavos`
  - the receipt input with `receiptFileProblem` and `prepareReceiptFile`, moved from `components/forms/expense-form.tsx`

  It exposes `values`, `errors`, and `validate()` to its parent
- [ ] T022 [US1] Create `components/expenses/expense-dialog.tsx`, exporting `AddExpenseDialog({ units })`:
  - The trigger is `<DialogTrigger render={<Button type="button" />}><Plus size={16} />Add expense</DialogTrigger>`, inside `DialogContent title="Add expense"`.
  - Submitting validates client-side, then calls `createExpense` with one idempotency key per open (`useActionForm().key`).
  - It then runs `attachReceipt` when a file was chosen (moved from `expense-form.tsx`).
  - On success it closes the dialog, calls `toast("Expense added")` and `router.refresh()`. Server errors go to `ValidationSummary`.
- [ ] T023 [P] [US1] Create `components/expenses/category-cell.tsx`:
  - The main label as plain text, or `Truncated` custom name plus a secondary `Badge` "Others".
  - A warning badge "Needs review" when `needs_review`.
  - A `LastReplacedCell` that renders the date, or "N/A" with `text-muted` for Others.
- [ ] T024 [US1] Rewrite `app/(operations)/expenses/page.tsx` (contracts/ui.md "Expenses page"):
  - **Layout**: remove the `.workspace-grid` aside and `?edit=` handling, so the table is full width. Load units with `archived = false and deleted_at is null` for the dialog.
  - **Select**: `id, unit_id, category, custom_category, replaced_date, expense_date, amount_centavos, notes, needs_review, source_table, updated_at, receipt_object_path, units(body_number, plate_number, name)`.
  - **Toolbar**: `listView(..., { searchLabel: "Search expenses", searchPlaceholder: "Search notes, unit, or category", controls, action: <AddExpenseDialog units={...} /> })`.
  - **Columns** (FR-011): Date, Unit, Category (`CategoryCell`), Amount (`formatPesos`, right-aligned), Last Replaced (column title in the client's capitalization; the Unit detail section stays "Last replaced"), Notes (receipt `Paperclip` button through `SignedFileButton`, then `Truncated` notes with tooltip), and Options (placeholder cell until US3).
  - **Empty state**: `EmptyState` "No expenses recorded yet." with the Add button.
  - **Header**: `PageHeader` eyebrow "Costs and upkeep", title "Expenses", description "Record fuel, parts, repairs and other unit costs.". Update `lib/navigation/page-context.ts` `expenses` to match.
- [ ] T025 [US1] Delete `components/forms/expense-form.tsx` after confirming nothing imports it. Move any still-needed helper (`attachReceipt`) into `components/expenses/expense-dialog.tsx` or a shared `components/expenses/receipt.ts`

**Checkpoint**: Adding expenses works from the modal, and the table shows the new columns. T019 and T020 pass.

---

## Phase 4: User Story 2 - Find and total expenses (Priority: P1)

**Goal**: Search, filters (unit, category, date range, receipt, review), sort, the filtered count and peso total, and the empty text.

**Independent Test**: Filter to one unit, Others, and one month. "N records · ₱X" matches the rows, and it updates when a filter changes.

### Tests for User Story 2

- [ ] T026 [P] [US2] Write `tests/unit/expense-list-total.test.ts`. It must check:
  - `loadExpenseTotal` applies the same search filter and controls as the page (assert the builder calls on a fake client).
  - It sums across multiple 1000-row pages with integer math.
  - It skips the read when the count is 0.
  - In demo mode it sums `controlRows`.
- [ ] T027 [P] [US2] Update `tests/unit/list-controls.test.ts` for `listControlSpecs.expenses`:
  - Category options are the 8 enum values in order with labels.
  - The `review` filter maps "needs-review" to `needs_review = true` and "moved" to `source_table is not null`.
  - The sorts are newest (default), oldest, amount-desc, and amount.
  - `maintenance` is gone.

  Update `tests/unit/search-filter.test.ts` for `searchSpecs.expenses` (it searches `custom_category` and matches category labels through `matchingEnumValues`)
- [ ] T028 [P] [US2] Extend `tests/e2e/list-sort-filter.spec.ts` and `tests/e2e/expenses-merged.spec.ts` (quickstart step 7):
  - Filter by unit, category Others, and a date range. The count and total equal the sum of the demo rows.
  - "Clear all" restores them.
  - A query matching nothing shows "No expenses match these filters.".
  - Replace the old `category=<uuid>` and "Gasoline" cases with the new demo data.

### Implementation for User Story 2

- [ ] T029 [P] [US2] Update `lib/pagination/search-specs.ts`: `searchSpecs.expenses` = `{ columns: ["notes", "custom_category"], related: [unitLink], enums: [{ column: "category", labels: expenseCategoryLabels }], dateColumn: "expense_date", amountColumn: "amount_centavos" }`. Remove `searchSpecs.maintenanceUnits`. In `lib/pagination/search-filter.ts`, drop `"expense_categories"` from the `RelatedSearch.table` union
- [ ] T030 [P] [US2] Update `lib/pagination/list-control-specs.ts`. `listControlSpecs.expenses`:
  - `range expense_date`
  - `eq unit` (options are injected)
  - `eq category` with fixed options from `expenseCategoryOptions` and its labels
  - `presence receipt`
  - a new `page`-kind `review` filter labelled "Review", with options "Needs review" (`needs-review`) and "Moved from maintenance" (`moved`), applied in `lib/pagination/list-controls.ts` as `.eq("needs_review", true)` or `.not("source_table", "is", null)`, with a `controlRows` twin

  Keep the sorts. Delete `listControlSpecs.maintenance`, and keep the audit entity labels for the legacy tables
- [ ] T031 [US2] Create `lib/expenses/list-total.ts` with `loadExpenseTotal(supabase, request, controls)` (research R8). It builds `supabase.from("expenses").select("amount_centavos").is("deleted_at", null)`, then `applyFilters`, then `.or(buildSearchFilter(...))` when searching. It reads `.range()` pages of 1000 until a short page and returns centavos as `number`. Export a demo twin that sums `controlRows(demoExpenses, controls)`
- [ ] T032 [US2] Add an optional `emptyText?: string` to `ListView` and `listView()` options in `components/ui/paged-list.tsx`. `SearchEmpty` uses it when set. The existing lists are unchanged
- [ ] T033 [US2] Wire `app/(operations)/expenses/page.tsx`:
  - Run `loadExpenseTotal` in parallel with the page read, and pass `hint: formatPesos(total)` and `emptyText: "No expenses match these filters."` to `listView`.
  - Unit filter options include archived units ("Body {n}").
  - Category options come from the spec, so the `expense_categories` query is removed. Delete `demoCategories` from `lib/demo/mode.ts` once nothing imports it.

**Checkpoint**: US1 and US2 together are the MVP Expenses page.

---

## Phase 5: User Story 3 - Edit or delete from the row menu (Priority: P2)

**Goal**: The 3-dot menu with Edit (pre-filled modal, main-to-Others confirmation) and an owner-only Delete (confirmation, soft delete, audit).

**Independent Test**: Edit an amount and see "Expense updated" with the totals changing. As the owner, delete with confirmation, and see the row gone, the totals drop, "Expense deleted", and an audit entry.

### Tests for User Story 3

- [ ] T034 [P] [US3] Write `tests/unit/expense-row-menu.test.tsx`. It must check:
  - The trigger `aria-label` is "Expense options", and the menu shows Edit and Delete.
  - For staff (`isOwner` false), Delete is disabled with text "Delete (owner only)" and title "Only the owner can delete expenses".
  - Edit opens "Edit expense" pre-filled with the saved values, including date replaced and custom name.
  - On a saved main-category expense, choosing Others opens "Remove Last Replaced date?" with the body "This removes the Last Replaced date.". Cancel reverts the category, and Continue keeps Others.
  - Saving calls `updateExpense` with `expectedUpdatedAt` and shows "Expense updated".
  - A STALE result shows the stale message and a "Reload" button.
  - The delete dialog shows the date, unit, category, and amount, and the text "This permanently removes the expense and changes report totals for that period.". Focus starts on Cancel. The confirm button is labelled "Delete expense", calls `deleteExpense(id, updatedAt)`, and shows "Expense deleted".
- [ ] T035 [P] [US3] Extend `tests/e2e/expenses-merged.spec.ts` with quickstart steps 8–11: the menu on the last row opens upward and stays inside the viewport; edit Chain to Others with the confirmation; delete as the owner (the demo owner); and the staff menu shows Delete disabled. Update `tests/e2e/soft-delete-audit.spec.ts` if it exercised the old expense delete button

### Implementation for User Story 3

- [ ] T036 [P] [US3] Add `EditExpenseDialog({ expense, units, open, onOpenChange })` to `components/expenses/expense-dialog.tsx`:
  - It uses the same `ExpenseFormFields`, pre-filled.
  - When the saved category is a main category and the user picks Others, it shows the nested `AlertDialog` from contracts/ui.md.
  - It submits through `updateExpense(id, { ...values, expectedUpdatedAt })`, with the receipt replace through `attachReceipt`.
  - On success it shows `toast("Expense updated")` and calls `router.refresh()`. On STALE it shows the message plus a "Reload" button (`router.refresh()` and close).
  - When the saved unit is archived, the Unit select shows it as a disabled current option and requires a new choice.
- [ ] T037 [P] [US3] Create `components/expenses/delete-expense-dialog.tsx`, following `components/units/archive-unit-dialog.tsx`:
  - `AlertDialogContent title="Delete this expense?"`, a `dl` of Date, Unit, Category (`categoryText`), and Amount (`formatPesos`), and the warning text.
  - Buttons: `AlertDialogClose` "Cancel" (outline, `initialFocus` ref) and "Delete expense" (`bg-danger text-surface hover:bg-danger/90`).
  - On success it shows `toast("Expense deleted")` and calls `router.refresh()`. Errors show in `<p role="alert">`.
- [ ] T038 [US3] Create `components/expenses/expense-row-menu.tsx`, following `components/units/unit-row-menu.tsx`:
  - The `DropdownMenu` trigger has `className="touch-target inline-flex w-11 …"`, `aria-label="Expense options"`, and the `MoreHorizontal` icon.
  - The items are Edit and Delete (disabled for staff, as T034 describes).
  - It conditionally mounts `EditExpenseDialog` and `DeleteExpenseDialog`.
- [ ] T039 [US3] In `app/(operations)/expenses/page.tsx`, render `<ExpenseRowMenu expense={…} units={…} isOwner={…} />` in the Options column. Remove the old `ArchiveButton` and Edit link and the `softDeleteExpense` import, then delete `softDeleteExpense` from `app/actions/expenses.ts`

**Checkpoint**: Full CRUD on the Expenses page. T034 and T035 pass.

---

## Phase 6: User Story 4 - One page replaces Maintenance (Priority: P2)

**Goal**: The Maintenance nav, pages, dashboard pieces, and write paths are gone. Old URLs redirect, moved records are visible, and mileage moves to Unit detail and the Daily card. The legacy API is read-only.

**Independent Test**: No "Maintenance" in the nav. `/maintenance/{id}` lands on `/expenses?unit={id}`. The Review filter "Moved from maintenance" shows the moved records. Staff record mileage from a Daily card. `POST /api/v1/part-replacements` returns 405.

### Tests for User Story 4

- [ ] T040 [P] [US4] Update `tests/unit/navigation-items.test.ts` (no "Maintenance"; Operations = Remittances, Expenses) and `tests/e2e/app-navigation.spec.ts` (lines listing "Maintenance")
- [ ] T041 [P] [US4] Update `tests/unit/dashboard-recent-data.test.ts`, `dashboard-ordering.test.ts`, and `convergence-ui-helpers.test.ts`: remove the maintenance glimpse and the due helpers, and the expense glimpse shows `categoryText`. Update `tests/e2e/dashboard-refresh.spec.ts` (no `panel-maintenance`, no `/maintenance?due=1`) and `tests/e2e/ui-system-refresh.spec.ts` (no "Recent maintenance work")
- [ ] T042 [P] [US4] Update `tests/integration/api/master-data-mutations.test.ts`, `delete-restore.test.ts`, `operational-mutations.test.ts`, and `read-resources.test.ts` (contracts/actions.md "API v1"). It must check:
  - The readOnly list includes `part-replacements`, `tire-installations`, and `expense-categories`, with empty fields and `softDelete` false.
  - `expense-categories` has no `ownerWrite`.
  - Writes return 405 with "This resource is read only. Record costs as expenses.".
  - `POST tire-installations/{id}/replace` returns 405.
  - The expenses create and update fields match the contract. Writing `category_id`, `needs_review`, or `source_table` returns 400 `IMMUTABLE_FIELD`.

  Update `tests/unit/api-dtos.test.ts` if it lists fields
- [ ] T043 [P] [US4] Add redirect and mileage cases to `tests/e2e/expenses-merged.spec.ts` (quickstart steps 1, 2, 14, 16): `/maintenance` leads to `/expenses`; `/maintenance/{demo unit id}` leads to `/expenses?unit=…`; the staff Daily card has "Record mileage", and saving it shows "Mileage saved"; and Review "Moved from maintenance" lists the 2 demo moved rows, one tagged "Needs review"

### Implementation for User Story 4

- [ ] T044 [P] [US4] Replace `app/(operations)/maintenance/page.tsx` with a server page that calls `permanentRedirect("/expenses")` (read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/permanentRedirect.md` first). Replace `app/(operations)/maintenance/[unitId]/page.tsx` with one that awaits `params`, then calls `permanentRedirect("/expenses?unit=" + unitId)` when it is a uuid, and `permanentRedirect("/expenses")` otherwise. Delete both `loading.tsx` files
- [ ] T045 [P] [US4] Remove the Maintenance destination from `lib/navigation/items.ts`, and `pageContext.maintenance` from `lib/navigation/page-context.ts`. Remove the maintenance wording from `app/manifest.ts` and `app/forbidden/page.tsx`
- [ ] T046 [P] [US4] Retire the dashboard maintenance pieces (research R14):
  - **`lib/dashboard/queries.ts`**: drop the `due_maintenance` RPC, the `part_replacements` and `tire_installations` reads, `describeDueItems`, `RecentKind` "maintenance", `stats.maintenanceDue`, and `attention.maintenance`. The expenses glimpse selects `category, custom_category` instead of `expense_categories(name)`.
  - **`lib/dashboard/ordering.ts`**: drop `DueMaintenanceRow`, `DueMaintenanceItem`, `dueText`, `orderDueMaintenance`, and `FleetStats.maintenanceDue`.
  - **Components**:
    - `components/dashboard/attention-panels.tsx`: remove the panel.
    - `fleet-stats.tsx`: remove the tile.
    - `recent-data-glimpse.tsx`: remove the config, and set `glimpseKinds = ["remittances","expenses","documents"]`. The expense label uses `categoryText`.
  - **Copy** in `app/(owner)/dashboard/page.tsx`: the band becomes "Expired documents and unpaid balances, most urgent first." and the PhoneFold hint becomes "Remittances, expenses and documents".
- [ ] T047 [US4] Delete these files and fix any imports:
  - `components/maintenance/parts-list.tsx` and `components/maintenance/tire-positions.tsx`
  - `components/forms/part-replacement-form.tsx` and `components/forms/tire-installation-form.tsx`
  - `app/actions/parts.ts` and `app/actions/tires.ts`
  - `lib/validation/maintenance.ts`
  - the `demoDueMaintenance` export in `lib/demo/mode.ts`, once T046 and this task have removed its last imports

  Keep `components/forms/mileage-form.tsx`. In `app/actions/mileage.ts`, revalidate `/units`, `/units/{id}`, and `/dashboard` only
- [ ] T048 [P] [US4] Make the legacy API read-only:
  - **`lib/domain/resource-config.ts`**: add `readOnlyMessage?: string` to `ResourceConfig`. Set `readOnly: true`, `createFields: []`, `updateFields: []`, `softDelete: false`, and `readOnlyMessage: "This resource is read only. Record costs as expenses."` on `part-replacements`, `tire-installations`, and `expense-categories`, and remove `ownerWrite` from categories.
  - **`expenses` config**: create and update fields `unit_id, category, custom_category, expense_date, replaced_date, amount_centavos, notes`; filter fields `unit_id, category, needs_review, source_table`; add `replaced_date` to the sort fields.
  - **`lib/domain/crud.ts` `contextForWrite`**: throw `ApiError(405, "FORBIDDEN", config.readOnlyMessage ?? "This resource is read only.")`.
  - **`app/api/v1/[...segments]/route.ts`**: the `tire-installations/{id}/replace` branch returns the same 405.
- [ ] T049 [P] [US4] Create `components/units/record-mileage-dialog.tsx`. It renders `Dialog` with title "Record mileage · Body {n}" around `MileageForm({ unitId, currentMileage })`, with an `onSaved` callback that closes it and shows `toast("Mileage saved")`. Add an `onSaved?: () => void` prop to `components/forms/mileage-form.tsx` if it has none
- [ ] T050 [US4] In `components/units/assignment-card.tsx`, add a ghost button "Record mileage" (`Gauge` icon) to every card kind, including blocked cards. It opens `RecordMileageDialog`. Pass `currentMileage` through the board card data (`lib/units/assignment-board.ts` and `lib/units/assignment-query.ts` select `current_mileage`). Update `tests/unit/assignment-board.test.ts` fixtures
- [ ] T051 [US4] Create `components/units/mileage-section.tsx`: `SectionHeading` "Mileage", then `MileageForm`, then a `PagedList` of readings, newest first ("{date} · {km} km · {notes}"), with prefix `mileage_` and the empty state "No mileage readings yet.". Render it on `app/(owner)/units/[id]/page.tsx`, with a `mileage_readings` read for the unit (`deleted_at is null`, ordered by `reading_date desc`)

**Checkpoint**: Maintenance is fully retired. T040–T043 pass.

---

## Phase 7: User Story 5 - Reports and unit totals follow expense changes (Priority: P3)

**Goal**: Unit detail and the XLSX reports reflect adds, edits, and deletes. Unit detail shows Last replaced per main category and links to the filtered Expenses.

**Independent Test**: Note a unit's monthly expenses and a monthly report's Net. Add, edit, then delete an expense in that month, and both change each time. Last replaced lists 7 categories with links.

### Tests for User Story 5

- [ ] T052 [P] [US5] Write `tests/unit/last-replaced.test.ts`. `lastReplacedByCategory(rows)` returns 7 entries in enum order with the latest `replaced_date` per category, ignores `others`, and gives `replacedDate: null` for categories with no rows
- [ ] T053 [P] [US5] Update `tests/unit/unit-dialogs.test.tsx` line ~125: the link text is "Expenses" and the href is `/expenses?unit=${unitId}`. Update `tests/unit/report-layout.test.ts` and `tests/unit/monthly-allowance.test.ts` only if their fixtures embed `expense_categories`. Add a case to `report-layout` showing that a moved ₱0 row and a deleted row are excluded and included as appropriate (the input is already filtered)

### Implementation for User Story 5

- [ ] T054 [P] [US5] Create `lib/expenses/last-replaced.ts` exporting `lastReplacedByCategory(rows: { category; replaced_date }[]): LastReplaced[]` (data-model "TypeScript shapes")
- [ ] T055 [P] [US5] Create `components/units/last-replaced.tsx`: `SectionHeading` "Last replaced" and a list of 7 rows, each a `Link` to `/expenses?unit={id}&category={value}` showing the label and the date (`font-data`) or "Never recorded" (`text-muted`). Each row is at least `touch-target` tall
- [ ] T056 [US5] In `app/(owner)/units/[id]/page.tsx`:
  - Add the read `expenses.select("category, replaced_date").eq("unit_id", id).neq("category", "others").is("deleted_at", null)` and render `LastReplaced` after `MonthlyAllowance` and before the Mileage section.
  - In `components/units/unit-details-section.tsx`, change the link to `<Link href={`/expenses?unit=${unit.id}`}>Expenses</Link>`.
  - Confirm the monthly allowance read needs no change: it reads `expenses` with `deleted_at is null`, so moved rows count.
- [ ] T057 [US5] Confirm `lib/reports/report-data.ts` needs no change, beyond the demo-mode path using the new `demoExpenses` shape. Add the quickstart step 15 assertion to `tests/e2e/expenses-merged.spec.ts`: download the monthly report in demo mode before and after a delete, and check that the Expenses cell for that period drops by the deleted amount

**Checkpoint**: Every story works on its own and together.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T058 [P] Search the codebase and confirm: no `"/maintenance"` links remain outside the redirect pages, there are no imports of the deleted files, no `expense_categories(` embeds in app code, and no `softDeleteExpense`
- [ ] T059 [P] Accessibility pass at 360 px on `/expenses`, the dialogs, the row menu, and the Unit detail sections, extending `tests/e2e/accessibility-mobile.spec.ts` with `/expenses` and the Add dialog open
- [ ] T060 Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm test:e2e`, `corepack pnpm check`, and `corepack pnpm build:vinext`, and fix any failures
- [ ] T061 **With the user's approval**, re-run the full pgTAP suite on rolnet-dev, then do the quickstart §5 manual walkthrough on the :3000 live dev server against rolnet-dev. During the walkthrough:
  - **Plain-language check** (constitution IV): read every error, empty state, toast, and confirmation, and check that each one says what happened and what to do next.
  - **SC-001**: time adding a Change Oil expense on a phone-sized screen, and count the inputs changed from their defaults. The target is under 45 s and at most 5 inputs.

  Record the results and screenshots in `specs/011-merged-expenses-page/validation.md`
- [ ] T062 Update `DESIGN.md` if a new pattern was introduced (the Others badge and the Needs-review badge in table cells). Otherwise note "no new pattern" in `validation.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T002 and T003 can run in parallel.
- **Foundational (Phase 2)**: depends on Setup.
  - The tests T004 to T007 can be written in parallel.
  - Then the migrations go in order: T008 → T009 → T010.
  - Then T012 (needs the user's approval) → T013.
  - T014, T015, T017, and T018 can start any time after T002.
  - T016 needs T013 and T014.
  - **Phase 2 blocks every story.**
- **US1 (Phase 3)**: after Phase 2.
- **US2 (Phase 4)**: after Phase 2. It shares `app/(operations)/expenses/page.tsx` with US1, so do T033 after T024.
- **US3 (Phase 5)**: after US1 (it reuses `ExpenseFormFields` and the page).
- **US4 (Phase 6)**: after Phase 2. It is independent of US1–US3 in code, except T043's Review filter check, which needs T030.
- **US5 (Phase 7)**: after Phase 2. T056 touches the same page as T051 (US4), so do them in sequence.
- **Polish (Phase 8)**: after the stories you're shipping.

### Release gate

Phase 2, US1, and US4 must ship together:
- Migration 1 makes `category` required, so the old form stops working.
- Migration 3 closes the Maintenance write paths that the old pages use.

US2 and US3 should ship in the same release, so the page isn't missing edit or delete.

### Within each story

Write the tests first and confirm they fail. Then do the lib, then the actions, then the components,
then the page.

## Parallel Examples

```text
# Phase 2 tests together:
T004 320_expense_fixed_categories.sql | T005 330_maintenance_move.sql | T006 rls/220_expenses_merge_rls.sql | T007 legacy fixture updates

# Phase 2 app code next to the migrations:
T014 validation | T015 validation tests | T017 demo data | T018 action-errors test

# US1:
T019 expense-dialog.test.tsx | T020 e2e add flow | T021 expense-form-fields | T023 category-cell

# After Phase 2, two people can split the work:
Developer A: US1 → US2 → US3
Developer B: US4, then US5

# US4 building blocks together:
T044 redirects | T045 nav | T046 dashboard | T048 API | T049 mileage dialog
```

## Implementation Strategy

### MVP (release-ready minimum)

1. Phase 1 and Phase 2 (with the user's approval for rolnet-dev).
2. US1 and US2: the new Expenses page with add, filters, and the total.
3. US4: Maintenance retired, which the release gate requires.
4. **Stop and validate** quickstart steps 1–7, 14, and 16.

### Incremental delivery

5. US3 (edit and delete through the row menu).
6. US5 (Last replaced and the report checks).
7. Phase 8 polish, the full checks, and `validation.md`.

## Notes

- Every task must leave lint, typecheck, and tests green, plus the full pgTAP suite after any SQL change.
- Commit after each task or logical group. Never commit `.env*` files.
- `types/database.ts` is generated. Regenerate it with `--linked`; never hand-edit it.
- [P] tasks touch different files and have no unmet dependencies.
