CREATE TABLE "direct_conversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "participantAId" TEXT NOT NULL,
  "participantBId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "direct_conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "direct_conversation_participantAId_fkey" FOREIGN KEY ("participantAId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "direct_conversation_participantBId_fkey" FOREIGN KEY ("participantBId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "direct_conversation_workspaceId_participantAId_participantBId_key" ON "direct_conversation"("workspaceId", "participantAId", "participantBId");
CREATE INDEX "direct_conversation_workspaceId_updatedAt_idx" ON "direct_conversation"("workspaceId", "updatedAt");
CREATE INDEX "direct_conversation_participantAId_updatedAt_idx" ON "direct_conversation"("participantAId", "updatedAt");
CREATE INDEX "direct_conversation_participantBId_updatedAt_idx" ON "direct_conversation"("participantBId", "updatedAt");

CREATE TABLE "direct_message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_message_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "direct_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "direct_conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "direct_message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "direct_message_workspaceId_conversationId_createdAt_idx" ON "direct_message"("workspaceId", "conversationId", "createdAt");
CREATE INDEX "direct_message_authorId_createdAt_idx" ON "direct_message"("authorId", "createdAt");
