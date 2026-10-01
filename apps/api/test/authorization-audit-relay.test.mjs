import assert from 'node:assert/strict';
import { test } from 'node:test';
import { relayOne, relayUntilIdle } from '../src/authorization-audit-relay.mjs';

function fakePrisma(rows) {
  const deadLetters = [];
  return {
    deadLetters,
    authorizationAuditOutbox: {
      async findFirst() { return rows.find((row) => row.deliveredAt === null) ?? null; },
      async updateMany({ where, data }) {
        const row = rows.find((item) => item.id === where.id && item.deliveredAt === where.deliveredAt);
        if (!row) return { count: 0 };
        Object.assign(row, data); return { count: 1 };
      },
    },
    authorizationAuditDeadLetter: {
      async create({ data }) { const row = { id: `dead-${deadLetters.length + 1}`, ...data }; deadLetters.push(row); return row; },
    },
  };
}

test('relay delivers once and leaves audit record untouched', async () => {
  const db = fakePrisma([{ id: 'o1', auditId: 'a1', payload: {}, deliveredAt: null }]);
  let deliveries = 0;
  const result = await relayOne(db, async () => { deliveries += 1; });
  assert.equal(result.status, 'DELIVERED');
  assert.equal(deliveries, 1);
  assert.notEqual(db.authorizationAuditOutbox, undefined);
});

test('relay retries then dead-letters after bounded failure', async () => {
  const db = fakePrisma([{ id: 'o1', auditId: 'a1', payload: {}, deliveredAt: null, auditEvent: { requestId: 'r1', action: 'VIEW_COMMISSION_SUMMARY_GRANTED' } }]);
  const attempts = new Map();
  const deliver = async () => { throw new Error('transport down'); };
  assert.equal((await relayOne(db, deliver, { attempts })).status, 'RETRY');
  assert.equal((await relayOne(db, deliver, { attempts })).status, 'RETRY');
  assert.equal((await relayOne(db, deliver, { attempts })).status, 'DEAD_LETTERED');
  assert.equal(db.deadLetters.length, 1);
});

test('relay until idle drains delivered rows', async () => {
  const db = fakePrisma([
    { id: 'o1', auditId: 'a1', payload: {}, deliveredAt: null },
    { id: 'o2', auditId: 'a2', payload: {}, deliveredAt: null },
  ]);
  const results = await relayUntilIdle(db, async () => {});
  assert.deepEqual(results.map((item) => item.status), ['DELIVERED', 'DELIVERED', 'IDLE']);
});
