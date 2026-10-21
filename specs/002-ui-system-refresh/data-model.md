# Data Model: Fleet UI System Refresh

This feature adds no persisted database entities and no migration. The following are presentation models and read-only projections used to make the UI contract explicit.

## Page Workspace

Represents the shared page composition.

| Field | Description | Validation/behavior |
|---|---|---|
| `route` | Current route and navigation context | Must map to an existing route and show active navigation where applicable |
| `title` | Human-readable page purpose | Required; visible at every page |
| `description` | Optional concise context or instruction | Must not replace the title or primary action |
| `primaryAction` | Authorized main action | Hidden or unavailable when permission is absent |
| `contentMode` | `table`, `ledger`, `form`, `detail`, `dashboard`, or `auth` | Determines the main layout pattern |
| `state` | `loading`, `ready`, `empty`, `filtered-empty`, or `error` | Must have plain-language user feedback |

## Data View

Represents a list or ledger view over an existing domain query.

| Field | Description | Validation/behavior |
|---|---|---|
| `columns` | Ordered visible data fields | Each heading must identify its values; important values may not be color-only |
| `rows` | Existing domain records or read-only projections | Must respect current query and permission boundaries |
| `filters` | Search, date, status, or domain filters | Active constraints are visible and removable |
| `sort` | Current sort field/direction when supported | Must be visible when not default |
| `resultCount` | Number of records in current view | Shown when useful for scanning |
| `rowAction` | Link or action to inspect the record | Must be keyboard and touch accessible |
| `responsiveMode` | Bounded overflow or compact alternate presentation | Cannot overflow the entire page |

## Dashboard Recent Glimpse

Read-only projection for the owner dashboard. It is not stored independently.

| Field | Description | Validation/behavior |
|---|---|---|
| `kind` | `remittance`, `unit`, `expense`, `maintenance`, `document`, or `driver` | Must map to a permitted full route |
| `title` | Section title, such as “Recent remittances” | Required and specific |
| `items` | Bounded recent records | Empty list gets an explicit empty state |
| `context` | Date, status, amount, unit, driver, or other scan context | Must be sufficient to identify why the item matters |
| `destination` | Full list/detail route | Must be authorized for the current user |
| `state` | `loading`, `ready`, `empty`, or `error` | Error is local to the glimpse and must not block other dashboard areas |

The dashboard glimpse does not own money calculations, expiry classification, permission decisions, or record mutations. It consumes authoritative existing results.

## Visual Token Roles

The visual system continues to use the existing token roles: brand yellow, navy/ink, warm canvas, surface, rule, muted, focus, success, warning, and danger. Typography adds explicit display/body/control/data roles and weight mapping without changing the color semantics.
