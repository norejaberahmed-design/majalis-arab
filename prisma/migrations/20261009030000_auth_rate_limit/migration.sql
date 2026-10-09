CREATE TABLE "rateLimit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL
);
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");
