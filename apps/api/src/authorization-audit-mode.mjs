const MODES = new Set(['LEGACY', 'SHADOW', 'CANONICAL', 'OFF']);

export function resolveAuditMode({ env = process.env.NODE_ENV, configured = process.env.AUDIT_AUTHORIZATION_EVENT_MODE } = {}) {
  const candidate = String(configured ?? '').trim().toUpperCase();
  if (!MODES.has(candidate)) return { mode: 'LEGACY', alert: 'AUDIT_MODE_INVALID_OR_MISSING' };
  if (candidate === 'OFF' && env === 'production') return { mode: 'LEGACY', alert: 'AUDIT_MODE_OFF_REJECTED_IN_PRODUCTION' };
  return { mode: candidate, alert: null };
}

export function auditModeDecision(options = {}) {
  const resolved = resolveAuditMode(options);
  return {
    ...resolved,
    legacyEffective: resolved.mode === 'LEGACY' || resolved.mode === 'SHADOW',
    canonicalEffective: resolved.mode === 'CANONICAL',
    observerEnabled: resolved.mode === 'SHADOW' || resolved.mode === 'CANONICAL',
    provenance: `authorization-audit:${resolved.mode.toLowerCase()}`,
  };
}

export function modeDedupKey(mode, requestId, action) {
  return `${mode}:${requestId}:${action}`;
}
