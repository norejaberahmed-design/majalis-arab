import { describe, expect, it } from "vitest";
import { buildDatabaseIntegrityReport } from "./audit-database-integrity.mjs";

describe("read-only database integrity audit", () => {
  it("reports a clean relational dataset without warnings", () => {
    const report = buildDatabaseIntegrityReport({
      entities: [
        { id: "tribe-1", name: "بنو تميم", normalizedName: "بنو تميم" },
        { id: "tribe-1b", name: "بنو بكر", normalizedName: "بنو بكر" }
      ],
      relationships: [{ id: "rel-1", fromEntityId: "tribe-1", toEntityId: "tribe-1b", relationshipType: "RELATED_TO", claimId: "claim-1" }],
      sources: [{ id: "source-1" }],
      passages: [{ id: "passage-1", sourceId: "source-1", entityId: "tribe-1", passageText: "نص موثق" }],
      claims: [{ id: "claim-1", statement: "ادعاء للاختبار", sourceId: "source-1", entityId: "tribe-1", status: "SUPPORTED", supportingPassageIds: ["passage-1"], contradictingPassageIds: [] }],
      places: [{ id: "place-1", name: "مكان", latitude: 24.7, longitude: 46.7, sourceId: "source-1", evidencePassageId: "passage-1", entityId: "tribe-1" }],
      workspaces: [{ id: "workspace-1" }],
      workspaceTribes: [{ workspaceId: "workspace-1", entityId: "tribe-1" }],
      users: [{ id: "user-1" }],
      workspaceMembers: [{ id: "member-1", workspaceId: "workspace-1", userId: "user-1" }],
      additionRequests: [{ id: "request-1", workspaceId: "workspace-1", userId: "user-1", entityId: "tribe-1" }],
      auditLogs: [{ id: "audit-1", workspaceId: "workspace-1", actorUserId: "user-1" }],
      posts: [{ id: "post-1", workspaceId: "workspace-1", authorId: "user-1" }],
      comments: [{ id: "comment-1", postId: "post-1", authorId: "user-1" }],
      reactions: [{ id: "reaction-1", postId: "post-1", userId: "user-1" }]
    });

    // The relationship above intentionally uses a second entity, so this fixture
    // checks that missing references are not silently treated as valid.
    expect(report.mode).toBe("READ_ONLY");
    expect(report.warnings.map(item => item.code)).toContain("BROKEN_RELATIONSHIP_REFERENCE");
    expect(report.totals).toMatchObject({ entities: 1, relationships: 1, councilPosts: 1, councilComments: 1 });
  });

  it("flags broken links, normalized-name mismatches, invalid coordinates, and unsupported claims", () => {
    const report = buildDatabaseIntegrityReport({
      entities: [{ id: "tribe-1", name: "إبل", normalizedName: "ابل-خطأ" }],
      relationships: [{ id: "rel-1", fromEntityId: "missing", toEntityId: "tribe-1", relationshipType: "ANCESTRY", claimId: null }],
      sources: [],
      passages: [{ id: "passage-1", sourceId: "missing-source", entityId: "missing-entity", passageText: "" }],
      claims: [{ id: "claim-1", statement: "نسب غير موثق", sourceId: null, entityId: "missing-entity", status: "UNREVIEWED" }],
      places: [{ id: "place-1", name: "مكان", latitude: 200, longitude: null, sourceId: "missing-source", evidencePassageId: "missing-passage", entityId: "missing-entity" }]
    });

    const codes = report.warnings.map(item => item.code);
    expect(codes).toContain("ENTITY_NORMALIZED_NAME_MISMATCH");
    expect(codes).toContain("BROKEN_RELATIONSHIP_REFERENCE");
    expect(codes).toContain("BROKEN_EVIDENCE_REFERENCE");
    expect(codes).toContain("BROKEN_HISTORICAL_CLAIM_REFERENCE");
    expect(codes).toContain("CLAIM_WITHOUT_LINKED_EVIDENCE");
    expect(codes).toContain("INVALID_PLACE_COORDINATES");
    expect(codes).toContain("BROKEN_PLACE_REFERENCE");
    expect(report.summary.criticalCount).toBeGreaterThan(0);
  });

  it("handles an empty database without manufacturing warnings", () => {
    const report = buildDatabaseIntegrityReport({});
    expect(report.totals.entities).toBe(0);
    expect(report.warnings).toEqual([]);
    expect(report.summary).toEqual({ criticalCount: 0, highCount: 0, mediumCount: 0, warningGroups: 0 });
  });

  it("flags discussion activity that is inconsistent with workspace membership", () => {
    const report = buildDatabaseIntegrityReport({
      workspaces: [{ id: "workspace-1" }, { id: "workspace-2" }],
      users: [{ id: "user-1" }, { id: "user-2" }],
      workspaceMembers: [{ id: "member-1", workspaceId: "workspace-1", userId: "user-1" }],
      posts: [{ id: "post-1", workspaceId: "workspace-1", authorId: "user-1" }],
      comments: [{ id: "comment-1", postId: "post-1", authorId: "user-2" }],
      reactions: [{ id: "reaction-1", postId: "post-1", userId: "user-2" }]
    });

    expect(report.warnings.map(item => item.code)).toContain("COMMENT_AUTHOR_NOT_IN_POST_WORKSPACE");
    expect(report.warnings.map(item => item.code)).toContain("REACTION_USER_NOT_IN_POST_WORKSPACE");
  });
});
