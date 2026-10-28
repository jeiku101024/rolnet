# ROLNET — Claude Code rules

@AGENTS.md

Mobile-first tricycle fleet ledger: units, primary/backup drivers, daily remittances, expenses,
parts, tires, mileage, compliance documents, dashboard, audit, reports.

## Read before changing code

- `.specify/memory/constitution.md` — non-negotiable principles (free tier, monolith, centavos, mobile, documents).
- `DESIGN.md` — UI rules and tokens. It wins over any design skill's suggestions.
- `docs/DEVELOPMENT.md` — setup, commands, business rules.
- The active feature's `specs/NNN-*/spec.md`, `plan.md`, `tasks.md`.

## Rules

- Money is integer centavos (`bigint` in SQL). Parse/format only with `lib/money/centavos.ts`.
- Business rows carry `created_at`, `updated_at`, actor IDs, and `deleted_at`; never hard-delete in app flows.
- Schema, RLS, Storage policies, and SQL functions change only through new files in
  `supabase/migrations/`, each with pgTAP coverage in `supabase/tests/`. Never edit a pushed migration.
- New functions in `public` start with no EXECUTE for `anon` or `authenticated`. Grant
  `authenticated` explicitly in the same migration only if the app calls it or an RLS policy uses it,
  and make `security definer` functions check the caller (`require_owner()` or an `is_owner()` filter).
- `types/database.ts` is generated: `corepack pnpm exec supabase gen types typescript --local > types/database.ts`.
- UI uses shadcn `base-nova` components in `components/ui/` and tokens from `app/globals.css`;
  no new component or animation libraries, no hex colors or arbitrary sizes in components.
- Every screen must work at a 360 px viewport.
- Never commit `.env*` files (except the `*.example` templates) or expose the service-role key via `NEXT_PUBLIC_*`.

## Commands (always via Corepack pnpm)

    corepack pnpm dev            # Next.js dev server (demo mode if NEXT_PUBLIC_DEMO_MODE=true)
    corepack pnpm lint
    corepack pnpm typecheck
    corepack pnpm test           # Vitest
    corepack pnpm test:e2e       # Playwright
    corepack pnpm check          # vinext compatibility
    corepack pnpm build:vinext   # Cloudflare Workers build
    corepack pnpm exec supabase db reset && corepack pnpm exec supabase test db

A task is done only when lint, typecheck, and tests pass (plus `supabase test db` if schema changed).

## Spec Kit

Slash commands: `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`,
`/speckit-analyze`, `/speckit-implement`. One feature per spec, on its own `NNN-name` branch.
