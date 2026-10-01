import { mkdir, writeFile } from 'node:fs/promises';
const out='temp/review'; await mkdir(out,{recursive:true});
const files={
'FW-02-R-phase86-exit-criteria-matrix.md':`# FW-02-R Phase 86-A — Exit Criteria Matrix

| Area | Completion Condition | Evidence Required | Current Status | Remaining Gap |
|---|---|---|---|---|
| Governance controls | Required internal control models are documented and accepted | Phase reports and acceptance history | Complete | None internal |
| Evidence integrity | Evidence provenance and freshness boundaries are preserved | Evidence map and freshness model | Complete with accepted risk | P52 historical artifact gap remains |
| Finding management | Open Finding is registered and disposition is explicit | Finding register | Pending action | FW-02-R-P52-F001 remains ACTIVE |
| Exception management | Exception scope, owner and expiry boundary are explicit | Exception register | Completed with accepted risk | FW-02-R-EXC-P52-001 remains ACTIVE/ACCEPTED |
| Handover readiness | Package, simulation and responsibility matrix exist | Phase 85 artifacts | Ready for maintenance transition | Actual ownership transfer not performed |
| External authority | Required authority decisions and ownership exist | Authority records | Pending external authority | Production/trust-root/signer/provider ownership pending |
| Production boundary | No-go state is explicit and enforced by governance | Decision history | LOCKED / NO-GO | Production authorization not granted |
`,
'FW-02-R-phase86-completion-states.md':`# FW-02-R Phase 86-B — Completion State Classification

| State | Meaning | FW-02-R Applicability |
|---|---|---|
| Completed | Internal scope and evidence are complete with no material gap | Internal governance models: applicable |
| Completed With Accepted Risk | Scope is complete while a documented risk/limitation remains | P52 Exception and historical evidence limitation: applicable |
| Pending External Authority | Internal work is complete but authority input is required | Production, trust-root, signer, provider and operational ownership: applicable |
| Blocked | A required action cannot proceed because a defined blocker prevents it | No new internal blocker identified |
| Requires Revalidation | New evidence, change, expiry or resume trigger invalidates prior validation | Applies when trigger occurs |
`,
'FW-02-R-phase86-completion-decision-model.md':`# FW-02-R Phase 86-C — Final Governance Completion Decision Model

Evidence Review
↓
Risk Review
↓
Authority Dependency Check
↓
Completion Classification
↓
Next Action

Decision rules:

- Complete internal documentation only when the applicable evidence and acceptance criteria are present.
- Classify documented limitations as Completed With Accepted Risk; do not silently close the related Finding.
- Classify unresolved production or external-ownership matters as Pending External Authority.
- Classify a state as Blocked only when a concrete blocker prevents the scoped action.
- Require Revalidation after new evidence, material change, exception expiry or resume trigger.
- No completion classification grants authorization, ownership, deployment or Production readiness.
`,
'FW-02-R-phase86-final-report.md':`# FW-02-R Phase 86 — Final Report

STATUS: COMPLETE / PASS

Completed:
- Exit Criteria Matrix created with completion condition, evidence, current status and remaining gap.
- Completion State Classification defined for Completed, Completed With Accepted Risk, Pending External Authority, Blocked and Requires Revalidation.
- Final Governance Completion Decision Model documented from Evidence Review through Next Action.
- P52 Finding preserved: FW-02-R-P52-F001 = ACTIVE.
- P52 Exception preserved: FW-02-R-EXC-P52-001 = ACTIVE/ACCEPTED; Owner Role = Project Owner.
- Production preserved: LOCKED / NO-GO.

Blocked:
- No new internal blocker. Historical evidence limitation and external authority dependencies remain explicitly classified.

Next Recommended Task:
- Await Commander acceptance and request the next independent non-production task, or HOLD if the internal governance cycle is complete.

Commander Decision Required:
- ACCEPT/CLOSE Phase 86 and explicitly declare HOLD or the next non-production task.
`
};
for(const [name,content] of Object.entries(files)) await writeFile(`${out}/${name}`,content,'utf8');
console.log(`Phase 86 exit criteria generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
