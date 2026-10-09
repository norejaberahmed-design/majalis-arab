CREATE TABLE "council_post" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "council_post_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "council_post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "council_post_workspaceId_createdAt_idx" ON "council_post"("workspaceId", "createdAt");
CREATE INDEX "council_post_authorId_createdAt_idx" ON "council_post"("authorId", "createdAt");

CREATE TABLE "council_comment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "council_comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "council_post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "council_comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "council_comment_postId_createdAt_idx" ON "council_comment"("postId", "createdAt");
CREATE INDEX "council_comment_authorId_createdAt_idx" ON "council_comment"("authorId", "createdAt");

CREATE TABLE "council_reaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "council_reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "council_post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "council_reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "council_reaction_postId_userId_key" ON "council_reaction"("postId", "userId");
CREATE INDEX "council_reaction_userId_createdAt_idx" ON "council_reaction"("userId", "createdAt");

PRAGMA foreign_keys=ON;
