# Research: App Navigation and Menu

## Decision: Use the shadcn Base UI Sidebar as the application-shell primitive

**Rationale**: The repository's `components.json` selects the Base Nova style, Base UI primitives, server-component support, and Lucide icons. The official shadcn sidebar provides the required provider, trigger, scrollable content, groups, active menu buttons, sticky footer, and mobile off-canvas behavior as editable project source. Using that primitive satisfies the requested shadcn direction while avoiding a second design system. The shell will keep destination labels visible whenever the menu is open; it will not use an icon-only collapsed state as the primary navigation presentation.

**Alternatives considered**: Extending the current three-column mobile footer was rejected because ten owner destinations do not fit accessibly. A custom dialog/sidebar was rejected because it would recreate responsive, focus, and dismissal behavior already available in the configured component system. A top navigation menu was rejected because grouped operational destinations and account actions become crowded at phone and intermediate widths.

## Decision: Resolve identity on the server and isolate interactivity in the sidebar

**Rationale**: Session cookies and the authoritative profile already live behind `getSessionProfile()`. The root shell can resolve that optional profile without exposing tokens, then pass only user id, display name, role, and account status to the interactive navigation. Active-route detection and open/close state require client hooks, but page content and authorization can remain server-rendered. Wrapping the existing profile lookup in request-scoped React caching prevents duplicate profile reads when both the shell and a page guard request the same identity during one render.

**Alternatives considered**: Fetching the profile from the browser was rejected because it creates a loading flash and an unnecessary client request. Moving all protected routes under a new shared route group was rejected because the current owner and operations groups would require structural churn unrelated to the user-visible outcome. Making the entire root layout a client component was rejected because it would enlarge the client boundary and prevent direct server session access.

## Decision: Treat page guards as authoritative and navigation filtering as presentation

**Rationale**: Existing pages use either `requireApprovedSession()` or a specific `requirePermission()`. The navigation registry will mirror those access requirements and call the existing `hasPermission()` helper. An approved staff member therefore sees Units, Drivers, Remittances, Expenses, and Maintenance; an owner additionally sees Dashboard, Documents, Reports, Audit History, and Staff Accounts. Direct requests continue through the existing guards, so hiding an item never becomes the security mechanism.

**Alternatives considered**: Filtering by route-group folder names was rejected because route groups do not define access and staff currently may read owner-grouped Units and Drivers pages. Creating a second role-to-route matrix inside components was rejected because it could drift from the permission helpers. Expanding staff permissions to match every owner route was rejected as outside scope.

## Decision: Use one typed registry for labels, icons, grouping, order, and route matching

**Rationale**: A single registry gives desktop and mobile presentations identical labels and Lucide icon components and makes role filtering independently testable. Each destination records a stable id, label, href, group, icon, order, and either approved-session access or a required existing permission. Group definitions provide labels and ordering; groups with no visible destinations are omitted.

**Alternatives considered**: Separate desktop and phone item arrays were rejected because icon, order, or permission changes could diverge. Deriving labels from folder names was rejected because user-facing terms such as “Audit History” and “Staff Accounts” require intentional language.

## Decision: Use segment-safe pathname matching for active destinations

**Rationale**: A small pure helper will mark a destination active when the current pathname equals its href or begins with the href followed by `/`. This marks `/units/[id]`, `/drivers/[id]`, `/documents/[id]`, `/remittances/[id]`, and `/maintenance/[unitId]` under their parent while avoiding false matches such as `/units-archive`. The client navigation reads the current pathname with the supported App Router hook and sets both the sidebar active state and `aria-current="page"` on the link.

**Alternatives considered**: Exact-only matching was rejected because detail pages would lose context. Raw `startsWith(href)` was rejected because it can activate unrelated routes sharing a prefix. Maintaining a second detail-to-parent map was rejected because the existing URL hierarchy already expresses the relationship.

## Decision: Keep public and authenticated navigation modes explicit

**Rationale**: The landing, sign-in, and registration experiences need a small public route set, while protected pages need the application sidebar. Unapproved profiles are treated as public navigation context because they cannot access protected routes. Authentication pages always render public-appropriate navigation even if reached with a stale authenticated client state. This prevents protected links or Logout from appearing where the specification forbids them.

**Alternatives considered**: Showing the application sidebar on every route whenever a session cookie exists was rejected because authentication pages have a different purpose and may be reached during account-state recovery. Removing public navigation entirely was rejected because it would regress the existing Sign in/Register entry points.

## Decision: Make logout outcome explicit and recoverable

**Rationale**: The existing action already performs server-side sign-out and redirect, but it ignores provider errors. The action will inspect the result, redirect to sign-in only after confirmed success (or an already-expired session), and return a structured failure otherwise. The sidebar account footer will show a pending state during submission and an inline plain-language error if the session remains active. The action remains server-side and applies the existing same-origin protection pattern.

**Alternatives considered**: Client-side provider logout was rejected because it duplicates server client setup and weakens the current action boundary. Redirecting regardless of provider error was rejected because it can imply a shared device is safe when the session remains valid. Adding a confirmation dialog was rejected because logout is reversible through sign-in and the specification prioritizes a direct, easy-to-find action.

## Decision: Validate behavior through pure unit tests plus focused browser journeys

**Rationale**: Registry filtering and active-route matching are deterministic and inexpensive to test with Vitest. Playwright is appropriate for the responsive sidebar, focus, Escape/close behavior, actual links, active announcements, public/auth modes, and logout redirect. A 320-pixel test overrides the current 360-pixel project viewport to satisfy the feature specification.

**Alternatives considered**: Browser-only coverage was rejected because permission matrices and route boundary cases are clearer as table-driven unit tests. Snapshot-only component tests were rejected because they do not prove focus, dismissal, navigation, or session behavior.

