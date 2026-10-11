# API authorization inventory — Phase 1

Audit baseline: `main` at `42af5d2501af46d5ec6a208a85fc4ea7923abcfb` (2026-10-11).

This inventory is a review aid, not a security certification. A route is not considered safe merely because it imports a workspace helper; the helper's membership check, role requirement, object ownership predicate, and negative tests must all match the operation.

## Shared route controls

- Every state-changing browser route should validate the request origin with `hasTrustedOrigin` before parsing or mutating data.
- Every private-data route should derive the user and active workspace from the server session and the validated active-workspace cookie. Never accept a user ID, role, or workspace authorization claim from the request body.
- Membership and role checks must happen server-side for every mutation.
- All private database reads and writes must include the active `workspaceId` in their lookup predicates or prove ownership through a relation scoped to that workspace.
- Denials should not mutate the target record or create secondary records/audit events.
- Shared catalogue tables (`TribalEntity`, `Relationship`, `Source`, `EvidencePassage`, `HistoricalClaim`, `Place`) contain public research data only. Contributor submissions remain workspace-private until reviewed.

## API route inventory

| Route | Methods | Expected boundary | Direct route test in tree |
|---|---|---|---|
| `/api/auth/[...all]` | Better Auth handler | Better Auth origin checks, persistent rate limits, secure session cookies, password policy | No; covered partly by auth lifecycle and rate-limit integration tests |
| `/api/workspaces` | GET, POST | Authenticated user; only own memberships; create owner membership atomically; validate Origin for POST | No; workspace/auth integration tests cover some flows |
| `/api/workspaces/active` | POST | Authenticated membership must exist before setting HTTP-only workspace cookie | No; auth lifecycle integration test covers valid selection |
| `/api/workspaces/members` | GET, POST | Active workspace; role-gated membership changes; never trust body-supplied actor identity | No direct route test found |
| `/api/workspaces/tribe` | GET, POST, DELETE | Workspace-scoped link; OWNER-only mutations; audit mutation | Yes |
| `/api/council/posts` | GET, POST | Read/write scoped to active workspace; validate Origin for POST | No direct route test found; tenant-isolation integration test covers cross-workspace post access |
| `/api/council/posts/[id]/comments` | POST | Parent post must belong to active workspace before comment creation | No direct route test found; tenant-isolation integration test covers denied foreign-post writes |
| `/api/council/posts/[id]/reaction` | PUT | Parent post and reaction must be scoped to active workspace/user | No direct route test found; tenant-isolation integration test covers denied foreign-post writes |
| `/api/addition-requests` | GET, POST | Workspace-scoped requests; actor from session; role-gated review visibility | Yes |
| `/api/addition-requests/[id]` | PATCH | Target request must belong to active workspace; review role required | No direct route test found |
| `/api/tribes` | POST | Authenticated workspace; contribution stored as private, unreviewed request; never directly publish catalogue entry | Yes |
| `/api/entities` | GET, POST | Workspace/auth gate for reads; creation remains fail-closed until governance is enabled | Yes |
| `/api/entities/[id]/note` | GET, PUT, DELETE | Private note scoped by both entity and active workspace; writes validate Origin and role | Yes |
| `/api/sources` | POST | Reviewer role plus server-side curator allowlist; safe URL; unreviewed metadata; audit event | No direct route test found |
| `/api/sources/import` | POST | Auth, workspace and reviewer/curator authorization; bounded/validated batch | Yes |
| `/api/sources/[id]/passages` | POST | Source and inserted passages must be valid; reviewer authorization; no false human-review status | Yes |
| `/api/sources/[id]/passages/import` | POST | Auth/role checks; bounded batch; safe evidence provenance | Yes |
| `/api/curation/entities` | POST | Role-gated draft only; do not publish an asserted fact automatically | Yes |
| `/api/curation/relationships` | POST | Role-gated draft; validate both entity references; no unsupported claim of proof | Yes |
| `/api/curation/places` | POST | Role-gated draft; validate evidence and links | Yes |
| `/api/curation/claims` | POST | Role-gated draft; claim remains UNREVIEWED until governed review | Yes |
| `/api/curation/claims/[id]` | PATCH | Target claim/draft must be valid; no bypass of review-state rules | Yes |
| `/api/curation/drafts/[id]` | PATCH | Draft ID and all related data scoped to the active workspace; reviewer authorization | No direct route test found |
| `/api/curation/passages/[id]` | PATCH | Evidence/source relationships validated; reviewer authorization | Yes |
| `/api/curation/sources/[id]` | PATCH | Source review permissions and provenance/audit rules enforced | Yes |
| `/api/curation/claims` | GET/POST only if method added later | Add a negative authorization test whenever a new method is introduced | Current route exports POST only |

## Existing automated verification

The Phase 1 workflow on the baseline commit passed:

- Prisma schema validation and clean SQLite migrations.
- Migration-upgrade test preserving pre-existing source/workspace rows.
- Idempotent bibliography and public-domain passage seed checks.
- Unit tests and SQLite workspace-isolation integration tests.
- ESLint and production build.
- Production-only and full dependency audits.
- CodeQL analysis.

Workflow: https://github.com/norejaberahmed-design/majalis-arab/actions/runs/38130115171

## Remaining work before the release gate can be opened

1. Add direct negative tests for uncovered routes listed above, especially membership changes, review by guessed foreign IDs, source registration allowlist denial/approval, and origin rejection.
2. Extend Better Auth integration tests for expired reset tokens, email-delivery failure, and duplicate-account/resend behavior. Keep sign-up verification policy explicit; do not enable required verification until its full email lifecycle is proven.
3. Review every Server Action and every route that performs a write, not only files under `src/app/api`.
4. Test against a copy of any actual deployed database and document backup/restore and rollback procedures.
5. Keep the production release gate closed until the exact candidate passes CI and an independent security review is recorded.

Do not treat this inventory as evidence that the listed gaps have already been fixed. Update the table as tests and fixes are merged.
