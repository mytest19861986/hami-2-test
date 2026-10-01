#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const entries = Object.entries(lock.packages ?? {}).filter(([key]) => key.startsWith('node_modules/'));
const registryEntries = entries.filter(([, meta]) => !meta.link);
const missing = registryEntries.filter(([, meta]) => !meta.integrity);
if (missing.length) {
  console.error(`Integrity check failed: ${missing.length} registry-backed entries missing integrity`);
  for (const [key] of missing) console.error(` - ${key}`);
  process.exitCode = 1;
} else {
  console.log(`Integrity check PASS: ${registryEntries.length}/${registryEntries.length} registry-backed entries have integrity`);
}
