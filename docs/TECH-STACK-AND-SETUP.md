# ROLNET — Final Tech Stack & Step-by-Step Development Guide

> Tricycle Fleet Ledger: units, drivers & extradors (backup drivers), daily remittances, expenses,
> parts, tires, mileage, compliance documents, dashboard alerts, audit history, and reports.
>
> **Version:** 1.0 · **Date:** 2026-10-28 · **Based on:** prototype `jeiku101024/rolnet` @ `51b352a`
> ("hold muna", 2026-10-27) and the brand kit in `rolnet-brand/`.

---

## Table of contents

1. [Where the prototype stands](#1-where-the-prototype-stands)
2. [Final tech stack](#2-final-tech-stack)
3. [UI system decision (from the 14 "beautiful UI" repos)](#3-ui-system-decision)
4. [Brand system](#4-brand-system)
5. [Architecture & project conventions](#5-architecture--project-conventions)
6. [One-time machine setup (Windows 11)](#6-one-time-machine-setup-windows-11)
7. [Project setup — step by step](#7-project-setup--step-by-step)
8. [Spec Kit + Claude Code workflow](#8-spec-kit--claude-code-workflow)
9. [Database change workflow (Supabase CLI)](#9-database-change-workflow-supabase-cli)
10. [Testing & quality gates](#10-testing--quality-gates)
11. [Git & branching](#11-git--branching)
12. [Deployment (free tier)](#12-deployment-free-tier)
13. [Operations: backups, keep-alive, quotas](#13-operations-backups-keep-alive-quotas)
14. [Cleanup items found in the prototype](#14-cleanup-items-found-in-the-prototype)
15. [Roadmap — what to build next, in order](#15-roadmap--what-to-build-next-in-order)
16. [Daily development loop (cheat sheet)](#16-daily-development-loop-cheat-sheet)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Where the prototype stands

The prototype is **not a throwaway** — it is a solid foundation. Keep it and continue from it rather
than starting over.

| Area | Status |
|---|---|
| Spec Kit | Initialized (v1.2.2.dev0) with the **Codex** integration, constitution v1.0.0 ratified |
| Feature 001 – Fleet management | 105 / 115 tasks done; 10 open are **validation checkpoints** blocked by no local Supabase runtime (T026, T043, T054, T065, T077, T090, T101, T108, T112, T115) |
| Feature 002 – UI system refresh | 42 / 45 done |
| Feature 003 – App navigation | 4 / 35 done |
| Feature 004 – Backend CRUD APIs | 0 / 72 (spec, plan, tasks written; code started under `app/api/v1/[...segments]`) |
| Database | 48 ordered migrations, RLS on every table, pgTAP constraint + RLS tests, seed |
| App | Owner/staff route groups, server actions per entity, demo mode, CSV report, audit log |
| Tests | Vitest unit/integration, Playwright e2e (mobile + a11y), pgTAP |
| Deploy | Cloudflare Workers via **vinext** + Wrangler; Docker dev container |

Business rules already captured (keep them):

- Remittance is daily: **₱180** when the unit is returned to the garage, **₱300** total when the driver
  keeps it overnight (overtime). Stored as `18000` / `30000` centavos.
- Each unit has one primary driver; extradors cover on the primary's days off. One operating
  assignment per unit and per driver per calendar date.
- Staff self-register → owner approves. Staff can create/edit remittances, expenses, maintenance only.
- Saved remittance facts are locked; owners correct via audited reversal + replacement.
- Driver profile license expiry is authoritative; uploaded license must match.
- Expiry buckets (fleet timezone `Asia/Manila`): expired, ≤ 7 days, ≤ 30 days, valid.
- Receipts target 300 KB / hard limit 500 KB; documents hard limit 5 MB.

---

## 2. Final tech stack

**Everything below is free.** Versions are what the prototype pins; keep them unless a spec says otherwise.

### 2.1 Application

| Layer | Choice | Version | Why |
|---|---|---|---|
| Language | TypeScript | 5.x | Type safety end-to-end with generated DB types |
| Runtime | Node.js LTS | 24 | Required by Next 16 / vinext |
| Package manager | pnpm via Corepack | 12.14 (pinned in `packageManager`) | Fast, strict, lockfile already committed |
| Framework | Next.js App Router | 16.4 | Server components, server actions, route handlers in one app |
| React | React / React DOM | 19.3.1 | |
| Workers build | vinext (Vite-based Next.js for Cloudflare) | ^1.2 | Lets the Next app run on Cloudflare Workers Free |
| Styling | Tailwind CSS | 4 (CSS-first `@theme`) | Tokens live in `app/globals.css` |
| Components | shadcn/ui, style **`base-nova`** (Base UI primitives) | shadcn CLI ^4.22, `@base-ui/react` ^1.9 | Accessible, owned source code, no runtime license |
| Variants/utils | class-variance-authority, clsx, tailwind-merge | | |
| Icons | lucide-react | | Consistent stroke icons (no emoji icons) |
| Fonts | Geist Sans (UI) + Geist Mono (numbers, plates, dates, ₱) | `geist` package | Self-hosted, tabular figures |
| Forms | React Hook Form + Zod | RHF 7, Zod 4 | Same Zod schema validates client and server |
| Image compression | browser-image-compression | 2.x | Keeps uploads < 300 KB before they hit Storage |

### 2.2 Backend (Supabase Free)

| Need | Supabase feature | Free limit |
|---|---|---|
| Database | PostgreSQL 17 | 500 MB |
| Auth | Supabase Auth (email/password), owner approval flag in `profiles` | 50k MAU |
| Authorization | Row Level Security on every table + `security definer` query functions | — |
| Files | Private Storage buckets (`receipts`, `documents`) + signed URLs | 1 GB storage, 5 GB egress/mo |
| Business logic | SQL functions/triggers (transactions for payments, reversals, audit) | — |
| Schema | Supabase CLI migrations in `supabase/migrations/` | — |
| DB tests | pgTAP via `supabase test db` | — |

> Free projects **pause after 7 days of inactivity** — see §13 keep-alive.

### 2.3 Tooling, testing, delivery

| Area | Tool |
|---|---|
| Unit & integration tests | Vitest 3 + Testing Library + jsdom |
| End-to-end, mobile, a11y | Playwright (360 px viewport is the acceptance width) |
| DB constraint & RLS tests | pgTAP |
| Lint / types | ESLint 9 (`eslint-config-next`), `tsc --noEmit` |
| Hosting | **Cloudflare Workers Free** (100k requests/day, 10 ms CPU/request) via vinext + Wrangler |
| Fallback hosting | `@opennextjs/cloudflare` (OpenNext) or Vercel Hobby (non-commercial only) |
| CI | GitHub Actions (free for public repos; 2,000 min/mo for private) |
| Local containers | Docker Desktop with WSL2 (needed by `supabase start`) |
| Spec-driven dev | GitHub Spec Kit (`specify` CLI) + **Claude Code** |
| Editor | VS Code (+ ESLint, Tailwind CSS IntelliSense, Playwright, PostgreSQL extensions) |

### 2.4 Explicitly *not* in the stack (by constitution: monolithic simplicity)

No separate backend service, no Redux/Zustand (server components + URL state suffice), no ORM
(Supabase client + generated types), no message queues, no paid SaaS, no heavy animation/3D
libraries in the app shell.

---

## 3. UI system decision

### 3.1 Key insight

Of the 14 repos, **only 3 are component libraries** (react-bits, magicui, canvas-ui), and all three
are animation/landing-page effects. The rest are **agent skills or design specs**: they teach Claude
Code *how* to design well. ROLNET is a data-heavy mobile ledger, so the right move is:

> **Keep shadcn/ui (base-nova) as the only component library**, and add a small set of design
> *skills* + a linted `DESIGN.md` so every Spec Kit feature produces consistent, non-generic UI.

### 3.2 Evaluation (verified via GitHub API on 2026-10-28; all exist, none archived)

| # | Repo | Stars | License | What it is | ROLNET verdict |
|---|---|---|---|---|---|
| 9 | google-labs-code/design.md | 28.6k | Apache-2.0 | DESIGN.md format spec + `lint`/`diff` CLI | ✅ **Use** — formalize & lint the existing `DESIGN.md` |
| 5 | pbakaus/impeccable | 90.9k | Apache-2.0 | Skill/CLI: design vocabulary, critique, audit, anti-"AI-slop" lint | ✅ **Use** — primary design-quality skill |
| 1 | nextlevelbuilder/ui-ux-pro-max-skill | 141.7k | MIT | Skill: design-system generator + UX/a11y rules DB (Next.js, shadcn supported) | ✅ **Use once** — to sanity-check the design system, then fold into DESIGN.md |
| 7 | emilkowalski/skills | 50.8k | MIT | Skill collection (mobile-native, break-ui, Sonner, animation) | ✅ **Partial** — `mobile-native`, `break-ui`, `ask-sonner` only |
| 2 | VoltAgent/awesome-design-md | 124.1k | MIT | Collection of brand DESIGN.md files (Linear, Stripe, Vercel…) | 📖 Reference only — study Linear/Stripe dashboards, don't copy |
| 8 | Nutlope/hallmark | 39.4k | MIT | Anti-slop skill, editorial/photography lean | ⏸ Alternative to Impeccable — don't run both |
| 4 | Leonxlnx/taste-skill | 103.8k | MIT | Art-direction skill, needs Chrome | ⏸ Skip — marketing-page focus, overlaps Impeccable |
| 10 | magicuidesign/magicui | 22.9k | MIT | Animated shadcn components | ⏸ Optional: at most `number-ticker` for KPI tiles |
| 3 | nexu-io/open-design | 104.5k | Apache-2.0 | Separate AI design workspace app + MCP | ❌ Skip — extra app, overkill |
| 6 | DavidHDev/react-bits | 50.5k | MIT + **Commons Clause** | Animated text/backgrounds | ❌ Skip — flashy; not OSI open source |
| 13 | DavidHDev/canvas-ui | 5.1k | MIT + **Commons Clause** | WebGL/WebGPU effects (some need Chrome flags) | ❌ Skip — heavy GPU/battery cost on low-end phones; not OSI open source |
| 11 | greensock/gsap-skills | 17.3k | MIT | GSAP animation skills | ❌ Skip — CRUD app doesn't need it |
| 12 | oso95/scroll-world | 10.6k | MIT | 3D scroll landing pages | ❌ Skip |
| 14 | enesozturk/dimensional-drawing | 1.3k | MIT | Apple-style illustration skill | ❌ Skip (maybe later for a marketing page) |

> Star counts are real per GitHub, but unusually high for such young repos; treat popularity as a
> weak signal. None of these tools were executed during this evaluation — verify on first install.

### 3.3 Final UI stack

| Role | Tool |
|---|---|
| Components | shadcn/ui `base-nova` (Base UI) — already in `components/ui/` |
| Design source of truth | `DESIGN.md` (existing), formalized & linted with `@google/design.md` |
| Day-to-day design QA skill | **Impeccable** (`/impeccable` critique / audit / polish) |
| One-time design-system review | **UI/UX Pro Max** |
| Mobile polish & stress-testing | emilkowalski `mobile-native`, `break-ui`; Sonner toasts |
| Icons | lucide-react |
| Motion | CSS transitions only (`prefers-reduced-motion` respected); no GSAP/WebGL |

### 3.4 Install (in the project folder, once)

```powershell
# 1. Design-system lint (no install; run via npx)
npx @google/design.md lint DESIGN.md

# 2. Impeccable — primary design skill
npx impeccable install
#   then inside Claude Code:  /impeccable init

# 3. UI/UX Pro Max — as a Claude Code plugin (in Claude Code):
#   /plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
#   /plugin install ui-ux-pro-max@ui-ux-pro-max-skill
#   (needs python3: winget install Python.Python.3.12)

# 4. Selected Emil Kowalski skills (pick mobile-native, break-ui, ask-sonner when prompted)
npx skills@latest add emilkowalski/skills

# 5. Toasts
corepack pnpm dlx shadcn@latest add sonner
```

Commit the skill files that land in the repo (e.g. `.claude/skills/`) so every machine and agent
uses the same design rules.

### 3.5 How to use them in the Spec Kit loop

1. **Before `/speckit-plan`** of any UI feature: ensure `DESIGN.md` covers the new pattern
   (e.g. "payment timeline", "tire position diagram"). Add it there first, then `npx @google/design.md lint DESIGN.md`.
2. **In `/speckit-plan`** say: *"Follow DESIGN.md; reuse components/ui; no new UI libraries."*
3. **After `/speckit-implement`**: run `/impeccable` critique/audit on the new screens and the
   `break-ui` skill with worst-case data (long driver names, ₱999,999.99, 100 units, empty states).
4. Fix findings, then Playwright at 360 px.

### 3.6 Rules so the skills don't fight each other

- `DESIGN.md` + the constitution win over any skill's suggestions (gradients, glass, pills, Inter → rejected).
- Run **one** critique skill per pass (Impeccable). Use UI/UX Pro Max only for system-level questions.
- Never let a skill add a new component library; changes land in `components/ui/` and `app/globals.css` tokens.

---

## 4. Brand system

### 4.1 Assets (copy into `public/brand/` — already present in the prototype)

| File | Use |
|---|---|
| `rolnet-logo.svg` / `.png` | Full mark + wordmark — sign-in screen (176 px wide), desktop header (≥ 120 px) |
| `rolnet-mark.svg` | Compact tricycle mark — mobile header (≥ 44 px) |
| `rolnet-icon.svg` | Square icon, favicon source |
| `favicon.svg`, `favicon.ico` | Browser tab |
| `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | PWA / home-screen icons (add to `app/manifest.ts`) |

Never recolor, redraw, stretch, or put the logo on a busy background. Keep clear space ≥ one stroke width.

### 4.2 Colors (extracted from the SVGs + derived tokens)

| Token | Hex | Use |
|---|---|---|
| `--token-brand` | `#FFC72C` | Primary action fill, active nav, key highlights — **always with dark text, never white** |
| `--token-brand-dark` | `#1B2A41` | Brand navy: headers, emphasis, `--primary` |
| `--token-ink` | `#0F1B2D` | Body text, dense data |
| `--token-canvas` | `#FFFCF3` | Warm page background |
| `--token-surface` | `#FFFFFF` | Inputs, tables, sheets |
| `--token-rule` | `#D8DEE7` | Dividers, table rules |
| `--token-muted` | `#526174` | Secondary text |
| `--token-focus` | `#7A4B00` | Focus ring, links |
| `--token-ok` / soft | `#246B4A` / `#E7F3EC` | Valid / paid |
| `--token-warn` / soft | `#8A5100` / `#FFF1D6` | Expiring soon / partial |
| `--token-danger` / soft | `#A33F3B` / `#FBE9E8` | Expired / overdue / short |

Rules: status color is never the brand yellow; status always = icon + text label + color.

### 4.3 Typography

- **UI:** Geist Sans. **Data:** Geist Mono with `font-variant-numeric: tabular-nums` for ₱ amounts,
  plate/body numbers, dates, odometer.
- Scale: 0.75 · 0.8125 · 0.9375 · 1 · 1.75 · 2.25 rem (already tokenized).
- Note: the SVG wordmark declares `Inter` as its font. That is fine **inside the logo file only**;
  for consistent rendering, convert the wordmark text to outlines (Inkscape → *Path → Object to Path*)
  so it never depends on an installed font.

### 4.4 Layout rules

Mobile-first single column at 360 px; touch targets ≥ 44 px; radius 4 px (base) / 6 px (controls);
no decorative shadows, gradients, or glassmorphism; tables carry hierarchy; the `DESIGN.md` file in
the repo is the source of truth for agents.

---

## 5. Architecture & project conventions

### 5.1 Request flow

```
Phone / desktop browser
        │
        ▼
Cloudflare Worker (vinext build of Next.js 16)
  ├─ proxy.ts ................. refresh Supabase session cookie, gate routes by role/approval
  ├─ app/(owner)/* ............ owner-only pages (server components)
  ├─ app/(operations)/* ....... owner + approved staff pages
  ├─ app/actions/*.ts ......... server actions (Zod-validate → supabase.rpc / insert)
  └─ app/api/v1/[...segments]  JSON CRUD API (feature 004)
        │  anon key + user JWT (never the service-role key in requests)
        ▼
Supabase
  ├─ Postgres + RLS (every table) + SQL functions for money/audit transactions
  ├─ Auth (profiles.role = owner|staff, profiles.status = pending|approved)
  └─ Storage (private buckets; browser uploads compressed files directly with signed paths)
```

### 5.2 Folder layout (keep it)

```
app/            routes: (auth) (owner) (operations), actions/, api/
components/     ui/ (shadcn primitives) + feature folders (forms, dashboard, maintenance…)
lib/            supabase/, auth/, permissions/, validation/ (Zod), money/, dates/, uploads/, reports/
supabase/       migrations/, tests/{constraints,rls}/, seed.sql, config.toml
tests/          unit/, integration/, e2e/
specs/NNN-*/    Spec Kit artifacts per feature
.specify/       Spec Kit memory (constitution), templates, scripts
types/          database.ts (generated — never hand-edit)
public/brand/   logo assets
```

### 5.3 Non-negotiable conventions (from the constitution)

1. **Money = integer centavos** (`bigint` in SQL, `number` in TS). Parse with `parseCentavos`, display
   with `formatPesos`. Never `float`/`numeric` math in JS.
2. **Every business row** has `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`
   (soft delete). No hard deletes in app flows.
3. **Multi-row money changes** (payments, reversals) happen inside one SQL function/transaction.
4. **Schema changes only via migrations**; no dashboard edits on the remote project.
5. **RLS on every exposed table**, with a pgTAP test proving owner/staff/pending/anonymous access.
6. **Mobile first:** every feature is accepted at 360 px.
7. **Free tier only:** a new dependency needs a documented free path.

---

## 6. One-time machine setup (Windows 11)

Run in **PowerShell** (as normal user unless noted).

### 6.1 Core tools

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e          # Node 24 LTS
winget install --id Microsoft.VisualStudioCode -e
winget install --id astral-sh.uv -e               # for Spec Kit's `specify` CLI
winget install --id GitHub.cli -e                 # optional: gh
```

Close and reopen the terminal, then verify:

```powershell
node -v        # v24.x
git --version
uv --version
```

### 6.2 pnpm via Corepack

```powershell
corepack enable
corepack prepare pnpm@12.14.0 --activate
pnpm -v
```

> If `corepack enable` fails with permissions, run that one command in an **Administrator** PowerShell.

### 6.3 Docker Desktop (needed for local Supabase)

1. Enable WSL2 (Administrator PowerShell): `wsl --install` → reboot.
2. `winget install --id Docker.DockerDesktop -e` → start Docker Desktop → Settings → *Use WSL 2 based engine* ✔.
3. Verify: `docker run --rm hello-world`.

> The prototype's 10 open validation tasks are blocked exactly here — this step unblocks them.
> On a locked-down corporate laptop where Docker isn't allowed, use a **separate free Supabase
> "dev" project** in the cloud instead of `supabase start` (see §7.6 option B).

### 6.4 Spec Kit CLI

```powershell
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
specify check
```

### 6.5 Claude Code

Use the Claude desktop app (Code tab) or the CLI. Open the project folder as the session folder.

### 6.6 Accounts (all free)

- GitHub (repo + Actions)
- Supabase (create 2 projects later: `rolnet-dev` optional, `rolnet-prod`)
- Cloudflare (Workers Free)

---

## 7. Project setup — step by step

### 7.1 Clone and install

```powershell
cd $HOME\code                       # or wherever you keep projects
git clone https://github.com/jeiku101024/rolnet.git
cd rolnet
corepack pnpm install
```

### 7.2 Quick sanity run in demo mode (no backend)

```powershell
Copy-Item .env.example .env.local   # then edit .env.local:
#   NEXT_PUBLIC_DEMO_MODE=true
#   DEMO_MASTER_EMAIL=owner@demo.local
#   DEMO_MASTER_PASSWORD=demo1234
corepack pnpm dev
```

Open <http://localhost:3000/login> → `owner@demo.local` / `demo1234`. Click through every page on a
phone-size window (DevTools → 360 × 800).

### 7.3 Verify the toolchain passes before changing anything

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm exec playwright install --with-deps chromium
corepack pnpm test:e2e
corepack pnpm check            # vinext compatibility check
corepack pnpm build:vinext     # Workers build
```

Record any failures as the first task — don't build features on a red baseline.

### 7.4 Do the repo cleanup (see §14) on a branch

```powershell
git switch -c chore/repo-hygiene
```

### 7.5 Spec Kit with Claude Code (done on `chore/repo-hygiene`)

The Claude integration is installed next to Codex and set as the default. Claude Code loads the
Spec Kit commands as skills from `.claude/skills/speckit-*`, so invoke them with a hyphen:
`/speckit-specify`, `/speckit-plan`, and so on. `CLAUDE.md` at the repo root holds the agent rules.

Check it on any machine:

```powershell
specify integration status      # expect: OK, default claude, Modified managed files: 0
```

How it was done, and what to watch for on a fresh setup:

```powershell
specify integration install claude --script ps
specify integration use claude
```

- **Keep your `specify` CLI at least as new as the project** (`.specify/init-options.json` →
  `speckit_version`, currently `1.2.2.dev0`). An older CLI rewrites shared scripts and templates with
  older versions. Upgrade with `specify self upgrade`, then check with `git diff -- .specify`.
- `.gitattributes` forces LF line endings. Spec Kit's manifest hashes assume LF; with CRLF,
  `specify integration status` reports "managed files modified" even though nothing changed.

### 7.6 Supabase — local development database

**Option A (recommended): local stack in Docker**

```powershell
corepack pnpm exec supabase start          # first run pulls images (~several minutes)
corepack pnpm exec supabase status         # shows API URL, anon key, service_role key, Studio URL
corepack pnpm exec supabase db reset       # applies all 48 migrations + seed.sql
corepack pnpm exec supabase test db        # runs pgTAP constraint + RLS tests
corepack pnpm exec supabase gen types typescript --local > types/database.ts
```

Put the **local** values from `supabase status` into `.env.local`:

```dotenv
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key — server-only, for tests/scripts>
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_FLEET_TIMEZONE=Asia/Manila
```

Studio (local DB GUI): <http://127.0.0.1:54323>. Local emails (sign-up confirmation): <http://127.0.0.1:54324>.

**Option B (no Docker allowed): cloud dev project**

1. supabase.com → New project `rolnet-dev`, region **Southeast Asia (Singapore)**, save the DB password.
2. ```powershell
   corepack pnpm exec supabase login
   corepack pnpm exec supabase link --project-ref <dev-project-ref>
   corepack pnpm exec supabase db push --include-seed
   corepack pnpm exec supabase gen types typescript --linked > types/database.ts
   ```
3. Put the dev project's URL + anon key in `.env.local`. (pgTAP tests need the local stack; run them
   in CI — see §10.3.)

### 7.7 Create the first owner account

1. `corepack pnpm dev` → open `/register` → sign up with your email.
2. Promote yourself to owner once (local Studio → SQL editor, or `psql`):
   ```sql
   update public.profiles p
   set role = 'owner',
       account_status = 'approved',
       approved_at = now(),
       approved_by = p.user_id          -- first owner self-approves (satisfies the check constraint)
   from auth.users u
   where p.user_id = u.id and u.email = 'you@example.com';
   ```
   (Columns from `supabase/migrations/20261019000200_create_profiles.sql`.) For the
   production project, put this one-time bootstrap in a documented script, not a dashboard edit.
3. Log in → you should see the owner dashboard.

### 7.8 Run the blocked validation checkpoints

With the database running, execute T026 → T115 in `specs/001-fleet-management/tasks.md`, recording
results in each `validation/*.md`. In Claude Code you can say:
*"Run task T026 from specs/001-fleet-management/tasks.md and record the results."*

---

## 8. Spec Kit + Claude Code workflow

### 8.1 Commands (in Claude Code)

| Order | Command | Output | Your job |
|---|---|---|---|
| once | `/speckit-constitution` | `.specify/memory/constitution.md` | Already v1.0.0 — only amend deliberately (semver bump) |
| 1 | `/speckit-specify <what & why>` | `specs/NNN-name/spec.md` + branch | Describe behavior only, no tech |
| 2 | `/speckit-clarify` | Clarifications appended to spec | Answer every question; this prevents rework |
| 3 | `/speckit-plan <tech notes>` | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` | Point it at this stack + DESIGN.md; review the data model hard |
| 4 | `/speckit-checklist` (optional) | `checklists/*.md` | Requirement-quality check |
| 5 | `/speckit-tasks` | `tasks.md` | Check ordering: migration → RLS → pgTAP → actions → UI → e2e |
| 6 | `/speckit-analyze` | Consistency report | Fix any CRITICAL findings before coding |
| 7 | `/speckit-implement` | Code, marks tasks `[X]` | Review each phase; commit per phase |

In this repo the commands are Claude Code skills, so they use a hyphen (`/speckit-plan`). Type `/speckit` and pick one from the autocomplete list.

### 8.2 Rules for good specs in this project

- **One feature per spec**, small enough to finish in 1–3 days.
- Every spec states roles (owner / staff / pending), the 360 px acceptance, and money in centavos.
- Every plan includes: migration file names, RLS policy matrix, pgTAP tests, Zod schemas, pages/components,
  and which `components/ui` primitives are reused.
- Ask `/speckit-plan` to **reuse existing code** (`lib/domain/crud.ts`, `components/ui/data-table.tsx`,
  `components/ui/form-panel.tsx`) instead of creating parallel versions.

### 8.3 Example prompts

```
/speckit-specify Owners can schedule preventive maintenance per unit by mileage or date
(e.g., change oil every 1,500 km or 30 days) and see overdue items on the dashboard.
Staff can mark a maintenance item done when they record the part replacement.

/speckit-plan Use the existing stack in docs/DEVELOPMENT.md and DESIGN.md. New tables via
Supabase migrations with RLS and pgTAP tests. Reuse lib/validation, components/ui/data-table,
and the due-maintenance dashboard panel. No new dependencies.
```

---

## 9. Database change workflow (Supabase CLI)

Yes — you can keep adding tables/columns forever. Every change is a **new** migration file.

```powershell
corepack pnpm exec supabase migration new add_maintenance_schedules
# edit supabase/migrations/<timestamp>_add_maintenance_schedules.sql
corepack pnpm exec supabase db reset                 # rebuild local DB from all migrations
corepack pnpm exec supabase test db                  # pgTAP must pass
corepack pnpm exec supabase gen types typescript --local > types/database.ts
```

Migration file template (follow the prototype's pattern of table file + separate RLS file):

```sql
-- <ts>_create_maintenance_schedules.sql
create table public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  task text not null check (length(task) between 2 and 80),
  every_km integer check (every_km > 0),
  every_days integer check (every_days > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  check (every_km is not null or every_days is not null)
);
-- reuse the shared updated_at / audit triggers from 20261019000100_create_shared_database_primitives.sql

-- <ts+1>_add_maintenance_schedules_rls.sql
alter table public.maintenance_schedules enable row level security;
-- policies: owner full access; approved staff select; nobody else
```

Safe vs. risky changes:

| Safe anytime | Needs a multi-step migration |
|---|---|
| New table, new nullable column, new index, new function | Rename/drop column, add `NOT NULL` to existing data, change type |
| | Pattern: add new → backfill → switch code → constrain → drop old (separate releases) |

**Never edit a migration that has been pushed to production.** Before risky production pushes, take a
backup (§13.1) and run `supabase db push --dry-run`.

---

## 10. Testing & quality gates

### 10.1 What to test where

| Layer | Tool | Location | Must cover |
|---|---|---|---|
| Constraints, triggers, money functions | pgTAP | `supabase/tests/constraints/` | Centavo math, one-assignment-per-day, reversal integrity |
| Row Level Security | pgTAP | `supabase/tests/rls/` | owner / staff / pending / anon for every table & bucket |
| Pure logic | Vitest | `tests/unit/` | `centavos.ts`, `fleet-date.ts`, Zod schemas, CSV escaping |
| API & actions | Vitest | `tests/integration/` | Auth, idempotency, concurrency, soft delete/restore |
| User journeys | Playwright | `tests/e2e/` | 360 px journeys, keyboard focus, axe a11y |

### 10.2 Definition of Done (per task / PR)

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
- [ ] `supabase db reset` + `supabase test db` pass (if schema touched)
- [ ] `types/database.ts` regenerated (if schema touched)
- [ ] Playwright journey for the feature passes at 360 px
- [ ] `pnpm check` and `pnpm build:vinext` pass
- [ ] Centavos, timestamps, soft delete, expiry behavior reviewed (constitution check)
- [ ] Tasks ticked `[X]` in `specs/NNN/tasks.md`; validation note written

### 10.3 CI (GitHub Actions — `.github/workflows/ci.yml`)

```yaml
name: ci
on: [pull_request, push]
jobs:
  app:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: corepack enable && pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck && pnpm test
      - run: pnpm check && pnpm build:vinext
  database:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start -x studio,imgproxy,inbucket,edge-runtime,logflare,vector
      - run: supabase db reset && supabase test db
```

The `database` job gives you pgTAP coverage even if Docker isn't allowed on your laptop.

---

## 11. Git & branching

- `main` = deployable. One branch per Spec Kit feature: `005-maintenance-schedules`.
- Small commits per task phase: `feat(remittances): add payment reversal function (T061)`.
- Open a PR per feature; CI must be green; squash-merge.
- Tag releases: `v0.1.0` after feature 001 validation passes.
- Never commit `.env.local`, `.env.docker`, `dist/`, `playwright-report/`, `test-results/`, `*.tsbuildinfo`.

---

## 12. Deployment (free tier)

### 12.1 Production Supabase project

1. Create `rolnet-prod` (Singapore region). Enable **email confirmations**; set Site URL and
   redirect URLs to your Workers domain (`https://rolnet-fleet.<subdomain>.workers.dev/api/auth/callback`).
2. Link and push migrations:
   ```powershell
   corepack pnpm exec supabase link --project-ref <prod-ref>
   corepack pnpm exec supabase db push --dry-run
   corepack pnpm exec supabase db push
   ```
   Do **not** push `seed.sql` (demo data) to production.
3. Bootstrap the owner account (§7.7) with a reviewed, one-time SQL script.

### 12.2 Cloudflare Workers (vinext)

```powershell
corepack pnpm exec wrangler login
corepack pnpm build:vinext
corepack pnpm exec wrangler deploy
```

Set environment variables (Cloudflare dashboard → Workers → `rolnet-fleet` → Settings → Variables,
or `wrangler secret put`):

| Name | Type | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | var (also needed at build time) | prod URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | var (build time) | prod anon key |
| `NEXT_PUBLIC_APP_URL` | var | your Workers URL |
| `NEXT_PUBLIC_FLEET_TIMEZONE` | var | `Asia/Manila` |
| `NEXT_PUBLIC_DEMO_MODE` | var | `false` |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** (only if a server task really needs it) | — |

Smoke test after every deploy: log in, create one expense with a receipt photo, download it,
open the dashboard, export a CSV.

### 12.3 Fallback if vinext breaks

vinext is beta (the plan already lists this risk). If a release fails `pnpm check`:

1. **OpenNext for Cloudflare**: `pnpm add -D @opennextjs/cloudflare` and follow its Next 16 guide
   (`opennextjs-cloudflare build && opennextjs-cloudflare deploy`) — same Workers Free account.
2. **Vercel Hobby** (`pnpm build` → import repo on vercel.com) — only for non-commercial use per
   Vercel's terms.

### 12.4 Optional automated deploy

Add a `deploy` job to CI on pushes to `main` using `cloudflare/wrangler-action@v3` with a
`CLOUDFLARE_API_TOKEN` repository secret, and a manual-approval `supabase db push` job.

---

## 13. Operations: backups, keep-alive, quotas

### 13.1 Backups (Supabase Free has none you can restore yourself)

Weekly, and before any risky migration:

```powershell
corepack pnpm exec supabase db dump --linked -f backups\schema.sql
corepack pnpm exec supabase db dump --linked --data-only -f backups\data-$(Get-Date -Format yyyyMMdd).sql
```

Keep `backups/` out of git; copy to Google Drive. Also periodically download Storage buckets
(Studio → Storage → download, or the S3-compatible endpoint with `rclone`).

### 13.2 Keep-alive (prevent the 7-day pause)

Free GitHub Actions cron hitting a cheap read every 3 days (`.github/workflows/keepalive.yml`):

```yaml
name: supabase-keepalive
on:
  schedule: [{ cron: "0 1 */3 * *" }]
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: >
          curl -sS -o /dev/null -w "%{http_code}\n"
          "${{ secrets.SUPABASE_URL }}/rest/v1/fleet_settings?select=id&limit=1"
          -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}"
```

(All ROLNET tables are `authenticated`-only, so the anon request returns an empty result; the API
request itself is what counts as project activity. Store `SUPABASE_URL` and `SUPABASE_ANON_KEY` as
repository secrets.)

### 13.3 Quotas to watch monthly (Supabase → Usage, Cloudflare → Workers → Metrics)

| Limit | Free cap | Action at 80 % |
|---|---|---|
| DB size | 500 MB | Archive old audit rows / check for bloat |
| Storage | 1 GB | Tighten compression, move files to Cloudflare R2 (10 GB free) |
| Egress | 5 GB / mo | Smaller images, cache signed-URL thumbnails |
| Workers requests | 100k / day | Fine for a single fleet; reduce prefetching if near |
| Workers CPU | 10 ms / request | Move heavy aggregation into SQL functions (already the pattern) |

---

## 14. Cleanup items found in the prototype

Status as of the `chore/repo-hygiene` branch (2026-10-28):

| # | Issue | Status |
|---|---|---|
| 1 | `dist/`, `.vinext/`, `.wrangler/`, `playwright-report/`, `test-results/`, `tsconfig.tsbuildinfo` were committed | ✅ Untracked and ignored |
| 2 | `.env.local` was committed (demo credentials only) | ✅ Untracked; the file stays on disk. `.env.example` and `.env.docker.example` remain the templates |
| 3 | `.gitignore` rule `.[!.]*/` ignored **all** dot-folders, including `.specify/`, `.claude/`, `.github/` | ✅ Replaced with explicit entries |
| 4 | Spec Kit integration was Codex-only | ✅ Claude added as default (§7.5) |
| 5 | CRLF line endings broke Spec Kit's manifest hashes on Windows | ✅ `.gitattributes` forces LF |
| 6 | Leftover Next template assets in `public/` | ✅ Deleted |
| 7 | No PWA manifest | ✅ `app/manifest.ts` |
| 8 | No CI | ✅ `.github/workflows/ci.yml` (app job + Supabase/pgTAP job) |
| 9 | 3 ESLint errors in existing code: `set-state-in-effect` in `components/ui/sidebar.tsx` and `components/documents/expiry-status.tsx`; `prefer-const` in `lib/domain/crud.ts` | ⏳ Open. The CI `app` job fails on lint until these are fixed |
| 10 | `DESIGN.md` says radius 4 px / 6 px, but `globals.css` sets `--radius: 0.875rem` (14 px, changed in commit `51b352a`) | ⏳ Open, owner's design decision. Make `DESIGN.md` and CSS agree |
| 11 | Logo SVG wordmark depends on the Inter font while the UI bans Inter | ⏳ Open: outline the wordmark text (§4.3) |
| 12 | Specs 001/004 headers say branch `main`/`master` | ⏳ Use per-feature branches going forward (§11) |

---

## 15. Roadmap — what to build next, in order

| Step | Work | Spec Kit |
|---|---|---|
| 0 | Machine setup + repo hygiene + Claude integration + CI | (chore, no spec) |
| 1 | Run the 10 open validation checkpoints of 001 with a real DB | `/speckit-implement` on remaining tasks |
| 2 | Finish 002 UI system refresh (3 tasks) — apply the UI decision in §3 | continue `specs/002` |
| 3 | Finish 003 app navigation (31 tasks) | continue `specs/003` |
| 4 | 004 backend CRUD APIs — **re-scope first**: run `/speckit-analyze`; only build endpoints a screen or integration needs (server actions already cover the UI) | `specs/004` |
| 5 | First production deploy + owner bootstrap + 1–2 week pilot with real remittances | — |
| 6 | New: preventive maintenance schedules by km/date | new spec 005 |
| 7 | New: PWA install + offline-tolerant remittance entry (queue & sync) | new spec 006 |
| 8 | New: driver self-view of balance (read-only role) | new spec 007 |
| 9 | New: Excel/PDF exports (`exceljs`, `@react-pdf/renderer`) beyond CSV | new spec 008 |
| 10 | Optional: free notifications (email via Supabase Auth SMTP limits / Telegram bot) for expiries | new spec 009 (needs constitution check: v1 says in-app only) |

---

## 16. Daily development loop (cheat sheet)

```powershell
# start of day
git switch main; git pull
corepack pnpm install
corepack pnpm exec supabase start
git switch -c 005-maintenance-schedules      # or let /speckit-specify create it
corepack pnpm dev

# in Claude Code
/speckit-specify …  →  /speckit-clarify  →  /speckit-plan …  →  /speckit-tasks
/speckit-analyze    →  /speckit-implement

# after schema edits
corepack pnpm exec supabase db reset
corepack pnpm exec supabase test db
corepack pnpm exec supabase gen types typescript --local > types/database.ts

# before pushing
corepack pnpm lint; corepack pnpm typecheck; corepack pnpm test; corepack pnpm test:e2e
corepack pnpm check; corepack pnpm build:vinext
git push -u origin HEAD          # open PR, wait for green CI, squash-merge

# end of day
corepack pnpm exec supabase stop
```

---

## 17. Troubleshooting

| Symptom | Fix |
|---|---|
| `supabase start` fails: Docker not running | Start Docker Desktop; confirm WSL2 engine; `docker ps` must work |
| Port 54321/54322 in use | `supabase stop --all`, or change ports in `supabase/config.toml` |
| Login works locally but not in prod | Supabase Auth → URL Configuration: Site URL + redirect `/api/auth/callback` |
| RLS "permission denied" | User profile still `pending`, or policy missing — write the pgTAP case first, then fix the policy |
| Types out of date / TS errors after migration | Regenerate `types/database.ts` |
| `pnpm` not found | `corepack enable` (Admin PowerShell), reopen terminal |
| vinext build or `pnpm check` warnings about middleware/cache | Known partial support — treat as release gate; use OpenNext fallback (§12.3) |
| Upload rejected | Receipt > 500 KB or doc > 5 MB after compression; check `lib/uploads/*` |
| Supabase project paused | Restore from dashboard; confirm keep-alive workflow (§13.2) is running |
| Next.js API looks different from tutorials | Next 16 has breaking changes — read `node_modules/next/dist/docs/` (per `AGENTS.md`) |
| Spec Kit slash commands missing in Claude Code | Check `specify integration status`; reinstall with `specify integration install claude --script ps`; restart the Claude session |
