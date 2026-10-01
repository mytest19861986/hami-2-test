import test from 'node:test';
import assert from 'node:assert/strict';

test('published health endpoint responds with ok', async () => {
  const baseUrl = process.env.HEALTH_BASE_URL ?? 'http://127.0.0.1:8080';
  const response = await fetch(`${baseUrl}/api/v1/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});
