# Implementation Plan: Unit Name and Register Columns

**Branch**: `007-unit-name-columns` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-unit-name-columns/spec.md`

## Summary

Each tricycle gets its own fleet name ("ROLNET-1") alongside its body number. The Units register
shows Unit (the name) · Body number · Plate · Motorcycle (the relabelled make and model) · Current
driver · Mileage · Status.

The name is a new `units.name` column. It is backfilled from the body number, unique among active
units, and set to the body number when a caller leaves it out. The current driver is worked out per
register page from today's assignments and days off, using the same `coverageOn` logic as the unit
page. Search, sort, forms, demo data and the unit page title pick up the name.

## Technical Context

**Language/Version**: TypeScript 5 (strict), SQL (Supabase Postgres)

**Primary Dependencies**: Next.js App Router (the repo's version; read `node_modules/next/dist/docs/` before touching routing APIs), Supabase JS, Zod, shadcn `base-nova` UI

**Storage**: Supabase Postgres. One new migration, with no changes to RLS or Storage

**Testing**: Vitest (helpers, list controls), pgTAP (`supabase test db`), Playwright (register e2e)

**Target Platform**: Mobile-first web, Cloudflare Workers through vinext

**Project Type**: Single Next.js monolith (web app)

**Performance Goals**: The register still loads in one round of queries per page. The two extra
assignment queries are limited to the page's unit ids

**Constraints**: Works at 360 px, uses only existing design tokens and components, stays on the free tier

**Scale/Scope**: A small fleet (tens of units). One page, two forms, the unit page header and demo data

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Free-Tier Sustainability | No new service or dependency | Pass |
| II. Monolithic Simplicity | A column plus a page-level query and a pure helper. No new RPC, view, or service. The current-driver logic reuses `coverageOn` | Pass |
| III. Data Integrity and Auditability | The migration preserves data (it backfills before `not null`); the uniqueness rule is enforced in the database; the existing audit-field, no-hard-delete and business-audit triggers cover the new column. No money is involved | Pass |
| IV. Mobile-First | Plain labels ("Unit name", "Motorcycle"); a duplicate name gets an error that says how to fix it; checked at 360 px. The table scrolls inside its own card, as every list in the app already does, and the page itself does not scroll sideways (research R7) | Pass |
| V. Compliance Documents | Not affected | N/A |
| Workflow gates | An ordered migration with pgTAP tests (`260_unit_name.sql`); regenerated `types/database.ts`; the new trigger function has no `anon`/`authenticated` EXECUTE | Pass |

**Post-design re-check**: Pass. Phase 1 introduced no new dependency, function grant or service.

## Project Structure

### Documentation (this feature)

```text
specs/007-unit-name-columns/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/units-register.md
├── checklists/requirements.md
└── tasks.md             # next: /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/20261030000200_add_unit_name.sql    # new: column, backfill, unique index, default-name trigger
└── tests/constraints/260_unit_name.sql             # new: pgTAP coverage
types/database.ts                                   # regenerated
lib/
├── validation/units.ts                             # name in unitSchema
├── actions/errors.ts                               # units_name_unique → DUPLICATE_UNIT_NAME
├── assignments/current-drivers.ts                  # new: per-unit current driver from coverageOn
├── pagination/search-specs.ts                      # search name
├── pagination/list-control-specs.ts                # name sorts (default)
├── domain/resource-config.ts                       # name in create/update/sort fields
└── demo/mode.ts                                    # demo names and more assignments
app/
├── actions/units.ts                                # write name; "motorcycle" label
├── (owner)/units/page.tsx                          # new columns, current-driver load
└── (owner)/units/[id]/page.tsx                     # title = name
components/forms/
├── unit-form.tsx                                   # Unit name field, Motorcycle label
└── unit-details-form.tsx                           # same
tests/
├── unit/current-drivers.test.ts                    # new
├── unit/list-controls.test.ts                      # name sort
└── e2e/units-register.spec.ts                      # new: columns, name, current driver (demo)
```

**Structure Decision**: Stay inside the existing monolith layout. The only new modules are the
`current-drivers` helper, its test, the migration and its pgTAP file.

## Complexity Tracking

No constitution violations to justify.
