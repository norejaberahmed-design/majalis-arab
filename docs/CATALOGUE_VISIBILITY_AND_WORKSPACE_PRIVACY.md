# Catalogue visibility and workspace privacy policy

Status: Phase 1 implementation policy. Production remains blocked until authorization and isolation tests pass.

## Shared research catalogue

The core research catalogue is intentionally shared across authenticated workspaces. The following tables are catalogue data and must be treated as globally visible, non-confidential research records:

- `TribalEntity`
- `Relationship`
- `Source`
- `EvidencePassage`
- `HistoricalClaim`
- `Place`

A workspace cookie or membership does not make these records private. The UI must say that the catalogue is shared. Do not store private customer, member, or workspace notes in these tables.

The legacy `TribalEntity.notes` column remains in the current schema for migration compatibility, but is deprecated and must not be used for workspace-private content. Private annotations belong in `WorkspaceEntityNote`; removing the legacy column requires a reviewed migration and data inventory.

For Phase 1, entity, relationship, evidence-passage, historical-claim, and place mutations remain disabled. Source bibliographic registration is the narrow exception: it is enabled only when the authenticated user has at least the workspace REVIEWER role and their exact email is listed in the server-side `CATALOGUE_CURATOR_EMAILS` environment variable. An empty or missing allowlist denies all writes. Every source registration is schema-validated, rejects unsafe external URLs, starts with access status `NOT_CHECKED`, extraction status `NOT_ATTEMPTED`, and `humanReviewed=false`, and writes an audit event. This records bibliographic metadata only; it does not assert that a book was accessed, read, or verified. Configure the allowlist only after explicitly appointing trusted curators. Entity creation remains fail-closed with HTTP 503.

## Workspace-private records

The following records are workspace-scoped and must never be exposed across workspaces:

- `WorkspaceEntityNote` — require matching `workspaceId` and authenticated user membership for every read/write.
- `AdditionRequest` — require matching `workspaceId` and membership; do not allow null workspace ownership for user-submitted requests.
- `ResearchDecision` — require matching `workspaceId` and membership; null workspace records must not be exposed as private decisions.
- `AuditLog` — require matching `workspaceId` and membership for workspace views; do not expose other workspaces' actor or event details.

Every future API or server action must authenticate on the server and authorize membership/role at the point of access. UI visibility and cookie presence are not authorization.

## Release requirements

- Keep the production release gate enabled.
- Add negative cross-workspace tests for all private models, including guessed IDs and relation traversal.
- Review schema and migrations so workspace-private records cannot be created without an owner workspace.
- Verify catalogue reads contain only explicitly public data; keep all catalogue writes blocked except the narrowly allowlisted bibliographic-source intake described above until broader curator governance exists.
- Add API integration tests for curator denial/approval, unsafe URLs, audit-event creation, and source metadata remaining unreviewed.
- Revisit this policy before enabling any import, upload, annotation, review, or export feature.

This policy describes intended visibility; it is not proof that every path is already compliant.
