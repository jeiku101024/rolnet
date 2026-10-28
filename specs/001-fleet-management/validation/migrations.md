# Migration Validation

Checkpoint T112 run: 2026-10-28. **Result: pass**, provided #6 is merged (see the note at the end).

Previously, `supabase db reset`, pgTAP and the dry-run push could not run because the workstation
had no Docker/WSL2 runtime.

## Clean rebuild and pgTAP

The CI `database` job (`.github/workflows/ci.yml`) starts an empty local Supabase stack on a
GitHub runner, then runs `supabase db reset` (all committed migrations plus `seed.sql`) and
`supabase test db`.

| Commit | Migrations | pgTAP files | Result |
|---|---|---|---|
| `main` @ `268dce8` (#5), [run 40660859489](https://github.com/jeiku101024/rolnet/actions/runs/40660859489) | 50 | 25 | Pass |
| `fix/require-owner-null` @ `c120ec8` (#6), [run 40663196781](https://github.com/jeiku101024/rolnet/actions/runs/40663196781) | 51 | 26 | Pass |

The schema therefore rebuilds from committed files alone: no step depends on Dashboard edits.

## Remote state matches committed migrations

`rolnet-dev` (Supabase Free, Singapore) was created empty on 2026-10-28. Every schema change was
applied with `supabase db push`; the Dashboard SQL editor was never used for schema.

```text
supabase db push --dry-run   (from fix/require-owner-null, 51 migrations)
→ {"upToDate":true, "migrations":[], "message":"Remote database is up to date."}
```

No migration exists remotely without a matching local file, and none is missing remotely.

## Data edits outside migrations (not schema)

These were data changes on the dev project only, made through `supabase db query --linked`:

- Promoting the first owner account and the E2E owner (`profiles.role` / `account_status`). The first
  owner cannot be approved through the app. Production needs a reviewed, documented one-time script
  for this step (see `docs/TECH-STACK-AND-SETUP.md` §7.7).
- Validation fixtures (units, drivers, assignments, etc.) created through the REST API by the
  checkpoint journeys, all tagged with a run id.

## Note

The dry-run is "up to date" only against a checkout that includes
`20261028000300_fix_owner_check_for_unapproved_users.sql` (#6). On branches without it, the CLI
reports `DbPushMissingLocalError`, because `rolnet-dev` already has that migration applied. Merging
#6 resolves this.
