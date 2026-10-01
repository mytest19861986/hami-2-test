# Database Schema Overview

The Wave 0 identity foundation contains `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, and `AuditLog`. The canonical Prisma schema is in `packages/database/prisma/schema.prisma`; the executable SQL migration is in `packages/database/prisma/migrations/0001_identity_rbac/migration.sql` and is also mounted as a PostgreSQL initialization script.
