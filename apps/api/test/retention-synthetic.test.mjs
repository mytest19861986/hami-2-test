import test from 'node:test';
import assert from 'node:assert/strict';
import { approveSyntheticRun, createSyntheticSnapshot, executeSyntheticWorker } from '../src/retention-synthetic.mjs';

const now = new Date('2026-09-29T12:00:00.000Z');
const records = [
  { id: 'audit-1', recordClass: 'AUTHORIZATION_AUDIT_EVENT', environment: 'SYNTHETIC', createdAt: new Date('2026-01-01T00:00:00.000Z'), hold: false },
  { id: 'audit-2', recordClass: 'AUTHORIZATION_AUDIT_EVENT', environment: 'SYNTHETIC', createdAt: new Date('2026-01-01T00:00:00.000Z'), hold: true },
  { id: 'real-1', recordClass: 'AUTHORIZATION_AUDIT_EVENT', environment: 'LOCAL_DB', createdAt: new Date('2026-01-01T00:00:00.000Z'), hold: false },
];

test('synthetic snapshot enforces environment boundary and hold precedence', () => {
  const snapshot = createSyntheticSnapshot(records, { now });
  assert.equal(snapshot.counts.candidates, 1);
  assert.equal(snapshot.counts.held, 1);
  assert.deepEqual(snapshot.manifest.candidates.map((x) => x.id), ['audit-1']);
  assert.deepEqual(snapshot.manifest.held.map((x) => x.id), ['audit-2']);
  assert.ok(snapshot.manifestDigest.length > 20);
});

test('approval mismatch fails closed and never deletes', () => {
  const snapshot = createSyntheticSnapshot(records, { now });
  const blocked = executeSyntheticWorker(snapshot, { approved: true, runId: snapshot.runId, manifestDigest: 'tampered' }, { records, now });
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(blocked.reason, 'APPROVAL_MISMATCH');
});

test('approved synthetic worker is dry-run only and emits complete evidence', () => {
  const snapshot = createSyntheticSnapshot(records, { now });
  const approvals = ['COMPLIANCE', 'SECURITY', 'OPERATIONS'].map((role) => ({ role, runId: snapshot.runId, manifestDigest: snapshot.manifestDigest }));
  const approval = approveSyntheticRun(snapshot, approvals);
  const result = executeSyntheticWorker(snapshot, approval, { records, now });
  assert.equal(approval.approved, true);
  assert.equal(result.status, 'DRY_RUN_COMPLETE');
  assert.deepEqual(result.processedIds, ['audit-1']);
  assert.equal(result.deletedCount, 0);
  assert.equal(result.evidence.realDeletion, false);
  assert.equal(result.evidence.holdPrecedence, true);
});

test('missing independent approval remains blocked', () => {
  const snapshot = createSyntheticSnapshot(records, { now });
  const approval = approveSyntheticRun(snapshot, [{ role: 'COMPLIANCE', runId: snapshot.runId, manifestDigest: snapshot.manifestDigest }]);
  assert.equal(approval.approved, false);
  assert.equal(executeSyntheticWorker(snapshot, approval, { records, now }).status, 'BLOCKED');
});
