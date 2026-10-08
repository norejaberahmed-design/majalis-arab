# Security policy

## Current release status

**Not production-ready.** Authentication, authorization, and per-user/workspace data isolation are not implemented. The production middleware intentionally returns HTTP 503 until those controls are implemented and reviewed. Do not remove that gate to make a deployment appear available.

## Reporting a vulnerability

Please do not publish exploit details, private records, credentials, or personal information in a public issue. Use GitHub's private vulnerability reporting / security advisory feature for this repository when available. Include the affected route or file, impact, reproduction steps, and a suggested mitigation. Do not include real user data.

## Required controls before public launch

- Authentication with secure session handling, account recovery, and session revocation.
- Authorization checks on every page, API route, and record operation.
- Workspace/tenant isolation enforced in the database access layer, not only in the UI.
- CSRF/origin protections for state-changing requests when cookie sessions are used.
- Durable rate limiting and abuse controls.
- Safe input validation, output minimization, and security headers.
- Dependency and static analysis checks; passing integration tests.
- Tested backup/restore and an incident response process.
- Independent security review / penetration test before accepting sensitive data.

## Test status

The repository contains unit tests and GitHub Actions workflows for validation, dependency auditing, build checks, and CodeQL analysis. A workflow definition is not proof that a workflow has run or passed. Verify the latest run results in the GitHub Actions tab before treating any check as passed.
