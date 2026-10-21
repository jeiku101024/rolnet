# Research: Fleet UI System Refresh

## Decision: Reuse the existing shadcn-compatible component direction

**Rationale**: `components.json` already declares the project’s shadcn-compatible setup, Tailwind CSS variables, and Lucide icons. Existing `components/ui/button.tsx` and feedback patterns provide the correct starting point for shared controls. Reusing this direction avoids parallel component APIs and keeps the UI consistent with the user’s requested table/tooling reference.

**Alternatives considered**: Introducing a separate table library or copying a complete external theme was rejected because it would add dependency and styling complexity without changing the user value.

## Decision: Use a stronger geometric sans direction with a project-safe free source

**Rationale**: The current root layout loads Geist and the global styles bind the entire interface to Geist variables. The user specifically wants a less thin, less generic presentation comparable to Satoshi, Montserrat, or Poppins. The implementation should select the closest free/project-safe source available to the repository, define explicit weights, and keep a separate tabular treatment for reconciliation data.

**Alternatives considered**: Keeping Geist and only increasing font weight was rejected because it does not address the requested change in personality. Adding a paid font dependency was rejected by the free-tier constitution principle.

## Decision: Treat dashboard recent data as bounded read-only projections

**Rationale**: The dashboard already reads monthly summary, expiry, maintenance, and balance projections through `lib/dashboard/queries.ts`. Recent glimpses should extend that composition with recent remittances, units, expenses, maintenance, documents, and drivers while preserving the existing permission guard and avoiding new tables or duplicated business calculations.

**Alternatives considered**: Creating a new dashboard snapshot table was rejected because the requirement is a current glimpse, not historical analytics. Making each panel fetch independently from the browser was rejected because it would weaken the existing server-side permission boundary and create avoidable loading waterfalls.

## Decision: Use bounded table overflow only within data regions

**Rationale**: Fleet records have legitimate dense columns. A bounded overflow region preserves data comparison on phone while keeping the page header, navigation, filters, and primary actions usable. Compact mobile alternatives should be used where a table cannot remain readable.

**Alternatives considered**: Hiding columns without disclosure was rejected because it can conceal operational or financial context. Allowing the entire page to overflow horizontally was rejected by the mobile-first constitution principle.

## Decision: Preserve existing domain and security boundaries

**Rationale**: The feature changes presentation, not permissions, calculations, or record lifecycle. Existing server-side guards, Supabase RPC security, and domain actions remain authoritative. Recent glimpses must use the same permission outcomes as the full views.

**Alternatives considered**: Reworking queries or consolidating domain actions as part of the visual refresh was rejected as unnecessary scope and a data-integrity risk.
