import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditModeDecision, resolveAuditMode } from '../src/authorization-audit-mode.mjs';

test('mode matrix resolves bounded modes and invalid values fail closed to LEGACY', () => {
  assert.deepEqual(resolveAuditMode({ env: 'test', configured: 'LEGACY' }).mode, 'LEGACY');
  assert.equal(auditModeDecision({ env: 'test', configured: 'SHADOW' }).observerEnabled, true);
  assert.equal(auditModeDecision({ env: 'test', configured: 'CANONICAL' }).canonicalEffective, true);
  assert.equal(auditModeDecision({ env: 'test', configured: 'OFF' }).observerEnabled, false);
  assert.deepEqual(resolveAuditMode({ env: 'test', configured: 'garbage' }), { mode: 'LEGACY', alert: 'AUDIT_MODE_INVALID_OR_MISSING' });
});

test('production rejects OFF and resolves to LEGACY', () => {
  assert.deepEqual(resolveAuditMode({ env: 'production', configured: 'OFF' }), { mode: 'LEGACY', alert: 'AUDIT_MODE_OFF_REJECTED_IN_PRODUCTION' });
});
