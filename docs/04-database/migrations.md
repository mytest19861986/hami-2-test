# Migrations

The initial RBAC migration creates six tables with primary keys, unique constraints for phone/role/permission identity, and foreign keys for role/user and role/permission membership. Fresh PostgreSQL volumes apply `infra/docker/postgres/001_identity_rbac.sql` automatically.
