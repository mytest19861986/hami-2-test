import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('security reconciliation invariants are explicit in current source', () => {
  const auth = fs.readFileSync(new URL('../src/auth.mjs', import.meta.url), 'utf8');
  const main = fs.readFileSync(new URL('../src/main.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(auth, /AUTH_SECRET\s*\?\?/);
  assert.match(auth, /ALLOW_DEV_OTP_CODE !== 'true'/);
  assert.match(main, /AUTH_SECRET_MISSING/);
  assert.match(main, /PASSWORD_SETUP_REQUIRED/);
  const composeUrl = new URL('../../../docker-compose.yml', import.meta.url);
  if (fs.existsSync(composeUrl)) assert.match(fs.readFileSync(composeUrl, 'utf8'), /AUTH_SECRET: \$\{AUTH_SECRET:\?/);
});
