# Implementation Plan: App Navigation and Menu

**Branch**: `003-app-navigation` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-app-navigation/spec.md`

## Summary

Replace the current three-link mobile footer with a session-aware application shell that exposes every existing page the current user may visit. Approved users receive a responsive shadcn sidebar with grouped Lucide icon-and-label destinations, route-aware active states, an account summary, and a recoverable logout action. Unauthenticated or unapproved visitors retain a small public navigation appropriate to the landing, sign-in, and registration pages.

The shell resolves the existing session profile on the server and sends only serializable access context to the interactive navigation boundary. A single typed navigation registry maps routes to labels, icons, groups, parent-route matching, and existing permissions. The current page guards remain authoritative; menu filtering is an additional presentation layer and does not broaden access.

## Technical Context

**Language/Version**: TypeScript 5 with React 19.3 and Next.js 16.4 App Router conventions already used by the repository

**Primary Dependencies**: Existing shadcn CLI/configuration using Base UI, `@base-ui/react`, Tailwind CSS 4, `lucide-react`, Next.js `Link`/navigation hooks, Supabase SSR authentication, React Testing Library, Vitest, and Playwright

**Storage**: Existing Supabase authentication and `profiles` table; no new tables, columns, cookies owned by this feature, or migrations

**Testing**: Vitest unit/component tests, Playwright mobile E2E tests, TypeScript typecheck, ESLint, and manual keyboard/screen-size acceptance review

**Target Platform**: Responsive web application supporting a 320-pixel phone viewport through desktop layouts

**Project Type**: Single monolithic web application with server-rendered App Router pages and a bounded client component for interactive navigation

**Performance Goals**: Menu open/close and active-state updates respond within 100 ms without a network round trip; users reach any authorized top-level page in at most two interactions; navigation adds no client-side data fetch waterfall

**Constraints**: Preserve existing routes and authorization, keep text visible with icons, avoid page-wide horizontal scrolling, maintain touch-friendly targets and visible focus, show public-only navigation on authentication pages, introduce no paid service, and preserve current user changes in the working tree

**Scale/Scope**: Two roles, four navigation groups, ten owner destinations, five staff destinations under current page guards, five detail-route families, public landing/auth pages, and one logout flow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Free-Tier Sustainability**: PASS. The design reuses installed open-source dependencies and the existing authentication service. The shadcn sidebar is source code added to the monolith and requires no paid runtime.
- **II. Monolithic Simplicity**: PASS. Session resolution, navigation metadata, UI, and tests stay inside the existing application. No service, queue, or deployment boundary is introduced.
- **III. Data Integrity and Auditability**: PASS. Navigation reads session/profile data but creates or mutates no business, monetary, compliance, or audit records. Logout affects only the current authentication session.
- **IV. Mobile-First, Human-Centered Operations**: PASS. The plan requires an off-canvas phone menu, 320-pixel validation, plain labels beside icons, touch targets, keyboard support, predictable focus, and recoverable feedback.
- **V. Compliance Document Lifecycle**: PASS. The Documents destination exposes the existing protected compliance register without changing document data, expiry rules, or visibility permissions.

## Project Structure

### Documentation (this feature)

```text
specs/003-app-navigation/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- ui-contract.md
`-- checklists/
    `-- requirements.md
```

### Source Code (repository root)

```text
app/
|-- layout.tsx                         # Resolve optional session context and enter the shell
|-- actions/auth.ts                    # Report logout failure or redirect after success
`-- globals.css                        # Map sidebar tokens to the existing ROLNET palette

components/
|-- navigation/
|   |-- app-shell.tsx                  # Server/client shell composition boundary
|   |-- app-sidebar.tsx                # Authenticated grouped navigation and account footer
|   |-- navigation-items.tsx           # Route-aware links and active-state behavior
|   `-- public-nav.tsx                 # Landing/auth navigation for public visitors
`-- ui/
    |-- sidebar.tsx                    # shadcn Base UI sidebar primitive generated for this project
    `-- ...                            # Existing button/feedback primitives reused where appropriate

lib/
|-- auth/guards.ts                     # Request-scoped session-profile lookup and current guards
|-- navigation/items.ts                # Typed destination registry, filtering, and route matching
|-- navigation/page-context.ts         # Existing page labels remain aligned with navigation labels
`-- permissions/roles.ts               # Existing permission decisions remain authoritative

tests/
|-- unit/navigation-items.test.ts      # Permission filtering, grouping, and parent-route matching
`-- e2e/app-navigation.spec.ts         # Public, owner, phone, keyboard, active-state, and logout flows
```

**Structure Decision**: Keep the existing single Next.js project and root application shell. Resolve the optional user profile in the server layer, then pass the minimal profile to a client-side shadcn sidebar for pathname and open-state interactions. Keep access calculations in a framework-light library so both components and unit tests use the same registry. Do not reorganize route groups or alter page URLs.

## Phase 0: Research Summary

Research decisions are captured in [research.md](./research.md). The key decisions are:

1. Use the official shadcn Base UI Sidebar primitive with a persistent desktop presentation, off-canvas mobile behavior, scrollable grouped content, an account footer, and a trigger in the shell header.
2. Resolve the optional session profile on the server and keep pathname/open/focus behavior in the smallest practical client boundary.
3. Model all destinations in one typed registry and filter them with the existing role/permission helpers; page guards remain the security boundary.
4. Use segment-safe pathname matching (`pathname === href` or `pathname` beginning with `href + "/"`) so detail routes activate their parent destination.
5. Submit logout through the existing server action, inspect provider errors, and expose a pending/error state without pretending the session ended.

## Phase 1: Design Summary

- [data-model.md](./data-model.md) defines the non-persistent destination, group, access-context, active-state, and logout-state models.
- [contracts/ui-contract.md](./contracts/ui-contract.md) defines exact route/permission mappings and observable desktop, mobile, public, active-state, accessibility, and logout behavior.
- [quickstart.md](./quickstart.md) defines automated and manual validation at 320-pixel and desktop viewports for public, owner, and staff contexts.

The design has no unresolved technical clarifications and requires no database migration or public network API.

## Implementation Sequence

1. Generate the shadcn Base UI sidebar primitive through the repository's configured CLI and review its generated dependencies and ROLNET token mappings.
2. Add the typed destination registry, access filtering, grouping, and segment-safe active-route helper with unit coverage.
3. Make the session-profile read request-scoped and compose the root shell from server-resolved access context plus a bounded interactive sidebar.
4. Build grouped authenticated navigation, public navigation, account identity, mobile trigger/dismissal behavior, and icon-plus-label links.
5. Harden logout to surface provider failure while preserving redirect-on-success behavior.
6. Add E2E coverage and run the full quickstart validation, including phone, desktop, touch, keyboard, role, detail-route, and expired-session cases.

## Post-Design Constitution Check

- **I/II**: PASS. All generated and custom code remains in the existing monolith and uses the current free dependency set; no hosted component or additional service is introduced.
- **III**: PASS. The data model is configuration and transient UI/session state only. Existing business data, money handling, timestamps, audit history, and soft deletion are untouched.
- **IV**: PASS. The UI contract and quickstart explicitly cover 320-pixel overflow, touch targets, icon-plus-label clarity, focus order, Escape/close behavior, active state, and logout recovery.
- **V**: PASS. Document navigation points to the existing permission-protected lifecycle view, with no change to its persisted model or expiry semantics.

## Complexity Tracking

No constitution violations or exceptions require justification.

