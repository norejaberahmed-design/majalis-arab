# Production Readiness Runbook

This checklist is evidence-driven. Do not open public production access or disable the release gate until every required item has a recorded result on the exact release candidate.

## 1. Secrets and incident response

- [ ] Revoke any provider credential that appeared in Git history; create a replacement through the provider dashboard.
- [ ] Rotate `BETTER_AUTH_SECRET` if the exposed value was ever used by a running environment. Invalidate existing sessions if required by the rotation plan.
- [ ] Remove exposed values from Git history using an owner-approved history rewrite; coordinate force-push impact with collaborators, then verify all branches, tags, pull-request refs, and available caches.
- [ ] Keep real values only in an untracked local `.env` or deployment secret manager. `.env.example` must contain blank placeholders only.
- [ ] Review provider usage and billing for unexpected activity; record who reviewed it and when.

## 2. Canonical URL and authentication

- [ ] Configure the canonical public HTTPS URL in `BETTER_AUTH_URL`.
- [ ] Configure `BETTER_AUTH_TRUSTED_ORIGINS` with exact approved origins only; no wildcard.
- [ ] Set a new high-entropy production `BETTER_AUTH_SECRET` in the deployment secret store.
- [ ] Test sign-up, email verification, sign-in, sign-out, password reset, session revocation, workspace creation/switching, and membership denial against the deployed candidate.
- [ ] Configure and test real SMTP delivery, including reset and verification messages. Do not mark delivery ready based on mocked CI.

## 3. Data protection and recovery

- [ ] Document the database location, owner, access boundary, and retention period.
- [ ] Create an encrypted backup using the deployment's supported method.
- [ ] Restore that backup into an isolated environment and verify record counts and application startup.
- [ ] Test the migration-upgrade path on a copy of the current database.
- [ ] Record a restore-based rollback procedure. Do not assume a down-migration exists or is safe.
- [ ] Verify scheduled backup success and alerting before enabling public traffic.

## 4. Monitoring and incident response

- [ ] Enable logs and alerts for application errors, authentication abuse, rate-limit events, database failures, and backup failures.
- [ ] Confirm logs do not contain passwords, session tokens, provider keys, or sensitive message content.
- [ ] Name an operator responsible for incident triage and document how to disable public traffic and rotate secrets.
- [ ] Confirm a tested recovery contact and escalation path.

## 5. Release evidence

- [ ] Run Phase 1 CI, production and full dependency audits, migration-upgrade tests, and CodeQL on the exact release-candidate commit.
- [ ] Complete the route and Server Action authorization review with direct negative tests for every state-changing path.
- [ ] Obtain an independent security review and record findings and resolutions.
- [ ] Attach evidence/links for all items above to issue #5.
- [ ] Only then may the release owner review whether to remove the production gate. A passing CI run alone is not release approval.

## Current known blockers

As of 2026-10-13, a provider-key-shaped value was reintroduced into the tracked `.env.example` and caught by the new regression test. The current file has been restored to blank placeholders, but key rotation and Git-history cleanup remain unresolved. Real SMTP, deployed HTTPS validation, recovery testing, and independent security review also remain unverified.
