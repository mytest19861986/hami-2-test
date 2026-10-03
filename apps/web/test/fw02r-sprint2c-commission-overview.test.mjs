import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { formatMoney } from '../lib/presentation.js';

const page = fs.readFileSync(new URL('../pages/commission-overview.jsx', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../components/user-shell.jsx', import.meta.url), 'utf8');
const presentation = fs.readFileSync(new URL('../lib/presentation.js', import.meta.url), 'utf8');

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
  assert.match(page, /formatMoney\(data\[field\]/);
  assert.doesNotMatch(page, /String\(data\[field\]/);
  assert.match(presentation, /value\.amount_minor/);
  assert.match(presentation, /value\.currency_code/);
  assert.match(presentation, /BigInt\(value\)/);
});

test('commission money objects render exact minor units and currency without object coercion', () => {
  const amount = '900719925474099312345';
  assert.equal(formatMoney({ amount_minor: amount, currency_code: 'IRR', sign_rule: 'signed_ledger_earned' }), `${BigInt(amount).toLocaleString('fa-IR')} IRR`);
  assert.doesNotMatch(formatMoney({ amount_minor: '0', currency_code: 'IRR' }), /\[object Object\]|NaN/);
});
