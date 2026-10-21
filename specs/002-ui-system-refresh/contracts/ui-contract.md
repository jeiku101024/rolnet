# UI Contract: Fleet UI System Refresh

This contract describes observable behavior for the existing ROLNET routes. It is not a public API contract and does not change data permissions or business rules.

## Shared page contract

Every route MUST expose:

1. A visible page purpose/title.
2. Current navigation context where the route belongs to authenticated navigation.
3. A primary action when the current role is authorized to act.
4. A dominant content region aligned to the workspace rather than a centered stack of cards.
5. A predictable loading, empty, filtered-empty, error, or ready state.

## Data-view contract

The following routes use a table or ledger-first content pattern where records are present:

| Route area | Primary records | Useful scan context |
|---|---|---|
| Units | Unit identity, driver, status, mileage | Body/plate, operating status, current driver |
| Drivers | Driver identity, license, assignments | License state, current unit, contact context |
| Remittances | Daily due, payments, balances | Date, driver, unit, paid/balance state |
| Expenses | Categorized costs | Date, unit, category, amount, receipt state |
| Maintenance | Parts, tires, mileage | Unit, item, due threshold, current/due state |
| Documents | Compliance documents | Type, related party, expiry, status |
| Reports | Monthly summaries | Period, unit, due, paid, expense, net |
| Audit | Record events | Actor, action, record, time |

Data views MUST expose row links/actions, text-based statuses, and intentional phone behavior. Filters and pagination are used when the underlying page supports them or when the dataset requires them; the UI must not imply unsupported filtering behavior.

## Dashboard contract

The owner dashboard keeps its existing monthly summary and attention panels and adds recent-data glimpses for:

- Recent remittances
- Recent units
- Recent expenses
- Recent maintenance activity
- Recent documents
- Recent drivers

Each glimpse MUST:

- Show a bounded number of items with useful date/status/amount/identity context.
- Use the same row, status, and typography rules as the full data view.
- Link to the related full list or detail route.
- Show a local empty state when no items exist.
- Show a local recoverable error state when its data cannot be loaded.
- Respect owner/staff permissions and never reveal an action unavailable in the full route.
- Avoid blocking the rest of the dashboard when one glimpse has no data or fails.

## Form contract

Create/edit workflows MUST group related fields, label required fields, preserve valid input after validation failure, provide plain-language recovery guidance, and keep primary/secondary/destructive actions visually distinct. Controls MUST meet the project touch-target and focus requirements.

## Detail contract

Detail routes MUST show record identity, current status, key values, related data, history when available, and authorized actions. The parent-list path must remain discoverable on phone and desktop.

## Typography and visual contract

- The primary UI type must feel sturdy and distinctive, comparable to Satoshi, Montserrat, or Poppins.
- Numeric/date/plate/peso values must remain aligned for scanning and reconciliation.
- Existing ROLNET color roles and status meanings remain unchanged.
- Rules, spacing, and grouping provide structure; rounded cards are optional containers, not the default composition for every section.
- No gradients, decorative shadows, all-caps decorative labels, emoji icons, or color-only statuses.
