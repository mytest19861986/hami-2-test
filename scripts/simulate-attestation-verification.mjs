import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const output = resolve(root, 'temp/review/FW-02-R-phase50-attestation-verification.json');
const sbom = JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', components: [{ name: 'synthetic-component', version: '1.0.0' }] });
const sbomDigest = `sha256:${createHash('sha256').update(sbom).digest('hex')}`;
const artifact = 'sha256:synthetic-artifact-digest';
const signer = 'test-signer-fixture';

const valid = { schema: 'sc-r3-attestation/v1', sbomDigest, artifactDigest: artifact, signer, expiresAt: '2099-01-01T00:00:00Z' };
const policy = { allowedSigners: [signer], requireMetadata: true, expired: 'WARN_OBSERVATION_FAIL_ENFORCED' };

function verify(attestation, now = new Date('2026-09-29T00:00:00Z')) {
  const failures = [];
  const warnings = [];
  if (!attestation?.schema || !attestation?.sbomDigest || !attestation?.artifactDigest || !attestation?.signer || !attestation?.expiresAt) failures.push('MISSING_METADATA');
  if (attestation?.sbomDigest !== sbomDigest) failures.push('SBOM_DIGEST_MISMATCH');
  if (attestation?.artifactDigest !== artifact) failures.push('ARTIFACT_DIGEST_MISMATCH');
  if (!policy.allowedSigners.includes(attestation?.signer)) failures.push('UNKNOWN_SIGNER');
  if (new Date(attestation?.expiresAt) <= now) warnings.push('EXPIRED_ATTESTATION');
  return { decision: failures.length ? 'FAIL' : warnings.length ? 'WARN' : 'PASS', failures, warnings };
}

const cases = [
  ['valid_signature', valid],
  ['unknown_signer', { ...valid, signer: 'unknown-signer' }],
  ['digest_mismatch', { ...valid, artifactDigest: 'sha256:wrong' }],
  ['modified_sbom', { ...valid, sbomDigest: 'sha256:modified' }],
  ['expired_metadata', { ...valid, expiresAt: '2020-01-01T00:00:00Z' }],
  ['missing_metadata', { schema: valid.schema, signer: valid.signer }],
];
const results = cases.map(([name, attestation]) => ({ name, ...verify(attestation) }));
const expected = { valid_signature: 'PASS', unknown_signer: 'FAIL', digest_mismatch: 'FAIL', modified_sbom: 'FAIL', expired_metadata: 'WARN', missing_metadata: 'FAIL' };
const mismatches = results.filter((r) => r.decision !== expected[r.name]);
const report = { phase: 'FW-02-R-50', scope: 'LOCAL_TEST_ONLY', externalProvider: false, realKeyCreated: false, results, mismatches, decision: mismatches.length ? 'FAIL' : 'PASS' };

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Attestation verification simulation: ${report.decision}; cases=${results.length}; mismatches=${mismatches.length}`);
if (mismatches.length) process.exitCode = 1;
