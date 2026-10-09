# Authentication and workspace isolation

Status: workspace isolation, SQLite migration-upgrade, authentication lifecycle, persistent rate-limit enforcement, and password-reset session revocation have passing integration/regression tests. Email failure/expiry cases, complete authorization inventory, and final independent release review remain blockers.

## Implemented foundations

- Better Auth with Prisma-backed user, session, account, and verification records.
- Email/password sign-up and sign-in, required email verification, password reset, secure production cookie settings, and server-side session lookup.
- Workspace and WorkspaceMember models with a unique `(workspaceId, userId)` membership pair and explicit roles.
- Server-side workspace selection checks the authenticated user's membership before setting the HTTP-only active-workspace cookie.
- State-changing requests validate Origin against the request's canonical origin; do not trust client-supplied `X-Forwarded-Host`.
- Better Auth uses persistent database-backed rate limiting with stricter per-endpoint rules for sign-in, sign-up, password-reset requests, and password resets. CI verifies the sign-in limit returns HTTP 429.
- Password-reset emails link directly to the implemented `/reset-password?token=...` page, and a successful password reset revokes existing sessions.
- JSON request parsing enforces content type and a byte limit.
- Entity creation remains fail-closed with HTTP 503. Source bibliographic registration is the narrow exception: it requires reviewer role plus the server-side curator allowlist, validates input and URLs, and writes an audit event.
- Production middleware keeps the main application behind a 503 release gate.
- CI uses a committed `package-lock.json` and `npm ci`; the full-tree and production dependency audits reported zero vulnerabilities on the verified candidate.

These foundations are not equivalent to a completed security review.

## Catalogue visibility policy

The core research catalogue is deliberately shared and read-only across authenticated workspaces: `TribalEntity`, `Relationship`, `Source`, `EvidencePassage`, `HistoricalClaim`, and `Place`. It must contain only public, non-confidential research records. The research dashboard, entity search/profile, claims list, source list, and source detail require an authenticated workspace before querying catalogue records.

Entity, relationship, claim, and place mutations remain disabled. Source registration records bibliographic metadata only and starts unverified. A curation draft is not published as a proven historical claim: approval creates an `UNREVIEWED` claim and never marks it as human-reviewed.

See [Catalogue visibility and workspace privacy](CATALOGUE_VISIBILITY_AND_WORKSPACE_PRIVACY.md).

## Workspace-private records and tested boundaries

Private records require a non-null workspace owner in the Prisma schema. `ResearchDecision` currently has no exposed CRUD route; `AuditLog` has no read endpoint and writes are attached to the active workspace.

Real SQLite integration tests exercise the current private-data routes with two separate workspaces. They verify that a workspace cannot:
- list another workspace's addition request or council post;
- review a guessed foreign addition-request or curation-draft ID;
- add a comment or reaction to a post belonging to another workspace;
- read a private entity note stored only in another workspace.

The tests also verify denied writes do not change the foreign record, create a comment/reaction, create a claim, or add an audit event in the requesting workspace. New routes and server actions must add equivalent negative tests before release; a workspace ID column alone is not an authorization boundary.

## Remaining requirements before production

- Test SMTP delivery failures, expired verification/reset tokens, resend verification, and duplicate-account enumeration behavior.
- Finish a route/server-action authorization inventory and add negative tests for uncovered state-changing paths; verify no endpoint trusts client-supplied user IDs or role claims.
- Validate the migration upgrade path against a copy of any actual deployed database before a production release. CI now tests incremental migrations from the initial schema while preserving pre-existing source/workspace rows.
- Configure real SMTP, canonical HTTPS URL, random production auth secret, backups/restore, and operational monitoring.
- Complete independent security review before handling sensitive information.

## Release gate

Keep production closed until all release criteria are implemented and verified on the exact candidate commit. Passing CI, dependency audits, and CodeQL does not replace authentication lifecycle tests or the final release review.
