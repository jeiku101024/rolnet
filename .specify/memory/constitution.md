<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0 (MINOR: principle III gains an explicit, bounded allowance for
  ordered multi-step writes)
- Modified principles:
  - III. Data Integrity and Auditability: added the multi-step write clause
- Added sections: none
- Removed sections: none
- Rationale: some single user actions need several writes that existing database functions cannot
  combine into one transaction (for example, recording a remittance and then its first payment, or
  an owner voiding payments and recording a corrected total). Spec 008 must not change the schema,
  and the existing create-then-pay form (components/forms/remittance-form.tsx) already works this
  way. The clause states the safety conditions those flows must meet.
- Migration impact: none. No schema or data changes. Existing flows that meet the four conditions
  are compliant without changes.
- Affected artifacts: specs/008-remittances-daily-view/plan.md and research.md R5 (now cite this
  clause); templates need no change.
- Approval: project owner, 2026-10-30 ("Apply all fixes" during /speckit-analyze remediation).
- Follow-up TODOs: none
-->
# ROLNET Constitution

## Core Principles

### I. Free-Tier Sustainability
Every service, hosting platform, database, dependency, and library MUST be usable in
production without a paid plan, license fee, or mandatory paid add-on. A proposed
dependency MUST have a documented free-tier path that covers the fleet's expected use.
Features that require paid infrastructure MUST NOT be merged. This keeps the system
affordable for a small-fleet operator and prevents hidden operating costs.

### II. Monolithic Simplicity
The system MUST be built and deployed as a single application. Microservices, distributed
queues, and independently deployed internal services are prohibited unless this constitution
is amended first. The team MUST prefer boring, mature, well-documented tools and the
simplest design that meets current requirements. Clever abstractions and speculative
infrastructure MUST be rejected when a direct implementation is sufficient. This minimizes
maintenance work and makes the system understandable by a small team.

### III. Data Integrity and Auditability
All monetary values MUST be stored and calculated as integer centavos; floating-point money
storage or arithmetic is prohibited. Every business record MUST include creation and update
timestamps. Records with business or audit value MUST use soft deletion with a deletion
timestamp or equivalent status and MUST NOT be physically deleted through normal application
flows. Database constraints and transactional updates MUST protect balances, payments, and
other related records from partial or invalid writes. Where one user action needs several writes
that existing database functions cannot combine into one transaction, the application MAY run them in
sequence only if: (1) each write is atomic and audited by itself; (2) the writes are ordered so that no
intermediate state overstates money received or understates money due; (3) retrying the action
converges on the intended final state through idempotency keys; and (4) a partial failure is shown to
the user with a plain-language way to finish. A single transactional database function is preferred
whenever a feature already changes the schema. These rules preserve a trustworthy
operational and financial history.

### IV. Mobile-First, Human-Centered Operations
Every feature MUST be fully usable on a phone-sized screen without horizontal scrolling or
desktop-only interactions. Primary actions MUST be easy to locate, forms MUST use plain
language and appropriate mobile input controls, and error messages MUST explain how to
recover. Workflows MUST be understandable and completable by a non-technical owner or staff
member without developer assistance. Acceptance review MUST include a mobile viewport and a
plain-language usability check.

### V. Compliance Document Lifecycle
The system MUST track each tricycle's OR/CR, licenses, franchise documents, insurance, and
any later compliance-document type. Every document record MUST include its type, applicable
vehicle or party, expiry date, status, and timestamps. The application MUST make expired and
soon-to-expire documents visible to the owner; expiry data MUST be queryable rather than
stored only in uploaded files or free-form notes. This prevents avoidable lapses in legal and
operational compliance.

## Technology and Cost Constraints

- The default architecture is one deployable application backed by one primary database.
- Selected platforms MUST document their free-tier limits and an export path for project data.
- Dependencies MUST be actively maintained, well documented, and free of runtime license fees.
- The design MUST stay within documented free-tier quotas for the expected small-fleet load.
- Uploaded documents and backups MUST use free storage options within their published limits.
- A simpler in-application or database-backed solution takes precedence over adding a service.

## Development Workflow and Quality Gates

- Every schema change MUST be represented by an ordered migration committed to version
  control. Manual production database edits are prohibited.
- Migrations MUST support a clean database setup and MUST preserve existing data during
  upgrades. Destructive transformations require a documented backup and recovery plan.
- Reviews MUST verify integer-centavo money handling, timestamps, soft deletion, and document
  expiry behavior wherever those concerns apply.
- Feature acceptance MUST exercise the primary workflow at a phone-sized viewport and confirm
  that labels, instructions, and recovery paths are understandable to non-technical users.
- Architecture or dependency changes MUST record why the choice is simpler than available
  alternatives and how it remains free to run.

## Governance

This constitution supersedes conflicting project practices and implementation preferences.
Every specification, implementation plan, task list, and change review MUST include an
explicit constitution-compliance check. Any exception requires a constitution amendment; a
code comment or implementation-plan note alone cannot waive a principle.

Amendments MUST document the proposed change, rationale, migration impact, and approval by the
project owner. Versions follow semantic versioning: MAJOR for removal or incompatible
redefinition of a principle, MINOR for a new principle or materially expanded requirement,
and PATCH for a clarification that does not change obligations. The constitution MUST be
reviewed whenever architecture, hosting, persistence, financial handling, compliance tracking,
or primary user workflows change.

**Version**: 1.1.0 | **Ratified**: 2026-10-19 | **Last Amended**: 2026-10-30
