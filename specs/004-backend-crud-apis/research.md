# Phase 0 Research: Backend CRUD APIs

## HTTP Surface and Versioning

**Decision**: Expose JSON Route Handlers under `/api/v1`. Use explicit collection, item, and
lifecycle-transition routes rather than a generic table name dispatcher. GET handlers remain
dynamic and private; no authenticated response is cached publicly.

**Rationale**: Next.js 16.4 defines Route Handlers as public HTTP endpoints and supports the needed
methods through Web Request/Response APIs. A version prefix stabilizes first-party clients. Explicit
routes make the permission matrix and immutable fields reviewable.

**Alternatives considered**: A separate REST service violates the monolith principle; a generic
catch-all CRUD handler makes authorization and audit review unsafe; Server Actions alone do not meet
the requested JSON API surface.

## Shared Domain Boundary

**Decision**: Refactor business operations into `server-only` domain services called by both Route
Handlers and existing Server Actions. Server Components continue reading from the domain/data layer
directly, never by fetching the application's own API.

**Rationale**: Bundled Next.js guidance recommends a centralized data-access layer, DTOs, and direct
data access from Server Components because self-fetching adds a network round trip and can fail at
build time. A shared service prevents API and form behavior from drifting.

**Alternatives considered**: Calling Server Actions from handlers couples HTTP to React transport;
calling Route Handlers from Server Components adds latency; duplicating logic would produce two
authorization and validation paths.

## Authentication, Authorization, and Request Origin

**Decision**: Authenticate with the existing Supabase cookie session, require an approved profile,
check the resource permission in the domain service, return role-specific DTOs, and use the same
user-scoped Supabase client so RLS remains enforced. Require same-origin validation for every unsafe
method. Do not enable cross-origin credentials or broad CORS.

**Rationale**: Route Handlers are public attack surfaces even when only the first-party app uses
them. Guard + service permission + RLS provides defense in depth; DTOs prevent over-returning owner
or storage data.

**Alternatives considered**: UI-only permissions are not security; service-role queries bypass RLS;
API keys and public CORS are unnecessary for the stated first-party scope.

## HTTP Semantics and Error Contract

**Decision**: Use POST for creation and named transitions, GET for reads, PATCH for partial updates,
and DELETE for soft deletion/reversal where allowed. Success responses use `{ data, meta? }`; errors
use `{ error: { code, message, fieldErrors?, current? } }`. Map validation to 400, authentication to
401, authorization to 403, hidden/missing resources to 404, conflicts/stale versions to 409, and
unexpected failures to a generic 500.

**Rationale**: The shape is easy for the current application to consume and retains plain-language
recovery guidance without leaking database messages.

**Alternatives considered**: Returning raw provider errors leaks internals; always returning 200
makes client recovery and monitoring ambiguous; PUT implies complete replacement and is a poor fit
for protected immutable fields.

## Pagination, Filtering, and Relationships

**Decision**: Use deterministic offset pagination with `page` (1-based), `pageSize` (25 default,
100 maximum), a resource allow-list for `sort`/`direction`, and resource-specific filter schemas.
Always add the primary key as a tie-breaker. Relationship expansion is an allow-listed `include`
parameter and DTOs control fields.

**Rationale**: The fleet is intentionally small and bounded, making offset pagination simpler and
adequate while still producing stable pages for an unchanged dataset. Allow-lists prevent arbitrary
column exposure.

**Alternatives considered**: Cursor pagination is stronger for rapidly changing feeds but adds
per-resource token and compound-sort complexity without a current scale need; unbounded lists risk
memory, egress, and slow mobile responses.

## Concurrency and Safe Retries

**Decision**: Return an ETag derived from `updated_at` for mutable item reads and require `If-Match`
on PATCH, DELETE, restore, and correction requests. Require a UUID `Idempotency-Key` header for
financial creates and upload finalization. Reuse existing table keys and add missing document and
receipt-finalization keys through migration.

**Rationale**: Conditional writes give standard stale-edit behavior. Persisted idempotency identities
ensure network retries return the first logical result rather than duplicate money or attachments.

**Alternatives considered**: Last-write-wins violates the specification; process-memory retry caches
do not survive Workers isolates; accepting keys without storing them gives no durable guarantee.

## Transaction and Audit Boundary

**Decision**: Keep simple single-row operations on the user-scoped client. Implement narrow database
functions for document renewal/license synchronization, tire replacement, payment correction,
remittance reversal/restoration, backup coverage, receipt/document finalization, and mileage
recalculation. Add a safe audit trigger for every business table and exclude secrets/private object
paths from `changed_fields`.

**Rationale**: PostgreSQL is the only reliable transaction boundary across related rows. The current
schema timestamps mutations but does not write a complete audit event for ordinary changes, so the
constitution requires closing that gap.

**Alternatives considered**: Sequential client calls can partially commit; one dynamic SQL function
for all tables would be harder to secure; application-only audit calls can be bypassed.

## Schema and Type Evolution

**Decision**: Add only fields and indexes required by the contract: missing retry identities,
supporting filter indexes, and any correction metadata required by narrow functions. Preserve all
existing rows, regenerate the complete Supabase TypeScript schema, and represent every change with
ordered migrations plus constraint/RLS tests.

**Rationale**: The current generated type file is incomplete and the constitution prohibits manual
schema edits. Additive migrations allow clean setup and safe upgrades.

**Alternatives considered**: An ORM would create a second schema authority; destructive table
replacement is unnecessary; hand-maintained partial types invite contract drift.

## Verification Strategy

**Decision**: Test pure parsing/error/DTO logic with Vitest, HTTP adapters and domain services in
integration tests, database invariants/RLS/functions with local Supabase tests, authenticated flows
with Playwright, and the production compatibility path with `vinext check` and build.

**Rationale**: No one test layer can prove cookie auth, public handler behavior, RLS, database
transactions, and Workers compatibility.

**Alternatives considered**: Unit-only tests miss database security; e2e-only tests make exact
permission and conflict coverage slow and opaque.
