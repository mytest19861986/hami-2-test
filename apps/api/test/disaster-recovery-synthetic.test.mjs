import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticBackup, restoreSyntheticBackup, validateSyntheticRestore } from '../src/disaster-recovery-synthetic.mjs';

const records = [
  { id: 'user-s1', type: 'USER', state: 'ACTIVE' },
  { id: 'wallet-s1', type: 'WALLET', balance: 1250 },
  { id: 'withdrawal-s1', type: 'WITHDRAWAL', state: 'UNKNOWN' },
  { id: 'audit-s1', type: 'AUDIT', action: 'SYNTHETIC_RESTORE' },
];

test('Phase 14 restores only LOCAL_TEST synthetic data and produces PASS evidence', () => {
  const backup = createSyntheticBackup({ records });
  const restored = restoreSyntheticBackup(backup);
  const evidence = validateSyntheticRestore(backup, restored);
  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.sourceEnvironment, 'LOCAL_TEST');
  assert.equal(evidence.targetEnvironment, 'SYNTHETIC_RECOVERY');
  assert.equal(evidence.sourceCount, evidence.restoredCount);
  assert.equal(evidence.realData, false);
  assert.equal(evidence.productionTouched, false);
  assert.equal(evidence.realCredentials, false);
  assert.equal(evidence.providerConnected, false);
  assert.equal(evidence.retentionExecuted, false);
});

test('Phase 14 fails closed on backup tampering', () => {
  const backup = createSyntheticBackup({ records });
  const tampered = { ...backup, payload: { ...backup.payload, records: [...backup.payload.records, { id: 'tampered' }] } };
  assert.throws(() => restoreSyntheticBackup(tampered), /BACKUP_DIGEST_MISMATCH/);
});

test('Phase 14 rejects production-like environments', () => {
  assert.throws(() => createSyntheticBackup({ environment: 'PRODUCTION', records }), /SYNTHETIC_ENVIRONMENT_REQUIRED/);
  const backup = createSyntheticBackup({ records });
  assert.throws(() => restoreSyntheticBackup(backup, { targetEnvironment: 'PRODUCTION' }), /SYNTHETIC_ENVIRONMENT_REQUIRED/);
});
