import { mkdir, writeFile } from 'node:fs/promises';
const out='temp/review'; await mkdir(out,{recursive:true});
const files={
'FW-02-R-phase87-capability-assessment.md':`# FW-02-R Phase 87-A — Governance Capability Assessment

| Capability | Assessment | Basis |
|---|---|---|
| Evidence Capability | Strong | Evidence lifecycle, freshness, integrity and historical limitation boundaries are documented |
| Risk Capability | Strong | Risk, accepted-risk and decision-boundary classifications are documented |
| Exception Capability | Strong | Exception scope, owner, status and non-remediation boundary are explicit |
| Operational Capability | Adequate | Calendar, ownership and maintenance loop are defined; execution remains future/non-production |
| Decision Capability | Strong | Evidence, risk, authority dependency and completion decision chain is documented |

Overall capability: Adequate for internal governance maintenance; not evidence of Production readiness or external authority.
`,
'FW-02-R-phase87-self-assessment-matrix.md':`# FW-02-R Phase 87-B — Self-Assessment Matrix

| Review Dimension | Classification | Rationale |
|---|---|---|
| Internal governance coverage | Strong | Required internal domains and lifecycle models are represented |
| Cross-domain consistency | Strong | Phase 83 found no material conflict |
| Long-term maintainability | Adequate | Phase 84 operating model exists; periodic execution is not activated |
| Handover readiness | Adequate | Phase 85 simulation passed; actual ownership transfer is out of scope |
| Historical evidence completeness | Needs Improvement | P52 historical artifact gap remains open |
| External authority readiness | External Dependency | Production, trust-root, signer, provider and operational ownership remain pending |
| Production readiness assessment | Not Assessable | Production authorization and external inputs are not granted |
`,
'FW-02-R-phase87-improvement-register.md':`# FW-02-R Phase 87-C — Final Improvement Register

| Observation | Impact | Priority | Recommended Direction | Dependency |
|---|---|---|---|---|
| Historical Phase 40 artifact remains missing | Evidence completeness limitation | High | Obtain or formally remediate through authorized process; do not reconstruct | Project Owner / authority decision |
| Periodic operating loop is documented but not executed | Maintenance assurance is future-state | Medium | Activate only after required authority and operational ownership exist | Operational owner |
| External authority ownership is pending | Production and trust boundaries remain unavailable | High | Obtain explicit authorized decisions | External authority |
| Internal models are consistent and complete for current scope | Positive governance maturity signal | Maintain | Preserve freshness and review history | Governance Maintainer |

No item authorizes Production, credentials, providers, trust roots, signers, deployment, code, dependency or ownership changes.
`,
'FW-02-R-phase87-final-report.md':`# FW-02-R Phase 87 — Final Report

STATUS: COMPLETE / PASS

Completed:
- Governance Capability Assessment created for Evidence, Risk, Exception, Operational and Decision capabilities.
- Self-Assessment Matrix created with Strong, Adequate, Needs Improvement, External Dependency and Not Assessable classifications.
- Final Improvement Register created with observation, impact, priority, direction and dependency.
- P52 Finding preserved: FW-02-R-P52-F001 = ACTIVE.
- P52 Exception preserved: FW-02-R-EXC-P52-001 = ACTIVE/ACCEPTED; Owner Role = Project Owner.
- Production preserved: LOCKED / NO-GO.

Blocked:
- No new internal blocker. Historical evidence limitation and external authority dependencies remain open by design.

Next Recommended Task:
- Await Commander acceptance and request HOLD or the next explicitly authorized non-production task.

Commander Decision Required:
- ACCEPT/CLOSE Phase 87 and explicitly declare HOLD or the next non-production task.
`
};
for(const [name,content] of Object.entries(files)) await writeFile(`${out}/${name}`,content,'utf8');
console.log(`Phase 87 meta-review generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
