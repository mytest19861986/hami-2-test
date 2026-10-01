#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const packages = lock.packages ?? {};
const components = [];

for (const [location, meta] of Object.entries(packages)) {
  if (!location.startsWith('node_modules/')) continue;
  const name = location.slice('node_modules/'.length);
  if (meta.link) continue;
  const component = {
    type: 'library',
    name,
    version: meta.version ?? 'unknown',
    purl: `pkg:npm/${name}@${meta.version ?? 'unknown'}`,
  };
  if (meta.integrity) component.hashes = [{ alg: 'SHA-512', content: meta.integrity.replace(/^sha512-/, '') }];
  components.push(component);
}

components.sort((a, b) => a.purl.localeCompare(b.purl));
const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: 'urn:uuid:00000000-0000-4000-8000-000000000045',
  version: 1,
  metadata: { tools: [{ vendor: 'FW-02-R', name: 'read-only-lockfile-sbom-generator', version: '1.0.0' }] },
  components,
};

const output = new URL('../temp/review/FW-02-R-phase46-sbom.json', import.meta.url);
await mkdir(new URL('../temp/review/', import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');
console.log(`SBOM written: ${output.pathname}`);
console.log(`Components: ${components.length}`);
