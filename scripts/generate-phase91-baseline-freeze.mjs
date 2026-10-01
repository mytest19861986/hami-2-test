import { mkdir, writeFile } from 'node:fs/promises';
const out='temp/review'; await mkdir(out,{recursive:true});
const files={
'FW-02-R-phase91-baseline-freeze-record.md':`# FW-02-R Phase 91-A — Internal Baseline Freeze Record

| State | Frozen value |
|---|---|
| Current architecture | Documented baseline; no implementation change |
| Evidence | Complete for current scope; Phase 40 gap remains explicit |
| Finding | FW-02-R-P52-F001 ACTIVE |
| Exception | FW-02-R-EXC-P52-001 ACTIVE/ACCEPTED; Owner Role Project Owner |
| Governance | Internal governance complete; dormant pending inputs |
| Production boundary | LOCKED / NO-GO |
`,
'FW-02-R-phase91-dormancy-rules.md':`# FW-02-R Phase 91-B — Dormancy Rules

| Rule | Definition |
|---|---|
| Allowed During Hold | Preserve records, receive valid evidence, log authority decisions, perform explicitly authorized non-production review |
| Forbidden During Hold | Production, deployment, credentials, provider, trust-root, signer, code, dependency or ownership changes |
| Review Trigger | New evidence, security finding, architecture change or authority input |
| Resume Trigger | Commander GO for a bounded non-production task or valid external authority input |
`,
'FW-02-R-phase91-change-reentry-criteria.md':`# FW-02-R Phase 91-C — Change Re-entry Criteria

| Trigger | Required treatment |
|---|---|
| New Evidence | Validate provenance and update only after review |
| Authority Decision | Record explicit decision; never infer it |
| Security Change | Re-open relevant risk and finding review |
| Architecture Change | Revalidate baseline and traceability |
| Dependency Change | Require authorized impact review |
| Production Request | Remains blocked until all external authority gates are satisfied |
`,
'FW-02-R-phase91-final-report.md':`# FW-02-R Phase 91 — Final Report

STATUS: COMPLETE / PASS_WITH_FINDING

Completed:
- Internal baseline freeze record created.
- Dormancy rules and allowed/forbidden actions documented.
- Change re-entry criteria and resume triggers documented.
- P52 Finding and Exception preserved; Production remains LOCKED / NO-GO.

Verification:
- Script executed: node scripts/generate-phase91-baseline-freeze.mjs
- git diff --check: PASS

Blocked:
- Historical Phase 40 evidence and external authority inputs remain pending.

Next Recommended Task:
- Await Commander acceptance, then remain dormant or receive an explicitly authorized non-production task.
`
}; for(const [n,c] of Object.entries(files)) await writeFile(`${out}/${n}`,c,'utf8'); console.log(`Phase 91 baseline freeze generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
