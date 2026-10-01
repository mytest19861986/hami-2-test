export const RELAY_MAX_ATTEMPTS = 3;

export class RelayDeliveryError extends Error {
  constructor(message = 'AUDIT_RELAY_DELIVERY_FAILED') {
    super(message);
    this.name = 'RelayDeliveryError';
  }
}

export async function relayOne(prisma, deliver, { maxAttempts = RELAY_MAX_ATTEMPTS, attempts = new Map(), now = new Date() } = {}) {
  const outbox = await prisma.authorizationAuditOutbox.findFirst({
    where: { deliveredAt: null },
    orderBy: { createdAt: 'asc' },
    include: { auditEvent: { select: { requestId: true, action: true } } },
  });
  if (!outbox) return { status: 'IDLE' };

  const count = (attempts.get(outbox.id) ?? 0) + 1;
  attempts.set(outbox.id, count);
  try {
    await deliver({ auditId: outbox.auditId, payload: outbox.payload });
    const marked = await prisma.authorizationAuditOutbox.updateMany({
      where: { id: outbox.id, deliveredAt: null },
      data: { deliveredAt: now },
    });
    return { status: marked.count === 1 ? 'DELIVERED' : 'ALREADY_DELIVERED', auditId: outbox.auditId, attempts: count };
  } catch {
    if (count < maxAttempts) return { status: 'RETRY', auditId: outbox.auditId, attempts: count };
    const dead = await prisma.authorizationAuditDeadLetter.create({
      data: {
        auditId: outbox.auditId,
        requestId: outbox.auditEvent?.requestId ?? outbox.auditId,
        action: outbox.auditEvent?.action ?? 'UNKNOWN',
        payload: outbox.payload,
        failureClass: 'DELIVERY_RETRY_EXHAUSTED',
      },
    });
    return { status: 'DEAD_LETTERED', auditId: outbox.auditId, deadLetterId: dead.id, attempts: count };
  }
}

export async function relayUntilIdle(prisma, deliver, options = {}) {
  const results = [];
  const attempts = options.attempts ?? new Map();
  for (;;) {
    const result = await relayOne(prisma, deliver, { ...options, attempts });
    results.push(result);
    if (result.status === 'IDLE') return results;
  }
}
