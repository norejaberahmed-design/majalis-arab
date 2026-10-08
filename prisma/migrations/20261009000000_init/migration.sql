-- Initial schema for the shared research catalogue and workspace security layer.
PRAGMA foreign_keys=OFF;

CREATE TABLE "TribalEntity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'OTHER',
  "summary" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "TribalEntity_normalizedName_key" ON "TribalEntity"("normalizedName");
CREATE INDEX "TribalEntity_kind_idx" ON "TribalEntity"("kind");

CREATE TABLE "Source" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "publisher" TEXT,
  "publicationYear" INTEGER,
  "url" TEXT,
  "bibliographicNote" TEXT,
  "accessStatus" TEXT NOT NULL DEFAULT 'NOT_CHECKED',
  "accessCheckedAt" DATETIME,
  "extractionStatus" TEXT NOT NULL DEFAULT 'NOT_ATTEMPTED',
  "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Place" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "country" TEXT,
  "region" TEXT,
  "description" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  "sourceNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "Place_name_idx" ON "Place"("name");

CREATE TABLE "HistoricalClaim" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "statement" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UNREVIEWED',
  "confidenceNote" TEXT,
  "reviewerNote" TEXT,
  "reviewedByHuman" BOOLEAN NOT NULL DEFAULT false,
  "reviewedAt" DATETIME,
  "sourceId" TEXT,
  "entityId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "HistoricalClaim_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "HistoricalClaim_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "TribalEntity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "HistoricalClaim_status_updatedAt_idx" ON "HistoricalClaim"("status", "updatedAt");
CREATE INDEX "HistoricalClaim_entityId_idx" ON "HistoricalClaim"("entityId");

CREATE TABLE "EvidencePassage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceId" TEXT NOT NULL,
  "entityId" TEXT,
  "pageLabel" TEXT,
  "passageText" TEXT NOT NULL,
  "locator" TEXT,
  "extractedAt" DATETIME,
  "reviewedByHuman" BOOLEAN NOT NULL DEFAULT false,
  "reviewNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidencePassage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EvidencePassage_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "TribalEntity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "EvidencePassage_sourceId_pageLabel_idx" ON "EvidencePassage"("sourceId", "pageLabel");
CREATE INDEX "EvidencePassage_entityId_idx" ON "EvidencePassage"("entityId");

CREATE TABLE "Relationship" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fromEntityId" TEXT NOT NULL,
  "toEntityId" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL,
  "description" TEXT,
  "claimId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Relationship_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "TribalEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Relationship_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "TribalEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Relationship_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "HistoricalClaim" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Relationship_fromEntityId_relationshipType_idx" ON "Relationship"("fromEntityId", "relationshipType");
CREATE INDEX "Relationship_toEntityId_relationshipType_idx" ON "Relationship"("toEntityId", "relationshipType");

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

CREATE TABLE "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

CREATE TABLE "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" DATETIME NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL,
  CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE INDEX "session_userId_idx" ON "session"("userId");

CREATE TABLE "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" DATETIME,
  "refreshTokenExpiresAt" DATETIME,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "account_userId_idx" ON "account"("userId");

CREATE TABLE "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

CREATE TABLE "workspace_member" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'VIEWER',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_member_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workspace_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "workspace_member_workspaceId_userId_key" ON "workspace_member"("workspaceId", "userId");
CREATE INDEX "workspace_member_userId_role_idx" ON "workspace_member"("userId", "role");

CREATE TABLE "ResearchDecision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT,
  "decisionType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "reviewer" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchDecision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ResearchDecision_workspaceId_decisionType_targetId_idx" ON "ResearchDecision"("workspaceId", "decisionType", "targetId");
CREATE INDEX "ResearchDecision_decisionType_targetId_idx" ON "ResearchDecision"("decisionType", "targetId");

CREATE TABLE "AdditionRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT,
  "userId" TEXT,
  "entityId" TEXT,
  "proposedName" TEXT NOT NULL,
  "proposedKind" TEXT NOT NULL DEFAULT 'OTHER',
  "explanation" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "submitter" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "reviewerNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AdditionRequest_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "TribalEntity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdditionRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdditionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AdditionRequest_workspaceId_status_createdAt_idx" ON "AdditionRequest"("workspaceId", "status", "createdAt");
CREATE INDEX "AdditionRequest_userId_createdAt_idx" ON "AdditionRequest"("userId", "createdAt");
CREATE INDEX "AdditionRequest_status_createdAt_idx" ON "AdditionRequest"("status", "createdAt");

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT,
  "actorUserId" TEXT,
  "actor" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "details" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "AuditLog"("targetType", "targetId", "createdAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE TABLE "workspace_entity_note" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "workspace_entity_note_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workspace_entity_note_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "TribalEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workspace_entity_note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "workspace_entity_note_workspaceId_entityId_key" ON "workspace_entity_note"("workspaceId", "entityId");
CREATE INDEX "workspace_entity_note_workspaceId_updatedAt_idx" ON "workspace_entity_note"("workspaceId", "updatedAt");
CREATE INDEX "workspace_entity_note_userId_createdAt_idx" ON "workspace_entity_note"("userId", "createdAt");

-- Many-to-many join tables used by the evidence/claim relations.
CREATE TABLE "_ClaimSupportingPassages" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_ClaimSupportingPassages_A_fkey" FOREIGN KEY ("A") REFERENCES "EvidencePassage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "_ClaimSupportingPassages_B_fkey" FOREIGN KEY ("B") REFERENCES "HistoricalClaim" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "_ClaimSupportingPassages_AB_unique" ON "_ClaimSupportingPassages"("A", "B");
CREATE INDEX "_ClaimSupportingPassages_B_index" ON "_ClaimSupportingPassages"("B");

CREATE TABLE "_ClaimContradictingPassages" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_ClaimContradictingPassages_A_fkey" FOREIGN KEY ("A") REFERENCES "EvidencePassage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "_ClaimContradictingPassages_B_fkey" FOREIGN KEY ("B") REFERENCES "HistoricalClaim" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "_ClaimContradictingPassages_AB_unique" ON "_ClaimContradictingPassages"("A", "B");
CREATE INDEX "_ClaimContradictingPassages_B_index" ON "_ClaimContradictingPassages"("B");

PRAGMA foreign_keys=ON;
