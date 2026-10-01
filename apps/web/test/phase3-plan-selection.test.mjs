import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/plans/index.jsx', import.meta.url), 'utf8');

test('customer plan selection uses backend data and fail-closed capability', () => {
  assert.match(source, /benefit-plans/);
  assert.match(source, /normalizeCapabilities/);
  assert.match(source, /capabilityState/);
  assert.match(source, /disabled=\{selectionState !== 'allowed'\}/);
  assert.doesNotMatch(source, /payment|gateway|درگاه/i);
});

test('customer plan selection covers loading, empty, error and degraded states', () => {
  for (const state of ['LoadingState', 'EmptyState', 'ErrorState', 'DegradedState']) assert.match(source, new RegExp(state));
});
