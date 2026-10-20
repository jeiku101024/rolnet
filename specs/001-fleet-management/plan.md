# Implementation Plan: Tricycle Fleet Management

**Branch**: `001-fleet-management` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-fleet-management/spec.md`

## Summary

Build a mobile-first, single-organization fleet operations application for owners and staff to
manage units, primary and backup drivers, daily remittances, expenses, maintenance, documents,
dashboard alerts, and CSV reports. Staff self-register but remain pending until an owner approves
them. Driver-profile license expiry is authoritative and must match uploaded license documents;
staff can edit remittance notes/add payments but financial facts require owner reversal. The
application is one Next.js 16.4 App Router codebase written in TypeScript, styled with Tailwind CSS
and shadcn/ui, and deployed on Cloudflare Workers through vinext. Supabase Free provides Auth,
PostgreSQL, Row Level Security, and private Storage. All schema, RLS, trigger, view, and seed changes
flow through committed Supabase CLI migrations.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 LTS; SQL for PostgreSQL migrations and pgTAP tests

**Primary Dependencies**: Next.js 16.4 App Router, React 19.3, vinext, Tailwind CSS, shadcn/ui,
`@supabase/supabase-js`, `@supabase/ssr`, Zod, React Hook Form, and a browser-side image compression
library using Canvas/Web Workers

**Storage**: Supabase PostgreSQL with all monetary values as `bigint` centavos; Supabase private
Storage buckets for receipts and compliance documents; only object paths and metadata in PostgreSQL

**Testing**: Vitest and React Testing Library for units/components, Playwright for mobile and
end-to-end flows, pgTAP through `supabase test db` for constraints/RLS, and vinext compatibility plus
Workers preview tests before release. Acceptance uses 10 non-technical participants, a 360-pixel
viewport, a 100-unit/24-month fixture, and timed expense/remittance/dashboard checks.

**Target Platform**: Modern mobile and desktop browsers; Cloudflare Workers Free using vinext;
Supabase Free in a region appropriate for the fleet

**Project Type**: Single full-stack web application with no separately deployed backend service

**Performance Goals**: Selected-month dashboard visible within 3 seconds for 100 units and 24 months
of records; routine expense entry under 90 seconds and remittance entry under 60 seconds on a phone;
CSV totals reconcile exactly to centavos

**Constraints**: Free-tier only; Workers Free limit of 100,000 dynamic requests/day, 10 ms CPU per
request, and 128 MB memory; Supabase Free 500 MB database, 1 GB Storage, and 5 GB monthly egress;
compressed image target below 300 KB; 360 px minimum viewport; RLS on every exposed table; private
buckets; soft deletion; no manual remote database edits; no outbound notifications in v1

**Scale/Scope**: One fleet, one owner role, multiple pending/approved staff accounts, acceptance
scale of 100 units, 24 months of operational history, 10 usability participants, and low concurrent
usage typical of a small fleet

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle or gate | Design evidence | Result |
|---|---|---|
| Free-Tier Sustainability | Workers Free and Supabase Free only; quotas are monitored and image uploads are compressed before direct Storage upload. | PASS |
| Monolithic Simplicity | One Next.js application; Supabase is the managed data/auth/storage dependency, not a separate custom service. | PASS |
| Data Integrity and Auditability | `bigint` centavos, constraints, transactional database functions, timestamps, actor IDs, soft deletion, immutable remittance facts, and global/per-record audit history. | PASS |
| Mobile-First, Human-Centered Operations | 360 px acceptance target, 10-participant usability run, timed workflows, shadcn/ui accessible primitives, plain-language forms, mobile Playwright journeys. | PASS |
| Compliance Document Lifecycle | Structured expiry dates, 30/7-day dashboard views, private files, supersession history, and status derivation. | PASS |
| Versioned Schema Changes | All SQL, RLS, functions, and Storage policies live in `supabase/migrations/`; `db reset` and pgTAP gate changes. | PASS |
| No Manual Database Edits | Remote changes deploy only through reviewed `supabase db push`; Dashboard editing is prohibited. | PASS |

**Post-design re-check**: PASS. The data model, contracts, and quickstart preserve every gate. vinext
is beta, so `vinext check`, Workers-runtime integration tests, and an OpenNext fallback are mandatory
release gates; this is a deployment compatibility risk, not a constitutional exception.

## Project Structure

### Documentation (this feature)

```text
specs/001-fleet-management/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── actions.md
│   ├── http.md
│   └── security.md
└── tasks.md                 # Created later by $speckit-tasks
```

### Source Code (repository root)

```text
app/
├── (auth)/login/
├── (owner)/
│   ├── dashboard/
│   ├── units/
│   ├── drivers/
│   ├── documents/
│   ├── reports/
│   ├── settings/
│   └── audit/
├── (operations)/
│   ├── remittances/
│   ├── expenses/
│   └── maintenance/
├── api/
│   ├── auth/callback/route.ts
│   └── reports/monthly/route.ts
├── actions/
└── layout.tsx

components/
├── ui/                      # shadcn/ui primitives
├── forms/
├── dashboard/
└── navigation/

lib/
├── auth/
├── supabase/
├── validation/
├── permissions/
├── money/
├── uploads/
└── reports/

supabase/
├── config.toml
├── migrations/
├── seed.sql
└── tests/
    ├── constraints/
    └── rls/

tests/
├── unit/
├── integration/
└── e2e/

public/
types/
vite.config.ts               # vinext adapter
wrangler.jsonc               # Workers configuration
next.config.ts
```

**Structure Decision**: Use a single repository-root Next.js application. Route groups separate
owner-only and staff-capable experiences without creating packages or services. Data access,
authorization, money formatting, validation, and uploads remain small focused modules under `lib/`.
Supabase migrations and database tests live beside the application but deploy to the same managed
project. No monorepo or repository abstraction is introduced.

## Complexity Tracking

No constitution violations require justification.
