# Phase 0 Research: Tricycle Fleet Management

## Deployment Target

**Decision**: Deploy the full-stack application to Cloudflare Workers using vinext. Run
`vinext check`, the production vinext build, and end-to-end tests against the Workers preview
runtime before every release. Keep OpenNext on Workers as the fallback if vinext exposes a blocking
compatibility gap.

**Rationale**: Cloudflare now directs full-stack Next.js features—including React Server Components,
Server Actions, Route Handlers, SSR, and middleware—to Workers. Cloudflare Pages supports a static
Next.js export only. The user selected Workers plus vinext after this compatibility conflict was
presented. vinext is Cloudflare's recommended path for new Next.js 16 applications, but it remains
beta, so compatibility is a release gate.

**Alternatives considered**:

- Cloudflare Pages: rejected because static export cannot provide required Server Actions and
  request-dependent Route Handlers.
- OpenNext on Workers: retained as the fallback; it preserves the same product architecture but is
  no longer Cloudflare's default recommendation for new applications.
- A conventional Node/Docker host: rejected because it adds operational cost and conflicts with the
  free-tier-only constraint.

Sources: [Cloudflare Pages Next.js](https://developers.cloudflare.com/pages/framework-guides/nextjs/),
[Cloudflare Workers Next.js/vinext](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/),
[Next.js deployment adapters](https://nextjs.org/blog/nextjs-across-platforms)

## Free-Tier Capacity

**Decision**: Treat free quotas as hard operational budgets. Show owner-only storage/database usage
guidance, reject files that exceed configured limits, and document an export/archive procedure.
Release tests must keep dynamic Workers requests below 10 ms CPU in representative flows; expensive
aggregation belongs in indexed PostgreSQL queries, not JavaScript loops.

**Rationale**: Workers Free allows 100,000 dynamic requests per day, 10 ms CPU per request, and
128 MB per isolate. Supabase Free currently includes a 500 MB database quota, 1 GB Storage, 5 GB
egress, and 50,000 monthly active users. The fleet's low concurrency is well inside user/request
quotas, while images, database growth, and Workers CPU are the practical constraints.

**Alternatives considered**:

- Relying on paid overages: rejected by the constitution.
- Storing images in PostgreSQL: rejected because it consumes the smaller database quota and weakens
  file lifecycle handling.

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Supabase billing quotas](https://supabase.com/docs/guides/platform/billing-on-supabase),
[Supabase database size](https://supabase.com/docs/guides/platform/database-size)

## Authentication and Authorization

**Decision**: Use Supabase Auth with cookie-based SSR clients from `@supabase/ssr`. Store the
application role and approval lifecycle in `profiles`, keyed to `auth.users.id`. Staff may
self-register, but RLS and session guards deny pending/rejected/deactivated staff until an owner
approves them. Every exposed table uses least-privilege grants and RLS. Server Actions and Route
Handlers re-check the authenticated user, approval state, and role close to the mutation; hiding UI
controls is never the authorization boundary.

**Rationale**: Table-backed roles take effect immediately and suit the two stable roles. RLS protects
browser, Server Action, and Route Handler access consistently. No service-role key is needed for
ordinary staff registration; owner-only approval and deactivation actions update the profile
lifecycle through protected database functions. Ordinary application queries use the signed-in
user's session so RLS remains effective.

**Alternatives considered**:

- JWT-only custom role claims: rejected for v1 because role changes remain stale until token refresh.
- Service-role access for routine mutations: rejected because it bypasses RLS.
- Client-side role checks only: rejected as insecure.

Sources: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Supabase SSR Auth](https://supabase.com/docs/guides/auth/server-side),
[Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication)

## Database Change Workflow

**Decision**: Make `supabase/migrations/` the only schema source of truth. Each change is created with
`supabase migration new`, validated by `supabase db reset`, checked by pgTAP/RLS tests, reviewed, and
deployed with `supabase db push --dry-run` followed by `supabase db push`. Regenerate TypeScript
database types after every schema change.

**Rationale**: This produces a reproducible database and satisfies the ban on manual DB edits.
Constraints, triggers, functions, views, grants, RLS policies, buckets, and Storage policies must all
be migrated together.

**Alternatives considered**:

- Dashboard/Table Editor changes: rejected because they create schema drift.
- ORM-managed migrations: rejected as an unnecessary second schema authority.

Sources: [Supabase migrations](https://supabase.com/docs/guides/local-development/database-migrations),
[Supabase local workflow](https://supabase.com/docs/guides/local-development/cli-workflows)

## Mutation and Validation Pattern

**Decision**: Use Server Actions for authenticated form mutations and a small number of Route
Handlers for downloads and Auth callbacks. Parse every input with a shared Zod schema, repeat
authorization in the mutation, call user-scoped Supabase queries or narrow transactional database
functions, and return a typed success/error result. Use idempotency keys for payment and upload
finalization operations.

**Rationale**: The pattern keeps the application monolithic, avoids a parallel API layer, gives
mobile forms progressive enhancement, and treats actions/handlers as public attack surfaces.

**Alternatives considered**:

- A separate REST backend: rejected by the single-app principle.
- Browser-only mutations: rejected because privileged workflow validation needs a server boundary in
  addition to RLS.

Sources: [Next.js Server Actions security](https://nextjs.org/docs/app/guides/authentication#server-actions),
[Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)

## Upload Strategy

**Decision**: Compress receipt and document images in the browser using Canvas/Web Workers, reduce
dimensions and quality iteratively to target at most 300 KB, validate MIME type and final size, then
upload directly to private Supabase Storage with the authenticated user's session. PDFs are not
image-compressed and use a separate conservative limit. Store only the object path, MIME type, byte
size, checksum, and business metadata in PostgreSQL.

**Rationale**: Direct uploads avoid Worker CPU/body overhead and preserve RLS. Private buckets and
short-lived signed URLs protect licenses, registration records, insurance, and receipts. Storage
policies bind allowed paths to the user role and related database row.

**Alternatives considered**:

- Cloudflare image transformation: rejected because Supabase Free does not include Storage image
  transformations and the requirement is client-side compression.
- Public buckets: rejected because documents contain sensitive information.
- Proxying uploads through Server Actions: rejected due to Workers CPU and unnecessary data transit.

Sources: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control),
[Supabase Storage limits](https://supabase.com/docs/guides/storage/uploads/file-limits)

## Reporting and Money

**Decision**: Store and aggregate all money as signed `bigint` centavos. Use parameterized
PostgreSQL functions/views for monthly totals, with the same query contract feeding dashboard cards
and CSV generation. Format pesos only at the display/export edge.

**Rationale**: One database calculation path prevents dashboard/CSV drift, avoids floating-point
errors, and minimizes Workers CPU.

**Alternatives considered**:

- Floating-point or JavaScript aggregation: rejected for integrity and performance.
- Materialized monthly summaries: deferred until measured query performance requires them.

## Testing Strategy

**Decision**: Use Vitest for pure functions and synchronous client components, React Testing Library
for accessible interactions, Playwright for async Server Component and end-to-end mobile journeys,
and pgTAP via `supabase test db` for constraints, functions, grants, and RLS allow/deny cases.

**Rationale**: Next.js recommends end-to-end testing for async Server Components. Database security
needs tests running as anonymous, staff, and owner identities rather than application mocks.

**Alternatives considered**:

- Unit tests only: rejected because Auth cookies, RLS, Storage, and Workers compatibility are
  integration concerns.
- Snapshot-heavy component tests: rejected because behavior and accessibility are more valuable.

Sources: [Next.js testing](https://nextjs.org/docs/app/guides/testing),
[Supabase RLS testing](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Future Scheduled Notifications

**Decision**: Include a dormant, channel-neutral notification outbox/delivery model and a
`notification_candidates` query contract in the initial migration. V1 only reads the same candidate
query for the dashboard. A future Supabase Cron job can enqueue 30-day and 7-day events, and a
Telegram sender can consume them without changing business tables.

**Rationale**: This meets the explicit no-schema-change extension requirement while keeping v1 free
of scheduled work and outbound messages. Unique deduplication keys make retries safe.

**Alternatives considered**:

- GitHub Actions schedule: viable fallback for coarse jobs but can be delayed and is less cohesive
  than database-native scheduling.
- Adding notification tables later: rejected by the stated forward-compatibility requirement.

Sources: [Supabase Cron](https://supabase.com/docs/guides/cron),
[Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
