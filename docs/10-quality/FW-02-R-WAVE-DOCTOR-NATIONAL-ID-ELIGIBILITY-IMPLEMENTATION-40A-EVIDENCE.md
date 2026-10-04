# FW-02-R-WAVE-DOCTOR-NATIONAL-ID-ELIGIBILITY-IMPLEMENTATION-40A — Final Evidence

## Status and boundary

- Status: Final Verification evidence complete; awaiting the Commander’s formal Wave 40 closure decision.
- Branch: `codex/wave40-doctor-national-id-review` on `hami2test`.
- The implementation and test source at `ad558962c54d4f6edc7217c96c17099438868ff3` were not changed for this visual verification. Evidence-only screenshots were added in commit `3d562822c7e2d0012728b9f4e9ad05492d4544ad`.
- `hami2test/main` was not changed or merged.
- Production, production credentials/data, provider connections, and real-money actions: NONE. Production remains LOCKED / NO-GO.

## Doctor National-ID contract evidence

The implementation is Doctor-specific and stores a keyed, versioned digest rather than returning the normalized identifier. The focused integration test exercises real local HTTP requests and a disposable test database. It verifies:

- invalid checksum/format receives controlled `400`; valid but unknown identity returns `{ eligible: false }`;
- duplicate identity is rejected with `409`;
- an approved doctor is eligible; suspended and rejected doctors are not;
- authorized Admin status/manage responses disclose only `{ configured: true }`, while an unauthorized cross-provider mutation is denied (`403`);
- raw National ID and digest are absent from registration, customer/public projections, Admin projections, and audit records;
- test-only HMAC key is provided by the isolated local test runtime, not by source, docs, or screenshots.

Existing Wave 39 eligibility integration also verifies session/provider scoping, legacy non-authority, and non-disclosure. No schema or migration was changed for Wave 40A. Prisma schema validation passed.

## Authenticated local visual evidence

Screenshots were captured from the actual authenticated LOCAL/TEST provider directory. The session came from a successful normal test-user registration/login flow; no cookie injection, token/session manipulation, or auth bypass was used. The National-ID input was empty. Visual and DOM privacy checks found no raw identifier, digest/HMAC, credential, token, or session value in the captured UI.

Commit-pinned images (all raw URLs returned HTTP 200):

- Desktop, 1440×900: [providers-desktop-1440x900.png](https://raw.githubusercontent.com/mytest19861986/hami-2-test/3d562822c7e2d0012728b9f4e9ad05492d4544ad/TEMP/wave40a/providers-desktop-1440x900.png)
- Mobile, 390×844: [providers-mobile-390x844.png](https://raw.githubusercontent.com/mytest19861986/hami-2-test/3d562822c7e2d0012728b9f4e9ad05492d4544ad/TEMP/wave40a/providers-mobile-390x844.png)
- Mobile drawer open, 390×844: [providers-mobile-drawer-390x844.jpg](https://raw.githubusercontent.com/mytest19861986/hami-2-test/3d562822c7e2d0012728b9f4e9ad05492d4544ad/TEMP/wave40a/providers-mobile-drawer-390x844.jpg)

Observed layout evidence:

- 1440×900: RTL; sidebar is on the right (`x=1177..1425`, width 248px), main content is to its left (`x=0..1177`), and the logical sidebar border is `border-inline-end`.
- 390×844: `documentElement.clientWidth === scrollWidth === 390`; drawer opens from the right, is 320px wide, and the underlying page is overlaid. The National-ID input is empty. Minimum interactive control height is 44px.
- Browser console warning/error snapshot for the authenticated page: 0 entries.
- Measured mobile input-to-submit gap: 16px.

## Independent visual review and disposition

Gemini reviewed these same three current-build screenshots and returned a complete response: `PASS WITH FINDINGS`; no P1 or P2 visual finding. It listed two P3 suggestions:

1. Alleged compressed mobile input/button gap: not reproduced; live DOM measurement is 16px and the control height is 44px.
2. Empty-state text contrast: unsupported by the supplied evidence; the referenced empty state is not present in these screenshots or the current directory DOM.

The Commander explicitly accepted both as `NON-ACTIONABLE / UNSUPPORTED BY CURRENT EVIDENCE` and authorized proceeding without UI changes. No Qwen re-review is required because no implementation bug was reproduced.

## Final gates (executed on this feature branch)

| Gate | Result |
|---|---|
| Focused Doctor/provider integration tests | 5/5 PASS, 0 fail, 0 skipped |
| Canonical API suite (serialized, Docker LOCAL/TEST) | 115/115 PASS, 0 fail, 0 skipped |
| Web tests | 60/60 PASS, 0 fail, 0 skipped |
| Lint | PASS |
| Typecheck | PASS |
| API and Web build | PASS |
| Prisma schema validation | PASS |
| Browser console warnings/errors | 0 observed |
| `git diff --check` | PASS |
| Screenshot dimensions | 1440×900; 390×844; drawer 390×844 |
| Raw-ID leakage in captured UI | NONE observed |

The first canonical-suite attempt, run immediately after the focused suite in the same API process, got `114/115` because the focused test had consumed the process-local five-request/60-second eligibility rate-limit window. No source change was made. After that window elapsed, the canonical suite was rerun serialized and passed `115/115`; this is test-process rate-limit state, not a product-code failure.

## Remaining control

Working-tree cleanliness and remote synchronization are verified after the ledger commit and reported with that commit SHA. Wave 40 remains open until the Commander reviews the final closure report. No merge to `hami2test/main` is authorized by this evidence document.
