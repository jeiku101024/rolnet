# Feature Specification: App Navigation and Menu

**Feature Branch**: `[003-app-navigation]`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Create navigation/menu for ROLNET, continue using the existing shadcn-based design language, add icons for the existing pages, and include logout and other relevant destinations."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate Core Fleet Work (Priority: P1)

As an approved ROLNET user, I can open a persistent navigation menu and move directly to the fleet pages available to me without returning to a landing page or guessing URLs.

**Why this priority**: The application already has multiple operational and owner pages, but users need a dependable way to reach them before those workflows function as one coherent product.

**Independent Test**: Sign in as each supported role, open the menu on phone and desktop viewports, and follow every visible destination. Each selection opens the intended page, the current destination is identifiable, and no inaccessible destination is offered.

**Acceptance Scenarios**:

1. **Given** an approved owner is signed in, **When** the owner views the navigation, **Then** the menu offers Dashboard, Units, Drivers, Remittances, Expenses, Maintenance, Documents, Reports, Audit History, and Staff Accounts.
2. **Given** an approved staff member is signed in, **When** the staff member views the navigation, **Then** the menu shows only the pages that staff member is permitted to access.
3. **Given** a user is on any page represented in the menu, **When** the navigation is displayed, **Then** that page's destination is visually identified as current and is also communicated as current to assistive technology.
4. **Given** a user selects a visible destination, **When** navigation completes, **Then** the corresponding existing page is displayed and the menu state remains understandable.

---

### User Story 2 - Use Navigation at Any Screen Size (Priority: P2)

As an owner or staff member working from a phone, tablet, or desktop, I can access the same authorized destinations through a layout suited to the available screen space.

**Why this priority**: Daily fleet work is frequently performed on a phone, and the project constitution requires every primary workflow to remain usable without desktop-only interaction or horizontal scrolling.

**Independent Test**: At 320-pixel phone width and at a desktop width, use only touch or keyboard navigation to open the menu, reach every authorized destination, identify the active page, and close or dismiss any temporary menu.

**Acceptance Scenarios**:

1. **Given** an authenticated user is on a phone-sized screen, **When** the user opens the navigation, **Then** all authorized destinations and account actions are reachable without horizontal scrolling.
2. **Given** an authenticated user is on a larger screen, **When** the application loads, **Then** the primary navigation is readily available without obscuring page content.
3. **Given** a temporary menu is open, **When** the user chooses a destination, activates its close control, presses Escape, or moves focus outside through the supported dismissal behavior, **Then** the menu closes and focus is left in a predictable location.
4. **Given** a keyboard or assistive-technology user is navigating, **When** focus moves through the menu, **Then** every item has a visible focus state, an understandable name, and a logical order.

---

### User Story 3 - Recognize Destinations Quickly (Priority: P3)

As a non-technical fleet user, I can recognize menu destinations and account actions quickly through consistent text labels paired with familiar icons.

**Why this priority**: Icons improve scanning speed, while retained text labels prevent ambiguity and make the menu understandable to new users and assistive technologies.

**Independent Test**: Review each menu item at phone and desktop sizes and verify that it has a consistent icon-and-label pairing, that meaning does not depend on the icon alone, and that decorative icon content is not redundantly announced.

**Acceptance Scenarios**:

1. **Given** the navigation is visible, **When** a user scans its destinations, **Then** every destination and logout action pairs a recognizable icon with a plain-language text label.
2. **Given** two views of the same destination at different screen sizes, **When** the user compares them, **Then** the destination uses the same icon and label in both contexts.
3. **Given** icons cannot be perceived or loaded, **When** the user uses the menu, **Then** the text labels still communicate every destination and action completely.

---

### User Story 4 - Sign Out Safely (Priority: P4)

As an authenticated user, I can find and activate logout from the navigation so that I can end my session on a shared or personal device.

**Why this priority**: Fleet devices may be shared, making a clear session-ending action necessary for account security and user confidence.

**Independent Test**: Sign in, activate Logout from each responsive navigation form, and verify that the session ends, protected pages are no longer accessible without signing in, and the sign-in screen is shown.

**Acceptance Scenarios**:

1. **Given** an approved user is signed in, **When** the user opens the navigation, **Then** Logout is clearly visible as an account action and is distinct from page destinations.
2. **Given** a user activates Logout, **When** the action succeeds, **Then** the session ends and the user is sent to the sign-in screen.
3. **Given** a user has logged out, **When** the user attempts to revisit a protected page, **Then** the user is required to sign in again.
4. **Given** logout cannot be completed, **When** the attempt fails, **Then** the user receives a plain-language error and remains aware of the current session state.

### Edge Cases

- A user's role or account status changes while a session is active; on the next authorization check, navigation must no longer expose destinations the user cannot access.
- The current route is a detail page, such as a specific unit, driver, document, remittance, or maintenance record; its parent menu destination remains identified as current.
- A user follows a stale bookmark or manually enters a destination outside the user's permissions; the existing access control remains authoritative and navigation does not imply access.
- The navigation contains more items than fit in the viewport; all items, including Logout, remain reachable without horizontal scrolling or clipped controls.
- The page is loading or navigation is delayed; repeated activation does not create confusing duplicate transitions, and the user receives visible progress feedback when needed.
- A label is translated, enlarged, or displayed with increased text spacing; destination names remain readable without colliding with icons or controls.
- The session is already expired when Logout is selected; the user is still taken to the sign-in screen without exposing protected content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide authenticated users with a consistent primary navigation menu across all protected application pages.
- **FR-002**: The owner menu MUST provide destinations for Dashboard, Units, Drivers, Remittances, Expenses, Maintenance, Documents, Reports, Audit History, and Staff Accounts.
- **FR-003**: The system MUST determine visible destinations from the authenticated user's current role and permissions, and MUST NOT display a destination the user is not authorized to access.
- **FR-004**: Navigation visibility MUST complement, not replace, enforcement of authorization when a destination is requested directly.
- **FR-005**: Each destination MUST use a concise, plain-language text label paired with a distinct, recognizable icon.
- **FR-006**: Icons MUST supplement rather than replace text, and decorative icons MUST not create duplicate or confusing announcements for assistive technologies.
- **FR-007**: The same destination MUST retain a consistent label and icon across phone, tablet, and desktop navigation presentations.
- **FR-008**: The system MUST clearly indicate the current destination visually and through a non-visual state that assistive technologies can identify.
- **FR-009**: Detail pages MUST identify their corresponding parent destination as current.
- **FR-010**: On phone-sized screens, users MUST be able to open, use, and dismiss the navigation without horizontal scrolling or a desktop-only interaction.
- **FR-011**: On larger screens, the primary navigation MUST remain readily discoverable without covering or preventing use of page content.
- **FR-012**: All navigation links and controls MUST be operable by touch and keyboard, follow a logical focus order, and show a visible focus state.
- **FR-013**: Temporary navigation surfaces MUST have an accessible name, keep focus behavior predictable, support an explicit close action, and close after a destination is selected.
- **FR-014**: The navigation MUST include a clearly labeled Logout action for every authenticated role and visually separate it from ordinary page destinations.
- **FR-015**: Activating Logout MUST end the current authenticated session, send the user to the sign-in screen, and prevent further access to protected pages until a new sign-in succeeds.
- **FR-016**: If logout cannot complete, the system MUST explain the failure in plain language and accurately communicate whether the user remains signed in.
- **FR-017**: Public authentication pages MUST show only navigation appropriate to unauthenticated visitors and MUST NOT present protected fleet destinations or an active Logout action.
- **FR-018**: Navigation labels, ordering, icons, active-state treatment, and interactive behavior MUST remain consistent with the application's established visual and interaction language.
- **FR-019**: The navigation MUST preserve the existing page routes and page-level authorization rules; this feature does not create new fleet-management workflows or broaden any role's permissions.
- **FR-020**: The application MUST remain usable when an icon fails to render because every destination and action retains its complete text label.

### Key Entities

- **Navigation Destination**: An existing application page available from the menu, described by a user-facing label, icon, route, display order, parent matching behavior, and required access permission.
- **Navigation Group**: A meaningful collection of destinations, such as overview, fleet records, daily operations, compliance/reporting, or administration, used to keep a larger owner menu scannable.
- **User Access Context**: The authenticated user's identity, display name when available, role, account status, and effective permissions used to decide which navigation and account actions are shown.
- **Active Navigation State**: The relationship between the current page and its matching top-level destination, including detail pages that belong to a parent destination.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing, at least 90% of first-time users can reach any authorized top-level page from an arbitrary protected page in no more than two navigation interactions.
- **SC-002**: At 320-pixel width and at the supported desktop viewport, 100% of authorized destinations and Logout are reachable without horizontal page scrolling or clipped labels.
- **SC-003**: In role-based acceptance tests, 100% of menu items lead to the intended existing page and 0 unauthorized destinations are displayed for either owner or staff accounts.
- **SC-004**: In route-state acceptance tests, 100% of top-level and covered detail pages identify the correct current destination both visually and to assistive technology.
- **SC-005**: In keyboard-only and touch-only acceptance testing, users complete opening, traversing, selecting from, and dismissing the menu with a 100% task completion rate.
- **SC-006**: In logout acceptance testing, 100% of successful logout attempts return the user to sign-in and block protected-page access until reauthentication.
- **SC-007**: At least 90% of representative owner and staff participants correctly identify the purpose of each visible destination from its icon-and-label pair without assistance.
- **SC-008**: Every navigation control meets the project's mobile plain-language review and exposes an understandable accessible name, visible focus state, and minimum touch-friendly target.

## Assumptions

- The existing authenticated roles, account statuses, permissions, page routes, and logout behavior remain the source of truth; this feature organizes access to them rather than changing them.
- The owner receives the complete menu. Staff receive only destinations permitted by the current authorization model; no permission expansion is implied.
- "Icons on existing pages" means each existing page represented in navigation receives a consistent icon in the menu; it does not require decorative icons to be added throughout every page's content.
- Text labels remain visible alongside icons because ROLNET is intended for non-technical users and must remain accessible when icons are unfamiliar or unavailable.
- Existing brand assets and the established component-driven visual language are reused so the menu feels native to the current application.
- Phone support is in scope and is tested at a 320-pixel viewport; native mobile applications and offline navigation are out of scope.
- Page reorganization, new fleet modules, user-configurable menu ordering, favorites, global search, notifications, and breadcrumb trails are outside this feature unless added by a later specification.
- Navigation must not introduce a paid service or new production infrastructure.

