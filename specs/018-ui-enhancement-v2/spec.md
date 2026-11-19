# Feature Specification: UI Enhancement v2

**Feature Branch**: `018-ui-enhancement-v2`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "UI Enhancement v2: (1) Login page: remove the Ledger link from the nav since it is not accessible when logged out. (2) Use web login/registration form designs as inspiration. (3) Switching between Sign in and Register does not re-render the page but slides the current card out to the left while the other card enters from the right, smoothly. (4) Center the ROLNET logo above the forms. (5) Add an animated background behind the forms. (6) Add dark mode. (7) Add a small, creative, lag-free animation to all pop-ups. (8) Add a matching exit animation when pop-ups close. (9) Add animation when saving and updating data in the views. Overall, animations are minimal but visible and must never cause lag."

## Clarifications

### Session 2026-11-18

- Q: Should the theme control be a simple Light/Dark switch or offer a "Match my device" choice? → A: Two-state switch in the header, plus a "Match my device" option in a small menu to return to following the device.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Polished, focused sign-in and registration screen (Priority: P1)

A visitor who is not signed in opens the sign-in page. The header offers only what they can actually use (Sign in and Register); there is no Ledger link. The ROLNET logo sits centered above the form card, with a calm animated background behind it. The form follows a modern, familiar login-card layout (clear heading, short helper line, labelled fields, one prominent action, a link to the other form).

**Why this priority**: It is the first screen every staff member sees and the only one a logged-out visitor can reach. Removing a dead link and giving the screen a professional look has the most visible effect and no dependency on other stories.

**Independent Test**: Open the sign-in and register pages while signed out at 360 px and desktop widths. Confirm there is no Ledger link, the logo is horizontally centered above the card, the background is animating, and the form is fully usable.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor on the sign-in or register page, **When** the page loads, **Then** the navigation shows only Sign in and Register, with no Ledger link.
2. **Given** the same visitor, **When** the page loads, **Then** the ROLNET logo is horizontally centered directly above the form card at every supported width.
3. **Given** the page is open, **When** the visitor looks behind the card, **Then** a subtle animated background is visible and does not reduce the legibility of the form text or fields.
4. **Given** a signed-in user, **When** they use the app, **Then** the existing navigation (including Ledger) is unchanged.

---

### User Story 2 - Smooth card swap between Sign in and Register (Priority: P1)

A visitor on the Sign in card chooses "Register for approval". Instead of the page reloading or flashing, the Sign in card slides out to the left while the Register card slides in from the right. Going back reverses the direction (Register slides out to the right, Sign in enters from the left). The logo and background stay in place throughout.

**Why this priority**: It is the specific interaction the owner asked for and defines how the two forms relate to each other.

**Independent Test**: From Sign in, activate the Register link and observe the transition, then go back. Confirm the logo and background do not re-render or flicker, the address and browser Back/Forward still match the visible form, and the transition feels smooth.

**Acceptance Scenarios**:

1. **Given** the Sign in card is shown, **When** the visitor chooses Register, **Then** Sign in slides left and out while Register slides in from the right, ending with Register fully visible and focused on its first field.
2. **Given** the Register card is shown, **When** the visitor chooses Sign in, **Then** the transition runs in the opposite direction.
3. **Given** a swap has completed, **When** the visitor presses the browser Back button, **Then** the previous form is shown again with the matching transition, and the address always reflects the visible form.
4. **Given** the visitor has typed into the Sign in fields, **When** they swap to Register and back, **Then** the swap never submits anything and leaves no half-visible or overlapping cards.
5. **Given** the visitor prefers reduced motion, **When** they swap forms, **Then** the change happens with a simple fade or instant switch instead of sliding.

---

### User Story 3 - Dark mode (Priority: P2)

Any user (signed in or not) can switch the whole application between light and dark appearance. The first visit follows the device's setting; the choice is remembered on that device afterwards. Every screen, form, table, chart, status badge, and pop-up remains readable and keeps the project's status-color rules (never color alone).

**Why this priority**: High value for drivers and owners working at night or in bright sun, but it touches every screen, so it follows the login work.

**Independent Test**: Toggle dark mode on the login page and on each main screen (Dashboard, Units, Drivers, Remittances, Expenses, Documents, Sinking fund, Reports). Confirm contrast, no unreadable text, and the choice persists after reload without a flash of the wrong theme.

**Acceptance Scenarios**:

1. **Given** a first-time visitor whose device is set to dark, **When** the app loads, **Then** it appears in dark mode with no flash of light mode.
2. **Given** any screen, **When** the user uses the theme control, **Then** the whole app switches between light and dark immediately, and the control is reachable on the login page and after sign-in at a 360 px viewport.
3. **Given** the user chose a theme, **When** they reload or return later on the same device, **Then** that choice is applied.
4. **Given** dark mode is on, **When** the user views text, form controls, tables, charts, status tags, toasts, and pop-ups, **Then** all meet the project's contrast targets and status meaning is still carried by icon and label, not color alone.
5. **Given** dark mode is on, **When** the animated login background is shown, **Then** it uses a dark-appropriate palette.

---

### User Story 4 - Pop-up open and close animations (Priority: P2)

Every pop-up in the system (dialogs, confirmation dialogs, side sheets, popovers, dropdown menus, and tooltips where applicable) opens with a small, creative entrance animation (a quick scale-and-fade with a slight rise, with its backdrop fading in) and closes with a matching, slightly faster exit animation, so closing never looks like an abrupt disappearance. Animations are brief, visible, and never delay the user: content is usable immediately and a closing pop-up never blocks the next action.

**Why this priority**: Consistent polish across the whole system, but purely enhancement over working behavior.

**Independent Test**: Open and close each kind of pop-up repeatedly and rapidly (including double-clicking Close and pressing Escape) on a low-end phone profile. Confirm entrance and exit are visible, never stutter, never leave a stuck backdrop, and focus returns correctly.

**Acceptance Scenarios**:

1. **Given** any pop-up trigger, **When** the user opens it, **Then** the pop-up and its backdrop animate in within roughly a quarter of a second and are interactive right away.
2. **Given** an open pop-up, **When** the user closes it by Close, Cancel, Escape, tapping the backdrop, or completing the action, **Then** it animates out (backdrop included) and is fully removed afterwards.
3. **Given** a pop-up that is closing, **When** the user immediately reopens it or triggers another action, **Then** nothing breaks, doubles up, or ignores the second action.
4. **Given** reduced-motion preference is set, **When** pop-ups open or close, **Then** they appear and disappear with no movement (opacity change at most).

---

### User Story 5 - Save and update feedback animation (Priority: P3)

When a user saves a new record or updates an existing one (remittance, expense, unit, driver, document, sinking fund entry, and so on), the view gives a brief, minimal animation: the save action shows an in-progress state, and when the data lands the affected row or card briefly highlights (or a new row eases in) and a success indication appears, so the user can see what changed without hunting for it.

**Why this priority**: Nice confirmation feedback that depends on the shared animation language set up by the other stories.

**Independent Test**: Create and edit a record on several screens. Confirm the in-progress state shows during the save, the new or changed item is visibly highlighted for about a second, a failed save shows no success animation, and long lists do not stutter.

**Acceptance Scenarios**:

1. **Given** a user submits a create or update form, **When** the request is in flight, **Then** the submit control shows an in-progress state and cannot be submitted twice.
2. **Given** the save succeeds, **When** the view refreshes, **Then** the created or changed row/card plays a short highlight (a new item also eases in) and then settles to its normal appearance.
3. **Given** the save fails, **When** the error returns, **Then** no success animation plays and the existing error message appears with the entered data kept.
4. **Given** a list with many rows, **When** one row is saved, **Then** only that row animates and scrolling and typing elsewhere stay smooth.
5. **Given** reduced-motion preference is set, **When** a save succeeds, **Then** the change is shown with a static highlight or no animation.

---

### Edge Cases

- A user with a reduced-motion setting must never see sliding or looping background motion; the login background becomes static.
- A device that cannot sustain smooth animation (low-end phone, battery saver) must stay fully usable; animations may degrade to simple fades but never block input.
- Opening the sign-in or register page directly by address, refreshing it, or arriving through Back/Forward must show the correct card without playing a confusing transition from nothing.
- A sign-in or registration error (wrong password, awaiting approval) keeps the current card in place with its message and does not trigger a swap animation.
- Rapidly clicking between Sign in and Register must not stack cards or leave one stuck mid-slide.
- Dark mode must not hide the focus ring, validation messages, or the disabled and locked states.
- Printed pages and the Excel report outputs are not affected by dark mode; printing uses light colors.
- A signed-out visitor who reaches a pop-up-free page (login) still receives the theme control, not just signed-in pages.
- Pop-ups opened while another is closing (for example, a confirmation after a form) must not leave an orphaned backdrop or trapped scroll.

## Requirements *(mandatory)*

### Functional Requirements

**Login and registration screen**

- **FR-001**: The signed-out navigation MUST show only the Sign in and Register entries; the Ledger entry MUST NOT appear for signed-out visitors. Signed-in navigation is unchanged.
- **FR-002**: The sign-in and register screens MUST present a modern login-card layout informed by common, well-regarded login and registration designs (clear heading and helper line, labelled fields with required markers, one prominent primary action, a link to the other form, visible validation messages), while following the project's design rules and tokens.
- **FR-003**: The ROLNET logo MUST be horizontally centered above the form card at every supported viewport width, including 360 px.
- **FR-004**: An animated background MUST appear behind the form on both screens; it MUST be decorative only, MUST NOT reduce text and field legibility, and MUST become static under a reduced-motion preference.
- **FR-005**: Switching between Sign in and Register MUST NOT reload or visibly re-render the page shell. The outgoing card MUST slide out to the left and the incoming card MUST enter from the right (reversed when going back), smoothly, with the logo and background staying in place.
- **FR-006**: After a swap, the address, the page title, and browser Back/Forward MUST stay consistent with the visible form, and keyboard focus MUST land on the first field of the incoming form. Screen readers MUST be informed of the form change.
- **FR-007**: Swapping forms MUST NOT submit, clear, or otherwise alter form data, and failed sign-in or registration MUST keep the current card in place.

**Dark mode**

- **FR-008**: The application MUST offer a light and a dark appearance, and every screen (including login, registration, all signed-in screens, pop-ups, toasts, charts, tables, and status tags) MUST be fully readable and usable in both.
- **FR-009**: A theme control MUST be available on the login and register screens and on all signed-in screens, including at a 360 px viewport. It MUST be a Light/Dark switch in the header, with a "Match my device" option in a small menu that clears the saved choice and returns to following the device setting.
- **FR-010**: On first visit the appearance MUST follow the device's light/dark setting; an explicit user choice MUST be remembered on that device and applied before the first paint so there is no flash of the wrong theme.
- **FR-011**: Dark mode colors MUST define dark counterparts for every existing design token, keep text and control contrast at least equal to the light mode targets, and keep status meaning conveyed by icon and text, never color alone.
- **FR-012**: Printing and exported reports MUST remain light-themed regardless of the chosen appearance.

**Animations (shared rules)**

- **FR-013**: All animations MUST be minimal and short (entrances about 150-250 ms, exits slightly shorter), use only smooth, low-cost properties (movement, opacity, scale), and MUST NOT delay interaction or cause visible lag, jank, or layout shifts.
- **FR-014**: All animations MUST respect the user's reduced-motion preference by removing movement and looping effects.
- **FR-015**: The app MUST use one shared set of animation timings and styles across the system so the motion feels consistent, and MUST NOT add any new paid or heavy animation dependency.

**Pop-ups**

- **FR-016**: Every pop-up in the system (dialogs, confirmation dialogs, side sheets, popovers, and menus) MUST have an entrance animation, with a backdrop fade where a backdrop exists.
- **FR-017**: Every pop-up MUST have a matching exit animation for every way of closing it (Close, Cancel, Escape, backdrop tap, completed action), and the pop-up and its backdrop MUST be fully removed when the exit finishes.
- **FR-018**: Opening and closing animations MUST NOT block input: content is usable immediately on open, and a user action during a closing animation MUST be handled correctly without duplicate, stuck, or orphaned pop-ups or backdrops, and focus MUST return to the triggering control.

**Save and update feedback**

- **FR-019**: Submit controls for creating or updating data MUST show an in-progress state during the save and MUST prevent double submission.
- **FR-020**: After a successful create or update, the affected row, card, or amount MUST show a brief highlight (and new items an ease-in) that settles within about one second; only the changed element MUST animate.
- **FR-021**: A failed save MUST NOT play the success animation and MUST keep the entered data and show the existing error message.
- **FR-022**: Existing business behavior, permissions, data rules, and the money and audit rules MUST be unchanged; this feature changes presentation only.

### Key Entities

This feature changes presentation only and adds no business data.

- **Theme preference**: The user's chosen appearance (light, dark, or follow device), stored per device; no account data or database change.
- **Motion preference**: The user's reduced-motion setting from their device, which governs whether animations run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-out visitor sees zero links to screens they cannot open; the Ledger entry is absent on the sign-in and register screens in 100% of page loads.
- **SC-002**: The logo is centered above the card (left and right margins differ by no more than 2 px) at 360 px, tablet, and desktop widths.
- **SC-003**: Switching between Sign in and Register completes in under 0.6 seconds with no page reload, no visible flicker of the logo or background, and no overlapping cards, including during rapid repeated switching.
- **SC-004**: 100% of screens listed in User Story 3 are readable in dark mode, with text contrast of at least 4.5:1 and control borders of at least 3:1, verified on every main screen.
- **SC-005**: The chosen theme is applied before the first visible paint on reload in 100% of cases (no flash of the other theme).
- **SC-006**: 100% of the system's pop-ups animate on open and on close, and none is left with a stuck backdrop, locked scrolling, or lost focus after 20 rapid open/close cycles.
- **SC-007**: Pop-up content is interactive within 0.3 seconds of the open action, and animations keep the interface responsive: no frame drops noticeable on a mid-range phone while opening, closing, or saving.
- **SC-008**: After a successful save, 95% of test users identify which row or card changed within 2 seconds without scrolling or searching, and the highlight settles within about 1 second.
- **SC-009**: With a reduced-motion preference on, no sliding, scaling, or looping motion appears anywhere in the system.
- **SC-010**: No existing automated checks regress and all screens still work at a 360 px viewport.

## Assumptions

- The theme control is a Light/Dark switch with a "Match my device" menu option (see Clarifications), placed in the signed-out header and the signed-in header; the exact placement follows the existing layout.
- Theme choice is stored only on the user's device, not in the account or database, so no schema change is needed.
- "Web inspiration" for the login layout and pop-up motion is gathered during planning as research, and the final look must still follow `DESIGN.md`, which takes precedence over outside designs.
- Motion uses the project's existing component set and styling approach; no new component or animation library is added, in line with the project rules and the free-tier principle.
- The animated background is a calm, low-contrast, decorative effect (for example, slowly drifting brand-colored shapes) that pauses when the tab is hidden and is static under reduced motion.
- "All pop-ups" means every dialog, alert dialog, side sheet, popover, and dropdown menu already in the system, plus any pop-up added later through the shared components.
- Save animations apply to create and update flows on existing screens; deleting or voiding flows keep their current behavior apart from the shared pop-up exit animation.
- Charts keep their current chart patterns and legends; dark mode adjusts their colors but not their meaning.
- Supported devices are the same modern mobile and desktop browsers the system already supports.
