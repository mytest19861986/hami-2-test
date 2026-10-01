import { mkdir, writeFile } from 'node:fs/promises';

const out = 'G:/project/TEST/hami/temp/review';
await mkdir(out, { recursive: true });

const docs = {
  'FW-02-R-phase71-improvement-backlog.md': `# FW-02-R Phase 71-A — Continuous Improvement Backlog

| Category | Candidate improvement | Current boundary |
|---|---|---|
| Security Enhancement | Revalidate security controls and evidence freshness | Planning only; no implementation |
| Operational Improvement | Refine runbook and incident-readiness review artifacts | Planning only; no operations change |
| Evidence Improvement | Resolve or re-source historical evidence through a valid source | P52 Finding remains ACTIVE |
| Governance Improvement | Review exception lifecycle, ownership and escalation cadence | Documentation only |
| Future Architecture Work | Reassess architecture decisions after explicit authority input | No code/dependency change |

Backlog items are candidates, not approvals or commitments.
`,
  'FW-02-R-phase71-review-roadmap.md': `# FW-02-R Phase 71-B — Review Roadmap

| Review trigger | Frequency | Required evidence | Decision boundary |
|---|---|---|---|
| Scheduled governance checkpoint | Per approved cadence | Current registers, exception review, evidence index | Continue planning or escalate |
| New Finding or material drift | On occurrence | Finding record, impact and traceability | Open wave or hold |
| Exception review / expiry | At review date or trigger | Mitigation, owner, validity and closure evidence | Renew, close or escalate |
| External authority decision | On receipt | Signed/recorded authority evidence | Update boundary only with valid authority |
| Pre-resume checkpoint | Before any broader activity | Resume criteria and decision package | Remain NO-GO until all gates pass |

The roadmap does not activate monitoring, deployment or Production activity.
`,
  'FW-02-R-phase71-resume-criteria.md': `# FW-02-R Phase 71-C — Resume Criteria Model

Continuation beyond the current non-production boundary requires documented evidence for all applicable gates:

- External approval received from the explicitly required authority.
- Missing historical evidence resolved by a valid, traceable source; no reconstruction by assumption.
- Ownership assigned for Production, trust-root, signing, provider/platform and operations where applicable.
- Required authority decisions completed and recorded.
- P52 Finding and Exception disposition reviewed without conflation.

Until the gates are met, Production remains LOCKED / NO-GO and work remains limited to explicitly approved non-production scope.
`,
  'FW-02-R-phase71-final-report.md': `# FW-02-R Phase 71 — Final Report

Result: PASS — Security Governance Continuous Improvement Roadmap.

- Improvement backlog created: PASS
- Review roadmap and cadence documented: PASS
- Resume criteria model documented: PASS
- P52 Finding preserved as ACTIVE: PASS
- P52 Exception preserved as ACTIVE/ACCEPTED: PASS
- No assumption converted to fact: PASS
- Production impact: NONE
- Production: LOCKED / NO-GO

No production, approval issuance, credential, provider, trust-root, signer, deployment, code or dependency change occurred.
`
};

for (const [name, content] of Object.entries(docs)) await writeFile(`${out}/${name}`, content, 'utf8');
console.log(`Phase 71 continuous improvement roadmap generated: outputs=${Object.keys(docs).length}; production=LOCKED/NO-GO`);
