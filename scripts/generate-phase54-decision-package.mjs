import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const review = path.join(root, 'temp', 'review');
const manifest = JSON.parse(fs.readFileSync(path.join(review, 'FW-02-R-phase53-evidence-manifest.json'), 'utf8'));
const exceptionId = 'FW-02-R-EXC-P52-001';
const findingId = 'FW-02-R-P52-F001';

const rows = manifest.rows.filter((row) => row.phase !== 'exception');
const phaseCounts = rows.reduce((acc, row) => {
  acc[row.phase] = (acc[row.phase] || 0) + 1;
  return acc;
}, {});

const riskRegister = `# FW-02-R Phase 54-A — Consolidated Risk Register

## Status

Documentation/governance package only. Production remains **LOCKED / NO-GO**.

| Risk ID | Title | Category | Evidence Reference | Current Status | Impact | Likelihood | Mitigation | Owner Role | Acceptance State |
|---|---|---|---|---|---|---|---|---|---|
| ${findingId} | Missing historical Phase 40 Docker immutable-pinning artifact | Evidence Integrity | Phase 52/53 reports; missing artifact preserved | OPEN | Historical traceability and recovery completeness gap | Medium | Retain fail-closed finding; immutable evidence indexing and retention in future waves | Project Owner | Accepted Risk via ${exceptionId} |
| ${exceptionId} | Missing historical evidence exception | Governance | temp/review/FW-02-R-EXC-P52-001.md | ACTIVE | Exception remains auditable but evidence gap remains | Medium | Review at next evidence-governance checkpoint; do not reconstruct artifact | Project Owner | ACCEPTED |
| FW-02-R-PROD-001 | Production authorization and real-money/provider boundary | Production Readiness | Phase 53 handover; Commander decision | LOCKED / NO-GO | Production access is not authorized | High | Obtain explicit external authority and production authorization before any deployment | Production Authority | NOT AUTHORIZED |
| FW-02-R-TRUST-001 | SC-R3 real trust root and signer | Production Readiness | Phase 49 policy and Phase 54 boundary | PENDING GOVERNANCE | Trust-root authority is not established | High | External authority decision; no trust root or signer creation in this phase | External Authority | PENDING |
| FW-02-R-EVID-001 | Evidence inventory completeness | Evidence Integrity | Phase 53 manifest (${rows.length} present rows; Phase 40 missing) | PARTIAL / TRACEABLE | Existing evidence is indexed; historical gap remains | Low | Preserve missing state and maintain hash-indexed handover bundle | Project Owner | ACCEPTED_WITH_FINDING |

## Phase coverage

${Object.entries(phaseCounts).map(([phase, count]) => `- ${phase}: ${count} indexed artifact(s)`).join('\n')}
- Phase 40: required historical artifact not recovered; this is not converted to PASS.
`;

const decisionPackage = `# FW-02-R Phase 54-B — Final Decision Package

## Executive decision

Phase 54 is a documentation/governance package. It does not authorize production, providers, credentials, trust roots, signers, CI enforcement, dependency or application changes.

## Completed capabilities

- Phases 39–51 technical/security/supply-chain evidence is indexed and handover-reconstructable.
- Phase 52 is ACCEPTED_WITH_FINDING.
- Phase 53 handover validation is CLOSED WITH FINDING.
- Hashes, timestamps, duplicate/orphan checks, and status consistency are documented.

## Open findings and accepted exceptions

- Finding **${findingId}** remains OPEN.
- Exception **${exceptionId}** remains ACTIVE/ACCEPTED with Owner Role **Project Owner**.
- Missing Phase 40 artifact remains missing; no retroactive PASS or reconstruction occurred.

## Production blockers and required external decisions

- Production authorization: NOT ISSUED.
- Real provider/payment/SMS connection: NOT AUTHORIZED.
- SC-R3 trust root and signer: PENDING external governance.
- Any production deployment, credential use, or real-money movement: FORBIDDEN.

## Recommended next steps

1. Keep the evidence gap and exception in the register.
2. Obtain external authority decisions for trust root, signer, provider criteria, and production authorization.
3. Re-run a non-production governance review after those decisions; do not infer approval from this package.
`;

const boundary = `# FW-02-R Phase 54-C — Production Readiness Boundary

## READY (internal evidence)

- Phase 39–53 documentation and handover artifacts are indexed.
- Phase 53 manifest and consistency validation are complete.
- Finding and Exception are traceable.
- Production state is explicitly LOCKED / NO-GO.

## NOT READY (external authority required)

- Phase 40 historical artifact: missing; exception accepted.
- SC-R3 real trust root: pending governance.
- Signer/credential/provider selection: not authorized.
- Production deployment and real-money movement: not authorized.

## Boundary rule

This document records readiness boundaries only. It creates no credentials, trust root, signer, provider connection, CI gate, Docker change, dependency change, lockfile change, or application-code change.
`;

const handover = `# FW-02-R Phase 54-D — Executive Handover Summary

## One-page state

| Area | State |
|---|---|
| Technical/security/supply-chain work | Phases 39–51 complete per indexed evidence |
| Evidence governance | Phase 53 closed with finding |
| Open finding | ${findingId} |
| Active exception | ${exceptionId} |
| Owner Role | Project Owner |
| Historical Phase 40 evidence | NOT RECOVERED |
| Production | LOCKED / NO-GO |

## Message for reviewers

The bundle is auditable and reconstructable from the indexed artifacts, but reconstructability does not erase the missing historical artifact. The open finding and accepted exception remain explicit. No production authorization is implied.
`;

const finalReport = `# FW-02-R Phase 54 — Final Report

## STATUS

PASS — Documentation / Governance only.

## Risk Register Result

- Consolidated register created with active finding, exception, production boundary, trust-root boundary, and evidence-completeness risk.
- Phase 40 evidence gap remains OPEN and missing.

## Decision Package Result

- Completed, pending, accepted-risk, and production-blocking items are separated.
- Required external decisions are explicit.

## Production Boundary

- Production: LOCKED / NO-GO.
- No credentials, provider, signer, trust root, CI, Docker, dependency, lockfile, or application changes were made.

## Executive Summary

- Phase 53 remains CLOSED WITH FINDING.
- ${findingId} remains ACTIVE/OPEN.
- ${exceptionId} remains ACTIVE/ACCEPTED; Owner Role: Project Owner.
- No missing evidence was converted into fact or PASS.

## Files Created

- temp/review/FW-02-R-phase54-final-risk-register.md
- temp/review/FW-02-R-phase54-decision-package.md
- temp/review/FW-02-R-phase54-production-boundary.md
- temp/review/FW-02-R-phase54-executive-handover.md
- temp/review/FW-02-R-phase54-final-report.md
- scripts/generate-phase54-decision-package.mjs

## GIT DIFF CHECK

Run completed by the caller after generation.

## NEXT ACTION

Request external authority decisions before any production-readiness change; otherwise continue only with separately authorized non-production governance work.
`;

const outputs = {
  'FW-02-R-phase54-final-risk-register.md': riskRegister,
  'FW-02-R-phase54-decision-package.md': decisionPackage,
  'FW-02-R-phase54-production-boundary.md': boundary,
  'FW-02-R-phase54-executive-handover.md': handover,
  'FW-02-R-phase54-final-report.md': finalReport,
};
for (const [name, content] of Object.entries(outputs)) fs.writeFileSync(path.join(review, name), content, 'utf8');
console.log(`Phase 54 decision package generated: risks=5; indexedArtifacts=${rows.length}; production=LOCKED/NO-GO`);
