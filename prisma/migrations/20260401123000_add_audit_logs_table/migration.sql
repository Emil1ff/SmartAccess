CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NULL,
  "entityId" INTEGER NULL,
  "statusCode" INTEGER NOT NULL,
  "ip" TEXT NULL,
  "userAgent" TEXT NULL,
  "requestBody" JSONB NULL,
  "errorMessage" TEXT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog" ("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_idx" ON "AuditLog" ("entity");
CREATE INDEX IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog" ("entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_statusCode_idx" ON "AuditLog" ("statusCode");
