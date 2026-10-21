# Feature Specification: Fleet UI System Refresh

**Feature Branch**: `main` (no branch hook configured)

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Improve UI on every page basing on the design specimen. We dont want centered cards ligned up only. Use Shadcn/UI as reference for data tables,etc. Also, change fonts that are so thin and so AI generic. Make it look like fonts like Satoshi, Montserrat, Poppins. Still follow the color scheme."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan Any Page as an Operations Workspace (Priority: P1)

As an owner or staff member, I want every page to share a clear workspace structure so I can quickly understand where I am, what needs attention, and which action is available without hunting through centered panels.

**Why this priority**: A consistent page structure affects every fleet workflow and reduces the cognitive load of daily operations.

**Independent Test**: Visit the dashboard, units, drivers, remittances, expenses, maintenance, documents, reports, audit, settings, and detail pages at desktop and phone widths; identify the page title, primary action, current navigation, and main data region on each page without assistance.

**Acceptance Scenarios**:

1. **Given** a user opens any authenticated page, **When** the page loads, **Then** the page presents a consistent shell with navigation, page title/context, primary action area, and a dominant content region aligned to the page rather than a stack of centered cards.
2. **Given** a user changes route, **When** the new page appears, **Then** navigation state, spacing rhythm, typography hierarchy, and action placement remain consistent while the content pattern adapts to the task.
3. **Given** a user opens a page at a 360-pixel viewport, **When** the page is used, **Then** primary content and actions remain readable and operable without accidental clipping or desktop-only interaction.
4. **Given** an owner opens the dashboard, **When** the dashboard loads, **Then** it includes concise recent-data glimpses for the major fleet areas, including remittances, units, expenses, maintenance, documents, and drivers, with each glimpse showing enough context to scan and a path to the full view.
5. **Given** a recent-data area has no records or its records cannot be loaded, **When** the dashboard is displayed, **Then** that area shows a specific empty or recoverable error state without preventing the rest of the dashboard from being used.

---

### User Story 2 - Work with Dense Fleet Data (Priority: P1)

As an owner or staff member, I want records presented in readable, scannable data views so I can compare units, drivers, remittances, expenses, maintenance items, and documents efficiently.

**Why this priority**: Fleet work depends on repeated comparison and reconciliation; data views are more useful than isolated summary cards.

**Independent Test**: Open each list page, scan its rows, apply available filters, sort or paginate when present, open a record, and return to the list while preserving the user’s context.

**Acceptance Scenarios**:

1. **Given** a list contains records, **When** the user views it, **Then** the page uses a structured table or ledger with clear column headings, aligned values, visible row separation, status labels with text and icons, and a discoverable row action or record link.
2. **Given** a table is wider than the phone viewport, **When** the user views it on a phone, **Then** the table remains usable through an intentional overflow region with its surrounding page still readable and without making the entire page unusable.
3. **Given** a user filters, sorts, searches, or changes a date period, **When** the result changes, **Then** the active state is visible, the result count or empty state is clear, and the user can remove or revise the constraint.
4. **Given** a table has no records, **When** the user opens it, **Then** the empty state explains what is missing and presents the next useful action when the user is authorized to create a record.
5. **Given** a user opens a row or detail link, **When** they return to the list, **Then** their relevant filter, period, and scroll context are not unexpectedly discarded.

---

### User Story 3 - Complete Forms and Review Details with Confidence (Priority: P1)

As an owner or staff member, I want forms and detail pages to make relationships, required fields, status, and recovery paths obvious so I can encode records accurately.

**Why this priority**: Clear forms prevent incorrect financial, maintenance, and compliance records.

**Independent Test**: Create or edit representative unit, driver, remittance, expense, maintenance, and document records at desktop and phone widths, including validation failures and optional receipt/file states.

**Acceptance Scenarios**:

1. **Given** a user opens a create or edit workflow, **When** the form loads, **Then** fields are grouped by meaning with readable labels, concise help text, required indicators, and a clearly identified primary and secondary action.
2. **Given** a user submits incomplete or invalid data, **When** validation runs, **Then** the affected fields and a summary explain what needs correction in plain language without losing valid input.
3. **Given** a user opens a record detail page, **When** the page loads, **Then** identity, current status, key totals, related records, history, and available actions are arranged as an operational detail view rather than unrelated centered cards.
4. **Given** a staff user lacks permission for an action, **When** the record or page is viewed, **Then** the restricted action is absent or clearly unavailable and the user is not led into a dead end.

---

### User Story 4 - Read the Interface as ROLNET (Priority: P2)

As an owner or staff member, I want typography and visual hierarchy to feel deliberate and brand-specific so the system is easier to read and does not look like a thin, generic AI-generated interface.

**Why this priority**: Strong typography improves scanning, confidence, and perceived quality across every workflow while retaining the established brand palette.

**Independent Test**: Compare representative pages and controls at common desktop and phone widths; verify the display, body, labels, controls, and numeric data have distinct but harmonious hierarchy and remain legible.

**Acceptance Scenarios**:

1. **Given** any page is displayed, **When** the user scans headings, labels, controls, helper text, and data, **Then** the type hierarchy uses a sturdy geometric or humanist sans style comparable to Satoshi, Montserrat, or Poppins, with visibly stronger weight and less fragile-looking text than the current presentation.
2. **Given** a page displays dates, plate numbers, quantities, balances, or peso values, **When** the user compares rows, **Then** numeric values align consistently and remain distinguishable from prose.
3. **Given** the refreshed interface uses emphasis, warning, success, or danger states, **When** the user reads the state, **Then** it retains the existing color semantics and includes a text label or icon so color is never the only signal.
4. **Given** a user navigates through the application, **When** the page changes, **Then** the established ROLNET yellow, navy, warm canvas, surface, rule, muted, and status colors remain recognizable and accessible.

### Edge Cases

- A table has very long unit names, driver names, document types, notes, or file names; the layout must preserve row actions and provide a readable way to inspect the full value.
- A table has many columns at a 360-pixel viewport; the data region must scroll intentionally without causing the page header, navigation, or primary actions to become unusable.
- A page has no data, filtered-out data, loading data, or a failed data request; each state must explain the state and the next available action.
- A user has a long validation error, an expired document, a missing receipt, an unpaid balance, or a due maintenance item; the message must remain legible and must not depend on color alone.
- A user increases browser text size or uses keyboard navigation; content must remain readable, focused, and operable.
- A page must show both a primary action and a destructive or secondary action; the hierarchy must prevent accidental activation.
- A route has a detail page with related records; the relationship and path back to the parent list must remain apparent on phone and desktop.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST apply one shared page-workspace pattern to all existing pages, including dashboards, list pages, forms, detail pages, reports, audit views, settings, authentication pages, and the mobile navigation entry point.
- **FR-002**: Each page MUST expose its title or purpose, current location, primary action when authorized, and main content region in a predictable visual hierarchy.
- **FR-003**: List and ledger pages MUST prioritize structured data regions with headings, aligned columns or fields, visible row separation, row-level navigation or actions, and explicit loading, empty, filtered-empty, and error states.
- **FR-004**: Data regions MUST support the applicable combination of search, filtering, date period selection, sorting, pagination, row navigation, and result feedback without requiring users to infer hidden state.
- **FR-005**: Tables MUST remain usable on phone-sized screens through intentional responsive behavior; no workflow may require horizontal scrolling across the entire page or rely on hover to reveal essential information.
- **FR-006**: Forms MUST use consistent field grouping, labels, required-state communication, helper text, validation feedback, submission feedback, and mobile-sized touch targets.
- **FR-007**: Detail pages MUST establish a clear relationship between the record identity, current status, key values, related records, history, and authorized actions.
- **FR-008**: The visual system MUST use the existing ROLNET color roles and preserve their meanings: yellow for brand emphasis and primary actions, navy and ink for text and structural emphasis, warm canvas for the page surface, rules for separation, and distinct status colors for success, warning, and danger.
- **FR-009**: The visual system MUST replace the current thin, generic-feeling type treatment with a stronger, readable sans-serif direction comparable to Satoshi, Montserrat, or Poppins; type weight, line height, and contrast MUST distinguish headings, body text, labels, controls, metadata, and data.
- **FR-010**: Numeric, currency, date, plate, and other reconciliation-oriented values MUST use a consistent scanning treatment with tabular alignment while remaining visually compatible with the primary type family.
- **FR-011**: The application MUST use rules, spacing, grouping, and hierarchy as the primary means of separation; it MUST NOT require every content group to be enclosed in a rounded card, and decorative gradients or ornamental shadows MUST NOT be introduced.
- **FR-012**: Reusable table, toolbar, filter, pagination, badge, form, dialog, and navigation patterns MUST have consistent states for default, hover, focus, disabled, loading, success, warning, danger, and error conditions.
- **FR-013**: All interactive controls MUST provide visible keyboard focus, accessible names, touch targets of at least 44 pixels, and status communication that does not rely on color alone.
- **FR-014**: The refreshed pages MUST preserve existing fleet data, permissions, routes, business rules, auditability, document expiry visibility, and mobile-first requirements; this feature changes presentation and interaction clarity, not domain meaning.
- **FR-015**: The refreshed interface MUST be reviewed against the design specimen and representative pages from every existing route before acceptance, including the shared navigation component.
- **FR-016**: The owner dashboard MUST show concise recent-data glimpses for remittances, units, expenses, maintenance, documents, and drivers, using the same readable data-view patterns as their full pages.
- **FR-017**: Each dashboard recent-data glimpse MUST show a useful time or status context, a bounded number of the most recent records, an empty or recoverable error state, and a clear link or action to view the complete related data set.
- **FR-018**: Dashboard recent-data glimpses MUST respect the current user’s permissions and MUST not expose records or actions that the user cannot access in the corresponding full view.

### Key Entities

- **Page Workspace**: The shared arrangement of navigation, page context, actions, data or form region, supporting information, and responsive behavior used across routes.
- **Data View**: A table or ledger presentation of fleet records with headings, row states, filters, sorting, navigation, and responsive behavior.
- **Form View**: A create or edit presentation with grouped fields, validation, actions, and recovery guidance.
- **Detail View**: A record presentation that connects identity, status, key values, related records, history, and authorized actions.
- **Visual Token**: A shared color, type, spacing, rule, radius, focus, or status role that keeps the interface coherent across pages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a review of every existing route, 100% of pages expose a recognizable title/context, current navigation, primary action where applicable, and dominant content region using the shared workspace pattern.
- **SC-002**: In a repeatable usability run with 10 non-technical participants at a 360-pixel viewport, at least 90% can locate the primary action and complete one representative list, detail, and form workflow without assistance.
- **SC-003**: At least 90% of participants can correctly identify the meaning of a success, warning, danger, missing-receipt, and unpaid state without relying on color alone.
- **SC-004**: Participants can locate a requested record from each major list page and open its detail view within 30 seconds in at least 9 of 10 trials.
- **SC-005**: All representative pages remain usable at 360 pixels without clipped primary actions, inaccessible controls, or horizontal scrolling of the overall page; tables may use a bounded, intentional overflow region where required.
- **SC-006**: A visual review confirms the refreshed type treatment is visibly heavier and more distinctive than the current thin treatment while preserving readable body text, aligned data, and the established color scheme on all representative pages.
- **SC-007**: At least 95% of keyboard focus transitions across representative pages are visible, sequential, and associated with the correct control; all primary actions have accessible names.
- **SC-008**: Existing business outcomes remain unchanged: no permission, record, calculation, expiry, audit, or route acceptance test regresses as a result of the presentation refresh.
- **SC-009**: In dashboard usability testing, at least 9 of 10 participants can identify the latest relevant remittance, unit, expense, maintenance, document, and driver activity and reach its full view within 30 seconds per area.

## Assumptions

- The existing [DESIGN.md](../../DESIGN.md) is the source of truth for the ROLNET color palette, logo usage, accessibility intent, and operations-ledger character; this feature refines typography and page composition within that direction.
- “Use Shadcn/UI as reference” means adopt the recognizable behavior and information density of accessible data tables, toolbars, filters, badges, forms, and pagination; it does not require copying a theme or changing business behavior.
- Satoshi is the preferred visual direction when available; Montserrat or Poppins may be used as a comparable fallback direction if licensing, loading, or project constraints require it.
- The existing routes, data model, permissions, and business rules remain in scope and are not redesigned as part of this feature.
- Mobile-first acceptance continues to use a 360-pixel viewport and includes keyboard and text-scaling checks where applicable.
- The existing shared navigation and layout components are included in the review because a page-wide refresh is incomplete if the shell remains visually inconsistent.

## Constitution Compliance

- **IV. Mobile-First, Human-Centered Operations**: Explicitly covered by FR-005, FR-006, FR-013, SC-002, SC-005, and SC-007.
- **III. Data Integrity and Auditability**: Preserved by FR-014 and SC-008; the feature changes presentation, not record or audit behavior.
- **V. Compliance Document Lifecycle**: Preserved by FR-014 and the detail/data-view requirements for expiry and status visibility.
- **I/II. Free-Tier Sustainability and Monolithic Simplicity**: No new paid service, deployment boundary, or persistence requirement is introduced.
