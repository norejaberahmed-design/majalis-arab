# Authentication and workspace isolation

Status: authentication and workspace-membership foundations are implemented; complete record-level authorization, abuse controls, and end-to-end isolation verification remain release blockers.

## Implemented foundations

- Better Auth with Prisma-backed user, session, account, and verification records.
- Email/password sign-up and sign-in, required email verification, password reset, secure production cookie settings, and server-side session lookup.
- Workspace and WorkspaceMember models with a unique `(workspaceId, userId)` membership pair and explicit roles.
- Server-side workspace selection checks the authenticated user's membership before setting the HTTP-only active-workspace cookie.
- State-changing workspace/entity requests validate Origin against the request's canonical origin; do not trust `X-Forwarded-Host` supplied by the client.
- JSON request parsing enforces content type and a byte limit.
- The entity-create API fails closed with HTTP 503 until shared-catalogue curator authorization is implemented.
- Production middleware keeps the main application behind a 503 release gate.

These foundations are not equivalent to a completed security review.

## Catalogue visibility policy

The core research catalogue is deliberately shared and read-only across authenticated workspaces: `TribalEntity`, `Relationship`, `Source`, `EvidencePassage`, `HistoricalClaim`, and `Place`. It must contain only public, non-confidential research records. Catalogue writes remain disabled until curator permissions, provenance requirements, and audit review are implemented.

See [Catalogue visibility and workspace privacy](CATALOGUE_VISIBILITY_AND_WORKSPACE_PRIVACY.md).

## Workspace-private records

`WorkspaceEntityNote`, `AdditionRequest`, `ResearchDecision`, and `AuditLog` are intended to be workspace-scoped. The schema and initial SQLite migration now require a workspace owner for the latter three models; workspace entity notes also require workspace, entity, and user IDs.

There are not yet complete CRUD interfaces for all private models, and cross-workspace negative integration tests are still required. Do not assume all future query paths are automatically safe because the schema contains a workspace ID. Every route/server action must authorize membership and scope each database read/write at the point of access.

## Remaining requirements before production

- Add durable shared-store rate limiting for sign-in, account creation, password reset, and state-changing endpoints.
- Add end-to-end tests for sign-up, email verification, sign-in, sign-out, password reset, workspace creation, and workspace switching.
- Add two-workspace integration tests for private records, guessed IDs, nested relation traversal, and role restrictions.
- Verify that unknown or stale roles fail closed and that no endpoint trusts client-provided user IDs or role claims.
- Commit a lockfile and use `npm ci` for reproducible installs.
- Review the full dependency audit; the current `braces` development-tool advisory has no upstream patched version listed.
- Configure real SMTP, canonical HTTPS URL, random production auth secret, backups/restore, and operational monitoring.
- Complete independent security review before handling sensitive information.

## Release gate

Keep production closed until all release criteria are implemented and verified on the exact candidate commit. Do not merge to `main` or deploy publicly based solely on unit tests, CodeQL, or a successful build.
