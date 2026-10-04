import test from 'node:test';
import assert from 'node:assert/strict';
import { canSupport, isSupportOnly, supportGrantPermissionIdsOutsideAllowlist, supportPermissions, supportUserProjection } from '../src/support-access.mjs';

test('SUPPORT is constrained to its explicit read-only permission allowlist', () => {
  assert.equal(isSupportOnly(['SUPPORT']), true);
  assert.equal(isSupportOnly([{ role: { name: 'USER' } }, { role: { name: 'SUPPORT' } }]), true);
  assert.equal(isSupportOnly(['SUPPORT', 'SUPER_ADMIN']), false);
  assert.equal(isSupportOnly(['SUPPORT', 'ADMIN']), false);
  for (const permission of supportPermissions) assert.equal(canSupport(permission), true);
  for (const permission of ['users.update', 'users.disable', 'roles.manage', 'permissions.manage', 'commercial_settings.manage', 'commissions.approve', 'withdrawals.approve', 'purchases.refund', 'redemptions.reverse']) assert.equal(canSupport(permission), false, permission);
  assert.deepEqual(supportGrantPermissionIdsOutsideAllowlist([
    { permissionId: 'allow-1', permission: { resource: 'support', action: 'dashboard.read' } },
    { permissionId: 'deny-1', permission: { resource: 'roles', action: 'manage' } },
    { permissionId: 'deny-2', permission: { resource: 'purchases', action: 'refund' } },
  ]), ['deny-1', 'deny-2']);
});

test('support user projection allowlists profile fields and excludes phone and national identifiers', () => {
  const result = supportUserProjection({ id: 'internal-id', phone: '09120000000', nationalId: '0012345678', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z', profile: { firstName: 'آزمایش', lastName: 'کاربر', nationalId: '0012345678' } });
  assert.deepEqual(Object.keys(result).sort(), ['createdAt', 'displayName', 'status']);
  assert.equal(result.displayName, 'آزمایش کاربر');
  assert.equal(JSON.stringify(result).includes('09120000000'), false);
  assert.equal(JSON.stringify(result).includes('0012345678'), false);
});
