import { createHash, randomUUID } from 'node:crypto';

export const SYNTHETIC_RETENTION_POLICY = Object.freeze({
  version: 'FW-02-R-RETENTION-V1-BASELINE',
  environment: 'LOCAL_TEST_SYNTHETIC',
  recordClasses: Object.freeze({
    AUTHORIZATION_AUDIT_EVENT: 7 * 365,
    AUDIT_ACCESS_LOG: 7 * 365,
    DELIVERED_OUTBOX: 30,
    DEAD_LETTER: 2 * 365,
  }),
});

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function createSyntheticSnapshot(records, { now = new Date(), policy = SYNTHETIC_RETENTION_POLICY } = {}) {
  const cutoff = new Date(now);
  const candidates = records.filter((record) => record.environment === 'SYNTHETIC' && record.createdAt < cutoff && !record.hold);
  const held = records.filter((record) => record.environment === 'SYNTHETIC' && record.hold);
  const manifest = {
    manifestVersion: 1,
    policyVersion: policy.version,
    environment: policy.environment,
    cutoff: cutoff.toISOString(),
    candidates: candidates.map(({ id, recordClass }) => ({ id, recordClass })),
    held: held.map(({ id, recordClass }) => ({ id, recordClass })),
  };
  return Object.freeze({
    runId: randomUUID(),
    manifest,
    manifestDigest: hash(manifest),
    counts: { total: records.length, candidates: candidates.length, held: held.length },
  });
}

export function approveSyntheticRun(snapshot, approvals) {
  const required = new Set(['COMPLIANCE', 'SECURITY', 'OPERATIONS']);
  const actual = new Set(approvals.filter((approval) => approval.runId === snapshot.runId && approval.manifestDigest === snapshot.manifestDigest).map((approval) => approval.role));
  const approved = [...required].every((role) => actual.has(role));
  return Object.freeze({ approved, runId: snapshot.runId, manifestDigest: snapshot.manifestDigest, roles: [...actual].sort() });
}

export function executeSyntheticWorker(snapshot, approval, { records, now = new Date() } = {}) {
  if (!approval.approved || approval.runId !== snapshot.runId || approval.manifestDigest !== snapshot.manifestDigest) {
    return Object.freeze({ status: 'BLOCKED', reason: 'APPROVAL_MISMATCH', runId: snapshot.runId });
  }
  const selected = new Set(snapshot.manifest.candidates.map((candidate) => candidate.id));
  const processed = records.filter((record) => selected.has(record.id) && record.environment === 'SYNTHETIC' && !record.hold);
  return Object.freeze({
    status: 'DRY_RUN_COMPLETE',
    runId: snapshot.runId,
    manifestDigest: snapshot.manifestDigest,
    processedIds: processed.map((record) => record.id),
    deletedCount: 0,
    evidence: Object.freeze({ generatedAt: new Date(now).toISOString(), holdPrecedence: true, realDeletion: false }),
  });
}

