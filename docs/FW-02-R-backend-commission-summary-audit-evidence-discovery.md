# FW-02-R Backend Commission Summary — F1 Audit Evidence Discovery

Status: read-only discovery; no audit event, pipeline, authorization, or application behavior was changed.

## Existing evidence reviewed

- `packages/database/prisma/schema.prisma` defines the append-only `AuditLog` record shape: `actorUserId`, `action`, `entity`, and `createdAt`.
- `apps/api/src/auth.mjs` exposes `audit(actorUserId, action, entity)` and persists exactly those fields.
- Existing API actions write audit records for registration, login, profile/status changes, attribution creation, commission decisions, and other mutations.
- `SalesCommissionController.representativeSummary()` calls `currentWithPermission()` and returns the read DTO, but does not call `audit()` for an allowed or denied summary view.
- `currentWithPermission()` raises `UNAUTHORIZED` or `FORBIDDEN`; the existing audit call sites do not record a `VIEW_COMMISSION_SUMMARY` grant/deny event.
- Repository search found no existing `AUTHZ_DENIED`, `VIEW_COMMISSION_SUMMARY`, or summary-view audit event that can be cited as F1 evidence.

## Result

No existing audit evidence was found for commission-summary view grant/deny. This is an evidence gap, not a claim that the endpoint is exploitable. Adding the missing events would change the audit behavior and therefore requires a separate design review, security review, and implementation authorization wave.

Frontend validation remains on hold until this separate F1 decision is resolved.
