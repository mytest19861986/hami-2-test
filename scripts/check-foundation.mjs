import { existsSync } from 'node:fs';
const required=['apps/api/src/server.mjs','apps/web/public/index.html','docker-compose.yml','infra/nginx/default.conf','.env.example'];
const missing=required.filter(x=>!existsSync(x));
if(missing.length){console.error('Missing:',missing.join(', '));process.exit(1)}
console.log('Foundation file checks passed');
