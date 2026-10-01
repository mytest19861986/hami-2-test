import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('FW-01 foundation exposes shared primitives and RTL tokens', () => {
  const component = fs.readFileSync(new URL('../components/foundation.jsx', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(component, /LoadingState/);
  assert.match(component, /DegradedState/);
  assert.match(styles, /--ui-primary/);
  assert.match(styles, /direction: rtl/);
});
