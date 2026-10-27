# Data Model: App Navigation and Menu

This feature adds no persisted entity and requires no database migration. The models below are typed configuration or request/UI state. Existing profile and permission data remain authoritative.

## Navigation Destination

Represents one existing top-level application page.

| Field | Description | Validation/behavior |
|---|---|---|
| `id` | Stable destination identifier | Unique across the registry; independent of the label |
| `label` | Plain-language visible name | Required and always rendered with the icon |
| `href` | Existing top-level route | Must begin with `/` and must not invent a new feature route |
| `icon` | Lucide icon reference | Decorative in the rendered link; text remains the accessible name |
| `group` | Navigation group identifier | Must reference a defined group |
| `order` | Position within the group | Deterministic and unique enough to produce stable ordering |
| `access` | `approved` or an existing permission | Evaluated against an approved `User Access Context`; never replaces the page guard |
| `matchDescendants` | Whether child paths activate this destination | `true` for current list/detail families |

### Destination access mapping

| Destination | Route | Access rule |
|---|---|---|
| Dashboard | `/dashboard` | `view_dashboard` |
| Units | `/units` | Approved session |
| Drivers | `/drivers` | Approved session |
| Remittances | `/remittances` | Approved session |
| Expenses | `/expenses` | Approved session |
| Maintenance | `/maintenance` | Approved session |
| Documents | `/documents` | `manage_documents` |
| Reports | `/reports` | `export_reports` |
| Audit History | `/audit` | `view_audit` |
| Staff Accounts | `/settings/staff` | `manage_users` |

## Navigation Group

Provides scannable organization without changing route behavior.

| Field | Description | Validation/behavior |
|---|---|---|
| `id` | Stable group identifier | One of `overview`, `fleet`, `operations`, or `administration` |
| `label` | Visible group name | Plain language; omitted with the group if no child is visible |
| `order` | Group display position | Produces Overview, Fleet, Operations, Administration |
| `destinations` | Filtered destination list | Contains only destinations authorized for the current context |

Recommended grouping:

- **Overview**: Dashboard
- **Fleet**: Units, Drivers
- **Operations**: Remittances, Expenses, Maintenance, Documents, Reports
- **Administration**: Audit History, Staff Accounts

## User Access Context

Serializable subset of the existing session profile used to render navigation.

| Field | Description | Validation/behavior |
|---|---|---|
| `userId` | Existing authenticated user identifier | Never displayed as account identity |
| `displayName` | Existing profile display name | Shown in the account footer; falls back to a neutral account label if unexpectedly empty |
| `role` | `owner` or `staff` | Uses existing application role type |
| `accountStatus` | Existing profile status | Authenticated navigation requires `approved` |
| `permissions` | Derived existing permission set | Computed from the role; not persisted by navigation |

### Access-context states

- **No profile**: render public navigation.
- **Pending, rejected, or deactivated profile**: render public/auth recovery navigation; protected page guards redirect as they do today.
- **Approved owner**: render all ten destinations.
- **Approved staff**: render Units, Drivers, Remittances, Expenses, and Maintenance.

## Active Navigation State

Derived from the current pathname and one destination.

| Field | Description | Validation/behavior |
|---|---|---|
| `pathname` | Current URL pathname without query string | Read from the App Router in the client navigation boundary |
| `destinationId` | Candidate destination | Must be visible in the current access context |
| `isActive` | Whether the destination owns the current route | True for exact match or segment-safe descendant match |

State transitions:

```text
route begins -> derive pathname -> compare visible destinations -> mark zero or one active
link selected -> mobile surface closes -> route transition -> recompute active destination
```

## Sidebar Presentation State

Transient client state owned by the shadcn sidebar provider.

| Field | Description | Validation/behavior |
|---|---|---|
| `mode` | `public` or `authenticated` | Authentication pages force public-appropriate presentation |
| `desktopOpen` | Desktop sidebar visibility | Defaults open; trigger remains discoverable if closed |
| `mobileOpen` | Mobile off-canvas visibility | Defaults closed; closes on selection, close control, or Escape |
| `pendingPath` | Destination currently being entered, if exposed | Optional progress feedback; never changes authorization |

## Logout State

Transient account-action state.

| State | Meaning | Next state |
|---|---|---|
| `idle` | Logout is available | `pending` after activation |
| `pending` | Server action is ending the session | Redirect on success; `error` on provider failure |
| `error` | Session may still be active and a message is visible | `pending` on retry or `idle` after navigation |
| `signed_out` | Session is absent | Redirect to `/login`; protected requests require authentication |

