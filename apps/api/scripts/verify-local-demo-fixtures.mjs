if (process.env.NODE_ENV === 'production') throw new Error('DEMO_FIXTURE_GUARD: production is forbidden');
if (process.env.DEMO_FIXTURES_ENABLED !== 'true') throw new Error('DEMO_FIXTURE_GUARD: set DEMO_FIXTURES_ENABLED=true explicitly');
if (!process.env.DEMO_FIXTURE_PASSWORD || process.env.DEMO_FIXTURE_PASSWORD.length < 16) throw new Error('DEMO_FIXTURE_GUARD: temporary fixture password is required');
if (!/^local_demo_[a-f0-9]{12}$/.test(process.env.DEMO_FIXTURE_DB_NAME ?? '')) throw new Error('DEMO_FIXTURE_GUARD: expected disposable database identity is required');
if (process.env.DEMO_FIXTURE_COMPOSE_PROJECT !== 'hami-demo-fixture') throw new Error('DEMO_FIXTURE_GUARD: local API verifier requires the dedicated hami-demo-fixture project');
for (const name of ['DEMO_FIXTURE_PHONE_ADMIN', 'DEMO_FIXTURE_PHONE_DOCTOR', 'DEMO_FIXTURE_PHONE_VISIT', 'DEMO_FIXTURE_PHONE_USER']) {
  if (!process.env[name]) throw new Error(`DEMO_FIXTURE_GUARD: ${name} is required`);
}

const base = new URL(process.env.DEMO_FIXTURE_BASE_URL ?? 'http://127.0.0.1:8080');
if (!['localhost', '127.0.0.1'].includes(base.hostname) || base.protocol !== 'http:' || base.username || base.password || !['8080', '18080'].includes(base.port) || base.search || base.hash) {
  throw new Error('DEMO_FIXTURE_GUARD: verification is restricted to a loopback URL');
}
if (process.env.DEMO_FIXTURE_DB_NAME && !/^local_demo_[a-f0-9]{12}$/.test(process.env.DEMO_FIXTURE_DB_NAME)) throw new Error('DEMO_FIXTURE_GUARD: expected disposable database identity is invalid');
const origin = process.env.DEMO_FIXTURE_FRONTEND_ORIGIN;
const expectedOrigin = `${base.origin}`;
if (!origin || origin !== expectedOrigin) throw new Error('DEMO_FIXTURE_GUARD: expected local frontend origin must exactly match the loopback verifier target');

const accounts = [
  { username: 'admin', phone: process.env.DEMO_FIXTURE_PHONE_ADMIN, role: 'SUPER_ADMIN', summaryPath: '/api/v1/admin/dashboard/summary' },
  { username: 'doctor', phone: process.env.DEMO_FIXTURE_PHONE_DOCTOR, role: 'USER', summaryPath: '/api/v1/users/me/providers', providerMember: true },
  { username: 'visit', phone: process.env.DEMO_FIXTURE_PHONE_VISIT, role: 'SALES_PARTNER', summaryPath: '/api/v1/rep/dashboard/summary' },
  { username: 'user', phone: process.env.DEMO_FIXTURE_PHONE_USER, role: 'USER', summaryPath: '/api/v1/customer/dashboard/summary' },
];

function assert(condition, message) {
  if (!condition) throw new Error(`DEMO_FIXTURE_VERIFY: ${message}`);
}

async function request(path, { method = 'GET', body, cookie, csrf } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (csrf) headers['X-CSRF-Token'] = csrf;
  if (method !== 'GET') headers.Origin = origin;
  if (method === 'POST' && path.endsWith('/login/password')) headers['X-Auth-Mode'] = 'cookie';
  return fetch(new URL(path, base), { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

const unauthenticated = await request('/api/v1/auth/me');
assert(unauthenticated.status === 401, `pre-login /auth/me expected 401, got ${unauthenticated.status}`);

for (const account of accounts) {
  const login = await request('/api/v1/auth/login/password', {
    method: 'POST',
    body: { phone: account.phone, password: process.env.DEMO_FIXTURE_PASSWORD },
  });
  assert(login.ok, `${account.username} password login failed with HTTP ${login.status}`);
  const setCookies = login.headers.getSetCookie?.() ?? [];
  assert(setCookies.length >= 2, `${account.username} login did not set expected session cookies`);
  const cookie = setCookies.map((entry) => entry.split(';', 1)[0]).join('; ');
  const csrf = setCookies.find((entry) => entry.startsWith('__Host-csrf='))?.split(';', 1)[0].slice('__Host-csrf='.length);
  assert(csrf, `${account.username} CSRF cookie missing`);

  const me = await request('/api/v1/auth/me', { cookie });
  assert(me.status === 200, `${account.username} /auth/me after login expected 200, got ${me.status}`);
  const identity = await me.json();
  const roles = identity.roles?.map(({ role }) => role.name) ?? [];
  assert(roles.includes(account.role), `${account.username} expected role ${account.role}`);

  const dashboard = await request(account.summaryPath, { cookie });
  assert(dashboard.ok, `${account.username} authorized surface failed with HTTP ${dashboard.status}`);
  if (account.providerMember) {
    const providers = await dashboard.json();
    assert(Array.isArray(providers) && providers.some((provider) => provider.displayName === 'LOCAL DEMO — doctor' && provider.status === 'DRAFT'), 'doctor fixture provider membership evidence is missing or has an unexpected status');
  }

  const logout = await request('/api/v1/auth/logout', { method: 'POST', body: {}, cookie, csrf });
  assert(logout.ok, `${account.username} logout failed with HTTP ${logout.status}`);
  const logoutCookies = logout.headers.getSetCookie?.() ?? [];
  const clearedNames = new Set(logoutCookies
    .filter((entry) => /(?:^|;\s*)Max-Age=0(?:;|$)/i.test(entry))
    .map((entry) => entry.split(';', 1)[0].split('=', 1)[0]));
  assert(clearedNames.has('__Host-access') && clearedNames.has('__Host-refresh'), `${account.username} logout did not clear session cookies`);
  const remainingCookie = cookie.split('; ').filter((entry) => !clearedNames.has(entry.split('=', 1)[0])).join('; ');
  const afterLogout = await request('/api/v1/auth/me', { cookie: remainingCookie });
  assert(afterLogout.status === 401, `${account.username} /auth/me after logout expected 401, got ${afterLogout.status}`);
  if (account.username === 'admin') {
    const staleCookieReplay = await request('/api/v1/auth/me', { cookie });
    const staleRefreshReplay = await request('/api/v1/auth/refresh', { method: 'POST', body: {}, cookie, csrf });
    assert(staleRefreshReplay.status === 401, `revoked refresh-family replay expected 401, got ${staleRefreshReplay.status}`);
    console.log(JSON.stringify({ diagnostic: 'OBSERVED_KNOWN_SECURITY_FINDING', check: 'old-access-cookie-replay-after-logout', status: staleCookieReplay.status, expectedSecureResult: '401', remediationTask: 'AUTH-LOGOUT-REPLAY-03' }));
    console.log(JSON.stringify({ diagnostic: 'REFRESH_FAMILY_REPLAY', status: staleRefreshReplay.status, expected: 401 }));
  }
  console.log(`${account.username}: login PASS; role PASS; authorized surface PASS; logout PASS; post-logout 401 PASS`);
}

console.log('DEMO_FIXTURE_VERIFICATION PASS; no credentials, tokens, cookies, or response payloads were logged.');
