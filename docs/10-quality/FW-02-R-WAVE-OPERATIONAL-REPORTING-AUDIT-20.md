# FW-02-R-WAVE-OPERATIONAL-REPORTING-AUDIT-20

## Executive Summary

این Wave فقط inventory و decision support است. هیچ dashboard، API، KPI جدید، schema، migration یا financial calculation تغییر نکرده است.

گزارش نشان می‌دهد که سه summary contract واقعی در حال استفاده‌اند: customer dashboard، representative dashboard و admin dashboard. علاوه بر آن، صفحات operational فهرست‌های خام domainها را مستقیماً از APIهای موجود می‌خوانند. Source of truth در همه موارد backend/Prisma است؛ Frontend فقط presentation/aggregation مجاز contract را انجام می‌دهد و authority مالی ندارد.

### Classification summary

| Classification | Count | Interpretation |
|---|---:|---|
| COMPLETE | 9 | KPI/report surface موجود، consumer فعلی و مالک محاسبه روشن است |
| EXISTS_NO_UI | 4 | API/report data موجود است ولی صفحه گزارش مستقل ندارد |
| INTERNAL_OPERATIONAL | 5 | برای کنترل داخلی/ممیزی است و UI عمومی لازم ندارد |
| MISSING | 0 | نبود قطعی source برای KPIهای مورد بررسی مشاهده نشد |
| DUPLICATE_RISK | 2 | چند presentation از یک source مشترک استفاده می‌کنند و باید از divergence پرهیز شود |
| UNKNOWN | 0 | مالک source برای مورد بررسی‌شده نامشخص باقی نماند |

## Reporting Inventory

| Surface / report | Source model/API | Current consumer | Calculation owner | Existing UI | Gap | Classification |
|---|---|---|---|---|---|---|
| Customer dashboard | `GET /customer/dashboard/summary` + wallet/withdrawals | `pages/dashboard.jsx` | API `DashboardController.customerSummary`; wallet ledger balance in API | Customer dashboard | none | COMPLETE |
| Representative dashboard | `GET /rep/dashboard/summary?period=` | `pages/rep-dashboard.jsx` | API `representativeSummary`; commission status sums in API | Representative dashboard | none | COMPLETE |
| Admin dashboard | `GET /admin/dashboard/summary?period=` | `pages/admin/index.jsx` | API `adminSummary`; grouped status counts in API | Admin dashboard | none | COMPLETE |
| User counts | `User.groupBy(status)` via admin summary | Admin dashboard | API/Prisma | Admin metric card | no independent report | COMPLETE |
| Provider counts | `Provider.groupBy(status)` via admin summary | Admin dashboard + provider review list | API/Prisma | Admin metric/operations | no historical trend | COMPLETE |
| Plan count | `BenefitPlan.count()` via admin summary | Admin dashboard + plans list | API/Prisma | Admin metric/list | no trend/export | COMPLETE |
| Purchases | `PlanPurchase` via customer/admin purchase endpoints | customer purchase pages + admin purchases | API/Prisma status/amount snapshots | Customer/Admin lists | no report/export surface | EXISTS_NO_UI |
| Memberships | `BenefitMembership` via customer/admin membership endpoints | customer memberships + admin memberships | API/Prisma lifecycle fields | Customer/Admin lists | no aggregate report | EXISTS_NO_UI |
| Eligibility | `Eligibility` contract through provider detail | `pages/providers/[id].jsx` | API eligibility evaluation | Provider detail | no operational KPI report | EXISTS_NO_UI |
| Redemption | Redemption endpoints and admin list | customer/provider/admin redemption pages | Redemption domain/service | Operational lists | no aggregate KPI report | EXISTS_NO_UI |
| Wallet balance | wallet ledger transactions via wallet/dashboard endpoints | customer dashboard + wallet + rep summary | backend ledger sum | Customer/rep cards | duplicate presentation risk | DUPLICATE_RISK |
| Wallet transactions | `GET /users/me/wallet/transactions` | wallet history | backend wallet transaction rows | Wallet history | no admin aggregate report | COMPLETE |
| Commission | `GET /rep/commission/summary` and admin commission list | rep dashboard, commission overview, admin commissions | API status-based commission sums | Rep/Admin surfaces | multiple views require shared contract | DUPLICATE_RISK |
| Withdrawal | withdrawal endpoints + admin list | wallet, dashboard, admin withdrawals, rep summary | withdrawal domain/API | Customer/rep/Admin | no cross-period operational report | COMPLETE |
| Compliance access | `GET /admin/compliance/audit-events` | no dashboard page | compliance projection over audit sink | internal API only | no UI by design | INTERNAL_OPERATIONAL |
| Recent activity | recent users/purchases/withdrawals/attributions in admin summary | Admin dashboard | API union and sort, max 10 | Admin activity card | bounded snapshot only | INTERNAL_OPERATIONAL |
| Attention queue | pending purchase/withdrawal/provider counts in admin summary | Admin dashboard links to operation pages | API status filters | Admin queue | not a historical report | INTERNAL_OPERATIONAL |
| Provider discovery | approved provider query with filters | provider directory/detail | Provider API query | Customer discovery | no discovery analytics | INTERNAL_OPERATIONAL |
| Attribution | sales partner customer collection + rep summary | sales/attributed customers/rep dashboard | attribution rows and status | Representative surfaces | no export/report | COMPLETE |

## KPI Source Matrix

| KPI | Source of truth | Formula/aggregation owner | Currency/time semantics | Current UI | Authority risk |
|---|---|---|---|---|---|
| Customer wallet balance | wallet transaction ledger | API wallet sum by currency | minor-unit integer; currency from wallet | dashboard/wallet | low; UI must not recalculate |
| Purchase count | customer summary recent purchase query | API count/limited recent set | backend timestamps | dashboard | clarify count semantics if full lifetime count is later required |
| Active plan | latest membership query | API latest membership | backend `endsAt` | dashboard | low |
| Attributed customer count | active `SalesAttribution` count | API count | optional period for new count | rep dashboard | low |
| Commission pending/available/reversed | `SalesCommission` rows by status | API sum by status | currency context required; API rejects mixed currencies | rep dashboard/commission | high if duplicated in UI |
| Withdrawal readiness | wallet ledger plus open withdrawal rows | API/domain | statuses PENDING/APPROVED/PAYOUT_PENDING/PAYOUT_UNKNOWN | rep dashboard | must not imply payout completion |
| Admin user/provider/purchase/withdrawal counts | grouped backend rows | API `groupBy(status)` | optional period applies to selected createdAt queries | admin dashboard | low |
| Attention queue | backend status filters | API | current operational snapshot | admin dashboard | not a historical KPI |
| Redemption count/status | redemption rows | domain/API | event timestamps | operation lists | no aggregate KPI currently |
| Eligibility result | benefit/provider/membership contract | eligibility service | current entitlement state | provider detail | no dashboard KPI currently |

## Data Ownership Map

| Domain | Authoritative model/service | Read-side owner | Mutation authority | Frontend rule |
|---|---|---|---|---|
| Users | `User`, auth/profile service | auth/admin endpoints | API auth/admin | display safe fields only |
| Providers | `Provider`, `ProviderController` | provider/discovery/admin endpoints | guarded provider transitions | no invented states |
| Plans | `BenefitPlan` | plan endpoints | admin plan API | use `priceAmount`/currency contract |
| Purchases | `PlanPurchase` | purchase endpoints | purchase/payment API | read-only display in current reports |
| Memberships | `BenefitMembership` | membership endpoints | payment/domain transaction | display dates/status only |
| Eligibility | eligibility service + benefit membership/provider benefits | eligibility endpoint | backend rules | no client eligibility calculation |
| Redemptions | redemption domain/service | redemption endpoints | guarded redemption transitions | token memory-only; no KPI invention |
| Wallet | `WalletTransaction` ledger | wallet/dashboard endpoints | backend transaction/withdrawal flows | no client balance calculation |
| Commission | `SalesCommission` and attribution models | commission endpoints | backend commission decision | no client amount calculation |
| Withdrawal | `WithdrawalRequest`/payout core | withdrawal endpoints | guarded payout lifecycle | no provider/payment claims |

## Existing Report/Export Surfaces

- Existing dashboards are JSON summary consumers; no CSV/PDF/export endpoint was found in the reviewed API source.
- Admin operation pages provide bounded lists, not historical reporting or export.
- Compliance audit events are an internal read surface with a projection and bounded read; no public report is appropriate.
- No missing source model was inferred merely because an export UI does not exist.

## Gaps and Risks

### REPORT-20-01 — No historical reporting/export layer

Current summaries are operational snapshots and bounded recent activity, not a time-series/reporting system. Adding trends, exports or cross-period aggregates would require an explicit product and data-retention decision.

### REPORT-20-02 — Shared financial presentation risk

Dashboard, wallet, representative and commission pages consume overlapping financial sources. The backend remains authoritative; future work should reuse contracts and shared presentation without duplicating amount/status calculations in React.

### REPORT-20-03 — Eligibility and Redemption have operational lists, not KPIs

The source and consumer exist, but no aggregate report is currently defined. This is `EXISTS_NO_UI`, not evidence that a KPI is required.

## Recommendation for Next Wave

Do not build an advanced reporting dashboard from this audit alone. If reporting is prioritized, first approve a narrow read-only contract for one use case (for example, admin purchase/membership trend or wallet/withdrawal operational snapshot), including period semantics, currency semantics, pagination/export limits and data ownership. Preserve current backend authority and avoid client-side financial aggregation.

## Verification

- Reporting inventory: completed against API source and current Web consumers.
- KPI ownership: mapped to backend models/services or explicitly marked operational/internal.
- No implementation performed.
- No API, dashboard, schema, migration or financial calculation changed.
- `git diff --check`: required after this documentation-only change.
- Production: NONE / LOCKED / NO-GO.
