# Migration Validation

All schema changes are committed as ordered files in `supabase/migrations/`. `supabase db reset`,
pgTAP, and dry-run push could not run because Podman cannot initialize without WSL2 and Docker
Desktop is blocked by workstation policy.
