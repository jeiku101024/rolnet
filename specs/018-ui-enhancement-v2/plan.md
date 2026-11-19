# Implementation Plan: UI Enhancement v2

**Branch**: `018-ui-enhancement-v2` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-ui-enhancement-v2/spec.md`

**Note**: This template is filled in by the `$speckit-plan` command; its definition describes the execution workflow.

## Summary

Presentation-only feature: a cleaner, centered login/register screen with an animated background and a sliding card swap, a light/dark theme, and one shared, minimal motion language for pop-ups (enter and exit) and for save feedback. Approach (see [research.md](research.md)): CSS transitions on the existing Base UI `data-starting-style`/`data-ending-style` attributes; a pathname-driven two-panel track in a new `(auth)` layout; class-based dark mode by remapping the existing design tokens with a hand-written pre-paint script; and a tiny provider that tints the one saved row. No new dependency, no database change.

## Technical Context

**Language/Version**: TypeScript 5, React 19.3, Next.js 16.4.6 (App Router, Cache Components), Tailwind CSS v4

**Primary Dependencies**: Existing only: `@base-ui/react`, shadcn `base-nova` components, `lucide-react`. No new packages.

**Storage**: None (browser `localStorage` key `rolnet-theme` only; no database change)

**Testing**: Vitest + Testing Library (unit), Playwright (e2e, 360 px and desktop, reduced-motion emulation)

**Target Platform**: Mobile-first web; Cloudflare Workers build via vinext

**Project Type**: Single Next.js web application (monolith)

**Performance Goals**: Only `opacity`/`transform` animate; enter <= 250 ms, exit <= 150 ms, auth swap <= 320 ms; no long tasks during swap or pop-up open

**Constraints**: Free tier, no new animation/theme library, 360 px viewport, `DESIGN.md` tokens (no hex or arbitrary sizes in components), `prefers-reduced-motion` honored, print stays light

**Scale/Scope**: About 12 shared UI files (globals, 7 pop-up primitives, headers, auth), 3 new small components (AuthStage, ThemeToggle, SaveFeedbackProvider), row opt-in on about 8 list screens

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. Free-tier sustainability | PASS | No new service or dependency. |
| II. Monolithic simplicity | PASS | CSS-first, direct implementation; hand-rolled theme script instead of a library. |
| III. Data integrity and auditability | PASS (N/A) | No data, schema, money, or audit change (FR-022). |
| IV. Mobile-first, human-centered | PASS | Theme control and auth swap verified at 360 px; reduced motion honored. |
| Other principles (documents, etc.) | PASS (N/A) | Not touched. |

Post-design re-check (after Phase 1): still PASS; no violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/018-ui-enhancement-v2/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui-contracts.md
├── checklists/requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── layout.tsx                    # theme script, suppressHydrationWarning, SaveFeedbackProvider
├── globals.css                   # dark tokens, motion tokens, pop-up/row/background utilities, reduced-motion, print
└── (auth)/
    ├── layout.tsx                # NEW: persistent stage (logo, background, AuthStage)
    ├── actions.ts                # NEW: submitLogin / submitRegistration server actions
    ├── login/page.tsx            # session redirect only; card moves to components/auth
    └── register/page.tsx         # same
components/
├── auth/                         # NEW: auth-stage.tsx, login-card.tsx, register-card.tsx, auth-background.tsx
├── navigation/
│   ├── public-nav.tsx            # remove Ledger
│   ├── app-shell.tsx             # mount ThemeToggle in both headers
│   └── theme-toggle.tsx          # NEW
├── forms/
│   ├── use-action-form.ts        # recordId on outcome, calls markSaved
│   └── form-status.tsx           # spinner, success fade-in
└── ui/
    ├── dialog.tsx, alert-dialog.tsx, sheet.tsx, popover.tsx, dropdown-menu.tsx, tooltip.tsx, toast.tsx   # motion classes
    └── save-feedback.tsx         # NEW: provider + markSaved
lib/theme/                        # NEW: theme-script.ts (inline script string and storage key)
tests/
├── unit/                         # theme script, toggle, dark contrast, save feedback
└── e2e/                          # ui-v2-auth, ui-v2-theme, ui-v2-popups, ui-v2-save specs
```

**Structure Decision**: Single Next.js app. Shared behavior lives in the existing `components/ui` primitives and `globals.css` so every screen inherits it; new files are limited to auth, theme, and save feedback.

## Complexity Tracking

No constitution violations; nothing to justify.
