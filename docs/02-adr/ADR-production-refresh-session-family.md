# ADR — Production Refresh Session-Family Hardening

Status: Proposed; PRW-03 design only. No implementation authorization.

## Context

Phase-1 has refresh rotation and replay rejection but does not claim family-wide revocation. Production incident response requires explicit family lineage and compromise containment without accidentally revoking legitimate independent devices.

## Decision proposal

Use PostgreSQL-backed session families. Each login root creates an independent family; refresh rotation atomically consumes one generation and creates the next. Reuse revokes the entire family and emits a redacted security event. Preserve the current endpoint contract during a compatibility rollout.

The refresh transaction locks the current session and family rows in a fixed order, re-checks family/user status while locked, conditionally consumes the presented generation, and creates the successor before commit. Revocation uses the same family-row serialization/conditional transition. Legacy null-family rows are upgraded atomically on first refresh; after a seven-day compatibility window they are invalid and require login. Consumed generations are retained through token expiry plus seven days; terminal family metadata is retained 90 days, with bounded idempotent purge.

## Consequences

This provides a multi-instance authority and explicit compromise boundary, at the cost of schema/data lifecycle work, concurrency tests, retention policy, and product decisions about logout/password-change scope. It must be reviewed by GLM and Claude before code or migrations.

## Alternatives rejected for now

- In-memory family state: not multi-instance authoritative.
- Vendor-only session authority: creates unapproved hosting/vendor coupling.
- Global revoke on every replay: potentially disrupts unrelated legitimate devices without a product decision.

## Locked operational decisions

- Normal logout revokes current family; logout-all and disable/security compromise revoke all families; password change/reset is revoke-all.
- Access-token TTL remains 15 minutes.
- Same-device duplicate refresh is fail-closed; client single-flight is the availability mitigation.
