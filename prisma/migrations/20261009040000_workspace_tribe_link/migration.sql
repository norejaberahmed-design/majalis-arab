CREATE TABLE "WorkspaceTribe" (
  "workspaceId" TEXT NOT NULL PRIMARY KEY,
  "entityId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceTribe_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceTribe_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "TribalEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkspaceTribe_entityId_idx" ON "WorkspaceTribe"("entityId");
