# Quickstart: Validate Unit Name and Register Columns

## Prerequisites

- Local Supabase running, with the database reset: `corepack pnpm exec supabase db reset`
- Types regenerated: `corepack pnpm exec supabase gen types typescript --local > types/database.ts`
- Signed in as the owner, on `corepack pnpm dev`

## Automated checks

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm exec supabase test db
corepack pnpm test:e2e
```

What these should show:

- pgTAP `260_unit_name.sql`: the backfill gives existing units their body number as the name; a
  blank, too-long, or duplicate name (different case or spacing) is rejected; a deleted unit's name
  can be reused; an insert without a name gets the body number; a rename writes an audit row.
- Vitest `current-drivers.test.ts`: the four current-driver situations from
  [data-model.md](data-model.md), plus ended and future primaries.
- Vitest list-controls and search tests: the `name` sort is the default, and search matches the name.

## Manual walkthrough (360 px viewport, then desktop)

1. Open `/units`. The headers read: Unit · Body number · Plate · Motorcycle · Current driver · Mileage · Status.
2. Add a unit: name `ROLNET-1`, body `0633`, plate `ABC-9999`, motorcycle `Yamaha YTX`. Its row shows
   `ROLNET-1` (a link), `0633`, and `Yamaha YTX`.
3. Add another unit named ` rolnet-1 `. You get "Another unit already uses this name…".
4. Open `ROLNET-1`. The title is `ROLNET-1` and the description begins `Body 0633`. Assign a primary
   driver, then go back to `/units`. Current driver shows that driver.
5. Record a day off for today with a backup. The register shows the backup with a "Backup" badge.
   Remove the backup: the register shows "Day off · no backup".
6. Search `ROLNET-1`; the unit is listed. Sort by "Name, Z to A"; the order flips.
7. At 360 px, the page doesn't scroll sideways. The table scrolls inside its card, and no cell text
   overlaps.
8. Sign in as staff. The new columns appear read-only, and there is no add panel.
9. Set `NEXT_PUBLIC_DEMO_MODE=true`. The demo units show `ROLNET-n` names and a mix of driver states.
