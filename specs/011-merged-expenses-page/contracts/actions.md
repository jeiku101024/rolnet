# Contract: Server Actions and API v1

Every action is wrapped in `run()` and returns `ActionResult`. Field errors use the form field names
below.

## `app/actions/expenses.ts`

### `createExpense(input)`: approved session (owner or staff)

```ts
input = {
  unitId: uuid,                 // a unit that isn't archived or deleted
  category: ExpenseCategory,
  customCategory?: string,      // required when category = "others"; trimmed 1–80
  expenseDate: "YYYY-MM-DD",    // ≤ fleet today
  replacedDate?: "YYYY-MM-DD",  // required for main categories; ≤ fleet today
  amountCentavos: int > 0,
  notes?: string ≤ 1000,
  idempotencyKey: uuid,
}
```

- Validation uses `expenseSchema` (Zod, `superRefine` for the category rules). Errors map to
  `unitId`, `category`, `customCategory`, `expenseDate`, `replacedDate`, `amountCentavos`, and
  `notes`.
- The unit check reads the unit. If it is archived or deleted, the action fails with field error
  `unitId`: "This unit is archived. Choose another unit."
- Idempotency: if a row with `idempotency_key` exists, the action returns it (FR-026). Otherwise it
  inserts with `category_id` null. The fields that don't apply are sent as null.
- It returns `{ id, updatedAt }`, so the receipt upload can follow, as today.
- It revalidates `/expenses`, `/dashboard`, and `/units/{unitId}`.

### `updateExpense(id, input & { expectedUpdatedAt })`: approved session

- Same validation, with no idempotency key.
- The update runs `.eq("id").eq("updated_at", expectedUpdatedAt).is("deleted_at", null)`. If no row
  matches, it fails with `STALE_RECORD`: "This expense was changed or deleted by someone else.
  Reload to see the latest." (FR-025).
- If the category moves away from `others`, it sends `custom_category: null`. If it moves to
  `others`, it sends `replaced_date: null`. The confirmation is client-side (contracts/ui.md).
- It revalidates as above, for both the old and the new unit.

### `deleteExpense(id, expectedUpdatedAt)`: owner (`manage_master_data`)

- Replaces `softDeleteExpense`.
- Calls `rpc("soft_delete_record", { p_table: "expenses", p_id: id, p_expected_updated_at })`. A null
  result means `STALE_RECORD`, with the same message.
- Staff calls fail with `FORBIDDEN`: "Only the owner can delete expenses."
- It revalidates as above.

The existing receipt actions are unchanged: `prepareReceiptUpload`, `finalizeReceiptUpload`, and
`getReceiptUrl`.

## `app/actions/mileage.ts`

`upsertMileageReading` keeps its signature and rules. Revalidation drops `/maintenance` and
`/maintenance/{id}`, and keeps `/units`, `/units/{id}`, and `/dashboard`.

## Removed

| File | Exports |
|------|---------|
| `app/actions/parts.ts` | `logPartReplacement`, `softDeletePart` |
| `app/actions/tires.ts` | `installTire`, `softDeleteTire` |
| `app/actions/expenses.ts` | `softDeleteExpense` (replaced by `deleteExpense`) |

## API v1 (`lib/domain/resource-config.ts`, `app/api/v1/[...segments]/route.ts`)

| Resource | Before | After |
|----------|--------|-------|
| `expenses` | create and update `unit_id, category_id, expense_date, amount_centavos, notes`. Filter `unit_id, category_id`. | create and update `unit_id, category, custom_category, expense_date, replaced_date, amount_centavos, notes`. Filter `unit_id, category, needs_review, source_table`. Sort adds `replaced_date`. `category_id`, `needs_review`, `source_table`, and `source_id` are returned but not writable (400 `IMMUTABLE_FIELD`). |
| `part-replacements` | write (encode_operations), softDelete | `readOnly`, create and update `[]`, `softDelete: false` |
| `tire-installations` | write, softDelete, `POST {id}/replace` | `readOnly`, `[]`, `softDelete: false`. `POST {id}/replace` returns 405. |
| `expense-categories` | ownerWrite, softDelete | `readOnly`, `[]`, `softDelete: false`, no `ownerWrite` |
| `mileage-readings` | unchanged | unchanged |

Read-only writes return `405 FORBIDDEN` with the resource's `readOnlyMessage`: "This resource is read
only. Record costs as expenses." The default "This resource is read only." is used elsewhere.

Database errors map to HTTP as today:
- `23514` → 422, with the messages from [database.md](database.md).
- `42501` → 403.
