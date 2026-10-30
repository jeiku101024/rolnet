# ROLNET Development Guide

ROLNET is a mobile-first tricycle fleet management application for one fleet owner and staff. It covers units, primary/backup drivers, daily remittances, expenses, parts, tires, documents, dashboard alerts, audit history, and monthly CSV reports.

## Quick start

Requirements: Node.js 24 LTS, Corepack/pnpm 12, Git, a Supabase project for backend mode, and Docker or Podman with a Linux VM backend for local Supabase integration tests.

Install:

    corepack enable
    corepack pnpm install

## Demo mode (no backend)

Demo mode lets another laptop review the complete UI without Docker, Supabase, Auth, Postgres, or Storage. Data is deterministic and in-memory; changes are not persisted.

Create .env.local with:

    NEXT_PUBLIC_DEMO_MODE=true
    DEMO_MASTER_EMAIL=owner@demo.local
    DEMO_MASTER_PASSWORD=demo1234

Start with:

    corepack pnpm dev

Open http://localhost:3000/login and use owner@demo.local / demo1234.

Demo mode exposes owner navigation and sample records for units, drivers, expenses, remittances, maintenance, documents, dashboard, reports, and audit history. It is strictly for local UI review.

## Dockerized development

The repository includes Dockerfile, docker-compose.yml, .dockerignore, and .env.docker.example.

Start a portable demo container:

    Copy-Item .env.docker.example .env.docker
    docker compose up --build

Then open http://localhost:3000/login. The compose service runs Node 24, installs pinned pnpm dependencies, and starts Next.js with source/dependency volumes for live development.

Build/run a production-like image:

    docker build --target runner -t rolnet:local .
    docker run --rm -p 3000:3000 --env-file .env.docker rolnet:local

Podman users can use the equivalent compose command after starting a Podman Linux machine. On Windows, Podman still needs WSL2 or another approved Linux VM provider.

## Backend mode

Copy .env.example to .env.local and set:

    NEXT_PUBLIC_DEMO_MODE=false
    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

Never commit .env.local or expose a service-role key through NEXT_PUBLIC_*.

With Docker or compatible Podman:

    corepack pnpm exec supabase start
    corepack pnpm exec supabase db reset
    corepack pnpm exec supabase gen types --lang typescript --local
    corepack pnpm exec supabase test db

All schema, RLS, Storage policies, triggers, and query functions belong in supabase/migrations/. Manual dashboard schema edits are prohibited.

## Tech stack

| Area | Technology |
|---|---|
| App | Next.js 16.4 App Router, React 19.3.1, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, class-variance-authority, lucide-react |
| Forms | React Hook Form and Zod |
| Backend | Supabase Auth, PostgreSQL, RLS, private Storage |
| Deployment | Cloudflare Workers through vinext and Wrangler |
| Tests | Vitest, Testing Library, Playwright, pgTAP |
| Package manager | pnpm 12 through Corepack |

## Useful commands

    corepack pnpm dev
    corepack pnpm dev:vinext
    corepack pnpm lint
    corepack pnpm typecheck
    corepack pnpm test
    corepack pnpm test:e2e
    corepack pnpm check
    corepack pnpm build:vinext

## Repository structure

    app/                  Next.js routes, actions, and route handlers
    components/           shadcn/ui and feature components
    lib/                  auth, Supabase, validation, money, uploads, reports
    supabase/migrations/  ordered SQL schema/RLS/Storage/query changes
    supabase/tests/       pgTAP constraint and RLS tests
    tests/                Vitest and Playwright tests
    specs/                constitution, spec, plan, tasks, validations
    docs/                 handoff and operations documentation

## Business/data rules

- Money is always integer centavos; display formatting is presentation-only.
- Returned remittance is 18,000 centavos; overnight/overtime is 30,000 centavos total.
- Business rows have timestamps, actor IDs, and soft deletion.
- Driver profile license expiry is authoritative and must match uploaded license documents.
- Receipts target 300 KB and hard-limit at 500 KB; documents hard-limit at 5 MB.
- Expiry buckets use the fleet timezone: expired, due within 7 days, due within 30 days, valid.
- Drivers are Active or Inactive; units are Active, In repair or Retired. Only the owner changes a
  status. Inactive drivers and In repair or Retired units have locked details (enforced in the
  database); daily operations, mileage, documents and license renewals still work for them.
- A driver with a current or upcoming assignment cannot be set Inactive until it is ended or removed.

## Lists and dashboard (feature 006)

- Every record list shows 10 rows per page. The page and search live in the URL: `?page=N&q=text`
  for a page's main list, and a per-list prefix on detail pages (`assignments_page`, `documents_q`,
  …). Changing the search drops that list's page; page 1 and empty values are left out of the URL.
- Top-level lists page and search in the database (`lib/pagination/list-page.ts`,
  `lib/pagination/search-filter.ts`, specs in `lib/pagination/search-specs.ts`). Names on related
  rows are matched through an id lookup; enum columns are matched by their display labels.
  Detail-page lists are already fully loaded for coverage logic, so they page in memory (`pageRows`).
- The main lists also have sort and filter (`sort`, `from`/`to` dates, and per-list filters such
  as `status`, `unit`, `category`): a date button with quick ranges and a Filters panel next to
  search, removable chips, and a Sort menu beside the record count (`components/ui/list-controls.tsx`). Each list declares its sorts and filters once in
  `lib/pagination/list-control-specs.ts`; `lib/pagination/list-controls.ts` validates the URL,
  applies it to the Supabase query, and does the same in memory for demo mode. Unknown values are
  ignored; changing a sort or filter drops the page. The dashboard's "View all" links use these
  filters: `/units?status=in_repair`, `/drivers?kind=backup`, `/documents?expiry=due`, and the
  owner-only `/maintenance?due=1` and `/remittances?balance=unpaid`.
- The dashboard has four bands, in this order on phones: Needs attention (expiring documents, due
  maintenance, unpaid balances, most urgent first), Fleet status (extradors today, units in repair),
  This month (figures and charts from `dashboard_monthly_unit_summary`, matching the monthly
  report), and Recent activity. Panels show 3 rows on phones and up to 5 on wider screens.
  Maintenance urgency counts 100 km past due as one day overdue (`kmPerDayEquivalent`).

## Validation and release

Run lint, typecheck, tests, vinext check, and build:vinext. With a database runtime, also run all Supabase migrations, pgTAP, Storage/RLS tests, Playwright journeys, 100-unit/24-month dashboard performance checks, CSV reconciliation, and the acceptance protocol in specs/001-fleet-management/quickstart.md.

The remaining integration checkpoints are tracked in specs/001-fleet-management/tasks.md: T026, T043, T054, T065, T077, T090, T101, T108, T112, T115. They remain unchecked until a working Supabase runtime is available.

## Troubleshooting

- Demo login fails: verify .env.local has NEXT_PUBLIC_DEMO_MODE=true, restart Next.js, and use the credentials shown on the login page.
- Supabase connection refused: start the local stack or switch to demo mode.
- Docker/Podman on Windows: the CLI alone is insufficient; WSL2 or an approved Linux VM is required.
- Cloudflare build warning: vinext currently reports known partial support for middleware/cache behavior; treat vinext check and the Workers build as release gates.

## Deployment outline

1. Run all code, database, RLS, Storage, E2E, performance, and CSV checks.
2. Apply reviewed Supabase migrations with supabase db push --dry-run, then supabase db push.
3. Configure Cloudflare Workers environment variables/secrets.
4. Build and deploy through the vinext Cloudflare workflow.
5. Smoke-test login, one mutation, private upload/download, dashboard, and CSV export.

