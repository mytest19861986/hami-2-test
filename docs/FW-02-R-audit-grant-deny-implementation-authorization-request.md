# FW-02-R Audit Grant/Deny — Implementation Authorization Request

Status: Authorization request only. No implementation is authorized by this document.

## Design closure evidence

- Audit Grant/Deny Design: CLOSED.
- Schema Delta Design: CLOSED.
- GLM Scoped Delta Verification: PASS.
- Claude Final Security Review: SECURITY_PASS.
- SP-1–SP-5: verified.
- RF-1–RF-4: verified.

## Requested implementation scope

If separately authorized, the implementation wave would cover only the approved
`AuthorizationAuditEvent` design for the commission-summary authorization decision:

- the additive schema delta for the immutable audit store;
- the consolidated outbox and dead-letter storage boundary;
- the single `AUDIT_AUTHORIZATION_EVENT_MODE` cutover control;
- post-decision, zero-authority emission with storage-level deduplication;
- the approved retention, access, privacy, and audit-of-access controls;
- the evidence and test matrix for the approved decision paths.

No endpoint, authorization rule, financial behavior, response contract, or client-visible
Generic403 behavior may change.

## Schema delta and migration plan

The future migration is one additive, forward-only wave covering exactly:

1. `AuthorizationAuditEvent`;
2. durable outbox storage;
3. dead-letter storage;
4. required unique/index and access-control definitions;
5. the named retention/config registry parameters.

There is no legacy `AuditLog` rewrite, no backfill, no cross-store reconciliation, and no
destructive DDL rollback after activation. Rollback is configuration-only; previously written
immutable grant events remain.

The outbox is transport-only and is written in its own post-decision transaction. Successful
relay may purge the outbox row through the non-interactive privileged retention boundary; the
immutable audit event remains the audit-of-record.

## Rollback and safety plan

- Pre-activation failure: do not enable the new emission path.
- Activation rollback: switch `AUDIT_AUTHORIZATION_EVENT_MODE` to the legacy baseline.
- No DDL drop, destructive mutation, backfill, or reconciliation.
- Missing/invalid retention configuration: retain longer and alert.
- Divergent dedup conflict: stored event remains authoritative; compare incoming payload and
  raise an inconsistency/security alert; never overwrite.
- Audit persistence failure: fail-open for the read request, count and alert the completeness
  gap, and do not alter authorization, financial behavior, status, or response.
- Multi-instance propagation: bounded and documented; evidence must cover cutover and rollback
  without double emission or silent audit loss.

## Evidence matrix and test plan

The implementation wave must provide named evidence for:

- exactly-one event under concurrent retry on `(request_id, action)`;
- divergent-conflict detection and no-overwrite behavior;
- replay and dead-letter replay no-op;
- platform-generated collision-resistant `request_id` with edge overwrite of inbound
  `X-Request-ID`;
- coordinated cutover and rollback with no double `AUTHZ_DENIED` emission;
- no event on 429, configuration failure, Degraded, unauthenticated/pre-auth, or
  pre-decision 5xx paths;
- post-grant 5xx retaining the GRANTED decision event;
- append-only privilege enforcement and non-interactive retention purge;
- compliance-only audit reads, denial for representative/default/SUPER_ADMIN roles, and
  durably audited store access;
- privacy-level absence of amount, currency, DTO contents, customer references, token/session
  material, provider/payout data, credentials, and ledger internals;
- byte-identical endpoint authorization and response behavior before and after activation;
- local/test Docker, lint, typecheck, build, migration rehearsal, rollback rehearsal, and
  evidence bundle.

## Environment and production boundary

Any future execution must be limited to Local/Test or an explicitly approved non-production
environment. Production deployment, provider connection, credentials, real SMS, real payment,
real-money movement, and production data access remain forbidden.

## Decision requested

Commander authorization is requested separately for the implementation wave described above.
Until an explicit authorization is recorded, the project remains:

- Implementation: NOT AUTHORIZED;
- Schema/Migration: NOT AUTHORIZED;
- Backend/Frontend: unchanged;
- Production: forbidden.
