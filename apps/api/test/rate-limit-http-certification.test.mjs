import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import http from 'node:http';
import test from 'node:test';

const worker = new URL('./fixtures/rate-limit-http-worker.mjs', import.meta.url);

function startStore() {
  const entries = new Map();
  const server = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const { key, limit, ttl } = JSON.parse(body);
    const now = Date.now();
    const current = entries.get(key);
    if (!current || now >= current.expiresAt) entries.set(key, { count: 1, expiresAt: now + ttl });
    else if (current.count >= limit) { response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify([0, current.expiresAt - now])); return; }
    else current.count += 1;
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify([1, 0]));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

function startWorker(storeUrl) {
  const child = fork(worker, [], { env: { ...process.env, RATE_LIMIT_STORE_URL: storeUrl, PORT: '0' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  return new Promise((resolve, reject) => { child.once('message', (message) => resolve({ child, url: `http://127.0.0.1:${message.port}` })); child.once('error', reject); });
}

async function consume(url, subject = 'shared-subject') {
  const response = await fetch(`${url}/consume`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ policy: 'TEST', subject }) });
  return response.json();
}

test('real HTTP A+B child processes share quota and survive API-A restart', async (t) => {
  const store = await startStore();
  let apiA = await startWorker(store.url);
  const apiB = await startWorker(store.url);
  t.after(() => { apiA.child.kill(); apiB.child.kill(); store.server.close(); });

  assert.equal((await consume(apiA.url)).result, 'ALLOW');
  assert.equal((await consume(apiA.url)).result, 'ALLOW');
  assert.equal((await consume(apiA.url)).result, 'ALLOW');
  assert.equal((await consume(apiB.url)).result, 'ALLOW');
  assert.equal((await consume(apiB.url)).result, 'ALLOW');
  assert.equal((await consume(apiB.url)).result, 'DENY');

  apiA.child.kill();
  apiA = await startWorker(store.url);
  assert.equal((await consume(apiA.url)).result, 'DENY');
  assert.equal((await consume(apiB.url, 'new-subject')).result, 'ALLOW');
});
