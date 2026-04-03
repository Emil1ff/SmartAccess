-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Permission_moduleId_action_key" ON "Permission"("moduleId", "action");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");
