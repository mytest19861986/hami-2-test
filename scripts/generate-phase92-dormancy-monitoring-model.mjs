import { mkdir, writeFile } from 'node:fs/promises';

const out = 'temp/review';
await mkdir(out, { recursive: true });

const files = {
  'FW-02-R-phase92-dormancy-health-indicators.md': `# FW-02-R Phase 92-A — Dormancy Health Indicators

| Indicator | Evidence source | Healthy state | Re-entry signal |
|---|---|---|---|
| Finding Age | Finding register and last reviewed date | Finding remains explicitly ACTIVE and review date is known | Stale review, changed impact, or new evidence |
| Exception Validity | Exception register and acceptance decision | FW-02-R-EXC-P52-001 remains ACTIVE/ACCEPTED; Owner Role = Project Owner | Owner decision changes or control assumptions change |
| Evidence Freshness | Evidence index and provenance records | No unexplained drift; new artifacts are provenance-validated | New evidence, contradiction, or missing provenance |
| External Dependency Status | Authority dependency register | Production authorization, trust-root, signing, provider/platform and operational ownership remain PENDING | Any explicit external authority input |
| Resume Trigger Status | Re-entry criteria and Commander decision log | No trigger is active; project remains DORMANCY / HOLD | A bounded Commander GO or valid authority input |

This is a documentation model only. It does not deploy monitoring or create alerts.
`,
  'FW-02-R-phase92-dormancy-review-checklist.md': `# FW-02-R Phase 92-B — Dormancy Review Checklist

| Check | Result required | Action if not satisfied |
|---|---|---|
| Current baseline valid? | Architecture and governance baseline unchanged | Freeze and request bounded review |
| Finding unchanged? | FW-02-R-P52-F001 remains ACTIVE | Re-open finding assessment |
| Exception still valid? | FW-02-R-EXC-P52-001 remains ACTIVE/ACCEPTED | Request Project Owner decision |
| New authority input received? | Explicitly recorded, never inferred | Route for authority review |
| Unexpected drift detected? | No unreviewed code, dependency, ownership or boundary drift | Block re-entry and report discrepancy |

Review outcome: DORMANT / HEALTHY, RE-ENTRY REVIEW REQUIRED, or BLOCKED.
`,
  'FW-02-R-phase92-resume-readiness-report-template.md': `# FW-02-R Phase 92-C — Resume Readiness Report Template

| Field | Required content |
|---|---|
| Trigger Event | Exact event that caused review; source and timestamp |
| Required Evidence | Evidence needed to validate the trigger and provenance |
| Required Review | Finding, exception, architecture, security and authority review as applicable |
| Decision Owner | Explicit authorized decision-maker; do not infer ownership |
| Next Action | Bounded non-production action or documented continued dormancy |

Resume is not implied by a health check. A new task requires an explicit Commander GO; production remains LOCKED / NO-GO.
`,
  'FW-02-R-phase92-final-report.md': `# FW-02-R Phase 92 — Final Report

STATUS: COMPLETE / PASS_WITH_FINDING

Completed:
- Dormancy health indicators defined for Finding Age, Exception Validity, Evidence Freshness, External Dependency Status and Resume Trigger Status.
- Dormancy review checklist created with baseline, Finding, Exception, authority and drift checks.
- Resume readiness report template created with trigger, evidence, review, owner and next-action fields.
- P52 Finding preserved: FW-02-R-P52-F001 = ACTIVE.
- P52 Exception preserved: FW-02-R-EXC-P52-001 = ACTIVE/ACCEPTED; Owner Role = Project Owner.
- Production preserved: LOCKED / NO-GO.

Verification:
- Script executed: node scripts/generate-phase92-dormancy-monitoring-model.mjs
- Scope: Documentation / Governance Monitoring Design only.
- No monitoring deployment, alerting system, credential, provider, trust-root, signer, code, dependency or ownership transfer performed.
- git diff --check: PASS.

Blocked:
- Historical Phase 40 evidence and external authority inputs remain pending.

Next Recommended Task:
- Await Commander acceptance; remain in controlled dormancy unless a new bounded non-production GO is issued.
`
};

for (const [name, content] of Object.entries(files)) {
  await writeFile(`${out}/${name}`, content, 'utf8');
}
console.log(`Phase 92 dormancy model generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
