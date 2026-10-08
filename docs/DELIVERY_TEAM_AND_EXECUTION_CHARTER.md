# Majalis Al-Arab — Delivery Team and Execution Charter

**Status:** Active engineering plan. This document does not claim that the application is production-ready.

## Mission

Deliver a reliable Arabic-first research platform for Arab tribal, historical, geographic, and documentary research. Preserve the distinction between what a source explicitly states, what a researcher infers, what conflicts with other sources, and what remains unknown. The application must never fabricate lineage, affiliation, historical facts, citations, or review outcomes.

## Working team

These are the specialist responsibilities used to review and execute the work. They are not a claim that named human specialists have been hired or that external experts have endorsed the product.

1. **Engineering lead / delivery owner** — architecture, sequencing, risk decisions, release criteria, integration.
2. **Arabian history and tribal-research methodology** — careful terminology and research workflows; identify claims requiring qualified human review. No single tribal narrative is privileged by default.
3. **Primary-source and archival research** — bibliographic completeness, source type, date/context, exact page/folio/line locators, source provenance, transcription uncertainty.
4. **Data modelling / knowledge graph** — entities, relationships, places, claim-level evidence, alternative interpretations, contradictions, temporal validity.
5. **Backend / API engineering** — server-side identity, authorization on every operation, schema validation, safe errors, audit events, rate limits.
6. **Frontend / Arabic UX** — accessible RTL interface, mobile-first navigation, clear source/evidence states, honest empty/error/loading states.
7. **Application security / privacy** — session lifecycle, CSRF/origin controls, least privilege, secret management, tenant isolation, abuse protection, backup/restore.
8. **QA / release engineering** — migrations, type checking, lint, build, unit/integration/e2e tests, CI evidence, regression and authorization matrix.
9. **AI-assisted research engineering** — source-grounded retrieval, quoted passages with locators, extraction uncertainty, prompt-injection resistance, human approval. AI output is never itself a source.

## Research and evidence policy

- A source is not automatically reliable merely because it is old, published, popular, or digitized.
- Store the exact source reference and precise passage supporting each claim. Preserve original wording separately from normalized names and interpretations.
- Track source provenance, author/creator, edition, publication date, page/folio/record identifier, URL or archive identifier, access date, transcription method, and review history where available.
- Keep claim status distinct from source quality and model confidence. Suggested states: UNREVIEWED, SUPPORTED, CONTESTED, INSUFFICIENT_EVIDENCE, REJECTED; only an authorized human reviewer can finalize a review decision.
- Record contradictory evidence rather than silently selecting one account. Allow competing claims and explain why evidence supports or fails to support each one.
- Never infer that people or groups share lineage merely because their names resemble each other.
- Do not expose sensitive personal data or publish user submissions by default. Apply appropriate consent, takedown, correction, and review procedures.
- Every AI-assisted extraction must be traceable to source material and marked as machine-generated until reviewed.

## Delivery sequence and exit gates

### Gate 0 — Establish a trustworthy baseline
- Inspect the actual branch, schema, routes, workflows, and pending changes.
- Run or obtain verifiable CI results; do not infer success from a commit existing.
- Verify Prisma schema against the committed SQLite migration and the existing database upgrade path.
- Keep the production release gate closed.

### Gate 1 — Authentication and account lifecycle
- Verify sign-up, email verification, sign-in, sign-out, session expiry/revocation, and password reset.
- Use HTTPS-only production configuration and configured email delivery; do not log live verification or reset tokens in production.
- Add abuse controls and generic responses where needed to avoid account enumeration.

### Gate 2 — Workspace and authorization
- Derive identity exclusively from a server-verified session.
- Define shared research-catalogue data separately from private workspace notes, submissions, decisions, and audit events.
- Enforce membership and role checks server-side on every API and server action.
- Add two-user/two-workspace tests for reads, writes, updates, deletes, relationships, exports, and search. Test attempts to reference records owned by another workspace.
- Do not treat middleware as a replacement for per-operation authorization.

### Gate 3 — Research catalogue and evidence workflow
- Complete CRUD flows for entities, relationships, sources, passages, places, claims, and review decisions.
- Validate relationship endpoints and prevent invalid/self relationships where the domain requires it.
- Ensure claims cannot appear as verified without an authorized human decision and traceable evidence.
- Include source citations and uncertainty in detail pages and exports.

### Gate 4 — UI and accessibility
- Verify all navigation, forms, filters, pagination, mobile layouts, RTL direction, keyboard access, and accessible labels.
- Make loading, empty, validation, permission-denied, not-found, and server-error states explicit.
- Remove demo metrics, placeholder success states, and unsupported claims of verification.

### Gate 5 — Verification and release
- Run dependency installation/lockfile checks, Prisma validate/generate/migrations, lint, typecheck, unit tests, integration tests, production build, and end-to-end smoke tests.
- Require successful CI on the exact candidate commit.
- Review secrets, headers, cookies, rate limits, error leakage, logs, backups, restore procedure, and data-retention policy.
- Keep release blocked if any critical check is missing or fails. Do not merge or deploy without explicit release approval.

## Definition of done

A feature is done only when its code, schema/migration, permission checks, user-facing states, tests, documentation, and CI evidence agree. A commit is not proof that code works. Any unverified item must be reported as unverified.

## Current known limitation

The repository has received initial authentication/workspace scaffolding, but complete authorization coverage, membership administration, full migration compatibility, and end-to-end isolation verification have not yet been demonstrated. Production access must remain blocked until the release gates above are satisfied.