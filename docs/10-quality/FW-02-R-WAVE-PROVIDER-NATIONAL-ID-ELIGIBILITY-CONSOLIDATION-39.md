# FW-02-R Wave 39 — Provider National-ID Eligibility Consolidation

## Scope and disposition

This wave consolidates the existing customer National-ID eligibility contract and its privacy boundary. It does not add a Provider/Doctor National-ID field, a new Admin lookup, or a schema migration: the repository has no defined business purpose, verification source, ownership rule, or lifecycle for a provider-side National ID. Adding one without those decisions would expand sensitive-data collection without a justified contract.

## Current source of truth

| Concern | Current contract |
| --- | --- |
| Customer identity | `UserProfile.nationalId` is the unique eligibility match key. Nullable `User.nationalId` is legacy-only and is not consulted. |
| Input validation | Trim and remove whitespace/hyphens; require ten ASCII digits; reject repeated digits; validate Iranian checksum. Invalid input returns the same minimal negative result as an unknown/ineligible identity. |
| Provider-operated check | `POST /api/v1/providers/:providerId/eligibility/check` requires an active account with `OWNER`, `MANAGER`, or `STAFF` membership on that exact `APPROVED` provider. Membership at another provider is insufficient. |
| Customer self-check | `GET /api/v1/providers/:providerId/eligibility` uses the authenticated customer account, not a submitted National ID. |
| Result/privacy | A positive provider lookup may return display name and applicable benefits; raw National ID is never returned. Negative cases share `{ eligible: false }`. Audit records do not retain the submitted ID, a fingerprint, or the matched customer ID. |
| Provider/Doctor identity | `Provider` and `DoctorProfile` have no National-ID field. `DoctorProfile.medicalCouncilNumber` is a distinct credential and is omitted from public provider projections. |
| Authorization model | Exact-provider membership is the effective check-route boundary. The cataloged `eligibility.check` permission is not independently enforced by this legacy endpoint; no separate Admin National-ID lookup route exists. |

## Implemented safeguards

- `/auth/me`, self-profile read/write, and Admin user detail return an allowlisted profile projection with a masked National ID only. The legacy `User.nationalId` is no longer serialized by `/auth/me`.
- The profile UI consumes `maskedNationalId`; its visible identity presentation remains masked without receiving the raw value.
- API and domain/security documentation now identify the authoritative field, exact-provider authorization, legacy-field non-authority, and the missing provider-side business contract.
- Tests cover normalization/checksum rejection and assert raw National-ID absence from auth/profile/admin responses. The Wave 07 integration test is extended to cover same-provider matching, cross-provider denial, legacy-column non-matching, non-disclosure, and audit non-retention.

## Explicit owner decision / follow-up

If “Provider National-ID eligibility” means providers themselves must be identified by a national ID, the Project Owner must define its purpose, authoritative verification source, whether it belongs to a legal person or doctor, uniqueness/transfer rules, retention/access policy, and customer-visible semantics before a schema/API change is proposed. Until then, the safe supported meaning is customer National-ID matching for a provider's benefit eligibility.

## Verification boundary

Unit tests, lint/typecheck, HTTP integration, database-backed canonical suite, and repository status must be reported from actual execution. No production action is authorized by this wave.
