CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY, "phone" TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "Role" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE);
CREATE TABLE "Permission" ("id" TEXT NOT NULL PRIMARY KEY, "resource" TEXT NOT NULL, "action" TEXT NOT NULL, CONSTRAINT "Permission_resource_action_key" UNIQUE("resource","action"));
CREATE TABLE "UserRole" ("userId" TEXT NOT NULL, "roleId" TEXT NOT NULL, PRIMARY KEY("userId","roleId"), FOREIGN KEY("userId") REFERENCES "User"("id"), FOREIGN KEY("roleId") REFERENCES "Role"("id"));
CREATE TABLE "RolePermission" ("roleId" TEXT NOT NULL, "permissionId" TEXT NOT NULL, PRIMARY KEY("roleId","permissionId"), FOREIGN KEY("roleId") REFERENCES "Role"("id"), FOREIGN KEY("permissionId") REFERENCES "Permission"("id"));
CREATE TABLE "AuditLog" ("id" TEXT NOT NULL PRIMARY KEY, "actorUserId" TEXT, "action" TEXT NOT NULL, "entity" TEXT NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY("actorUserId") REFERENCES "User"("id"));
