import crypto from 'node:crypto';

const SYNTHETIC_ENVIRONMENTS = new Set(['LOCAL_TEST', 'SYNTHETIC_RECOVERY']);

function canonical(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function digest(value) {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex');
}

function assertSyntheticEnvironment(environment) {
  if (!SYNTHETIC_ENVIRONMENTS.has(environment)) {
    throw new Error('SYNTHETIC_ENVIRONMENT_REQUIRED');
  }
}

export function createSyntheticBackup({ environment = 'LOCAL_TEST', records, now = new Date('2026-01-01T00:00:00.000Z') }) {
  assertSyntheticEnvironment(environment);
  if (!Array.isArray(records) || records.length === 0) throw new Error('SYNTHETIC_RECORDS_REQUIRED');
  const payload = { backupVersion: 1, environment, createdAt: now.toISOString(), records: records.map((record) => ({ ...record })) };
  return Object.freeze({
    backupId: `sdr-${crypto.randomUUID()}`,
    environment,
    createdAt: payload.createdAt,
    payload,
    payloadDigest: digest(payload),
  });
}

export function restoreSyntheticBackup(backup, { targetEnvironment = 'SYNTHETIC_RECOVERY', now = new Date('2026-01-01T00:05:00.000Z') } = {}) {
  assertSyntheticEnvironment(targetEnvironment);
  if (!backup || backup.payloadDigest !== digest(backup.payload)) throw new Error('BACKUP_DIGEST_MISMATCH');
  if (backup.payload.environment !== 'LOCAL_TEST') throw new Error('SOURCE_MUST_BE_LOCAL_TEST');
  const records = backup.payload.records.map((record) => ({ ...record }));
  return Object.freeze({
    restoreId: `restore-${crypto.randomUUID()}`,
    sourceBackupId: backup.backupId,
    sourceDigest: backup.payloadDigest,
    targetEnvironment,
    restoredAt: now.toISOString(),
    records,
  });
}

export function validateSyntheticRestore(backup, restored, { expectedRtoSeconds = 3600 } = {}) {
  if (!restored || restored.sourceBackupId !== backup.backupId) throw new Error('RESTORE_SOURCE_MISMATCH');
  const source = backup.payload.records;
  const target = restored.records;
  const sourceIds = source.map((record) => record.id).sort();
  const targetIds = target.map((record) => record.id).sort();
  const sourceDigest = digest(source);
  const targetDigest = digest(target);
  const elapsedSeconds = Math.max(0, (Date.parse(restored.restoredAt) - Date.parse(backup.createdAt)) / 1000);
  return Object.freeze({
    phase: 'FW-02-R-PHASE-14',
    status: sourceDigest === targetDigest && JSON.stringify(sourceIds) === JSON.stringify(targetIds) && elapsedSeconds <= expectedRtoSeconds ? 'PASS' : 'FAIL',
    sourceEnvironment: backup.environment,
    targetEnvironment: restored.targetEnvironment,
    backupId: backup.backupId,
    restoreId: restored.restoreId,
    sourceDigest,
    targetDigest,
    sourceCount: source.length,
    restoredCount: target.length,
    rpoSeconds: 0,
    rtoSeconds: elapsedSeconds,
    expectedRtoSeconds,
    realData: false,
    productionTouched: false,
    realCredentials: false,
    providerConnected: false,
    retentionExecuted: false,
  });
}
