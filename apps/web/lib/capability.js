// Capability decisions are supplied by the backend. Role labels and hidden
// routes are never treated as authorization.
export function normalizeCapabilities(payload) {
  const list = Array.isArray(payload) ? payload : payload?.capabilities;
  return new Set(Array.isArray(list) ? list.filter((value) => typeof value === 'string') : []);
}
export function hasCapability(capabilities, capability) { return capabilities instanceof Set && capabilities.has(capability); }
export function capabilityState(capabilities, capability) { return hasCapability(capabilities, capability) ? 'allowed' : 'disabled'; }
