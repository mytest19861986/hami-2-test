// Authentication state is deliberately memory-only. Tokens must never be put in
// localStorage/sessionStorage; the backend cookie/session contract remains the authority.
let session = null;
export function readSession() { return session; }
export function writeSession(value) { session = value || null; }
export function clearSession() { session = null; }
