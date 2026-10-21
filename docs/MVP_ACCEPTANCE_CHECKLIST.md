# Majalis Arab MVP Acceptance Checklist

This checklist is for the existing Next.js, Prisma, SQLite, and Better Auth application. It is a manual release checklist; checked items must be backed by a real test run or recorded browser evidence.

## 1. Safe setup and database
- [ ] Confirm the deployed/test environment points to the intended SQLite database.
- [ ] Take and verify a restorable database backup before migration.
- [ ] Validate Prisma schema and apply migrations to a clean temporary database.
- [ ] Test migration upgrade against a copy of existing data.
- [ ] Confirm no command resets, drops, or seeds fictional tribe/genealogy data.

## 2. Authentication and workspace
- [ ] Sign in with a valid account.
- [ ] Confirm invalid credentials fail without exposing sensitive details.
- [ ] Confirm unauthenticated requests to protected pages redirect or return 401.
- [ ] Create/select a workspace and confirm membership is required.
- [ ] Confirm OAuth is shown as usable only when provider credentials and callback configuration are valid.
- [ ] Confirm secrets, email addresses, and session tokens are absent from logs and UI.

## 3. Tribe discovery and proposals
- [ ] Search by an existing Arabic tribe/entity name.
- [ ] Verify results come from the database, not a hard-coded demo list.
- [ ] Search for an absent name and submit a proposal for review.
- [ ] Confirm a proposal is not automatically published as a verified entity.
- [ ] Confirm aliases/normalization do not silently merge records.
- [ ] Verify source attribution and human-review status are visible where applicable.

## 4. Councils and discussion
- [ ] Open the general workspace council.
- [ ] Open a tribe-specific council from a real catalogue entity.
- [ ] Publish a post and verify it persists after refresh.
- [ ] Add a comment and verify author/content/persistence.
- [ ] Add and remove a reaction and verify counts/state.
- [ ] Confirm workspace posts do not leak across workspaces.
- [ ] Confirm tribe-council posts are shared only according to the documented access policy.
- [ ] Confirm invalid Origin and oversized content are rejected.

## 5. Direct messages and privacy
- [ ] Start a conversation with an eligible member.
- [ ] Send a message and verify both participants see the correct thread.
- [ ] Switch quickly between conversations and verify messages do not appear in the wrong thread.
- [ ] Confirm non-members cannot read or send messages.
- [ ] Confirm removing membership revokes access as specified.
- [ ] Confirm regular members cannot see another member's email address.

## 6. Research catalogue and moderation
- [ ] Add a source with bibliographic details and a verifiable URL.
- [ ] Add an evidence passage linked to its source and locator.
- [ ] Submit a claim and verify it remains unreviewed until a reviewer acts.
- [ ] Confirm unsupported lineage/history is never presented as verified.
- [ ] Confirm user contributions are labeled unreviewed and can be reported.
- [ ] Verify reporting/review actions are permission-protected and audited.

## 7. Technical release checks
- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] TypeScript check (use the repository's configured command).
- [ ] `npm run build`
- [ ] Prisma schema validation and migration-upgrade test.
- [ ] Database integrity audit; review all warnings.
- [ ] Dependency audit and CodeQL.
- [ ] Complete phone-sized browser walkthrough in a test deployment.
- [ ] Verify backup restore procedure.
- [ ] Verify production environment variables, trusted origins, email delivery, rate limits, HTTPS, and monitoring.

## Release decision
Do not mark the application production-ready solely because CI passes. Record the commit SHA, workflow run links, database migration result, browser-test evidence, unresolved issues, and rollback plan. Keep public traffic disabled until the deployment-specific checks pass.
