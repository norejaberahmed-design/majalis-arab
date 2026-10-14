ALTER TABLE "council_post" ADD COLUMN "tribeEntityId" TEXT REFERENCES "TribalEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "council_post_tribeEntityId_createdAt_idx" ON "council_post"("tribeEntityId", "createdAt");
