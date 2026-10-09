CREATE TABLE "TribeKnowledgeEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entityId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UNREVIEWED',
  "createdByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TribeKnowledgeEntry_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "TribalEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TribeKnowledgeEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TribeKnowledgeEntry_entityId_status_createdAt_idx" ON "TribeKnowledgeEntry"("entityId", "status", "createdAt");
CREATE INDEX "TribeKnowledgeEntry_createdByUserId_createdAt_idx" ON "TribeKnowledgeEntry"("createdByUserId", "createdAt");
