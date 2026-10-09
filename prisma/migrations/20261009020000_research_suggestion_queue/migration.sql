CREATE TABLE "ResearchSuggestion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "passageId" TEXT NOT NULL,
  "statement" TEXT NOT NULL,
  "evidenceQuote" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedAt" DATETIME,
  "reviewedBy" TEXT,
  "reviewNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ResearchSuggestion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ResearchSuggestion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ResearchSuggestion_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "EvidencePassage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ResearchSuggestion_workspaceId_passageId_statement_key" ON "ResearchSuggestion"("workspaceId", "passageId", "statement");
CREATE INDEX "ResearchSuggestion_workspaceId_status_createdAt_idx" ON "ResearchSuggestion"("workspaceId", "status", "createdAt");
CREATE INDEX "ResearchSuggestion_sourceId_passageId_idx" ON "ResearchSuggestion"("sourceId", "passageId");
