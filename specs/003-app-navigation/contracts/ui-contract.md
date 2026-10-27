# UI Contract: App Navigation and Menu

This contract defines observable navigation behavior. It is not a public network API and does not replace server-side route authorization.

## Access contract

1. The shell MUST derive navigation from the current server-verified profile.
2. Only an `approved` profile receives authenticated navigation.
3. A visible destination MUST satisfy the access mapping in [data-model.md](../data-model.md).
4. Existing page guards MUST still authorize every direct request; a hidden link is not an authorization control.
5. Empty groups MUST not render.
6. Public authentication pages MUST expose only public-appropriate routes, even if entered during stale client state.

### Expected visible destinations

| Context | Destinations |
|---|---|
| Public/unapproved | Landing/Ledger, Sign in, Register as appropriate to the current public page |
| Approved staff | Units, Drivers, Remittances, Expenses, Maintenance |
| Approved owner | Dashboard, Units, Drivers, Remittances, Expenses, Maintenance, Documents, Reports, Audit History, Staff Accounts |

## Desktop shell contract

1. At desktop widths, authenticated navigation MUST be readily visible as a sidebar when the shell first loads.
2. The sidebar MUST contain brand/home affordance, scrollable grouped destinations, and a visually separated account footer.
3. Page content MUST occupy the remaining width without being covered by the sidebar.
4. If the sidebar can be hidden, a labeled and keyboard-focusable trigger MUST remain available.
5. The sidebar MUST not use icon-only presentation as its default or sole discoverable state.

## Mobile shell contract

1. At 320 pixels wide, the authenticated sidebar MUST start closed and open from a clearly labeled touch-friendly trigger.
2. The open surface MUST expose every authorized destination, account identity, and Logout without horizontal scrolling.
3. Content longer than the viewport MUST scroll within the navigation surface while its close mechanism remains reachable.
4. Selection, the explicit close control, and Escape MUST dismiss the temporary surface.
5. Opening the surface MUST move interaction into it predictably; closing it without navigation MUST restore focus to the trigger.
6. Selecting a link MUST close the surface and allow the destination's page heading or route announcement to communicate the transition.

## Destination link contract

Every destination link MUST:

- Use the framework's client-navigation link.
- Render one consistent Lucide icon and one visible text label.
- Treat the icon as decorative so it is not announced in addition to the label.
- Provide at least the project's touch-friendly target size and a visible keyboard focus indicator.
- Mark the exact or segment-safe parent destination with both the visual active treatment and `aria-current="page"`.
- Preserve the same label, icon, group, and order across desktop and mobile presentations.

### Parent-route examples

| Current path | Active destination |
|---|---|
| `/units` or `/units/{id}` | Units |
| `/drivers` or `/drivers/{id}` | Drivers |
| `/remittances` or `/remittances/{id}` | Remittances |
| `/maintenance` or `/maintenance/{unitId}` | Maintenance |
| `/documents` or `/documents/{id}` | Documents |
| `/settings/staff` | Staff Accounts |
| `/units-archive` | None (must not falsely activate Units) |

## Account and logout contract

1. The footer MUST show the current display name and role in plain language.
2. Logout MUST be labeled with text and an icon and separated from destination links.
3. Activation MUST submit to the existing server-side authentication boundary.
4. While pending, repeated activation MUST be prevented and progress MUST be perceivable.
5. Confirmed success or an already-expired session MUST end at `/login`.
6. Provider failure MUST keep the user aware that the session may still be active and MUST show a plain-language retryable error.
7. After success, direct access to a protected route MUST invoke the existing sign-in redirect.

## Public navigation contract

1. The landing page MUST retain discoverable Sign in and Register routes.
2. Sign in and registration pages MUST not display fleet destinations or Logout as active account actions.
3. Public links SHOULD use the same icon-plus-label and focus/touch conventions where icons are present.
4. Public navigation MUST not occupy page width in a way that causes horizontal scrolling at 320 pixels.

## Visual contract

- Sidebar tokens MUST map to the existing ROLNET canvas, surface, ink, rule, brand, muted, focus, and status roles.
- Active state MUST use more than color alone, such as weight, marker, background, or border in combination with `aria-current`.
- Group labels and destination labels MUST remain readable under enlarged text and increased spacing.
- No emoji icons, decorative gradients, paid assets, or second icon library may be introduced.

## Failure and edge-state contract

- A route transition delay leaves the shell usable and supplies progress feedback if the delay is perceptible.
- A changed/deactivated account loses destinations on the next server verification; stale client visibility never bypasses the page guard.
- Missing icon rendering leaves the full text label and action meaning intact.
- An unknown route may show no active destination but must not cause multiple items to be active.
- An expired session encountered during Logout ends at sign-in without exposing protected content.

