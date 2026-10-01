import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('FW-01 Phase 2 keeps refresh single-flight and session-scoped', () => {
  const api = fs.readFileSync(new URL('../lib/api-client.js', import.meta.url), 'utf8');
  const auth = fs.readFileSync(new URL('../components/auth-state.jsx', import.meta.url), 'utf8');
  assert.match(api, /refreshInFlight/);
  assert.match(api, /finally\(\(\) => \{ refreshInFlight = null/);
  assert.match(auth, /readSession/);
  assert.match(auth, /نشست منقضی شده است/);
});
