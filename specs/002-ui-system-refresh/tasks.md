# Tasks: Fleet UI System Refresh

**Input**: Design documents from `/specs/002-ui-system-refresh/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md), [quickstart.md](./quickstart.md)

**Organization**: Tasks are grouped by user story so each story can be implemented and reviewed as an independent increment after the shared foundation is complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the shared implementation surface and verify the current project conventions before changing route presentation.

- [X] T001 Read the repository’s current Next.js guidance in `node_modules/next/dist/docs/` and record any route/layout constraints relevant to the refresh in `specs/002-ui-system-refresh/research.md`
- [X] T002 [P] Inventory the existing route, component, visual-token, and dashboard-query consumers in `app/`, `components/`, `lib/dashboard/`, and `app/globals.css`; record the final ownership map in `specs/002-ui-system-refresh/plan.md`
- [X] T003 [P] Define the shared page-workspace, data-view, form-view, detail-view, status, and dashboard-glimpse acceptance checklist in `specs/002-ui-system-refresh/contracts/ui-contract.md`
- [X] T004 [P] Confirm the project-safe font source and available weights for the stronger Satoshi/Montserrat/Poppins-like direction, documenting the chosen fallback order in `app/layout.tsx` and `specs/002-ui-system-refresh/research.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared visual and interaction primitives that every page and story depends on.

**CRITICAL**: User-story work should not begin until this phase is complete.

- [X] T005 Update the global font variables, weight mapping, data-font treatment, and type scale in `app/layout.tsx` and `app/globals.css` so headings, body text, labels, controls, metadata, and numeric data have explicit hierarchy without changing the ROLNET color tokens
- [X] T006 Replace centered max-width/card-only shell assumptions with shared workspace, page-header, section-rule, responsive-grid, bounded-table-overflow, and focus/touch utilities in `app/globals.css`
- [X] T007 [P] Create shared status/badge and state-display primitives for loading, empty, filtered-empty, success, warning, danger, missing-receipt, unpaid, and error states in `components/ui/feedback.tsx`
- [X] T008 [P] Create shared table/data-view primitives with semantic headings, aligned cells, row links/actions, bounded mobile overflow, and no-data/loading/error states in `components/ui/data-table.tsx`
- [X] T009 [P] Create shared page-header, toolbar/filter, and responsive action-group primitives in `components/ui/page-header.tsx`, `components/ui/data-toolbar.tsx`, and `components/ui/action-group.tsx`
- [X] T010 [P] Update the shared button primitive in `components/ui/button.tsx` to preserve the brand variants while enforcing the refreshed typography, focus visibility, accessible disabled state, and 44-pixel touch target contract
- [X] T011 Update the shared application shell and mobile navigation in `components/navigation/app-shell.tsx` and `components/navigation/mobile-nav.tsx` to expose consistent route context, active navigation, and workspace alignment
- [X] T012 Add shared route-to-title/navigation metadata and permission-aware action helpers in `lib/navigation/page-context.ts` for use by list, form, detail, and dashboard pages

**Checkpoint**: Shared type, spacing, state, table, toolbar, action, shell, and navigation primitives are available without changing domain behavior.

---

## Phase 3: User Story 1 - Scan Any Page as an Operations Workspace (Priority: P1) 🎯 MVP

**Goal**: Give every page a consistent workspace structure and extend the owner dashboard with recent-data glimpses for the major fleet areas.

**Independent Test**: At desktop and 360-pixel widths, visit all authenticated and public routes; identify title/context, navigation, primary action, and dominant content region. On the owner dashboard, identify and open recent remittance, unit, expense, maintenance, document, and driver activity.

### Implementation for User Story 1

- [X] T013 [P] [US1] Create the shared workspace page composition and route-aware header usage in `components/navigation/app-shell.tsx` and `components/ui/page-header.tsx`, keeping public/auth pages and authenticated pages visually coherent
- [X] T014 [P] [US1] Add bounded dashboard recent-data projection types and local loading/empty/error state handling in `components/dashboard/recent-data-glimpse.tsx`
- [X] T015 [US1] Extend the authorized dashboard read model in `lib/dashboard/queries.ts` to provide bounded recent remittances, units, expenses, maintenance, documents, and drivers without new persistence or client-side permission bypasses
- [X] T016 [US1] Render recent-data glimpses alongside the existing monthly summary, expiry, due-maintenance, and unpaid-balance panels in `app/(owner)/dashboard/page.tsx`, with independent failure isolation and links to the full views
- [X] T017 [US1] Refactor dashboard loading and ready states to use the shared workspace/state primitives in `app/(owner)/dashboard/page.tsx` and `components/dashboard/`, preserving the existing three-second dashboard target
- [X] T018 [US1] Adopt the shared page header and workspace layout on owner dashboard, reports, audit, staff settings, login, register, and home entry routes in `app/(owner)/dashboard/page.tsx`, `app/(owner)/reports/page.tsx`, `app/(owner)/audit/page.tsx`, `app/(owner)/settings/staff/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, and `app/page.tsx`

**Checkpoint**: The dashboard and all route shells provide the refreshed workspace structure; dashboard glimpses are independently scannable and permission-aware.

---

## Phase 4: User Story 2 - Work with Dense Fleet Data (Priority: P1)

**Goal**: Make fleet records scannable through consistent data tables/ledgers, toolbars, filters, row navigation, and responsive behavior.

**Independent Test**: Open every major list page, scan rows and headings, use available filters/date periods, open a row, return to the list, and verify empty/loading/error states at desktop and 360-pixel widths.

### Implementation for User Story 2

- [X] T019 [P] [US2] Convert the units list to the shared data-view, page-header, and action patterns while preserving owner-only mutations in `app/(owner)/units/page.tsx` and `components/forms/unit-form.tsx`
- [X] T020 [P] [US2] Convert the drivers list to the shared data-view, status, and row-navigation patterns while preserving license-state semantics in `app/(owner)/drivers/page.tsx` and `components/forms/driver-form.tsx`
- [X] T021 [P] [US2] Convert the remittances list to the shared ledger/data-view pattern with aligned peso/date values and payment/balance states in `app/(operations)/remittances/page.tsx` and `components/forms/remittance-form.tsx`
- [X] T022 [P] [US2] Convert the expenses list to the shared data-view pattern with category, amount, date, receipt, and empty/error states in `app/(operations)/expenses/page.tsx` and `components/forms/expense-form.tsx`
- [X] T023 [P] [US2] Convert the maintenance list and unit maintenance detail to the shared data-view pattern with due-state labels and bounded mobile overflow in `app/(operations)/maintenance/page.tsx`, `app/(operations)/maintenance/[unitId]/page.tsx`, `components/maintenance/parts-list.tsx`, and `components/maintenance/tire-positions.tsx`
- [X] T024 [P] [US2] Convert the documents list and document detail to the shared data-view pattern with expiry status, file context, and owner-only actions in `app/(owner)/documents/page.tsx` and `app/(owner)/documents/[id]/page.tsx`
- [X] T025 [P] [US2] Convert reports and audit records to the shared data-view pattern with period/result context and audit-safe record links in `app/(owner)/reports/page.tsx`, `app/(owner)/audit/page.tsx`, and `components/audit/audit-history.tsx`
- [X] T026 [US2] Add or refine list-page filter/search/date-period and result-state presentation using `components/ui/data-toolbar.tsx` and the applicable route pages, ensuring active constraints are visible and removable without inventing unsupported domain filters
- [X] T027 [US2] Verify all converted tables preserve row/detail navigation context and use bounded overflow or a compact alternative at 360 pixels in `components/ui/data-table.tsx` and the affected list pages

**Checkpoint**: Every major fleet list is table/ledger-first, responsive, status-readable, and independently navigable without changing its domain query or permission rules.

---

## Phase 5: User Story 3 - Complete Forms and Review Details with Confidence (Priority: P1)

**Goal**: Make create/edit and detail workflows easier to understand, validate, and recover from across the fleet domain.

**Independent Test**: Create or edit representative unit, driver, remittance, expense, maintenance, and document records at desktop and 360-pixel widths; trigger validation failures and permission-restricted states; verify valid input and recovery guidance remain available.

### Implementation for User Story 3

- [X] T028 [P] [US3] Establish shared form field grouping, label, helper-text, required-state, validation-summary, and action-group patterns in `components/ui/form-field.tsx`, `components/ui/validation-summary.tsx`, and `components/ui/action-group.tsx`
- [X] T029 [P] [US3] Refactor unit, driver, remittance, expense, document, part, tire, and report forms to use the shared field/action patterns without changing validation schemas or server actions in `components/forms/unit-form.tsx`, `components/forms/driver-form.tsx`, `components/forms/remittance-form.tsx`, `components/forms/expense-form.tsx`, `components/forms/document-form.tsx`, `components/forms/part-replacement-form.tsx`, `components/forms/tire-installation-form.tsx`, and `components/forms/report-export-form.tsx`
- [X] T030 [P] [US3] Refactor unit and driver detail pages to show identity, current status, key values, assignments, related records, history, and authorized actions in `app/(owner)/units/[id]/page.tsx` and `app/(owner)/drivers/[id]/page.tsx`
- [X] T031 [P] [US3] Refactor remittance detail pages to show service context, due/paid/balance values, payment history, notes, and role-appropriate actions in `app/(operations)/remittances/[id]/page.tsx`
- [X] T032 [P] [US3] Refactor document and maintenance detail pages to show status, expiry/due context, related unit/driver, history, and authorized actions in `app/(owner)/documents/[id]/page.tsx` and `app/(operations)/maintenance/[unitId]/page.tsx`
- [X] T033 [US3] Ensure validation, upload, missing-receipt, expired-document, unpaid-balance, and permission-restricted states use plain-language feedback and preserve valid form input in `components/ui/feedback.tsx`, `components/ui/validation-summary.tsx`, and the affected form/detail pages

**Checkpoint**: Representative forms and detail pages expose relationships, statuses, actions, and recovery guidance at desktop and phone widths without domain-rule changes.

---

## Phase 6: User Story 4 - Read the Interface as ROLNET (Priority: P2)

**Goal**: Apply the stronger brand-specific typography and visual hierarchy consistently across all routes and shared components.

**Independent Test**: Compare representative public, dashboard, list, form, detail, report, audit, and settings pages at desktop and phone widths; verify headings, controls, body copy, metadata, and numeric data have distinct readable hierarchy while the existing color scheme remains recognizable.

### Implementation for User Story 4

- [X] T034 [US4] Apply the selected stronger font family, explicit weights, and font loading/fallback behavior across the root document in `app/layout.tsx`, ensuring the project remains free to run and avoids the previous thin generic treatment
- [X] T035 [P] [US4] Replace hard-coded typography, arbitrary spacing, and ad hoc color classes with shared tokens/utilities in `app/globals.css`, `components/`, and all affected `app/` route pages
- [X] T036 [P] [US4] Apply consistent tabular numeric styling to peso amounts, dates, plate numbers, mileage, counts, and report values in `app/globals.css`, `lib/money/centavos.ts`, and affected data-view components
- [X] T037 [P] [US4] Review and adjust status icon/label pairings, focus rings, disabled states, and contrast-preserving brand/status usage in `components/ui/feedback.tsx`, `components/ui/button.tsx`, and affected route components
- [X] T038 [US4] Remove remaining centered card-only compositions, decorative shadows, gradients, decorative all-caps labels, and color-only status communication from `app/`, `components/`, and `app/globals.css` while preserving intentional containers where they improve grouping

**Checkpoint**: The complete application reads as one deliberate ROLNET interface with stronger typography, preserved palette, visible hierarchy, and no generic card-stack drift.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete refresh against the spec, preserve domain behavior, and resolve responsive/accessibility regressions.

- [X] T039 [P] Add route-level mobile and keyboard acceptance coverage for workspace headers, primary actions, bounded tables, focus visibility, and status labels in `tests/e2e/ui-system-refresh.spec.ts`
- [X] T040 [P] Add dashboard acceptance coverage for all six recent-data glimpse categories, full-view links, permission visibility, local empty states, and isolated error states in `tests/e2e/ui-system-refresh.spec.ts`
- [X] T041 [P] Add focused unit coverage for dashboard glimpse mapping and state normalization in `tests/unit/dashboard-recent-data.test.ts`
- [ ] T042 Run the existing business and security regression suites for permissions, dashboard queries, document expiry, remittances, expenses, maintenance, and audit behavior in `supabase/tests/`, `tests/e2e/`, and `tests/unit/`
- [ ] T043 Run `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm test`, and `corepack pnpm test:e2e`; resolve any regressions in the affected source files
- [ ] T044 Perform the complete desktop and 360×800 manual route review defined in `specs/002-ui-system-refresh/quickstart.md`, recording results and screenshots/traces for failures
- [X] T045 Confirm the implementation does not add paid dependencies, schema migrations, new persistence, permission bypasses, or changes to monetary/document/audit business rules in `specs/002-ui-system-refresh/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependency; establishes conventions and acceptance contracts.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories because every story consumes the shared primitives and tokens.
- **User Story 1 (Phase 3)**: Depends on Foundational. It is the MVP because it establishes the page workspace and dashboard glimpse behavior.
- **User Story 2 (Phase 4)**: Depends on Foundational and should integrate with the shared primitives from US1; list pages remain independently testable.
- **User Story 3 (Phase 5)**: Depends on Foundational and can proceed after the shared action/state patterns exist; it may reuse US2 detail navigation.
- **User Story 4 (Phase 6)**: Depends on Foundational and is best completed after representative pages from US1–US3 exist so typography and spacing can be tuned globally.
- **Polish (Phase 7)**: Depends on all desired user stories being implemented.

### User Story Dependencies

- **US1 (P1)**: No dependency on another story after Foundational; MVP.
- **US2 (P1)**: No domain dependency on US1, but shares its page/data-view primitives.
- **US3 (P1)**: No domain dependency on US2, but reuses shared navigation and data/detail patterns.
- **US4 (P2)**: Cross-cutting; can begin after Foundational but final review depends on representative US1–US3 screens.

### Parallel Opportunities

- T002–T004 can run in parallel during Setup.
- T007–T010 can run in parallel during Foundational; T011–T012 follow their relevant primitives.
- Within US1, T013–T014 and T018 can proceed in parallel; T015 precedes T016.
- Within US2, T019–T025 can proceed in parallel by route owner; T026–T027 follow shared data-view adoption.
- Within US3, T028–T032 can proceed in parallel after the shared field/action patterns are agreed; T033 follows integration.
- Within US4, T035–T037 can proceed in parallel after T034 establishes the font variables.
- T039–T041 can proceed in parallel during Polish.

## Parallel Example: User Story 1

```text
Developer A: T013 shared workspace/header adoption in components/navigation/ and components/ui/
Developer B: T014 dashboard glimpse state/view in components/dashboard/recent-data-glimpse.tsx
Developer C: T015 dashboard read model extension in lib/dashboard/queries.ts
Developer D: T018 public/owner route shell adoption in the listed app/**/page.tsx files
After T015: integrate T016 in app/(owner)/dashboard/page.tsx and validate T017.
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup and Phase 2 shared primitives.
2. Complete Phase 3 US1, including dashboard recent-data glimpses.
3. Validate every route shell and the dashboard independently at desktop and 360 pixels.
4. Stop for review/demo before converting every domain list and form.

### Incremental Delivery

1. Deliver shared foundation plus US1 as the workspace/dashboard MVP.
2. Add US2 list/ledger views and validate dense data scanning.
3. Add US3 forms/detail views and validate recovery and permission states.
4. Add US4 typography/polish across all representative pages.
5. Run Phase 7 regression and quickstart validation before release.

## Notes

- Every task follows the required checklist format and includes an exact repository path.
- Dashboard recent-data glimpses are read-only and must not duplicate domain calculations or weaken authorization.
- No schema migration is expected for this feature.
