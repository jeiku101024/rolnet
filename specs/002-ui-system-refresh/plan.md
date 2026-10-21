# Implementation Plan: Fleet UI System Refresh

**Branch**: `002-ui-system-refresh` | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-ui-system-refresh/spec.md`

## Summary

Refresh the ROLNET presentation layer across all existing routes so the application reads as a cohesive operations workspace instead of a sequence of centered cards. The implementation will establish shared page, toolbar, data-view, form, detail, status, and responsive patterns; replace the current thin Geist treatment with a stronger Satoshi-like sans direction while preserving the ROLNET palette; and extend the owner dashboard with bounded, permission-aware recent-data glimpses for remittances, units, expenses, maintenance, documents, and drivers.

The work is presentation-focused. Existing routes, permissions, business calculations, audit behavior, document expiry semantics, and database records remain unchanged. Dashboard recent glimpses are read-only projections of existing data and do not introduce a new persisted entity.

## Technical Context

**Language/Version**: TypeScript with React 19 and Next.js 16.4.0 conventions already used by the repository

**Primary Dependencies**: Tailwind CSS 4, existing shadcn/ui-compatible setup, class-variance-authority, lucide-react, next/font, Supabase server client, Playwright

**Storage**: Existing Supabase/PostgreSQL schema and RPCs; no new storage model required for UI refresh or dashboard glimpses

**Testing**: Existing Playwright mobile E2E suite, Vitest unit/integration setup, TypeScript typecheck, ESLint, and manual route-by-route visual/usability review

**Target Platform**: Responsive web application at 360-pixel mobile width and desktop widths supported by the existing app shell

**Project Type**: Single monolithic web application with Next.js App Router and server-rendered route pages

**Performance Goals**: Dashboard and list pages should preserve the current acceptance target of displaying the selected monthly dashboard within 3 seconds for the 100-unit/24-month dataset; recent glimpses must not cause serial data waterfalls

**Constraints**: Preserve the existing brand color roles, 44-pixel touch targets, visible keyboard focus, no page-wide horizontal scrolling, no decorative gradients or shadows, no card-only layout, existing owner/staff permissions, and free-tier/monolithic architecture

**Scale/Scope**: All existing authenticated and public routes, shared shell/navigation, existing reusable UI primitives, dashboard panels, list/table views, forms, detail views, and representative mobile/desktop states

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Free-Tier Sustainability**: PASS. No paid service, font license, or hosted design system is required; font sourcing must use a free or already available project-safe option.
- **II. Monolithic Simplicity**: PASS. Work stays within the existing application, shared components, and existing data access layer. No service or deployment boundary is added.
- **III. Data Integrity and Auditability**: PASS. UI-only changes preserve existing records, calculations, audit history, and soft-delete behavior. Dashboard glimpses are read-only.
- **IV. Mobile-First, Human-Centered Operations**: PASS. The plan explicitly covers 360-pixel layouts, bounded table overflow, touch targets, keyboard focus, plain-language states, and recovery guidance.
- **V. Compliance Document Lifecycle**: PASS. Document expiry status remains visible and gains a consistent data-view presentation; no expiry logic is changed.

## Project Structure

### Documentation (this feature)

```text
specs/002-ui-system-refresh/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-contract.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
app/
├── layout.tsx                         # Global font variables and shell entry
├── globals.css                        # Shared visual tokens, typography, layout utilities
├── (owner)/dashboard/page.tsx         # Dashboard composition and recent glimpses
├── (owner)/{units,drivers,documents}/ # Owner list/detail route adoption
├── (operations)/{remittances,maintenance,expenses}/
└── (auth)/{login,register}/           # Public page adoption

components/
├── navigation/
│   ├── app-shell.tsx
│   └── mobile-nav.tsx
├── dashboard/                         # Existing panels plus recent-data views
├── ui/                                # Shared button, table, toolbar, status, and feedback primitives
├── forms/                             # Existing forms updated to shared field/action patterns
├── maintenance/
└── audit/

lib/
├── dashboard/queries.ts               # Existing dashboard query composition; extend read-only recent data
└── ...                                # Existing domain and permission helpers remain authoritative

tests/
├── e2e/accessibility-mobile.spec.ts  # Extend 360px shell/table/action checks
├── e2e/ui-system-refresh.spec.ts     # Route and dashboard visual-behavior acceptance coverage
└── unit/                              # Shared formatting/state helper coverage where needed
```

**Structure Decision**: Keep the existing single Next.js project. Add only shared presentation primitives and dashboard projection/query composition where existing data cannot be reused directly. Keep domain-specific actions and database rules in their current locations.

## Phase 0: Research Summary

Research decisions are captured in [research.md](./research.md). The key decisions are:

1. Use the repository’s existing `components.json` and current shadcn-compatible conventions as the behavioral reference for tables, toolbars, badges, forms, and pagination; do not introduce a second component system.
2. Use a stronger Satoshi-like sans direction with a free/project-safe font source and retain a tabular data treatment for dates, plates, quantities, and peso amounts.
3. Compose dashboard glimpses from existing authorized records/query paths. Keep each glimpse bounded, independently stateful, and linked to the related full route.
4. Use CSS grid, rules, spacing, and responsive overflow to create workspace composition; avoid wrapping every section in a rounded card.

## Phase 1: Design Summary

- [data-model.md](./data-model.md) defines the non-persistent visual entities and the dashboard recent-data projection contract.
- [contracts/ui-contract.md](./contracts/ui-contract.md) defines shared page, list, form, detail, status, and dashboard-glimpse behavior across routes.
- [quickstart.md](./quickstart.md) defines the route-by-route and 360-pixel validation run.

The design has no unresolved technical clarifications and introduces no schema migration.

## Post-Design Constitution Check

- **I/II**: PASS. The design reuses the monolith, existing dependency set, and existing query/security boundaries.
- **III**: PASS. Data views and recent glimpses are read-only presentations of existing authoritative records; no money or audit calculations move into the UI.
- **IV**: PASS. Responsive behavior, focus states, 44-pixel targets, error/empty states, and 360-pixel acceptance are explicit in the contract and quickstart.
- **V**: PASS. Document expiry status remains queryable and visible in both the existing dashboard alert area and the new recent-data/navigation patterns.

## Complexity Tracking

No constitution violations or exceptions require justification.
