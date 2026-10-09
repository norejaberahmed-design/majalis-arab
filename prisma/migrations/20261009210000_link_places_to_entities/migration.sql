ALTER TABLE "Place" ADD COLUMN "entityId" TEXT REFERENCES "TribalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Place_entityId_idx" ON "Place"("entityId");
