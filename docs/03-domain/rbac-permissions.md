# RBAC and Permissions

Roles and permissions remain data-driven through `Role`, `Permission`, `UserRole`, and `RolePermission`. The API seeds `SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `SALES_PARTNER`, and `USER`, plus the initial user/audit/role permission set. Backend routes must enforce permissions; frontend visibility is not a security boundary.
