# Copilot instructions for Majalis Arab

Read and follow the repository-wide instructions in `/AGENTS.md` before making changes.

For any assistant behavior, content-analysis, discussion-moderation, historical-research, or source-comparison feature, follow `docs/MAJALIS_AGENT_SPEC.md`.

Project-specific expectations:
- Preserve the existing Next.js, TypeScript, Prisma, and SQLite architecture unless a verified requirement justifies a change.
- Do not fabricate tribal histories, genealogies, citations, sources, or test results.
- Distinguish candidate records, user-submitted narratives, reviewed evidence, and confirmed facts.
- Keep responses neutral and respectful; do not favor a group based on identity.
- Protect authentication, authorization, workspace isolation, privacy, and the production launch gate.
- Inspect relevant files first, make small reviewable changes, and add or run appropriate tests.
- Report only work actually completed and checks actually run. Do not claim production readiness without evidence.
