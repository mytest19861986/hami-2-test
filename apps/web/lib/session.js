// Authentication state is deliberately memory-only. Tokens must never be put in
// localStorage/sessionStorage; the backend cookie/session contract remains the authority.
let session = null;
export function readSession() { return session; }
export function writeSession(value) { session = value || null; }
export function clearSession() { session = null; }
export function normalizeSessionUser(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  let permissions = roles.flatMap((link) => link?.role?.permissions || []).map((item) => item?.permission).filter((permission) => permission?.resource && permission?.action).map((permission) => permission.resource + '.' + permission.action);
  if (roles.some((link) => link?.role?.name === 'SUPPORT') && !roles.some((link) => ['SUPER_ADMIN', 'ADMIN'].includes(link?.role?.name))) permissions = permissions.filter((permission) => permission.startsWith('support.'));
  return { id: user?.id, phone: user?.phone, status: user?.status, roles: roles.map((link) => link?.role?.name).filter(Boolean), permissions };
}
