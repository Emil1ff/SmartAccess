INSERT INTO "Role" ("name", "isRoot", "createdAt", "updatedAt")
VALUES ('root', true, NOW(), NOW())
ON CONFLICT ("name") DO UPDATE
SET "isRoot" = EXCLUDED."isRoot", "updatedAt" = NOW();

INSERT INTO "Module" ("name", "createdAt", "updatedAt")
VALUES
	('users', NOW(), NOW()),
	('roles', NOW(), NOW()),
	('permissions', NOW(), NOW()),
	('modules', NOW(), NOW())
ON CONFLICT ("name") DO UPDATE
SET "updatedAt" = NOW();

INSERT INTO "Permission" ("moduleId", "action", "createdAt", "updatedAt")
SELECT m."id", a."action", NOW(), NOW()
FROM "Module" m
CROSS JOIN (
	VALUES ('view'), ('add'), ('edit'), ('delete')
) AS a("action")
WHERE m."name" IN ('users', 'roles', 'permissions', 'modules')
ON CONFLICT ("moduleId", "action") DO UPDATE
SET "updatedAt" = NOW();

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT r."id", p."id", NOW(), NOW()
FROM "Role" r
JOIN "Permission" p ON true
WHERE r."isRoot" = true
ON CONFLICT ("roleId", "permissionId") DO UPDATE
SET "updatedAt" = NOW();

INSERT INTO "User" (
	"firstName",
	"lastName",
	"email",
	"password",
	"birthDate",
	"gender",
	"roleId",
	"refreshTokenHash",
	"createdAt",
	"updatedAt"
)
SELECT
	'root',
	'root',
	'root@smarthub.az',
	'$2b$10$nzhDPNehyTB.bX0L47QQGOs4TSJ271vBRdIi9U3PP2TYn1Z7yPoP2',
	TIMESTAMP '2006-08-31 00:00:00',
	'other',
	r."id",
	NULL,
	NOW(),
	NOW()
FROM "Role" r
WHERE r."name" = 'root'
ON CONFLICT ("email") DO UPDATE
SET
	"firstName" = EXCLUDED."firstName",
	"lastName" = EXCLUDED."lastName",
	"password" = EXCLUDED."password",
	"birthDate" = EXCLUDED."birthDate",
	"gender" = EXCLUDED."gender",
	"roleId" = EXCLUDED."roleId",
	"updatedAt" = NOW();

CREATE OR REPLACE FUNCTION prevent_root_role_delete()
RETURNS TRIGGER AS $$
BEGIN
	IF OLD."isRoot" = true THEN
		RAISE EXCEPTION 'Root role cannot be deleted';
	END IF;

	RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_root_role_delete ON "Role";

CREATE TRIGGER trg_prevent_root_role_delete
BEFORE DELETE ON "Role"
FOR EACH ROW
EXECUTE FUNCTION prevent_root_role_delete();

CREATE OR REPLACE FUNCTION prevent_system_root_user_delete()
RETURNS TRIGGER AS $$
BEGIN
	IF OLD."email" = 'root@smarthub.az' THEN
		RAISE EXCEPTION 'System root user cannot be deleted';
	END IF;

	RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_system_root_user_delete ON "User";

CREATE TRIGGER trg_prevent_system_root_user_delete
BEFORE DELETE ON "User"
FOR EACH ROW
EXECUTE FUNCTION prevent_system_root_user_delete();
