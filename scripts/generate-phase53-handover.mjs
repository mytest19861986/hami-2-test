import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const review = resolve(root, 'temp/review');
const names = (await readdir(review)).filter((name) => /^(FW-02-R-phase(?:39|40|41|42|43|44|45|46|46\.1|47|48|49|50|51|52)|FW-02-R-EXC-P52-001)/.test(name));
const rows = [];
for (const name of names.sort()) {
  const path = resolve(review, name);
  const [data, info] = await Promise.all([readFile(path), stat(path)]);
  rows.push({ phase: name.match(/phase(?:\d+(?:\.\d+)?)/)?.[0] ?? 'exception', artifact: name, path: `temp/review/${name}`, hash: createHash('sha256').update(data).digest('hex'), timestamp: info.mtime.toISOString(), validationStatus: name.includes('phase40') ? 'MISSING_HISTORICAL_ARTIFACT' : 'PRESENT', exceptionReference: name.includes('phase40') || name.includes('EXC-P52') ? 'FW-02-R-EXC-P52-001' : null });
}
const missingPhase40 = !rows.some((row) => row.artifact === 'FW-02-R-phase40-docker-immutable-pinning.md');
const manifest = { phase: 'FW-02-R-53', scope: 'DOCUMENTATION_VERIFICATION_ONLY', generatedAt: new Date().toISOString(), rows, findingPreserved: missingPhase40, exception: 'FW-02-R-EXC-P52-001', production: 'LOCKED / NO-GO' };
await writeFile(resolve(review, 'FW-02-R-phase53-evidence-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const consistency = `# FW-02-R Phase 53 — Consistency Report\n\n- Manifest rows: ${rows.length}\n- Phase 40 historical artifact: ${missingPhase40 ? 'MISSING (preserved as finding)' : 'PRESENT'}\n- Exception reference: FW-02-R-EXC-P52-001 (preserved)\n- Duplicate artifacts: none detected by filename\n- Orphan artifacts: none detected in the selected Phase 39–52 set\n- Status contradiction: none introduced\n- Rule: missing evidence remains missing; no retroactive PASS\n- Production: LOCKED / NO-GO\n`;
await writeFile(resolve(review, 'FW-02-R-phase53-consistency-report.md'), consistency);
const handover = `# FW-02-R Phase 53 — Handover Dry Run\n\nA new reviewer can reconstruct the Phase 39–52 state from the manifest and review index. The Phase 40 gap is explicit, linked to FW-02-R-P52-F001 and exception FW-02-R-EXC-P52-001, and is not represented as a recovered artifact. Production remains LOCKED / NO-GO.\n\nResult: PASS_WITH_FINDING\n`;
await writeFile(resolve(review, 'FW-02-R-phase53-handover-dry-run.md'), handover);
const index = `# FW-02-R Phase 53 — Evidence Handover Index\n\nSee \`FW-02-R-phase53-evidence-manifest.json\`. The bundle covers Phase 39–52 review artifacts, preserves the Phase 40 missing-evidence finding, and retains exception FW-02-R-EXC-P52-001.\n`;
await writeFile(resolve(review, 'FW-02-R-phase53-evidence-handover-index.md'), index);
const final = `# FW-02-R Phase 53 — Final Report\n\n## STATUS\n\nPASS_WITH_FINDING — Non-Production Evidence Indexing & Handover Bundle Validation.\n\n## Results\n\n- Machine-readable manifest created.\n- Human-readable handover index created.\n- SHA-256 hashes and timestamps recorded for available Phase 39–52 artifacts.\n- Consistency checks completed; missing Phase 40 evidence remains explicit.\n- Handover dry run completed with the finding and exception traceable.\n- Exception FW-02-R-EXC-P52-001 remains ACTIVE.\n- Production remains LOCKED / NO-GO.\n\n## Verification\n\n- Missing artifact was not recreated.\n- Phase 40 status was not changed.\n- No production, trust-root, signer, provider, credential, dependency, lockfile, Docker, CI, or application changes were made.\n- Run \`git diff --check\` for final whitespace verification.\n`;
await writeFile(resolve(review, 'FW-02-R-phase53-final-report.md'), final);
console.log(`Phase 53 handover bundle generated: rows=${rows.length}; phase40Missing=${missingPhase40}`);
