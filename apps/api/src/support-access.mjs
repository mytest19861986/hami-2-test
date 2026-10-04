export const supportPermissions = Object.freeze([
  'support.dashboard.read',
  'support.users.read',
  'support.providers.read',
  'support.purchases.read',
  'support.memberships.read',
  'support.redemptions.read',
  'support.refund_cases.read',
]);

const allowed = new Set(supportPermissions);
export function isSupportOnly(roles) {
  const names = roles.map((link) => typeof link === 'string' ? link : link?.role?.name).filter(Boolean);
  return names.includes('SUPPORT') && !names.some((name) => ['SUPER_ADMIN', 'ADMIN'].includes(name));
}
export function canSupport(permission) { return allowed.has(permission); }
export function supportGrantPermissionIdsOutsideAllowlist(grants) {
  return grants.filter(({ permission }) => !allowed.has(`${permission.resource}.${permission.action}`)).map(({ permissionId }) => permissionId);
}
export function supportUserProjection({ status, createdAt, profile }) {
  return { status, createdAt, displayName: [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || null };
}
