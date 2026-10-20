# Authorization and RLS Contract

## Roles

- `owner`: all product workflows, including master records, assignments, documents, settings,
  reports, users, soft deletion/restoration, reversals, and audit history.
- `staff`: pending self-registrants have no application data access until owner approval; approved
  staff read only the operational context needed for entry; create/update remittances, expenses,
  mileage, part replacements, tires, and receipt files; no deletion.
- `anon`: no application data access.

## Required Defense Layers

1. Route groups and navigation hide unavailable screens for usability.
2. Server Actions and Route Handlers authenticate and verify the profile role for every invocation.
3. PostgreSQL grants remove operations a role never needs.
4. RLS policies restrict rows and operations for every exposed table and Storage bucket.
5. Constraints and transactional functions enforce cross-row invariants even for authorized users.

No layer substitutes for a lower layer. Secret/service keys are server-only; staff self-registration
uses the normal Supabase Auth flow, while approval and deactivation use owner-authorized database
functions.

## RLS Acceptance Matrix

| Scenario | Owner | Staff | Anonymous |
|---|---:|---:|---:|
| Read active operational unit/driver/assignment labels | Allow | Allow minimum fields | Deny |
| Create/update units, drivers, assignments, days off | Allow | Deny | Deny |
| Read/create/update remittances and payments | Allow | Allow notes/payments only; financial facts immutable | Deny |
| Soft-delete or reverse financial records | Allow | Deny | Deny |
| Read/create/update expenses and maintenance | Allow | Allow | Deny |
| Read/upload compliance documents | Allow | Deny | Deny |
| Read owner dashboard/report functions | Allow | Deny | Deny |
| Export CSV | Allow | Deny | Deny |
| Manage profiles/settings and staff approval | Allow | Deny | Deny |
| Read audit events | Allow | Deny | Deny |
| Upload/read receipt objects | Allow | Allow for accessible expense | Deny |
| Upload/read document objects | Allow | Deny | Deny |

## Database Test Contract

Each table/function requires pgTAP tests proving:

- anonymous access is denied;
- owner allow cases succeed;
- staff allow and deny cases match the matrix;
- users cannot set actor, calculated, role, or soft-delete fields outside approved functions;
- soft-deleted rows disappear from current queries but remain owner-auditable;
- Storage paths cannot cross buckets, records, or roles;
- report and dashboard functions are owner-only;
- expired licenses, retired units, assignment conflicts, duplicate remittances, invalid money, and
  invalid document holders are rejected.

## Session and Request Rules

- Use cookie-based Supabase SSR sessions and validate the current user server-side.
- Do not trust role values from forms, URL parameters, or editable user metadata.
- Server Actions accept same-origin requests only. Route Handlers apply CSRF-safe methods and reject
  unsafe cross-origin use.
- Apply a Content Security Policy compatible with Supabase and Workers, secure cookies, HTTPS-only
  production, and no secrets in `NEXT_PUBLIC_*` variables.
- Log stable error codes and actor/entity IDs, never credentials, tokens, or document contents.
