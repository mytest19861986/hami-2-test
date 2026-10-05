import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { clearTimeout, setTimeout } from 'node:timers';
import { fileURLToPath } from 'node:url';

const apiContainer = process.env.WAVE41_API_CONTAINER || 'wave41-support-api-current2';
const baseURL = process.env.WAVE41_BASE_URL || 'http://127.0.0.1:8081';
const outputDir = process.env.WAVE41_EVIDENCE_DIR || path.resolve('docs/10-quality/evidence/wave-41/current-build');
const harnessPath = fileURLToPath(new URL('./wave41-support-evidence.mjs', import.meta.url));
const expectedPermissions = [
  'support.dashboard.read',
  'support.users.read',
  'support.providers.read',
  'support.purchases.read',
  'support.memberships.read',
  'support.redemptions.read',
  'support.refund_cases.read',
].sort();

function randomPassword() { return randomBytes(32).toString('base64url'); }

function runProcess(command, args, input = '', env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => child.kill(), 180_000);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

const prepareFixtureCode = `
  const { prisma, hashPassword } = await import('/workspace/apps/api/src/auth.mjs');
  const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk);
  const { temporaryPassword } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const required = ${JSON.stringify(expectedPermissions)};
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', roles: { some: { role: { name: 'SUPPORT' } } } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, phone: true, roles: { select: { role: { select: { id: true, name: true } } } } },
  });
  let fixture = null;
  for (const user of users) {
    if (user.roles.length !== 1 || user.roles[0].role.name !== 'SUPPORT') continue;
    const permissions = await prisma.rolePermission.findMany({
      where: { roleId: user.roles[0].role.id },
      select: { permission: { select: { resource: true, action: true } } },
    });
    const names = [...new Set(permissions.map(({ permission }) => permission.resource + '.' + permission.action))].sort();
    if (JSON.stringify(names) === JSON.stringify(required)) { fixture = user; break; }
  }
  if (!fixture) throw new Error('SUPPORT_FIXTURE_NOT_FOUND');
  await prisma.user.update({ where: { id: fixture.id }, data: { passwordHash: hashPassword(temporaryPassword) } });
  process.stdout.write(JSON.stringify({ userId: fixture.id, phone: fixture.phone }));
  await prisma.$disconnect();
`;

const cleanupFixtureCode = `
  const { prisma, hashPassword } = await import('/workspace/apps/api/src/auth.mjs');
  const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk);
  const { userId, startedAt, rotationPassword } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const now = new Date();
  const revoked = await prisma.authSession.updateMany({ where: { userId, createdAt: { gte: new Date(startedAt) }, revokedAt: null }, data: { revokedAt: now, consumedAt: now } });
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(rotationPassword) } });
  process.stdout.write(JSON.stringify({ revokedSessions: revoked.count, credentialRotated: true }));
  await prisma.$disconnect();
`;

let fixture;
let temporaryPassword;
let startedAt;
let childEnv;
let harnessResult;
let safeHarnessStatus;
let cleanup = { ok: false, revokedSessions: null };

try {
  temporaryPassword = randomPassword();
  startedAt = new Date(Date.now() - 1_000).toISOString();
  const prepared = await runProcess('docker', ['exec', '-i', apiContainer, 'node', '--input-type=module', '-e', prepareFixtureCode], JSON.stringify({ temporaryPassword }));
  if (prepared.code !== 0) throw new Error('SUPPORT_FIXTURE_PREPARATION_FAILED');
  fixture = JSON.parse(prepared.stdout);

  childEnv = Object.fromEntries(['PATH', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key]]));
  childEnv.WAVE41_BASE_URL = baseURL;
  childEnv.WAVE41_EVIDENCE_DIR = outputDir;
  childEnv.WAVE41_BROWSER_EXECUTABLE = process.env.WAVE41_BROWSER_EXECUTABLE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  childEnv.WAVE41_SUPPORT_PHONE = fixture.phone;
  childEnv.WAVE41_SUPPORT_PASSWORD = temporaryPassword;
  harnessResult = await runProcess(process.execPath, [harnessPath], '', childEnv);

  if (harnessResult.stdout.trim()) {
    try {
      const output = harnessResult.stdout.trim();
      const start = output.indexOf('{');
      const end = output.lastIndexOf('}');
      const evidence = JSON.parse(start >= 0 && end > start ? output.slice(start, end + 1) : '');
      safeHarnessStatus = evidence.status === 'FAIL'
        ? { status: evidence.status, stage: evidence.stage, error: evidence.error, ...(evidence.drawer ? { drawer: evidence.drawer } : {}), ...(evidence.consoleErrors ? { consoleErrors: evidence.consoleErrors } : {}) }
        : { status: evidence.status, anonymousAuthMe: evidence.anonymousAuthMe, authenticatedAuthMe: evidence.authenticatedAuthMe, postLogoutAuthMe: evidence.postLogoutAuthMe, roles: evidence.roles, permissions: evidence.permissions, consoleErrors: evidence.consoleErrors, consoleEvents: evidence.consoleEvents, viewports: evidence.viewports, drawer: evidence.drawer };
      if (evidence.status !== 'PASS') throw new Error('SAFE_E2E_FAILURE');
      assert.equal(evidence.status, 'PASS');
      assert.equal(evidence.anonymousAuthMe, 401);
      assert.equal(evidence.authenticatedAuthMe, 200);
      assert.equal(evidence.postLogoutAuthMe, 401);
      assert.ok(evidence.roles.includes('SUPPORT'));
      assert.deepEqual(evidence.permissions, expectedPermissions);
      assert.equal(evidence.consoleErrors, 0);
      console.log(JSON.stringify(evidence, null, 2));
    } catch {
      harnessResult.code = 1;
    }
  }
  if (harnessResult.code !== 0 && !safeHarnessStatus) {
    const errorType = harnessResult.stderr.match(/\b(TimeoutError|AssertionError|TypeError|ReferenceError|Error):/)?.[1] || 'UnknownError';
    safeHarnessStatus = { stage: 'harness-start-or-output', error: errorType, exitCode: harnessResult.code, signal: harnessResult.signal, stdoutBytes: Buffer.byteLength(harnessResult.stdout), stderrBytes: Buffer.byteLength(harnessResult.stderr) };
  }
} finally {
  if (fixture?.userId && temporaryPassword) {
    const cleanupInput = JSON.stringify({ userId: fixture.userId, startedAt, rotationPassword: randomPassword() });
    const result = await runProcess('docker', ['exec', '-i', apiContainer, 'node', '--input-type=module', '-e', cleanupFixtureCode], cleanupInput);
    if (result.code === 0) {
      try {
        const parsed = JSON.parse(result.stdout);
        cleanup = { ok: parsed.credentialRotated === true, revokedSessions: parsed.revokedSessions };
      } catch { cleanup.ok = false; }
    }
    fixture.phone = '';
    temporaryPassword = '';
  }
  if (childEnv) {
    delete childEnv.WAVE41_SUPPORT_PHONE;
    delete childEnv.WAVE41_SUPPORT_PASSWORD;
    childEnv = undefined;
  }
}

if (!cleanup.ok) throw new Error('Temporary SUPPORT fixture password/session cleanup could not be verified.');
if (harnessResult?.code !== 0) throw new Error(`Authenticated evidence harness failed: ${JSON.stringify(safeHarnessStatus)}; raw output suppressed.`);
console.log(JSON.stringify({ credentialRotation: 'PASS', revokedSessions: cleanup.revokedSessions, noCredentialValuesLogged: true }));
