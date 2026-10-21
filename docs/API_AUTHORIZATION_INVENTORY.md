# API Authorization Inventory

Audit baseline: `main` as inspected on 2026-10-13 after the neutral assistant route was added. This is a static route inventory and review aid, not an independent penetration test or production security certification.

## Shared authorization invariants

1. Authenticate workspace-private requests from the server-side Better Auth session.
2. Resolve the active workspace from a verified membership; never trust a client-provided user ID, workspace role, or unvalidated workspace cookie.
3. Validate trusted Origin before every state-changing browser request.
4. Scope private reads and writes by the resolved `workspaceId`; guessed foreign IDs must not reveal or mutate private records.
5. Keep shared-catalogue writes behind reviewer-level membership and the configured `CATALOGUE_CURATOR_EMAILS` allowlist.
6. Require human-reviewed source/passage evidence for factual claims, places, and relationships. OCR candidates remain `UNREVIEWED`.
7. Denials must not mutate target records or create secondary records/audit events. Use no-store cache headers for private responses.

## API route inventory

| Route | Methods | Expected boundary | Automated evidence |
|---|---|---|---|
| `/api/assistant` | POST | Trusted Origin + authenticated active-workspace membership; bounded message count/length; server-only API key; no app-database conversation persistence; upstream errors are bounded | `assistant/route.test.ts` covers origin/session denial, validation, missing key, mocked response, and `store: false`\n| `/api/auth/[...all]` | Better Auth handler | Better Auth origin checks, persistent rate limits, secure session cookies and password policy | Authentication lifecycle integration; expiry, SMTP failure, resend, duplicate-sign-up and rate-limit regression tests |
| `/api/workspaces` | GET, POST | Authenticated user; GET lists only own memberships; POST creates caller as OWNER and validates Origin | Auth lifecycle integration |
| `/api/workspaces/active` | POST | Caller must be a member before the HTTP-only active-workspace cookie is set | Auth lifecycle integration verifies foreign-workspace rejection |
| `/api/workspaces/members` | GET, POST | Active workspace; writes require trusted Origin and EDITOR-or-higher; membership predicates are workspace-scoped; client-supplied role is not authority | `workspaces/members/route.test.ts` verifies a submitted `role: OWNER` is stored as `VIEWER` |
| `/api/workspaces/tribe` | GET, POST, DELETE | Workspace-scoped link; mutations require trusted Origin and OWNER; only TRIBE/CLAN entities are linkable | `workspaces/tribe/route.test.ts` |
| `/api/tribes` | POST | Authenticated member + trusted Origin; contributions to existing profiles remain UNREVIEWED; missing names go to an addition-request workflow | `tribes/route.test.ts` |
| `/api/entities` | GET, POST | Authenticated member for shared-catalogue search; POST deliberately returns 503 until catalogue governance is enabled | `entities/route.test.ts` |
| `/api/entities/[id]/note` | GET, PUT, DELETE | Private note scoped by workspace and entity; writes require trusted Origin and EDITOR-or-higher | `entities/[id]/note/route.test.ts`; tenant-isolation integration |
| `/api/addition-requests` | GET, POST | Authenticated member; VIEWER sees own requests, REVIEWER sees requests in active workspace; actor is derived from session | `addition-requests/route.test.ts`; tenant-isolation integration |
| `/api/addition-requests/[id]` | PATCH | REVIEWER-or-higher, trusted Origin; target lookup and compare-and-set update constrained by request ID and workspace ID | `addition-requests/[id]/route.test.ts`; tenant-isolation integration |
| `/api/council/posts` | GET, POST | Authenticated workspace member; general posts are workspace-scoped; tribe posts are shared by `tribeEntityId`; POST validates Origin and validates tribe kind | Tenant-isolation integration; shared tribe-council checks required |
| `/api/council/posts/[id]/comments` | POST | Parent must belong to active workspace or be a shared tribe-council post; trusted Origin | Tenant-isolation integration tests denied foreign general-post writes; shared tribe-council tests required |
| `/api/council/posts/[id]/reaction` | PUT | Target must belong to active workspace or be a shared tribe-council post; reaction is keyed to current user; trusted Origin | Tenant-isolation integration tests denied foreign general-post writes; shared tribe-council tests required |
| `/api/curation/entities` | POST | REVIEWER-or-higher plus configured curator allowlist; trusted Origin; audit metadata | `curation/entities/route.test.ts` |
| `/api/curation/sources/[id]` | PATCH | REVIEWER-or-higher plus curator allowlist; trusted Origin; source review changes audited | `curation/sources/[id]/route.test.ts` |
| `/api/curation/claims` | POST | REVIEWER-or-higher plus curator allowlist; trusted Origin; requires reviewed source and evidence passages | `curation/claims/route.test.ts` |
| `/api/curation/claims/[id]` | PATCH | REVIEWER-or-higher plus curator allowlist; trusted Origin; claim review transitions validated | `curation/claims/[id]/route.test.ts` |
| `/api/curation/passages/[id]` | PATCH | REVIEWER-or-higher plus curator allowlist; trusted Origin; evidence review transitions audited | `curation/passages/[id]/route.test.ts` |
| `/api/curation/places` | POST | REVIEWER-or-higher plus curator allowlist; trusted Origin; requires reviewed source passage and evidence/name check | `curation/places/route.test.ts` |
| `/api/curation/relationships` | POST | REVIEWER-or-higher plus curator allowlist; trusted Origin; entity references and supporting reviewed evidence validated | `curation/relationships/route.test.ts` |
| `/api/curation/drafts/[id]` | PATCH | REVIEWER-or-higher plus curator allowlist; draft lookup/update scoped by active workspace | Tenant-isolation integration rejects foreign draft IDs |
| `/api/sources` | POST | REVIEWER-or-higher plus curator allowlist; trusted Origin; safe URL validation, audit event, new source remains unreviewed | `sources/route.test.ts` |
| `/api/sources/import` | POST | REVIEWER-or-higher plus curator allowlist; trusted Origin; bounded batch and per-row validation | `sources/import/route.test.ts` |
| `/api/sources/[id]/passages` | POST | Reviewer/curator gate, trusted Origin; evidence intake must not falsely set human-reviewed status | `sources/[id]/passages/route.test.ts` |
| `/api/sources/[id]/passages/import` | POST | Reviewer/curator gate, trusted Origin; bounded batch, duplicate checks, provenance retained | `sources/[id]/passages/import/route.test.ts` |

## Automated verification present in the repository

- SQLite tenant-isolation tests verify that foreign addition requests, private notes, council posts/comments/reactions, and curation drafts cannot be read or mutated through guessed IDs.
- Authentication lifecycle tests cover sign-up, sign-in/out, password reset, session revocation after reset, workspace creation/switching, and foreign-workspace rejection.
- Additional authentication regression tests cover persistent sign-in rate limits, SMTP failure, expired verification/reset tokens, resend, and duplicate-account enumeration.
- Direct route tests exist for assistant requests, addition request submission and review, curation claims/entities/passages/places/relationships/sources, entity search/notes, source intake/import, tribe contributions, workspace creation/listing/members, and workspace-to-tribe linking.
- CI runs Prisma schema/migration checks, tests, lint, production build, dependency audit, and CodeQL.

## Remaining release blockers

1. Finish the authorization review for every Server Action and every state-changing route; add direct negative tests for any uncovered path, especially membership changes, origin rejection, and curator allowlist denial/approval.
2. Decide explicitly whether production sign-up requires email verification. It is currently not required; do not enable it without validated end-to-end verification UX and production email delivery.
3. Validate migrations against a copy of any actual deployed database and document backup/restore and rollback procedures.
4. Configure and verify real SMTP, canonical HTTPS URL, strong production auth secret, monitoring and incident response.
5. Run all release checks on one exact release-candidate commit and record an independent security review.

**Do not deploy publicly yet.** This inventory records static review and current tests; it is not proof of a completed independent security review.

## Latest regression additions (2026-10-13)

- `src/app/api/curation/entities/route.test.ts`: negative cases verify untrusted Origin is rejected before workspace lookup/transaction, a non-allowlisted reviewer is denied, and curator allowlisting does not bypass the required reviewer role.
- `src/app/api/workspaces/members/route.test.ts`: a client request that submits `role: OWNER` must create the new member as `VIEWER`.
- `src/lib/env-example-safety.test.ts`: CI requires secret-bearing entries in `.env.example` to remain empty and rejects provider API-key-shaped strings.
- These tests passed in Phase 1 checks and CodeQL on the PR candidates before merge. Main-branch checks passed on commit `fb492e7d2f803aba508d49769e62dc621b0f05fd`; the latest `main` credential-placeholder repair is under revalidation.
- A provider-key-shaped value was reintroduced in an older `.env.example` commit, caught by the regression test, and removed from the current file again. Rotation and Git-history cleanup remain unresolved and are not covered by these tests.
