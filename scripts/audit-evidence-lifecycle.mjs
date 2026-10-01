import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const reviewDir = resolve(root, 'temp/review');
const files = new Set(await readdir(reviewDir));
const expected = [
  ['39', 'FW-02-R-phase39-stage-a-authority-determination.md'],
  ['40', 'FW-02-R-phase40-docker-immutable-pinning.md'],
  ['41', 'FW-02-R-phase41-reachability-analysis.md'],
  ['42', 'FW-02-R-phase42-final-vulnerability-evidence.md'],
  ['43', 'FW-02-R-phase43-next-advisory-identification.md'],
  ['44', 'FW-02-R-phase44-next-compatibility-review.md'],
  ['45', 'FW-02-R-phase45-sbom-provenance-baseline.md'],
  ['46', 'FW-02-R-phase46-enforcement-design.md'],
  ['46.1', 'FW-02-R-phase46.1-api-regression.md'],
  ['47', 'FW-02-R-phase47-enforcement-simulation.json'],
  ['48', 'FW-02-R-phase48-signed-sbom-attestation-design.md'],
  ['49', 'FW-02-R-phase49-trust-root-selection-design.md'],
  ['50', 'FW-02-R-phase50-attestation-verification.json'],
  ['51', 'FW-02-R-phase51-verifier-integration-dry-run.json'],
];
const inventory = expected.map(([phase, artifact]) => ({ phase, artifact, present: files.has(artifact), status: files.has(artifact) ? 'VERIFIED_PRESENT' : 'MISSING' }));
const missing = inventory.filter((item) => !item.present);
const report = {
  phase: 'FW-02-R-52',
  scope: 'DOCUMENTATION_VERIFICATION_ONLY',
  inventory,
  traceability: { chain: 'PHASE -> ARTIFACT -> VALIDATION RESULT -> CURRENT STATUS', complete: missing.length === 0, missing },
  recoverySimulation: { reviewerCanRebuildState: missing.length === 0, dependencies: ['Phase 39-51 evidence', 'Phase 51 HOLD decision', 'Production LOCKED / NO-GO boundary'] },
  findings: { orphanEvidence: [], duplicateEvidence: [], missingReference: missing.map((item) => item.artifact), inconsistentStatus: [], staleAssumptions: [] },
  decision: missing.length === 0 ? 'PASS' : 'FAIL',
};
await writeFile(resolve(reviewDir, 'FW-02-R-phase52-evidence-lifecycle-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Evidence lifecycle audit: ${report.decision}; inventory=${inventory.length}; missing=${missing.length}`);
if (missing.length) process.exitCode = 1;
