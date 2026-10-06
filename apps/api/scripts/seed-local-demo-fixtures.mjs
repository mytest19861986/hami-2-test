const requiredEnvironment = [
  'DEMO_FIXTURES_ENABLED',
  'DEMO_FIXTURE_PASSWORD',
  'DEMO_FIXTURE_DB_HOST',
  'DEMO_FIXTURE_DB_NAME',
  'DEMO_FIXTURE_DB_SERVER_IP',
  'DEMO_FIXTURE_DB_PASSWORD',
  'DEMO_FIXTURE_COMPOSE_PROJECT',
  'DEMO_FIXTURE_AUTH_MODULE',
  'DEMO_FIXTURE_PHONE_ADMIN',
  'DEMO_FIXTURE_PHONE_DOCTOR',
  'DEMO_FIXTURE_PHONE_VISIT',
  'DEMO_FIXTURE_PHONE_USER',
];

function assertSafeDisposableDatabaseUrl(value) {
  let target;
  try { target = new URL(value); } catch { throw new Error('DEMO_FIXTURE_GUARD: DATABASE_URL must be a valid PostgreSQL URL'); }
  const directTarget = process.env.DEMO_FIXTURE_DB_HOST !== 'db';
  const expectedHost = directTarget ? process.env.DEMO_FIXTURE_DB_SERVER_IP : 'db';
  if (!['postgres:', 'postgresql:'].includes(target.protocol)
    || target.username !== (directTarget ? 'demo_fixture' : 'hamayat')
    || target.password.length < 32
    || (directTarget && target.password !== process.env.DEMO_FIXTURE_DB_PASSWORD)
    || target.port !== '5432'
    || target.search
    || target.hash
    || target.pathname.slice(1) !== process.env.DEMO_FIXTURE_DB_NAME
    || target.hostname !== expectedHost) {
    throw new Error('DEMO_FIXTURE_GUARD: DATABASE_URL must exactly match the allowlisted disposable PostgreSQL target');
  }
  if (target.hostname === 'db' && process.env.DEMO_FIXTURE_COMPOSE_PROJECT !== 'hami-demo-fixture') throw new Error('DEMO_FIXTURE_GUARD: Docker db host is restricted to the dedicated hami-demo-fixture project');
  if (target.hostname === 'db' && target.port !== '5432') throw new Error('DEMO_FIXTURE_GUARD: Docker database port must be 5432');
  if (target.hostname !== 'db' && target.hostname !== process.env.DEMO_FIXTURE_DB_SERVER_IP) throw new Error('DEMO_FIXTURE_GUARD: loopback connection host must match the server identity allowlist');
  return target;
}

for (const name of requiredEnvironment) {
  if (!process.env[name]) throw new Error(`DEMO_FIXTURE_GUARD: ${name} is required`);
}

if (process.env.NODE_ENV === 'production') throw new Error('DEMO_FIXTURE_GUARD: production is forbidden');
if (process.env.DEMO_FIXTURES_ENABLED !== 'true') throw new Error('DEMO_FIXTURE_GUARD: set DEMO_FIXTURES_ENABLED=true explicitly');
if (process.env.DEMO_FIXTURE_PASSWORD.length < 16) throw new Error('DEMO_FIXTURE_GUARD: password must be a temporary secret of at least 16 characters');
if (process.env.DEMO_FIXTURE_DB_PASSWORD.length < 32) throw new Error('DEMO_FIXTURE_GUARD: disposable DB password must be a temporary random secret of at least 32 characters');
if (process.env.OTP_PROVIDER?.toLowerCase() === 'sms') throw new Error('DEMO_FIXTURE_GUARD: real SMS provider must be disabled');
if (process.env.ALLOW_DEV_OTP_CODE === 'true') throw new Error('DEMO_FIXTURE_GUARD: dev OTP exposure must remain disabled');
if (!/^local_demo_[a-f0-9]{12}$/.test(process.env.DEMO_FIXTURE_DB_NAME)) throw new Error('DEMO_FIXTURE_GUARD: database name must use a unique local_demo_<12 hex> name');
if (!['127.0.0.1', 'db'].includes(process.env.DEMO_FIXTURE_DB_HOST)) throw new Error('DEMO_FIXTURE_GUARD: database host must be 127.0.0.1 or the dedicated Compose db service');
if (process.env.DEMO_FIXTURE_DB_HOST !== 'db' && process.env.DEMO_FIXTURE_DB_SERVER_IP !== process.env.DEMO_FIXTURE_DB_HOST) throw new Error('DEMO_FIXTURE_GUARD: loopback database server identity must exactly match its host allowlist');
if (process.env.DEMO_FIXTURE_DB_HOST === 'db' && process.env.DEMO_FIXTURE_COMPOSE_PROJECT !== 'hami-demo-fixture') throw new Error('DEMO_FIXTURE_GUARD: Docker db host is restricted to the dedicated hami-demo-fixture project');
if (process.env.DEMO_FIXTURE_DB_HOST === 'db' && process.env.POSTGRES_DB !== process.env.DEMO_FIXTURE_DB_NAME) throw new Error('DEMO_FIXTURE_GUARD: Compose POSTGRES_DB must exactly match the disposable fixture database name');
if (process.env.DEMO_FIXTURE_DB_HOST === 'db' && process.env.POSTGRES_PASSWORD !== process.env.DEMO_FIXTURE_DB_PASSWORD) throw new Error('DEMO_FIXTURE_GUARD: Compose database password must match the disposable fixture secret');
if (process.env.DEMO_FIXTURE_DB_HOST === 'db' && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(process.env.DEMO_FIXTURE_DB_SERVER_IP)) throw new Error('DEMO_FIXTURE_GUARD: dedicated Compose database server IP must be explicitly allowlisted');
if (process.env.DEMO_FIXTURE_COMPOSE_PROJECT !== 'hami-demo-fixture') throw new Error('DEMO_FIXTURE_GUARD: disposable fixture containers must use the dedicated hami-demo-fixture project');

const { prisma, hashPassword, normalizeMobile } = await import(process.env.DEMO_FIXTURE_AUTH_MODULE);
const fixtures = [
  { username: 'admin', phone: normalizeMobile(process.env.DEMO_FIXTURE_PHONE_ADMIN), role: 'SUPER_ADMIN' },
  { username: 'doctor', phone: normalizeMobile(process.env.DEMO_FIXTURE_PHONE_DOCTOR), role: 'USER', provider: true },
  { username: 'visit', phone: normalizeMobile(process.env.DEMO_FIXTURE_PHONE_VISIT), role: 'SALES_PARTNER' },
  { username: 'user', phone: normalizeMobile(process.env.DEMO_FIXTURE_PHONE_USER), role: 'USER' },
];

try {
  assertSafeDisposableDatabaseUrl(process.env.DATABASE_URL);

  const [database] = await prisma.$queryRaw`SELECT current_database() AS "name", host(inet_server_addr()) AS "serverIp"`;
  if (database.name !== process.env.DEMO_FIXTURE_DB_NAME || database.serverIp !== process.env.DEMO_FIXTURE_DB_SERVER_IP) {
    throw new Error('DEMO_FIXTURE_GUARD: connected database server is not the explicitly allowed disposable instance');
  }

  const roleNames = [...new Set(fixtures.map(({ role }) => role))];
  const roles = await prisma.role.findMany({ where: { name: { in: roleNames } }, select: { id: true, name: true } });
  if (roles.length !== roleNames.length) throw new Error('DEMO_FIXTURE_GUARD: one or more required real RBAC roles are missing');
  const roleByName = new Map(roles.map((role) => [role.name, role]));

  const existing = await Promise.all(fixtures.map(({ phone }) => prisma.user.findUnique({
    where: { phone },
    include: { profile: true, roles: { include: { role: true } }, providerMemberships: { include: { provider: true } } },
  })));
  if (existing.some(Boolean)) {
    if (existing.some((user) => !user)) throw new Error('DEMO_FIXTURE_GUARD: partial phone collision; no accounts were changed');
    for (let i = 0; i < fixtures.length; i += 1) {
      const fixture = fixtures[i];
      const user = existing[i];
      const assignedRoles = user.roles.map(({ role }) => role.name).sort();
      const expectedRoles = [fixture.role].sort();
      const hasDemoProfile = user.profile?.firstName === 'Demo' && user.profile?.lastName === fixture.username;
      const hasExpectedRoles = JSON.stringify(assignedRoles) === JSON.stringify(expectedRoles);
      const hasExpectedProvider = fixture.provider
        ? user.providerMemberships.some(({ provider }) => provider.displayName === 'LOCAL DEMO — doctor')
        : user.providerMemberships.length === 0;
      if (user.status !== 'ACTIVE' || !hasDemoProfile || !hasExpectedRoles || !hasExpectedProvider) {
        throw new Error('DEMO_FIXTURE_GUARD: a synthetic phone is occupied by a non-fixture or changed record; no accounts were changed');
      }
    }
    console.log(JSON.stringify({ result: 'already-seeded', database: database.name, fixtures: fixtures.map(({ username, role }) => ({ username, role })) }));
  } else {
    const city = await prisma.city.findFirst({ orderBy: { name: 'asc' }, select: { id: true, provinceId: true } });
    const specialty = await prisma.medicalSpecialty.findUnique({ where: { name: 'General Practitioner' }, select: { id: true } });
    if (!city || !specialty) throw new Error('DEMO_FIXTURE_GUARD: local geography/specialty seed is missing; no accounts were created');

    const passwordHash = hashPassword(process.env.DEMO_FIXTURE_PASSWORD);
    await prisma.$transaction(async (tx) => {
      for (const fixture of fixtures) {
        const role = roleByName.get(fixture.role);
        const user = await tx.user.create({
          data: {
            phone: fixture.phone,
            passwordHash,
            status: 'ACTIVE',
            // These are local-only synthetic identities. Keep mobileVerifiedAt null;
            // the seed never verifies a phone, creates an OTP, or contacts an SMS provider.
            profile: { create: { firstName: 'Demo', lastName: fixture.username } },
          },
        });
        await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
        if (fixture.provider) {
          const provider = await tx.provider.create({
            data: {
              type: 'DOCTOR',
              status: 'DRAFT',
              displayName: 'LOCAL DEMO — doctor',
              provinceId: city.provinceId,
              cityId: city.id,
              address: 'Local demo fixture',
              phone: fixture.phone,
              doctorProfile: { create: { medicalCouncilNumber: 'LOCAL-DEMO-DOCTOR-01', specialtyId: specialty.id } },
            },
          });
          await tx.providerMembership.create({ data: { providerId: provider.id, userId: user.id, role: 'OWNER' } });
        }
      }
    });
    console.log(JSON.stringify({ result: 'created', database: database.name, fixtures: fixtures.map(({ username, role }) => ({ username, role })) }));
  }
} catch (error) {
  if (error?.code === 'P2002' || error?.code === 'P2034') throw new Error('DEMO_FIXTURE_GUARD: concurrent fixture seed/collision detected; transaction rolled back; inspect fixture state before retry');
  throw error;
} finally {
  await prisma.$disconnect();
}
