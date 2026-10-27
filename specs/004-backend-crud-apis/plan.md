# Implementation Plan: Backend CRUD APIs

**Branch**: `004-backend-crud-apis` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-backend-crud-apis/spec.md`

## Summary

Add a versioned, same-origin JSON backend under `app/api/v1/` for the 15 lifecycle-aware fleet
entities. Explicit Route Handlers will adapt HTTP requests to shared, server-only domain services;
the existing Server Actions and Server Components will call those services directly rather than
making internal HTTP requests. Services will use the caller's Supabase session so row-level security
remains the final authorization boundary. Ordered migrations will add missing transactional
operations, concurrency/idempotency data, restoration checks, complete audit capture, and indexes.

## Technical Context

**Language/Version**: TypeScript 5 in strict mode, SQL/PL/pgSQL, Node.js 24 LTS

**Primary Dependencies**: Next.js 16.4 App Router/Route Handlers, React 19.3, `@supabase/ssr` 0.7,
`@supabase/supabase-js` 2.57, Zod 4; no new runtime dependency

**Storage**: Supabase PostgreSQL plus existing private Supabase Storage buckets for receipts and
compliance documents

**Testing**: Vitest 3 for helpers/services, route-level integration tests with mocked request
boundaries, pgTAP/Supabase database tests for constraints/functions/RLS, Playwright for authenticated
end-to-end and mobile recovery journeys, and vinext compatibility/build checks

**Target Platform**: One Cloudflare Workers deployment through vinext, backed by one Supabase Free
project; local Next.js and local Supabase for development

**Project Type**: Full-stack web application using a same-origin backend-for-frontend

**Performance Goals**: With 100 units and 24 months of records, 95% of ordinary list/detail requests
available to the consuming screen within 1 second and all within 3 seconds

**Constraints**: Free-tier only; one deployable monolith; no service-role key for routine requests;
integer-centavo money; business-record soft deletion; private uploads; stable JSON errors; dynamic
requests kept within the existing Workers CPU budget; no cross-origin public developer API

**Scale/Scope**: 15 lifecycle-aware entities, two roles, one small fleet, page size 25 by default
and 100 maximum, approximately 100 units and 24 months of operational history

## Constitution Check

*GATE: Passed before research and passed again after Phase 1 design.*

| Principle / gate | Pre-design evaluation | Post-design evaluation |
|------------------|-----------------------|------------------------|
| Free-Tier Sustainability | PASS: reuses installed dependencies, Workers, PostgreSQL, and private Storage. | PASS: no paid service or new runtime dependency; pagination and direct Storage uploads protect quotas. |
| Monolithic Simplicity | PASS: Route Handlers remain in the existing application. | PASS: explicit handlers plus shared services avoid a second backend and avoid a generic framework. |
| Data Integrity and Auditability | PASS: exact money, transactions, soft deletion, version checks, and audit attribution are required. | PASS: migrations add narrow transactional functions, full audit triggers, retry keys, and restore guards. |
| Mobile-First Operations | PASS: stable plain-language errors support existing phone workflows. | PASS: quickstart includes 360 px recovery and usability checks; no new desktop-only workflow. |
| Compliance Document Lifecycle | PASS: document expiry and current/superseded/void state remain explicit. | PASS: renewal is atomic, holder/type uniqueness remains enforced, and files remain private. |
| Ordered migrations | PASS: every persistence change is planned as a committed migration. | PASS: clean reset, database tests, generated types, and dry-run deployment are release gates. |

No constitutional exceptions are required.

## Project Structure

### Documentation (this feature)

```text
specs/004-backend-crud-apis/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── http-api.md
└── tasks.md                 # generated later by /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── api/
│   ├── auth/callback/route.ts
│   ├── reports/monthly/route.ts
│   └── v1/
│       ├── <resources>/route.ts
│       ├── <resources>/[id]/route.ts
│       └── <resources>/[id]/<transition>/route.ts
└── actions/                 # thin adapters to shared domain services

lib/
├── api/
│   ├── errors.ts
│   ├── request.ts
│   ├── response.ts
│   └── pagination.ts
├── auth/
├── domain/                  # server-only query/mutation services grouped by fleet area
├── permissions/
├── supabase/
└── validation/              # shared Zod input/query schemas

supabase/
├── migrations/              # audit, indexes, idempotency, restore/correction/transition RPCs
└── tests/
    ├── constraints/
    └── rls/

tests/
├── unit/
├── integration/api/
└── e2e/

types/
└── database.ts              # regenerated after migrations
```

**Structure Decision**: Keep the current single Next.js application. Route files only translate
HTTP concerns; authorization-aware domain services and DTOs are shared with Server Actions and
direct Server Component reads. Explicit resource routes are preferred over a catch-all table router
because entity permissions and lifecycle invariants differ materially.
