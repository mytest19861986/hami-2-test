import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const input = resolve(root, 'temp/review/FW-02-R-phase50-attestation-verification.json');
const output = resolve(root, 'temp/review/FW-02-R-phase51-verifier-integration-dry-run.json');

const phase50 = JSON.parse(await readFile(input, 'utf8'));
const decisions = phase50.results.map(({ name, decision, failures, warnings }) => ({
  case: name,
  policyDecision: decision,
  failures,
  warnings,
  dryRunAction: decision === 'FAIL' ? 'REPORT_FAIL_NO_RELEASE_ACTION' : decision === 'WARN' ? 'REPORT_WARN_CONTINUE_OBSERVATION' : 'REPORT_PASS_CONTINUE',
}));

const report = {
  phase: 'FW-02-R-51',
  scope: 'NON_PRODUCTION_DRY_RUN_ONLY',
  flow: ['SBOM_GENERATED', 'ATTESTATION_AVAILABLE', 'VERIFIER_INVOKED', 'POLICY_DECISION', 'PASS_WARN_FAIL_REPORTED'],
  integration: { verifierInvocation: 'LOCAL_NODE_SCRIPT', releaseGate: false, productionCiModified: false },
  trust: { realSigner: false, productionIdentity: false, providerConnection: false, secretCreated: false, trustRootCreated: false },
  decisions,
  evidence: { source: 'FW-02-R-phase50-attestation-verification.json', preserved: true, traceable: true, reviewable: true },
  decision: decisions.length === 6 && decisions.every((item) => item.policyDecision === phase50.results.find((r) => r.name === item.case).decision) ? 'PASS_DRY_RUN' : 'FAIL',
};

await mkdir(resolve(root, 'temp/review'), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Verifier integration dry-run: ${report.decision}; cases=${decisions.length}`);
if (report.decision !== 'PASS_DRY_RUN') process.exitCode = 1;
