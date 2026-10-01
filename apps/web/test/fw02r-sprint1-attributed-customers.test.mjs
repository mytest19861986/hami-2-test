import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(new URL('../pages/attributed-customers/index.jsx', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../components/user-shell.jsx', import.meta.url), 'utf8');

test('Sprint 1 attributed customers view uses the existing collection and all required states', () => {
  assert.match(page, /sales-partner\/customers/);
  for (const marker of ['LoadingState', 'EmptyState', 'ErrorState', 'DegradedState', 'unauthorized']) assert.match(page, new RegExp(marker));
  assert.match(page, /customerRef/);
  assert.match(page, /displayAlias/);
  assert.doesNotMatch(page, /customerUserId/);
  assert.doesNotMatch(page, /commission|withdrawal/i);
  assert.match(shell, /attributed-customers/);
});
