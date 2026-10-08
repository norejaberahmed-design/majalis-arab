# Authentication and workspace-isolation implementation plan

Status: design gate for Phase 1. This document is not evidence that authentication or isolation has been implemented.

## Security boundary

- Keep the production release gate enabled until all release criteria below are met.
- Research catalogue records (tribal entities, relationships, sources, evidence passages, claims, and places) are shared reference data only if the product owner explicitly confirms that this is the intended visibility model. Until then, do not add sensitive/private material.
- User submissions, reviewer decisions/notes, and audit events must not become globally readable by default.
- Never treat a hidden UI control, client-provided user/workspace ID, or a URL identifier as authorization.

## Intended identity and tenancy model

1. Use a maintained authentication library with Prisma support and secure server-managed sessions. Do not implement password hashing or session tokens from scratch.
2. Add User, Session, Account, and Verification models exactly as required by the chosen library version. Pin the library version and validate its generated schema before migration.
3. Add Workspace and WorkspaceMember. Membership has a unique (workspaceId, userId) pair and an explicit role (OWNER, EDITOR, REVIEWER, VIEWER).
4. Resolve the authenticated user from the verified server session. Resolve the workspace from a trusted membership lookup; never trust a submitted userId, role, or workspaceId without checking membership.
5. Put authorization in shared server-side helpers and call them in every private page and route handler. Use deny-by-default and least privilege.
6. Keep canonical research records shared only if that is a deliberate product decision. Workspace-private notes, review decisions, requests, drafts, and audit data must carry workspace ownership and be queried with that scope in the database.
7. Any mutation must validate input, authorize the action, perform the change and audit event in one transaction, and avoid returning private fields unnecessarily.

## Required abuse protections

- Rate-limit sign-in, password reset, account creation, and write APIs using a durable shared store in deployed environments; an in-memory counter is not sufficient for multi-instance hosting.
- Enforce same-origin/CSRF protections for cookie-authenticated state-changing requests.
- Set secure cookie attributes in production and define session expiration/revocation behavior.
- Avoid public user enumeration in authentication responses. Do not log passwords, session tokens, reset tokens, or submitted sensitive research text.
- Configure secrets outside source control. Production startup must fail safely if required secrets are missing or weak.
- Define backups, restore drills, retention/deletion, and hosting/database encryption controls.

## Required isolation tests

Create at least two independent users in two workspaces and test both pages and direct API calls:
- User A cannot list, read, update, or delete User B's private records by changing IDs, query parameters, request bodies, or headers.
- A viewer cannot mutate records; an editor cannot perform reviewer/owner-only actions; a reviewer cannot manage membership.
- Missing, expired, revoked, and malformed sessions are denied.
- Cross-workspace relation IDs are rejected, including nested relations and audit lookups.
- Unauthorized requests do not leak whether a private record exists.
- Invalid JSON, oversized bodies, and wrong content types remain rejected.
- Audit entries are written for successful privileged mutations and are not user-editable.
- Tests run against a temporary SQLite database with migrations applied, not mocked Prisma calls alone.

## Release criteria

Do not remove the production 503 gate until all are true:
- Auth/session configuration and migrations are committed.
- Every page and API route has a documented public/private boundary and server-side authorization.
- Workspace ownership is enforced in schema constraints and database query paths for all private records.
- The isolation/role tests above pass.
- CI reports successful Prisma validation, tests, lint, and production build on the exact PR head.
- Dependency/security checks are reviewed, deployment secrets and backups are configured, and an independent security review is complete.

No implementation is complete merely because these requirements are documented.