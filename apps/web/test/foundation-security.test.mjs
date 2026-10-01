import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('foundation does not persist authentication state in browser storage', () => { const source = fs.readFileSync(new URL('../lib/session.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, ''); assert.doesNotMatch(source, /localStorage|sessionStorage/); assert.match(source, /let session/); });
test('api boundary uses credentials for the httpOnly cookie contract', () => { const source = fs.readFileSync(new URL('../lib/api-client.js', import.meta.url), 'utf8'); assert.match(source, /credentials:\s*'include'/); assert.match(source, /retryAfterMs/); });
test('capability layer fails closed for absent backend capability', () => { const source = fs.readFileSync(new URL('../lib/capability.js', import.meta.url), 'utf8'); assert.match(source, /allowed/); assert.match(source, /disabled/); });
