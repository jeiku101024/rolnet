# Contract: UI

Tokens only (`app/globals.css`), shadcn `base-nova` components, and no new libraries. Every screen
works at 360 px. Copy is exact unless marked *(example)*.

## Expenses page: `/expenses`

**Header**: `PageHeader` with eyebrow "Costs and upkeep", title "Expenses", and description "Record
fuel, parts, repairs and other unit costs." The `.workspace-grid` aside is removed, so the list uses
the full width (FR-004).

**Toolbar** (`listView` + `ListToolbar`):
- Row 1: the search box (label "Search expenses", placeholder "Search notes, unit, or category"),
  the date-range button, the Filters button, and the primary **Add expense** button with a `Plus`
  icon (`action`).
- Row 2: "{n} records · ₱{total}" (`hint` = `formatPesos(total)`), then the sort select: "Newest
  first" (default), "Oldest first", "Highest amount", "Lowest amount".

**Filters panel**:
- Unit: every unit, including archived ones, labelled "Body {n}".
- Category: Change Oil … Battery, Others.
- Receipt: Attached or Missing.
- Review: "Needs review" or "Moved from maintenance".

**URL params**: `unit`, `category`, `from`, `to`, `receipt`, `review`, `q`, `sort`, and `page`. Old
`category=<uuid>` links are ignored (unknown option).

**Table** (`DataTable`; headers `Date`, `Unit`, `Category`, `Amount`, `Last Replaced`, `Notes`,
`Options`):

| Column | Content |
|--------|---------|
| Date | `expense_date`, `font-data` |
| Unit | "Body {n}" linking to `/units/{id}` for the owner, plain text for staff |
| Category | the main label, or the typed name in `Truncated` plus a `Badge` "Others" (secondary). Rows with `needs_review` also get a warning badge "Needs review". |
| Amount | `formatPesos`, right-aligned, `font-data` |
| Last Replaced | `replaced_date`, or "N/A" in `text-muted` for Others |
| Notes | `Truncated` (ellipsis plus a tooltip with the full text). Before the text, a receipt button (`Paperclip` icon, `aria-label` "View receipt") opening the signed URL. |
| Options | `ExpenseRowMenu` |

**Empty states**:
- No expenses at all: `EmptyState` "No expenses recorded yet.", with the Add button.
- Filters or search match nothing: "No expenses match these filters." (FR-016).

## `AddExpenseDialog` / `EditExpenseDialog`: `components/expenses/expense-dialog.tsx`

These use `Dialog` + `DialogContent title="Add expense" | "Edit expense"` and wrap
`ExpenseFormFields`. The trigger for Add is the toolbar button. Edit opens from the row menu, with a
controlled `open` state.

**Fields** (in order; `*` = required, shown inline on save):

1. **Unit*** is a `Select` of units that aren't archived or deleted ("Body {n} · {plate}"), including
   In repair units. When editing an expense whose unit is now archived, that unit appears as a
   disabled current option, and saving requires choosing an active unit.
2. **Category*** is a `Select` of the 7 main categories in order, then "Others".
3. **Category name*** appears only for Others. It is a text input with `maxLength` 80. Below it,
   when the name looks like a main category: "This looks like {label}. Choose it from Category to
   track Last Replaced."
4. **Expense date*** is a date input, defaulting to fleet today, with `max` today.
5. **Date replaced*** appears only for main categories. It is a date input with `max` today. It
   follows the expense date until the user edits it (FR-019). When editing, it is pre-filled from
   the saved value.
6. **Amount (₱)*** is `inputMode="decimal"`, parsed with `parsePositiveCentavos`.
7. **Notes** is a textarea of up to 1000 characters.
8. **Receipt photo** (optional) uses the existing file input and rules. When editing an expense that
   has a receipt, it shows "Receipt attached" with a View button, and a new file replaces it.

**Behaviour**:
- Switching the category swaps fields 3 and 5 in place. Every other value is kept (FR-020).
- In Edit, choosing Others on an expense saved with a main category opens an `AlertDialog`: title
  "Remove Last Replaced date?", body "This removes the Last Replaced date.", buttons "Cancel"
  (default focus; reverts the category) and "Continue". The date is cleared only on save.
- Save shows "Saving…" and is disabled while pending, and one idempotency key is used per open
  (FR-026). On success the dialog closes, the toast "Expense added" or "Expense updated" shows, and
  `router.refresh()` runs.
- A server failure shows in `ValidationSummary`, and the dialog stays open. A stale record shows the
  STALE message with a "Reload" button that refreshes and closes the dialog.
- The dialog closes on Escape and on the X button ("Close"), and returns focus to the trigger.

## `ExpenseRowMenu`: `components/expenses/expense-row-menu.tsx`

- The trigger is a `MoreHorizontal` icon button with class `touch-target w-11` and `aria-label`
  "Expense options".
- Items: **Edit** and **Delete**. For staff, Delete is disabled with the text "Delete (owner
  only)" and `title` "Only the owner can delete expenses".
- The Base UI positioner flips upward near the viewport bottom (FR-027). The menu works by keyboard:
  arrows, Enter, and Escape.

## `DeleteExpenseDialog`: `components/expenses/delete-expense-dialog.tsx`

- `AlertDialog`, title "Delete this expense?".
- The body is a definition list of Date, Unit, Category, and Amount, followed by the text "This
  permanently removes the expense and changes report totals for that period."
- Buttons: "Cancel" (outline, `initialFocus`) and "Delete expense" (`bg-danger text-surface
  hover:bg-danger/90`). It sends `expectedUpdatedAt`.
- On success: the toast "Expense deleted" and `router.refresh()`.
- On failure: a `role="alert"` message inside the dialog.

## Unit detail: `/units/{id}` (owner)

- The `UnitDetailsSection` link "Maintenance and mileage" becomes "Expenses", pointing to
  `/expenses?unit={id}` (FR-003).
- **New section "Last replaced"**, after Monthly allowance: a list of 7 rows ("Change Oil — 12 Oct
  2026" *(example)* or "Never recorded" in `text-muted`), each a link to
  `/expenses?unit={id}&category={value}`.
- **New section "Mileage"**, after Last replaced: `MileageForm` plus a paged list of readings, newest
  first ("{date} · {km} km · {notes}"), with prefix `mileage_`. The empty state is "No mileage
  readings yet."

## Units Daily view: staff mileage

- Each assignment card, including blocked ones, gets a ghost button "Record mileage" (`Gauge`
  icon). It opens `RecordMileageDialog` (`Dialog`, title "Record mileage · Body {n}"), which wraps
  `MileageForm`.
- On success: the toast "Mileage saved", and the dialog closes.

## Navigation and dashboard

- **Navigation**: the "Maintenance" item is removed. The Operations group is Remittances, then
  Expenses.
- **Maintenance URLs**: `/maintenance` → `/expenses`, and `/maintenance/{uuid}` →
  `/expenses?unit={uuid}`, both permanent redirects.
- **Dashboard**:
  - The "Maintenance due" stat tile and attention panel are removed.
  - The band copy becomes "Expired documents and unpaid balances, most urgent first."
  - The recent glimpses are remittances, expenses, and documents. The expense rows show the
    category label (or the custom name).
  - The PhoneFold hint becomes "Remittances, expenses and documents".
- **Copy**: `app/manifest.ts` and `app/forbidden/page.tsx` stop mentioning maintenance.
