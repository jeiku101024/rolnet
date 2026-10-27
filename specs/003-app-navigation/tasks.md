---

description: "Dependency-ordered implementation tasks for ROLNET app navigation and menu"
---

# Tasks: App Navigation and Menu

**Input**: Design documents from `/specs/003-app-navigation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md), [quickstart.md](./quickstart.md)

**Tests**: Tests are included because the approved plan explicitly requires Vitest unit/component coverage, Playwright E2E coverage, typecheck, lint, and manual acceptance validation.

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested in priority order while preserving the plan's shared architecture.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it uses different files and does not depend on unfinished work.
- **[Story]**: Maps the task to a user story in [spec.md](./spec.md).
- Every task includes the exact repository path it changes or validates.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the configured shadcn building block without changing application behavior.

- [X] T001 Generate the official Base UI-flavored shadcn sidebar through the repository's configured CLI, review generated dependencies for free-runtime compatibility, and retain only required changes in `components/ui/sidebar.tsx`, `app/globals.css`, `package.json`, and `pnpm-lock.yaml`

**Checkpoint**: The repository contains the configured shadcn sidebar primitive and no second component or icon system.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared navigation/access model and request-scoped identity read used by every story.

**CRITICAL**: No user story implementation begins until this phase is complete.

- [X] T002 [P] Write failing table-driven tests for owner/staff/unapproved filtering, group ordering and empty-group omission, exact matching, descendant matching, and `/units-archive` false-prefix rejection in `tests/unit/navigation-items.test.ts`
- [X] T003 Implement the typed destination/group registry, permission filtering, stable ordering, and segment-safe active matcher in `lib/navigation/items.ts`, enforcing the data-model constraints: `id` is "Unique across the registry; independent of the label"; `label` is "Required and always rendered with the icon"; `href` "Must begin with `/` and must not invent a new feature route"; `group` "Must reference a defined group"; `order` is "Deterministic and unique enough to produce stable ordering"; `access` is "Evaluated against an approved `User Access Context`; never replaces the page guard"; `matchDescendants` is "`true` for current list/detail families"; group `id` is "One of `overview`, `fleet`, `operations`, or `administration`"; group `order` "Produces Overview, Fleet, Operations, Administration"; and `destinations` "Contains only destinations authorized for the current context"
- [X] T004 [P] Wrap `getSessionProfile()` in request-scoped React caching without changing `requireApprovedSession()` or `requirePermission()` outcomes in `lib/auth/guards.ts`, preserving these access-context constraints: `userId` is "Never displayed as account identity"; `displayName` is "Shown in the account footer; falls back to a neutral account label if unexpectedly empty"; `role` "Uses existing application role type"; `accountStatus` means "Authenticated navigation requires `approved`"; and permissions are "Computed from the role; not persisted by navigation"
- [ ] T005 Run the focused foundation test and type checks for `tests/unit/navigation-items.test.ts`, `lib/navigation/items.ts`, and `lib/auth/guards.ts` using `corepack pnpm test -- tests/unit/navigation-items.test.ts` and `corepack pnpm typecheck`

**Checkpoint**: A tested framework-light registry produces exactly ten owner destinations, five staff destinations, no protected destinations for unapproved contexts, and correct parent-route activation while page guards remain authoritative.

---

## Phase 3: User Story 1 - Navigate Core Fleet Work (Priority: P1) MVP

**Goal**: Give each approved role a persistent menu containing every and only the existing pages that role can access, with the current top-level or parent destination identified.

**Independent Test**: Sign in as owner and staff, inspect every visible destination, follow each link, and verify the intended existing page opens, unauthorized links are absent, and list/detail routes identify exactly one current parent destination.

### Tests for User Story 1

- [ ] T006 [P] [US1] Write failing Playwright coverage for public/unapproved navigation, the ten-item owner menu, the five-item staff menu when staff credentials are available, destination routing, and exact/detail active states in `tests/e2e/app-navigation.spec.ts`

### Implementation for User Story 1

- [ ] T007 [P] [US1] Implement reusable route-aware destination links in `components/navigation/navigation-items.tsx` using the shared registry, framework client links, visual active treatment, and `aria-current="page"`, with active state "True for exact match or segment-safe descendant match"
- [ ] T008 [US1] Build the authenticated grouped menu and account identity presentation in `components/navigation/app-sidebar.tsx`, omitting empty groups and showing the existing display name/role without exposing `userId`
- [ ] T009 [P] [US1] Replace the old public footer behavior with landing/sign-in/register-appropriate navigation in `components/navigation/public-nav.tsx`, ensuring protected fleet destinations and Logout are absent on `/login` and `/register`
- [ ] T010 [US1] Refactor the server/client shell boundary to render public or approved-profile navigation without client-side profile fetching in `components/navigation/app-shell.tsx`, preserving all page children and existing brand assets
- [ ] T011 [US1] Resolve the optional profile in the root server layout and pass only serializable access context into the shell in `app/layout.tsx`
- [ ] T012 [US1] Remove the obsolete three-link authenticated navigation implementation and its remaining imports in `components/navigation/mobile-nav.tsx` and `components/navigation/app-shell.tsx`
- [ ] T013 [US1] Run the User Story 1 unit/E2E checks in `tests/unit/navigation-items.test.ts` and `tests/e2e/app-navigation.spec.ts`, confirming existing route guards still reject unauthorized direct requests

**Checkpoint**: User Story 1 is a usable MVP: owner and staff can navigate their authorized existing pages, public visitors see only public routes, and parent active states work on detail pages.

---

## Phase 4: User Story 2 - Use Navigation at Any Screen Size (Priority: P2)

**Goal**: Present the same authorized navigation as a readily visible desktop sidebar and a fully operable off-canvas phone menu.

**Independent Test**: At 320x800 and a desktop viewport, use touch and keyboard to open, traverse, select, and dismiss the menu; verify all authorized destinations and account actions remain reachable without page-wide horizontal scrolling or covered content.

### Tests for User Story 2

- [ ] T014 [P] [US2] Add failing 320x800 Playwright scenarios for default-closed mobile state, 44-pixel trigger, scroll reachability, explicit close, Escape dismissal, focus restoration, link-selection dismissal, desktop visibility, and no page-wide horizontal overflow in `tests/e2e/app-navigation.spec.ts`

### Implementation for User Story 2

- [ ] T015 [US2] Compose `SidebarProvider`, the persistent desktop sidebar, mobile off-canvas surface, labeled trigger, close control, and main content inset in `components/navigation/app-shell.tsx`, enforcing presentation-state constraints: `desktopOpen` "Defaults open; trigger remains discoverable if closed"; `mobileOpen` "Defaults closed; closes on selection, close control, or Escape"; and `mode` means "Authentication pages force public-appropriate presentation"
- [ ] T016 [US2] Wire link selection to close the temporary menu while retaining route announcements and parent active state in `components/navigation/navigation-items.tsx`
- [ ] T017 [P] [US2] Map generated sidebar variables and responsive layout rules to the existing ROLNET canvas, surface, ink, rule, brand, muted, and focus tokens; preserve 44-pixel targets and prevent page-wide overflow in `app/globals.css`
- [ ] T018 [P] [US2] Make public navigation fit and remain keyboard/touch operable at 320 pixels without exposing protected actions in `components/navigation/public-nav.tsx`
- [ ] T019 [US2] Run the User Story 2 Playwright scenarios in `tests/e2e/app-navigation.spec.ts` at phone and desktop widths and verify focus returns to the trigger after non-navigation dismissal

**Checkpoint**: User Stories 1 and 2 work together on phone and desktop, with predictable focus, dismissal, scrolling, and content layout.

---

## Phase 5: User Story 3 - Recognize Destinations Quickly (Priority: P3)

**Goal**: Pair every authenticated destination with one consistent Lucide icon and a visible plain-language label without creating redundant assistive-technology announcements.

**Independent Test**: Compare phone and desktop menus and verify each destination uses the same icon/label pair, labels remain complete if icons are ignored or fail, and decorative icons do not enter the accessible name.

### Tests for User Story 3

- [ ] T020 [P] [US3] Add failing component assertions for visible labels, one registry-selected icon per destination, `aria-hidden` decorative icons, consistent owner/staff rendering, and text-only meaning in `tests/unit/navigation-items.test.ts`
- [ ] T021 [P] [US3] Add Playwright assertions that phone and desktop destination links retain the same accessible names and that active meaning is not color-only in `tests/e2e/app-navigation.spec.ts`

### Implementation for User Story 3

- [ ] T022 [US3] Render each registry-selected Lucide icon beside its visible label and hide only the icon from the accessibility tree in `components/navigation/navigation-items.tsx`
- [ ] T023 [US3] Apply consistent icon sizing, text wrapping, active marker/weight/background, enlarged-text resilience, and visible focus styling without icon-only default collapse in `components/navigation/app-sidebar.tsx` and `app/globals.css`
- [ ] T024 [US3] Run the User Story 3 unit and Playwright checks in `tests/unit/navigation-items.test.ts` and `tests/e2e/app-navigation.spec.ts`, including an accessibility-tree inspection that confirms labels survive without icon semantics

**Checkpoint**: User Stories 1-3 provide consistent, scannable, text-complete, accessible icon navigation across responsive presentations.

---

## Phase 6: User Story 4 - Sign Out Safely (Priority: P4)

**Goal**: Give every approved user a distinct Logout action that reports progress, redirects after confirmed success, and clearly reports failure when the session may still be active.

**Independent Test**: From desktop and mobile navigation, activate Logout, observe a pending state, confirm redirect to `/login`, verify protected routes require sign-in, and simulate provider failure to confirm a retryable plain-language error without a false signed-out state.

### Tests for User Story 4

- [ ] T025 [P] [US4] Write failing unit tests for successful sign-out redirect, already-expired session handling, provider-error failure result, and same-origin enforcement in `tests/unit/logout-action.test.ts`
- [ ] T026 [P] [US4] Add failing desktop/mobile Playwright coverage for visible separated Logout, disabled/pending repeat prevention, redirect to `/login`, and protected-route rejection after logout in `tests/e2e/app-navigation.spec.ts`

### Implementation for User Story 4

- [ ] T027 [US4] Harden the existing server action to apply same-origin validation, inspect Supabase sign-out errors, redirect only after success or an already-expired session, and return a structured plain-language failure in `app/actions/auth.ts`
- [ ] T028 [US4] Implement the icon-plus-label logout form with `idle -> pending -> error` UI behavior, retry support, and explicit "session may still be active" feedback in `components/navigation/logout-button.tsx`, enforcing: `pending` means "Server action is ending the session" and `error` means "Session may still be active and a message is visible"
- [ ] T029 [US4] Add the current display name, plain-language role, and visually separated Logout control to the authenticated footer in `components/navigation/app-sidebar.tsx`
- [ ] T030 [US4] Run the User Story 4 unit/E2E checks in `tests/unit/logout-action.test.ts` and `tests/e2e/app-navigation.spec.ts`, including direct protected-route access after successful logout

**Checkpoint**: All four user stories are functional; logout is discoverable, responsive, truthful about failure, and verified to end protected access on success.

---

## Phase 7: Polish and Cross-Cutting Validation

**Purpose**: Verify the complete feature, remove obsolete code, and record constitution/acceptance evidence.

- [ ] T031 [P] Remove unused navigation imports/styles and confirm no duplicate destination, role matrix, second icon library, paid asset, or stale mobile-footer behavior remains in `components/navigation/`, `lib/navigation/`, `app/globals.css`, and `package.json`
- [ ] T032 [P] Review all public and protected page headings/metadata for unique route-announcement context without changing domain workflows in `app/(auth)/`, `app/(operations)/`, and `app/(owner)/`
- [ ] T033 Run `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm test`, and `corepack pnpm test:e2e`, then resolve only navigation-feature regressions in `components/navigation/`, `lib/navigation/`, `app/layout.tsx`, `app/actions/auth.ts`, and `tests/`
- [ ] T034 Execute every desktop, 320x800, role, detail-route, enlarged-text, accessibility-tree, delayed-navigation, changed-account, and logout scenario from `specs/003-app-navigation/quickstart.md`
- [ ] T035 Record command results, environment mode, roles/statuses, viewports, destination counts, manual findings, and any failure traces in the implementation-validation section of `specs/003-app-navigation/quickstart.md`, explicitly confirming no schema change, permission expansion, paid service, business-record mutation, or unresolved constitution violation

**Checkpoint**: The complete feature satisfies the specification, UI contract, quickstart, and all five constitution principles.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on T001 and blocks every user story.
- **User Story 1 (Phase 3)**: Depends on T002-T005 and delivers the MVP.
- **User Story 2 (Phase 4)**: Depends on the authenticated/public shell delivered by User Story 1.
- **User Story 3 (Phase 5)**: Depends on destination links and responsive presentations from User Stories 1 and 2.
- **User Story 4 (Phase 6)**: Depends on the authenticated sidebar/footer from User Story 1; its test preparation can run in parallel with later US2/US3 work after the foundation.
- **Polish (Phase 7)**: Depends on all selected user stories.

### User Story Completion Order

```text
Setup -> Foundation -> US1 (MVP) -> US2 -> US3
                                  `-------> US4
US2 + US3 + US4 -> Polish/Full validation
```

### Within Each User Story

- Write the listed failing tests before implementing that story.
- Implement pure models/helpers before components that consume them.
- Build inner navigation/action controls before shell/footer integration.
- Run the story-specific tests and satisfy its independent test before moving to the next checkpoint.
- Preserve existing server-side guards throughout; menu visibility never substitutes for authorization.

### Parallel Opportunities

- T002 and T004 can run in parallel after T001 because they change different foundation files.
- T006 and T009 can run in parallel for User Story 1; T007 can begin once the registry is complete.
- T014, T017, and T018 can start in parallel after User Story 1.
- T020 and T021 can run in parallel before User Story 3 implementation.
- T025 and T026 can run in parallel before User Story 4 implementation.
- T031 and T032 can run in parallel after all story implementations.

---

## Parallel Examples

### User Story 1

```text
Task T006: Write role, route, and active-state E2E coverage in tests/e2e/app-navigation.spec.ts
Task T009: Implement public-only navigation in components/navigation/public-nav.tsx
```

### User Story 2

```text
Task T014: Write responsive/focus E2E coverage in tests/e2e/app-navigation.spec.ts
Task T017: Map sidebar/responsive tokens in app/globals.css
Task T018: Make public navigation responsive in components/navigation/public-nav.tsx
```

### User Story 3

```text
Task T020: Write icon/label unit assertions in tests/unit/navigation-items.test.ts
Task T021: Write responsive accessible-name assertions in tests/e2e/app-navigation.spec.ts
```

### User Story 4

```text
Task T025: Write logout action unit tests in tests/unit/logout-action.test.ts
Task T026: Write logout browser journeys in tests/e2e/app-navigation.spec.ts
```

---

## Implementation Strategy

### MVP First: User Story 1

1. Complete T001-T005.
2. Complete T006-T013.
3. Stop and run the User Story 1 independent test across owner, staff, public, list, and detail contexts.
4. Demo the role-aware desktop navigation before adding responsive refinements, icon polish, or logout.

### Incremental Delivery

1. **Foundation**: Configured shadcn sidebar, tested route registry, and request-scoped session context.
2. **US1 MVP**: Authorized grouped destinations, active route context, and public navigation.
3. **US2**: Desktop/mobile shell, focus, dismissal, scrolling, and overflow behavior.
4. **US3**: Consistent Lucide icon-plus-label presentation and accessibility semantics.
5. **US4**: Recoverable server-side logout and protected-route verification.
6. **Polish**: Full automated suite, manual quickstart, cleanup, and recorded evidence.

### Parallel Team Strategy

After T001-T005 are complete:

- One developer may deliver US1 while another prepares US4 tests because logout touches separate action/test files until footer integration.
- After US1, responsive CSS/public navigation work in US2 can proceed alongside icon/accessibility test preparation for US3.
- Changes to `components/navigation/app-sidebar.tsx`, `components/navigation/navigation-items.tsx`, or `tests/e2e/app-navigation.spec.ts` must be sequenced or merged carefully because multiple story phases intentionally extend those files.

---

## Notes

- `[P]` means different files and no dependency on an unfinished task at that point in the execution order.
- Tests are written before their corresponding implementation and should fail for the intended missing behavior.
- No task adds a database migration, new route, permission, hosted service, or client-side profile fetch.
- Generated shadcn source is reviewed and adapted to the existing ROLNET palette rather than treated as an opaque dependency.
- Commit after each task or coherent task group and stop at every checkpoint for independent validation.
