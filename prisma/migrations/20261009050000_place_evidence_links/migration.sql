ALTER TABLE "Place" ADD COLUMN "sourceId" TEXT REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Place" ADD COLUMN "evidencePassageId" TEXT REFERENCES "EvidencePassage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Place_sourceId_idx" ON "Place"("sourceId");
CREATE INDEX "Place_evidencePassageId_idx" ON "Place"("evidencePassageId");
