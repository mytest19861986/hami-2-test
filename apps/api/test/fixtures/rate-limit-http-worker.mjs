import http from 'node:http';
import { RedisCompatibleRateLimitStore } from '../../src/rate-limit.mjs';

const storeUrl = process.env.RATE_LIMIT_STORE_URL;
const port = Number(process.env.PORT);

const client = {
  async eval(_script, { keys, arguments: args }) {
    const response = await fetch(storeUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: keys[0], limit: Number(args[0]), ttl: Number(args[1]) }) });
    if (!response.ok) throw new Error('store unavailable');
    return response.json();
  },
};
const limiter = new RedisCompatibleRateLimitStore(client, { limit: 5, windowMs: 60_000 });
const server = http.createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/consume') { response.writeHead(404).end(); return; }
  let body = '';
  for await (const chunk of request) body += chunk;
  const { policy = 'TEST', subject = 'subject' } = JSON.parse(body);
  const decision = await limiter.consume(policy, subject);
  response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(decision));
});
server.listen(port, '127.0.0.1', () => process.send?.({ type: 'ready', port: server.address().port }));
