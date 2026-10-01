import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(new URL('../pages/commission-overview.jsx', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../components/user-shell.jsx', import.meta.url), 'utf8');

test('Sprint 2C uses only the representative summary contract and approved capability boundary', () => {
  assert.match(page, /rep\/commission\/summary/);
  assert.match(page, /SUMMARY_FIELDS/);
  assert.match(shell, /commission-overview/);
  assert.doesNotMatch(page, /admin\/commissions/);
  assert.doesNotMatch(page, /entries\/\{id\}/);
});

test('Sprint 2C renders safe states and never calculates commission values', () => {
  for (const marker of ['loading', 'unauthorized', 'degraded', 'error', 'empty', 'stale', 'placeholder']) assert.match(page, new RegExp(marker, 'i'));
  assert.doesNotMatch(page, /\+\s*data|reduce\(|Math\.|amount.*amount/i);
  assert.match(page, /pending_balance/);
  assert.match(page, /available_balance/);
  assert.match(page, /clawback_due/);
});
