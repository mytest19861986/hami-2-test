import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('FW-01 Phase 6 keeps errors safe and degraded states retryable', () => {
  const api = fs.readFileSync(new URL('../lib/api-client.js', import.meta.url), 'utf8');
  const dashboard = fs.readFileSync(new URL('../pages/dashboard.jsx', import.meta.url), 'utf8');
  assert.match(api, /retryAfterMs/);
  assert.match(api, /retry-after/);
  assert.match(dashboard, /ErrorState/);
  assert.match(dashboard, /DegradedState/);
  assert.match(dashboard, /تلاش دوباره/);
  assert.match(dashboard, /داده مالی جدیدی نمایش داده نمی‌شود/);
});
