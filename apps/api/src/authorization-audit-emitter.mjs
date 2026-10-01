import crypto from 'node:crypto';

const AUDIT_ACTOR_TYPE = 'REP';
const AUDIT_SCHEMA_VERSION = 1;

function fingerprint(req) {
  const value = String(req.headers.cookie ?? req.headers.authorization ?? 'anonymous');
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function requestIdFor(req) {
  const supplied = String(req.headers['x-request-id'] ?? '').trim();
  return supplied || crypto.randomUUID();
}

export async function emitAuthorizationDecision(prisma, req, decision) {
  if (!prisma) throw new Error('AUDIT_PRISMA_REQUIRED');
  if (!decision?.actorId || !decision.action || !decision.endpoint || !decision.capability) throw new Error('AUDIT_ENVELOPE_INVALID');
  const requestId = requestIdFor(req);
  const event = {
    requestId,
    actorId: decision.actorId,
    actorType: AUDIT_ACTOR_TYPE,
    action: decision.action,
    entity: decision.entity ?? 'AuthorizationDecision',
    result: decision.result ?? 'GRANTED',
    reasonCode: decision.reasonCode ?? null,
    endpoint: decision.endpoint,
    capability: decision.capability,
    opaqueResourceId: decision.opaqueResourceId ?? null,
    hashedSessionFingerprint: fingerprint(req),
    dedupKey: decision.dedupKey ?? `${requestId}:${decision.action}`,
    schemaVersion: AUDIT_SCHEMA_VERSION,
  };
  return prisma.$transaction(async (tx) => {
    const created = await tx.authorizationAuditEvent.upsert({
      where: { requestId_action: { requestId, action: event.action } },
      create: event,
      update: {},
    });
    await tx.authorizationAuditOutbox.upsert({
      where: { auditId: created.auditId },
      create: {
        auditId: created.auditId,
        // The frozen 0021 check currently permits only the empty JSON object
        // because its allowlist sentinel values are null. Keep the audit event
        // as the source of record and avoid a schema change in Phase 1.
        payload: {},
      },
      update: {},
    });
    return created;
  });
}

export const AUDIT_RUNTIME_ROLE = 'hami_audit_app';
