# FW-02-R-WAVE-PROVIDER-OPERATIONS-AUDIT-17

## Executive Summary

این Wave فقط audit و decision support است؛ هیچ API، UI، schema، migration، lifecycle یا permissionی تغییر نکرده است. بررسی source-based روی ProviderController، صفحات Provider/Admin، shared presentation و route decorators انجام شد.

نتیجه: Provider domain از نظر API و Admin review surface موجود است. شکاف اصلی، self-service onboarding است: API ثبت‌نام پزشک وجود دارد اما صفحه Frontend برای ارسال پرونده در snapshot فعلی وجود ندارد. این یک `UI_GAP` است، نه `API_GAP`. Provider Review Admin نیز `COMPLETE` است، اما جزئیات کامل پرونده در صفحه لیست نمایش داده نمی‌شود و route detail فعلاً operational surface محسوب می‌شود.

## Lifecycle واقعی

| Current state | Allowed transition(s) | Actor / capability | Existing UI |
|---|---|---|---|
| `DRAFT` | `PENDING_REVIEW`, `REJECTED` | Admin `providers.update`; owner edit path | Admin status controls; owner status read-only |
| `PENDING_REVIEW` | `APPROVED`, `REJECTED` | Admin `providers.approve` / `providers.update` | Admin providers review page |
| `APPROVED` | `SUSPENDED` | Admin `providers.suspend` | Admin providers review page |
| `REJECTED` | `DRAFT` | Admin `providers.update` | Admin providers review page |
| `SUSPENDED` | `DRAFT` | Admin `providers.update` | Admin providers review page |

Transition map is enforced in `apps/api/src/main.mjs`; the Web page does not invent transitions and only renders controls for transitions already accepted by the API.

## Provider Operations Matrix

| Domain | API / Method | Current UI | Permission / scope | Gap | Classification | Recommendation |
|---|---|---|---|---|---|---|
| Public discovery | `GET /api/v1/providers` | `pages/providers/index.jsx` | public; only `APPROVED` rows | none | COMPLETE | Keep |
| Discovery metadata | `GET /api/v1/specialties` | providers filter UI | public | none | COMPLETE | Keep |
| Geography metadata | `GET /api/v1/locations/provinces` and cities | providers filter UI | public | none | COMPLETE | Keep |
| Public detail | `GET /api/v1/providers/:id` | `pages/providers/[id].jsx` | public; approved-only projection | none | COMPLETE | Keep safe projection |
| Provider onboarding | `POST /api/v1/providers/doctor-registration` | no submit form found | authenticated user; creates `PENDING_REVIEW` | missing self-service form | UI_GAP | Separate onboarding Wave |
| Owner workspace | `GET /api/v1/users/me/providers` | `pages/providers/me.jsx` | current user memberships | read-only status surface | COMPLETE | Keep; add edit only in approved onboarding scope |
| Provider edit | `PATCH /api/v1/providers/:id` | no current edit form | owner/manager; only DRAFT/PENDING_REVIEW | no edit UI | UI_GAP | Decide with onboarding flow |
| Admin review list | `GET /api/v1/admin/providers` | `pages/admin/providers.jsx` | `providers.read` | none for list | COMPLETE | Keep |
| Admin review detail | `GET /api/v1/admin/providers/:id` | no detail page | `providers.read` | detail UI absent | DEFERRED | Add only if review needs full record |
| Admin create | `POST /api/v1/admin/providers` | no create form | `providers.create` | no UI | INTERNAL_ONLY | Operational API; no current product requirement |
| Admin update | `PATCH /api/v1/admin/providers/:id` | no edit form | `providers.update` | no UI | INTERNAL_ONLY | Operational API; preserve contract |
| Admin lifecycle | `PATCH /api/v1/admin/providers/:id/status` | `pages/admin/providers.jsx` | status-specific capabilities | none | COMPLETE | Keep guarded controls |
| Provider eligibility | `GET /api/v1/providers/:providerId/eligibility` | `providers/[id].jsx` | approved provider + current user | none | COMPLETE | Keep |
| Eligibility check | `POST /api/v1/providers/:providerId/eligibility/check` | no direct UI call | provider/customer eligibility rules | no separate consumer found | INTERNAL_ONLY | Do not add without product contract |
| Provider redemption | `GET/POST /api/v1/providers/me/redemptions*` | `pages/providers/redemptions.jsx` | provider capability | none | COMPLETE | Keep |

## Authentication and Permission Findings

- Public discovery returns only approved providers and a constrained projection.
- Owner workspace is membership-scoped to the authenticated user.
- Admin list/detail use `providers.read`.
- Status transitions select `providers.approve`, `providers.suspend`, or `providers.update` based on target state.
- Onboarding uses authenticated user proof and creates provider membership with `OWNER`; it does not bypass review.
- No new capability or permission is required by this audit.

## Provider Onboarding Assessment

| Capability | Current state | Classification | Decision |
|---|---|---|---|
| Draft creation from self-service | API supports submission directly to `PENDING_REVIEW`; no UI form | UI_GAP | Future implementation candidate |
| Draft editing | API supports owner/manager edits only for DRAFT/PENDING_REVIEW; no UI | UI_GAP | Bundle with onboarding, do not implement separately |
| Review submission | API submission itself creates review state; no explicit submit UI | PROCESS_GAP / UI_GAP | Product must define draft vs submit UX |
| Admin approval/rejection | API and Admin page exist | COMPLETE | Keep |
| Post-approval suspension | API and Admin page exist | COMPLETE | Keep |
| Public discovery | API and filters/detail exist | COMPLETE | Keep |
| Provider documents | No contract or UI found in snapshot | DEFERRED | Do not invent requirements |

## Findings

### FINDING-17-01 — Self-service onboarding UI gap

The backend contract supports `POST /providers/doctor-registration`, but no Frontend page currently collects the required display name, province, city, medical council number and specialty. This is a real UI gap; it is not an API gap. Implementing it requires product decisions for draft persistence, submission timing, validation copy and review-state UX.

### FINDING-17-02 — Provider admin detail UI deferred

`GET /admin/providers/:id` exists, while the current Admin page consumes the list and status mutation only. The list already displays the review fields needed for the current low-risk flow. A detail UI is therefore deferred, not missing from the core review path.

### FINDING-17-03 — Lifecycle is defined and guarded

The lifecycle and transition matrix are explicit in API code and reflected in Admin controls. No lifecycle inconsistency was found in this snapshot.

## Decision Support

**Recommended next path:** a separately approved Provider Onboarding UI Wave, beginning with a product contract for draft/submit behavior. Do not add provider documents, new states, new permissions or API routes as part of this audit.

## Verification

- Inventory: complete for Provider API, current UI and lifecycle source.
- Existing contracts: verified from `apps/api/src/main.mjs` and current pages.
- Runtime change: none.
- API/UI/schema/migration/permission changes: none.
- `git diff --check`: required after adding this file.
- Production: NONE / LOCKED / NO-GO.
