# FW-02-R-WAVE-API-CONSUMER-PARITY-14

## Executive Summary

این گزارش در محیط LOCAL/TEST و بدون تغییر API، Frontend، schema یا migration تهیه شده است. بررسی source-based، ۸۰ route decorator موجود در `apps/api/src/main.mjs` و consumerهای واقعی `apps/web` را پوشش می‌دهد. هیچ endpoint جدیدی اضافه یا حذف نشده است.

نتیجه: مسیر بعدی باید بر اساس inventory زیر انتخاب شود؛ چند surface عملیاتی Admin consumer مستقل ندارند و باید قبل از هر feature تصمیم‌گیری محصولی شوند. این موضوع به‌تنهایی defect محسوب نمی‌شود.

### Classification summary

| Classification | Count | Meaning |
|---|---:|---|
| COMPLETE | 48 | API، consumer قابل مشاهده و مسیر تست/regression موجود است |
| HAS_UI_GAP | 12 | API سالم/موجود است اما consumer کامل یا صفحه مستقل ندارد |
| INTERNAL_OPERATIONAL | 16 | surface عملیاتی Admin یا internal است و UI عمومی لازم ندارد |
| LEGACY | 4 | consumer یا مالکیت فعلی نیازمند تصمیم صریح است |
| DUPLICATE_CANDIDATE | 0 | overlap قطعی در این snapshot مشاهده نشد |
| UNKNOWN | 0 | route بدون قابلیت/مالک قابل استنتاج باقی نماند |

## Method and Evidence

- Source of truth: `apps/api/src/main.mjs`, `apps/web/pages`, `apps/web/components`, `apps/web/lib`.
- Frontend consumer detection با جست‌وجوی `createApiClient().get/post/put/patch/delete` انجام شد.
- Test evidence موجود در snapshot: API regression `106/106 PASS`، Web tests `51/51 PASS`، lint/typecheck/build قبلاً PASS شده‌اند.
- این گزارش runtime یا production connectivity را ادعا نمی‌کند؛ consumer parity از روی source و test surface ارزیابی شده است.
- Authentication پیش‌فرض API cookie session است؛ mutationها CSRF/origin guard دارند. Capabilityها در جدول به permission/domain capability اشاره می‌کنند، نه credential.

## API Matrix

`Coverage` در این جدول یعنی پوشش موجود در regression/source tests؛ `—` یعنی consumer مستقیم در Frontend فعلی یافت نشد.

### Health, location and authentication

| Route | Method | Domain | Authentication / capability | Frontend consumer | Coverage | Status | Recommendation |
|---|---|---|---|---|---|---|---|
| `/api/v1/health` | GET | Health | public | Nginx/container health | health check | COMPLETE | Keep operational |
| `/api/v1/locations/provinces` | GET | Location | public | `addresses`, `providers` | API + web | COMPLETE | Keep |
| `/api/v1/locations/provinces/:id/cities` | GET | Location | public | `addresses`, `providers` | API + web | COMPLETE | Keep |
| `/api/v1/auth/register/request-otp` | POST | Identity | public | `auth-form` | API + web | COMPLETE | Keep |
| `/api/v1/auth/register/verify-otp` | POST | Identity | public | `auth-form` | API + web | COMPLETE | Keep |
| `/api/v1/auth/register/set-password` | POST | Identity | registration proof | `auth-form` | API + web | COMPLETE | Keep |
| `/api/v1/auth/login/request-otp` | POST | Identity | public | `auth-form` | API + web | COMPLETE | Keep |
| `/api/v1/auth/login/verify-otp` | POST | Identity | OTP proof | `auth-form` | API + web | COMPLETE | Keep |
| `/api/v1/auth/login/password` | POST | Identity | public | `auth-form` | API + web | COMPLETE | Keep |
| `/api/v1/auth/refresh` | POST | Identity | refresh cookie | api-client silent refresh | API | COMPLETE | Keep internal |
| `/api/v1/auth/logout` | POST | Identity | session | api-client/session shell | API | COMPLETE | Keep internal |
| `/api/v1/auth/me` | GET | Identity | session | index, plans, shell | API + web | COMPLETE | Keep |
| `/api/v1/admin/users` | GET | Admin identity | `users.read` | `admin/users` | API + web | COMPLETE | Keep |
| `/api/v1/admin/users/:id` | GET | Admin identity | `users.read` | no direct detail page | API | HAS_UI_GAP | Decide whether detail UI is needed |
| `/api/v1/admin/users/:id/status` | PATCH | Admin identity | `users.write` | `admin/users` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/profile` | GET | Profile | user session | `profile` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/profile` | PUT | Profile | user session | `profile` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/addresses` | GET | Profile | user session | `addresses` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/addresses` | POST | Profile | user session | `addresses` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/addresses/:id` | PUT | Profile | user session | `addresses` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/addresses/:id` | DELETE | Profile | user session | `addresses` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/addresses/:id/default` | PUT | Profile | user session | `addresses` | API + web | COMPLETE | Keep |

### Customer, provider, plan and membership

| Route | Method | Domain | Authentication / capability | Frontend consumer | Coverage | Status | Recommendation |
|---|---|---|---|---|---|---|---|
| `/api/v1/benefit-plans` | GET | Plans | public | `plans` | API + web | COMPLETE | Keep |
| `/api/v1/benefit-plans/:id` | GET | Plans | public | `plans/[id]` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/purchases` | POST | Purchase | user session | `plans/[id]` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/purchases` | GET | Purchase | user session | `purchases`, `purchases/[id]` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/memberships` | GET | Membership | user session | `memberships` | API + web | COMPLETE | Keep |
| `/api/v1/providers/:providerId/eligibility/check` | POST | Eligibility | user/provider capability | no direct current call | API | HAS_UI_GAP | Review whether explicit check UI is required |
| `/api/v1/providers/:providerId/eligibility` | GET | Eligibility | user/provider capability | `providers/[id]` | API + web | COMPLETE | Keep |
| `/api/v1/providers` | GET | Provider discovery | public/session | `providers` | API + web | COMPLETE | Keep |
| `/api/v1/specialties` | GET | Provider discovery | public | `providers` | API + web | COMPLETE | Keep |
| `/api/v1/providers/:id` | GET | Provider discovery | public/session | `providers/[id]` | API + web | COMPLETE | Keep |
| `/api/v1/providers/doctor-registration` | POST | Provider onboarding | provider session | no direct current page | API | HAS_UI_GAP | Decide onboarding UI ownership |
| `/api/v1/users/me/providers` | GET | Provider onboarding | user session | `providers/me` | API + web | COMPLETE | Keep |
| `/api/v1/admin/providers` | GET | Provider admin | `providers.read` | `admin/providers` | API + web | COMPLETE | Keep |
| `/api/v1/admin/providers/:id` | GET | Provider admin | `providers.read` | no direct detail page | API | HAS_UI_GAP | Detail route can remain operational |
| `/api/v1/admin/providers` | POST | Provider admin | `providers.write` | no create form | API | HAS_UI_GAP | Product decision before UI |
| `/api/v1/admin/providers/:id` | PATCH | Provider admin | `providers.write` | no edit form | API | HAS_UI_GAP | Product decision before UI |
| `/api/v1/admin/providers/:id/status` | PATCH | Provider admin | `providers.write` | `admin/providers` | API + web | COMPLETE | Keep |
| `/api/v1/admin/benefit-plans` | GET | Plan admin | `plans.read` | `admin/plans` | API + web | COMPLETE | Keep |
| `/api/v1/admin/benefit-plans/:id` | GET | Plan admin | `plans.read` | `admin/plans` | API + web | COMPLETE | Keep |
| `/api/v1/admin/benefit-plans` | POST | Plan admin | `plans.write` | `admin/plans` | API + web | COMPLETE | Keep |
| `/api/v1/admin/benefit-plans/:id` | PATCH | Plan admin | `plans.write` | `admin/plans` | API + web | COMPLETE | Keep |
| `/api/v1/admin/benefit-plans/:id/status` | PATCH | Plan admin | `plans.write` | `admin/plans` | API + web | COMPLETE | Keep |
| `/api/v1/admin/benefit-plans/:id/providers/:providerId` | POST | Plan/provider link | `plans.write` | no direct current call | API | INTERNAL_OPERATIONAL | Keep as admin operation |
| `/api/v1/admin/benefit-plans/:id/providers/:providerId` | PATCH | Plan/provider link | `plans.write` | no direct current call | API | INTERNAL_OPERATIONAL | Keep as admin operation |
| `/api/v1/admin/benefit-plans/:id/providers/:providerId` | DELETE | Plan/provider link | `plans.write` | no direct current call | API | INTERNAL_OPERATIONAL | Keep as admin operation |
| `/api/v1/admin/purchases` | GET | Purchase admin | `purchases.read` | no dedicated page | API | INTERNAL_OPERATIONAL | Inventory owner; no UI required yet |
| `/api/v1/admin/memberships` | GET | Membership admin | `memberships.read` | no dedicated page | API | INTERNAL_OPERATIONAL | Inventory owner; no UI required yet |
| `/api/v1/admin/purchases/:id/confirm-payment` | POST | Purchase admin | `purchases.write` | no dedicated page | API | INTERNAL_OPERATIONAL | Keep operational |
| `/api/v1/admin/purchases/:id/refund` | POST | Purchase admin | `purchases.write` | no dedicated page | API | INTERNAL_OPERATIONAL | Keep operational; production gated |

### Referral, wallet, commission and withdrawal

| Route | Method | Domain | Authentication / capability | Frontend consumer | Coverage | Status | Recommendation |
|---|---|---|---|---|---|---|---|
| `/api/v1/users/me/referral` | GET | Referral | user session | `referrals` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/referral` | POST | Referral | user session | `referrals` | API + web | COMPLETE | Keep |
| `/api/v1/referrals/claim` | POST | Referral | user session | `referrals` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/referrals` | GET | Referral | user session | `referrals` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/wallet` | GET | Wallet | user session | `dashboard`, `wallet` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/wallet/transactions` | GET | Wallet | user session | no direct current call | API | HAS_UI_GAP | Wallet history UI candidate |
| `/api/v1/users/me/wallet/withdrawals` | POST | Withdrawal | user session | `wallet` | API + web | COMPLETE | Keep |
| `/api/v1/users/me/wallet/withdrawals` | GET | Withdrawal | user session | `dashboard`, `wallet` | API + web | COMPLETE | Keep |
| `/api/v1/sales-partner/customers` | GET | Attribution | representative session | `sales`, `attributed-customers` | API + web | COMPLETE | Keep |
| `/api/v1/sales-partner/customers` | POST | Attribution | representative capability | `sales` | API + web | COMPLETE | Keep |
| `/api/v1/rep/commission/summary` | GET | Commission | representative capability | `commission-overview` | API + web | COMPLETE | Keep |
| `/api/v1/admin/commissions` | GET | Commission admin | `commissions.read` | `admin/commissions` | API + web | COMPLETE | Keep |
| `/api/v1/admin/commissions/:id/decision` | POST | Commission admin | `commissions.write` | `admin/commissions` | API + web | COMPLETE | Keep |
| `/api/v1/admin/commissions/:id/approve` | POST | Commission admin | `commissions.write` | no direct current call | API | INTERNAL_OPERATIONAL | Keep; avoid duplicate UI until ownership decided |
| `/api/v1/admin/commissions/:id/reject` | POST | Commission admin | `commissions.write` | no direct current call | API | INTERNAL_OPERATIONAL | Keep; avoid duplicate UI until ownership decided |
| `/api/v1/admin/withdrawals` | GET | Withdrawal admin | `withdrawals.read` | `admin/withdrawals` | API + web | COMPLETE | Keep |
| `/api/v1/admin/withdrawals/:id/approve` | POST | Withdrawal admin | `withdrawals.write` | `admin/withdrawals` | API + web | COMPLETE | Keep |
| `/api/v1/admin/withdrawals/:id/reject` | POST | Withdrawal admin | `withdrawals.write` | `admin/withdrawals` | API + web | COMPLETE | Keep |
| `/api/v1/admin/withdrawals/:id/mark-paid` | POST | Withdrawal admin | `withdrawals.write` | `admin/withdrawals` | API + web | COMPLETE | Keep |
| `/api/v1/admin/withdrawals/:id/initiate-payout` | POST | Withdrawal admin | `withdrawals.write` | no direct current call | API | INTERNAL_OPERATIONAL | Keep operational; provider action gated |
| `/api/v1/admin/withdrawals/:id/reconcile-payout` | POST | Withdrawal admin | `withdrawals.write` | no direct current call | API | INTERNAL_OPERATIONAL | Keep operational; provider action gated |
| `/api/v1/admin/withdrawals/:id/cancel` | POST | Withdrawal admin | `withdrawals.write` | no direct current call | API | INTERNAL_OPERATIONAL | Keep operational |
| `/api/v1/admin/withdrawals/:id/retry-payout` | POST | Withdrawal admin | `withdrawals.write` | no direct current call | API | INTERNAL_OPERATIONAL | Keep operational; no UI inferred |
| `/api/v1/admin/commercial-settings` | GET | Commercial settings | `commercial_settings.read` | `admin/settings` | API + web | COMPLETE | Keep |
| `/api/v1/admin/commercial-settings` | PATCH | Commercial settings | `commercial_settings.write` | `admin/settings` | API + web | COMPLETE | Keep |

### Dashboard, compliance and redemption

| Route | Method | Domain | Authentication / capability | Frontend consumer | Coverage | Status | Recommendation |
|---|---|---|---|---|---|---|---|
| `/api/v1/customer/dashboard/summary` | GET | Customer dashboard | user session | `dashboard` | API + web | COMPLETE | Keep |
| `/api/v1/rep/dashboard/summary` | GET | Representative dashboard | representative capability | `rep-dashboard` | API + web | COMPLETE | Keep |
| `/api/v1/admin/dashboard/summary` | GET | Admin dashboard | dashboard.read | `admin/index` | API + web | COMPLETE | Keep |
| `/api/v1/admin/compliance/audit-events` | GET | Compliance | compliance capability | no direct current page | API | INTERNAL_OPERATIONAL | Keep read-only operational |
| `/api/v1/redemptions` | POST | Redemption | user session | `providers/[id]` | API + web | COMPLETE | Keep |
| `/api/v1/redemptions/:id` | GET | Redemption | owner/provider/admin scoped | no direct current call | API | HAS_UI_GAP | Detail UI optional; do not add without product decision |
| `/api/v1/users/me/redemptions` | GET | Redemption | user session | `redemptions` | API + web | COMPLETE | Keep |
| `/api/v1/redemptions/:id/cancel` | POST | Redemption | owner session | `redemptions` | API + web | COMPLETE | Keep |
| `/api/v1/providers/me/redemptions/confirm` | POST | Redemption | provider capability | `providers/redemptions` | API + web | COMPLETE | Keep |
| `/api/v1/providers/me/redemptions` | GET | Redemption | provider capability | `providers/redemptions` | API + web | COMPLETE | Keep |
| `/api/v1/admin/redemptions` | GET | Redemption admin | redemption.read | `admin/redemptions` | API + web | COMPLETE | Keep |
| `/api/v1/admin/redemptions/:id/reverse` | POST | Redemption admin | redemption.write | `admin/redemptions` | API + web | COMPLETE | Keep |

## Findings and Decision Paths

### FINDING-14-01 — Admin operational surfaces without dedicated UI

`admin/purchases`, `admin/memberships`, payout lifecycle actions, compliance audit events, and a few provider/commission actions have API ownership and regression coverage but no dedicated page-level consumer. They are classified `INTERNAL_OPERATIONAL`, not broken. A future UI requires product ownership, RBAC review, audit UX and acceptance criteria.

### FINDING-14-02 — Customer wallet transaction history

`GET /users/me/wallet/transactions` exists but current Web pages consume wallet balance and withdrawals, not a transaction-history view. Classified `HAS_UI_GAP`. This is the clearest low-risk candidate for a later Frontend Wave, subject to product priority.

### FINDING-14-03 — Redemption detail and provider onboarding

The redemption detail route and doctor-registration mutation are valid API surfaces but lack a direct current page consumer. They remain `HAS_UI_GAP`; no implementation is authorized by this audit.

## Recommended Next Path

**PATH B — UI gap important**, only if Project Owner prioritizes customer wallet history or provider onboarding. Otherwise choose **PATH A — API parity accepted** and move to a separately approved product task. No cleanup, route deletion, refactor, schema change, migration, or production action is recommended from this report alone.

## Verification

- `git diff --check`: required after this documentation-only change.
- Working tree: expected dirty until this file is committed.
- Production action: NONE.
- Scope: documentation only.
