# FW-02-R-WAVE-PROVIDER-ONBOARDING-DESIGN-18

## Status and Boundary

این سند Design Gate برای Provider self-service onboarding است. بر اساس contract فعلی workspace تهیه شده و هیچ implementation، API، field، state، permission، schema، migration یا production action انجام نمی‌دهد.

## Current State (Verified)

### Existing API

`POST /api/v1/providers/doctor-registration` در `ProviderController.registerDoctor` موجود است. endpoint به نشست کاربر نیاز دارد و در یک transaction، Provider را با `type=DOCTOR` و `status=PENDING_REVIEW` می‌سازد، membership مالک با نقش `OWNER` ایجاد می‌کند و DoctorProfile می‌سازد.

### Required request fields

| Field | Required by current contract | Current validation / use | Sensitive? |
|---|---|---|---|
| `displayName` | yes | non-empty | no |
| `provinceId` | yes | required; city relationship checked | no |
| `cityId` | yes | required; must belong to province | no |
| `medicalCouncilNumber` | yes | normalized; 4–32 chars `[0-9A-Za-z-]` | operational identity; protect in UI |
| `specialtyId` | yes | required | no |
| `address` | no | defaults to empty string | location data |
| `phone` | no | defaults to empty string | contact data |
| `imageUrl` | no | defaults to null | external URL; no upload contract |

No documents, attachments, certificates, descriptions or extra profile fields are part of this contract.

### Existing owner workspace

`GET /api/v1/users/me/providers` returns providers linked to the current user's membership. The current UI `pages/providers/me.jsx` is read-only and shows status, location, specialty and activation interpretation.

### Existing owner update contract

`PATCH /api/v1/providers/:id` already exists for an owner/manager membership. It permits edits only while the provider is `DRAFT` or `PENDING_REVIEW`; fields are display name, address, phone, image URL, and optionally province/city with relationship validation. The current UI does not consume this mutation.

## State Mapping

| UX state | Existing API state | Meaning | Allowed UI action in a future implementation |
|---|---|---|---|
| Start | no provider | no linked application | Begin form |
| Draft (conceptual) | `DRAFT` | editable incomplete/admin-created record | Edit; submit only if API transition is available |
| Complete profile | `DRAFT` or `PENDING_REVIEW` | fields pass current contract validation | Review fields; edit while contract permits |
| Submit review | current POST creates `PENDING_REVIEW` directly | registration submitted | Submit once; show pending result |
| Pending review | `PENDING_REVIEW` | awaiting Admin decision | Read-only status plus permitted owner edits |
| Approved | `APPROVED` | accepted provider | Read-only onboarding fields; use provider workspace |
| Rejected | `REJECTED` | Admin rejected | Current API allows Admin transition to `DRAFT`; reason field is not in contract |
| Suspended | `SUSPENDED` | Admin operational suspension | Read-only status; no owner reactivation |

Important contract constraint: the API has no distinct `save draft` endpoint and the public registration mutation creates `PENDING_REVIEW`. A true multi-step draft flow cannot be claimed without either using an existing `DRAFT` record created elsewhere or changing the API, which is outside this Wave.

## Proposed UX Flow (Design Only)

### Recommended default: one-page guided form

Because the current registration endpoint is atomic and has no draft-save contract, the safest first implementation is a single-page guided form:

`Start → Complete required fields → Review → Submit review → Pending review`

The form may be visually grouped into identity, location and contact sections, but it must submit once through the existing endpoint. It must not imply that an intermediate draft has been persisted.

### Future multi-step option (not authorized now)

A multi-step flow is possible only after a contract decision for draft persistence, resume behavior, abandonment, and submit transition. This document does not authorize that API change.

### Post-submit behavior

- On success, navigate to the existing owner workspace or show the newly returned `PENDING_REVIEW` record.
- Do not show approval as complete before the API returns `APPROVED`.
- On validation/API error, preserve user-entered non-sensitive fields in memory and show a safe error.
- Do not expose stack traces, tokens or raw database errors.

## Field and Editability Rules

| Field group | During initial form | After `PENDING_REVIEW` | After `APPROVED` / `SUSPENDED` |
|---|---|---|---|
| Display name | editable, required | API currently permits owner update | readonly in onboarding surface |
| Province/city | editable, required and linked | API currently permits update | readonly in onboarding surface |
| Specialty | required for registration | no update field in existing owner PATCH | readonly |
| Medical council number | required for registration | no update field in existing owner PATCH | readonly |
| Address/phone/image URL | optional | API permits update | readonly in onboarding surface |
| Documents/rejection reason | not available | not available | not available |

The UI must not invent a rejection reason or document status. If product requires either, it needs a separate contract decision.

## Permission Impact

- Initial registration: authenticated user session; no new permission.
- Owner workspace: current-user membership scoping.
- Admin review: existing `providers.read`, `providers.update`, `providers.approve`, `providers.suspend` boundaries.
- No permission addition or boundary change is recommended.

## API Reuse Plan for a Future Implementation

1. Load provinces/cities and specialties from existing public endpoints.
2. Submit the exact required/optional field set to `POST /providers/doctor-registration`.
3. Read the owner result through `GET /users/me/providers`.
4. If editing is approved in a later wave, use existing `PATCH /providers/:id` only for its current allowed fields and only in `DRAFT`/`PENDING_REVIEW`.
5. Reuse shared `labelStatus` for lifecycle presentation.

No client-side financial, permission or lifecycle calculation is needed.

## Risks and Open Decisions

| Risk / decision | Impact | Recommendation |
|---|---|---|
| Atomic POST has no persisted draft | Users cannot resume a partially submitted form | Use one-page form first, or approve API draft contract separately |
| Rejected state has no reason field | UX cannot explain rejection from backend data | Do not fabricate reason; product must define contract |
| Medical council number is sensitive operational identity | accidental exposure in lists/logs | Mask or omit outside authorized owner/Admin contexts |
| Owner PATCH excludes specialty/council number | editing those fields needs a new contract | Keep them immutable after submission in initial UX |
| No document upload contract | cannot support certificate workflow truthfully | Defer document UX |
| Approval changes discovery visibility | user expectation may differ from API | Explain pending/approved semantics in copy |

## Implementation Recommendation

After Project Owner approval, implement a low-risk one-page onboarding consumer using only the existing POST/read/update contracts, with explicit `PENDING_REVIEW` result handling. Do not implement persisted drafts, rejection reasons, documents, new states or new permissions in that follow-up unless separately approved.

## Verification

- Current contract: verified against `apps/api/src/main.mjs`.
- Existing UI: verified against `apps/web/pages/providers/index.jsx`, `[id].jsx`, `me.jsx` and Admin providers page.
- No implementation performed.
- No schema or migration impact.
- `git diff --check`: required after this documentation-only change.
- Production: NONE / LOCKED / NO-GO.
