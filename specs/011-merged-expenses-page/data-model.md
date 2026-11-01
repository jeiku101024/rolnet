# Data Model: Merged Expenses Page

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Money is integer centavos (`bigint`). "Fleet date" is `(now() at time zone 'Asia/Manila')::date`.

## Enum `public.expense_category` (new)

The values are listed in display order. Both the declared order and the label order follow FR-009.

| Value | Label | Main category (tracks Last Replaced) |
|-------|-------|-----------------------------------|
| `change_oil` | Change Oil | yes |
| `front_tire` | Front Tire | yes |
| `rear_tire` | Rear Tire | yes |
| `engine_sprocket` | Engine Sprocket | yes |
| `chain` | Chain | yes |
| `rear_sprocket` | Rear Sprocket | yes |
| `battery` | Battery | yes |
| `others` | Others | no |

## `public.expenses` (changed)

| Column | Type | Change | Rule |
|--------|------|--------|------|
| `id` | uuid | none | |
| `unit_id` | uuid → units | none | Required. New and edited rows must use a unit that isn't archived or deleted (enforced in the app and its picker). Existing rows on archived units stay. |
| `category` | `expense_category` not null | **new** | Backfilled to `others` (R2) or set by the move (R3) |
| `custom_category` | text | **new** | Required for `others`, trimmed, 1–80 characters, inner whitespace collapsed. Null otherwise. |
| `replaced_date` | date | **new** | Required for main categories, null for `others`. No later than the fleet date (app sessions). |
| `category_id` | uuid → expense_categories | **now nullable** | Legacy only. The app never writes it. |
| `expense_date` | date not null | none | No later than the fleet date when set or changed (app sessions) |
| `amount_centavos` | bigint | **check replaced** | `> 0`, or `= 0` only with `needs_review` |
| `needs_review` | boolean not null default false | **new** | Set only by the move. Cleared when the amount becomes > 0. |
| `source_table` | text | **new** | `'part_replacements'`, `'tire_installations'`, or null. Kept from the original row on update. |
| `source_id` | uuid | **new** | The original record's id. Paired with `source_table`. |
| `notes` | text | none | ≤ 1000 characters (Zod) |
| receipt columns | | none | Existing rules and storage policies |
| `idempotency_key` | uuid not null unique | none | Equal to `source_id` for moved rows |
| `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by` | | none | Existing triggers |

**Constraints**

- `expenses_category_shape_check`:
  ```
  (category = 'others' and custom_category is not null and length(trim(custom_category)) between 1 and 80 and replaced_date is null)
  or (category <> 'others' and custom_category is null and replaced_date is not null)
  ```
- `expenses_amount_check`: `amount_centavos > 0 or (amount_centavos = 0 and needs_review)`. This
  replaces `expenses_amount_centavos_check`.
- `expenses_source_pair_check`: `(source_table is null) = (source_id is null)` and
  `source_table in ('part_replacements','tire_installations')`.

**Indexes** (all partial on `deleted_at is null` unless noted)

- `expenses_date_idx (expense_date desc)` **new**
- `expenses_unit_date_idx (unit_id, expense_date desc)` existing
- `expenses_category_date_idx (category, expense_date desc)` **new**
- `expenses_unit_category_replaced_idx (unit_id, category, replaced_date desc)` where also
  `category <> 'others'` **new**
- `expenses_source_unique (source_table, source_id)` unique, where `source_table is not null`
  (includes deleted rows) **new**
- `expenses_category_idx` **dropped**

**Triggers**: the existing `set_audit_fields`, `reject_hard_delete`, `audit_business_change`, and
`guard_soft_delete_columns`, plus **new** `expenses_normalize` (BEFORE INSERT OR UPDATE),
`normalize_expense()`:

1. Collapse whitespace in `custom_category`.
2. For app sessions (`auth.uid() is not null`):
   - On INSERT: force `needs_review = false`, `source_table = null`, `source_id = null`.
   - On UPDATE: copy `source_table` and `source_id` from OLD. If `amount_centavos > 0`, set
     `needs_review = false`.
3. For app sessions only: if `expense_date` (or `replaced_date`) is new or changed and later than
   the fleet date, raise
   `23514` "Dates can't be in the future."

**Lifecycle**

```
(add) ──▶ active ──(edit)──▶ active
            │
            └──(owner delete: soft_delete_record)──▶ deleted (hidden everywhere, audit soft_delete event)
moved ₱0 (needs_review) ──(edit, amount > 0)──▶ active (needs_review false)
```

There's no restore in the app. `restore_record` still works for owners through the API.

**Category change on edit** (FR-024)

| From → To | `custom_category` | `replaced_date` |
|-----------|-------------------|-----------------|
| main → main | stays null | kept, editable |
| main → others | required | **cleared** (after the confirmation) |
| others → main | **cleared** | required (defaults to the expense date) |
| others → others | editable | stays null |

## Legacy tables (now read-only)

| Table | Reads | Writes after 011 |
|-------|-------|------------------|
| `part_replacements` | approved users (existing policy) | none: insert and update policies dropped, no soft delete |
| `tire_installations` | approved users | none: also `replace_tire_installation` is revoked |
| `expense_categories` | approved users | none: owner insert and update policies dropped, no soft delete |
| `mileage_readings` | unchanged | unchanged (still written, see below) |

## Move mapping (migration 2, `move_maintenance_into_expenses()`)

| Source | → `category` | `custom_category` | `expense_date` / `replaced_date` | `amount_centavos` | `notes` |
|--------|--------------|-------------------|----------------------------------|-------------------|---------|
| part, `maintenance_category_for(part_name)` is a main category | that value | null | `replaced_on` / `replaced_on` | `cost_centavos` | notes · mileage · next due |
| part, no match | `others` | `left(trim(part_name),80)` | `replaced_on` / null | `cost_centavos` | same |
| tire `front` | `front_tire` | null | `installed_on` / `installed_on` | `cost_centavos` | position · brand · mileage · next due |
| tire `rear_left` / `rear_right` | `rear_tire` | null | same | same | same |

Every moved row has `needs_review = (cost_centavos = 0)`, `source_table`, `source_id`, and
`idempotency_key = source_id`. It also keeps `created_at` and `created_by` from the source, and
`category_id` is null.

**Verification invariant** (`verify_maintenance_move()`): for every `unit_id`, the moved rows must match the non-deleted sources:

```
count(non-deleted sources) = count(expenses where source_table is not null)
sum(cost_centavos)          = sum(amount_centavos)
```

## `mileage_readings` (unchanged)

The schema, the trigger (`validate_mileage_reading`), and RLS are the same. Only the screens that
write it move (research R13).

## Audit events

There's no schema change. Insert, update, and soft delete of an expense each produce one
`audit_events` row with `entity_type = 'expenses'` and full before and after values. The new columns
are included automatically, because the trigger serializes the whole row.

## TypeScript shapes

```ts
type ExpenseCategory = Database["public"]["Enums"]["expense_category"];
const mainCategories: readonly ExpenseCategory[];   // 7, in order
const expenseCategoryOptions: readonly ExpenseCategory[]; // 7 + "others"
type ExpenseRow = { id; unit_id; category; custom_category; replaced_date; expense_date;
  amount_centavos; notes; needs_review; source_table; updated_at; receipt_object_path;
  units: { body_number; plate_number; name } };
type LastReplaced = { category: ExpenseCategory; label: string; replacedDate: string | null };
```
