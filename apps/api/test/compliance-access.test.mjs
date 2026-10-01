import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertComplianceActor, complianceProjection } from '../src/compliance-access.mjs';

const actor = (names) => ({ id: 'u1', status: 'ACTIVE', roles: names.map((name) => ({ role: { name } })) });

test('compliance access is explicit and excludes SUPER_ADMIN/default roles', () => {
  assert.equal(assertComplianceActor(actor(['COMPLIANCE_AUDITOR'])).id, 'u1');
  assert.throws(() => assertComplianceActor(actor(['SUPER_ADMIN', 'COMPLIANCE_AUDITOR'])), { message: 'FORBIDDEN' });
  assert.throws(() => assertComplianceActor(actor(['ADMIN'])), { message: 'FORBIDDEN' });
  assert.throws(() => assertComplianceActor({ ...actor(['COMPLIANCE_AUDITOR']), status: 'DISABLED' }), { message: 'UNAUTHORIZED' });
});

test('compliance projection is read-only and excludes session/fingerprint fields', () => {
  const output = complianceProjection({ auditId: 'a', requestId: 'r', actorType: 'REP', action: 'VIEW_COMMISSION_SUMMARY_GRANTED', entity: 'CommissionSummary', result: 'GRANTED', reasonCode: null, endpoint: '/x', capability: 'x', schemaVersion: 1, createdAt: new Date('2026-01-01') });
  assert.deepEqual(Object.keys(output).sort(), ['action', 'actor_type', 'audit_id', 'capability', 'created_at', 'endpoint', 'entity', 'reason_code', 'request_id', 'result', 'schema_version'].sort());
  assert.equal('hashed_session_fingerprint' in output, false);
});
