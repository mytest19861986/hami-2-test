# ADR-0002: Baseline Existing Database in Prisma

## Decision

The existing local `hamayat_card` database was not created through Prisma Migrate and had no migration history, while its RBAC tables already existed. We used `prisma migrate resolve --applied 0001_identity_rbac` to record the known baseline without dropping or rewriting data, then applied `0002_auth_identity` and `0003_user_status_enum` normally.

## Validation

The existing-database path and a fresh temporary database both deploy all three migrations successfully. The temporary validation database was removed with `WITH (FORCE)` after verification; the main database was preserved.
