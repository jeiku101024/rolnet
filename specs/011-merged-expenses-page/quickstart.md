# Quickstart: Validate the Merged Expenses Page

See [contracts/](contracts/) for exact rules and copy and [data-model.md](data-model.md) for the
records. Run every command from the repo root with Corepack pnpm.

## Prerequisites

- Branch `011-merged-expenses-page`, with dependencies installed (`corepack pnpm install`).
- No local Supabase is available here. Database tests run against **rolnet-dev** through the rollback
  wrapper (`run-pgtap-linked.mjs`), and only after the owner approves each run. Applying the three
  migrations to rolnet-dev also needs approval.
- **Before applying migration 2 anywhere with real data**, take a backup or export of `expenses`,
  `part_replacements`, and `tire_installations`. The move only adds rows, and it rolls back fully on
  a failed check. The backup is still the documented recovery path the constitution requires.

## 1. Static checks and unit tests

```bash
corepack pnpm lint
```

```bash
corepack pnpm typecheck
```

```bash
corepack pnpm test
```

These should pass, including the new tests:
- `expense-categories` (labels, order, `mainCategoryFor` against the research R3 table)
- `expense-validation` (category, name, and date-replaced rules; future dates; amount > 0)
- `last-replaced`
- `expense-list-total`
- `expense-dialog` (field swap keeps values, edit confirmation, inline errors)
- `expense-row-menu` (staff can't delete)

The updated tests (navigation, dashboard, list controls, and API resources) should pass too.

## 2. Database (after approval)

Apply the migrations to rolnet-dev, then regenerate the types:

```bash
corepack pnpm exec supabase gen types typescript --linked > types/database.ts
```

Run the **full** pgTAP suite through the wrapper. Expected results:
- 320, 330, and rls/220 pass, along with every updated legacy file.
- The migration 2 log shows no "move check failed" error.
- Spot check on rolnet-dev: for each unit, the count and sum of `expenses where source_table is not
  null` equal those of the non-deleted parts plus tires.

## 3. Build gates

```bash
corepack pnpm check
```

```bash
corepack pnpm build:vinext
```

## 4. End-to-end (demo build on :3100)

```bash
corepack pnpm test:e2e
```

`tests/e2e/expenses-merged.spec.ts` runs the list below at 360 px and at desktop size.
`app-navigation`, `list-sort-filter`, `dashboard-refresh`, and `ui-system-refresh` are updated for
the removed Maintenance pieces.

## 5. Manual walkthrough (live dev server on :3000, rolnet-dev)

| # | Step | Expected |
|---|------|----------|
| 1 | Open the nav as the owner, then as staff | No "Maintenance". Expenses is under Operations. |
| 2 | Visit `/maintenance`, then `/maintenance/{unitId}` | Lands on `/expenses`, then on `/expenses?unit={unitId}` |
| 3 | On `/expenses`, look at the layout at 360 px | No side form. The toolbar has search, the date range, Filters, and **Add expense**. The line reads "{n} records · ₱…". |
| 4 | Add: Unit, Chain, leave the dates, ₱350 | Date replaced = today. The toast "Expense added" shows. The row shows Chain, ₱350.00, and today in Last replaced. The count and total go up. |
| 5 | Add: Others with an empty name | Inline "Enter a category name". Type "Brake pads" and save. The row shows "Brake pads" with an Others tag and N/A. |
| 6 | Pick Others, type a note, switch back to Battery | The note and amount are kept, and Date replaced reappears. |
| 7 | Filter Category = Others, plus a unit and a month | The rows and the total match a hand sum. Clear the filters and the total is restored. |
| 8 | Row menu on the last row | Opens upward. Edit opens "Edit expense" pre-filled. |
| 9 | Edit Chain → Others | The confirmation "This removes the Last Replaced date." shows. Continue, name it, save. "Expense updated" shows, and Last replaced is N/A. |
| 10 | As staff, open the row menu | Delete is disabled, "Delete (owner only)". |
| 11 | As the owner, Delete | The dialog shows the date, unit, category, and amount, with focus on Cancel. Confirm. "Expense deleted" shows, and the row, count, and total update. |
| 12 | `/audit` | Shows the delete with the actor, time, and the old values |
| 13 | Unit detail for that unit | Monthly expenses vs allowance reflects steps 4–11. **Last replaced** lists 7 categories. "Expenses" links to the filtered list. The Mileage section records a reading. |
| 14 | As staff, Units Daily view → "Record mileage" on a card | The dialog saves, and "Mileage saved" shows |
| 15 | Download the monthly XLSX for the month before and after step 11 | Expenses and Net differ by the deleted amount |
| 16 | Filter Review = "Moved from maintenance", then "Needs review" | Shows the moved parts and tires (step 2's history), and ₱0 rows tagged "Needs review" |
| 17 | Dashboard | No Maintenance due tile or panel. The recent expenses show category labels. |
| 18 | `POST /api/v1/part-replacements` | 405, "This resource is read only. Record costs as expenses." |
