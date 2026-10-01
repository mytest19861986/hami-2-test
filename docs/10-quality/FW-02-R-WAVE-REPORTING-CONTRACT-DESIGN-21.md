# FW-02-R-WAVE-REPORTING-CONTRACT-DESIGN-21

## Status and Boundary

این سند Design Gate برای Reporting است. هدف، تبدیل inventory Wave 20 به قرارداد تصمیم‌گیری قابل‌اجراست؛ نه ساخت dashboard یا API. در این Wave هیچ کد runtime، endpoint، schema، migration، KPI محاسباتی یا permissionی تغییر نمی‌کند.

## Reporting Use Cases

### UC-01 — Admin operational overview

مصرف‌کننده: Admin با capability موجود `users.read` و capabilityهای عملیاتی domainها.

هدف: مشاهده وضعیت فعلی کاربران، providers، purchases، withdrawals و صف اقدام؛ read-only و bounded.

خارج از scope: روند تاریخی، export، تصمیم مالی خودکار، داده خام مشتری یا اطلاعات حساس provider.

### UC-02 — Representative performance review

مصرف‌کننده: Representative مجاز با `commissions.summary_read`.

هدف: مشاهده attributed customer count، تغییرات بازه‌ای، commission status summary و withdrawal readiness خود شخص.

خارج از scope: مشاهده داده نمایندگان دیگر، تغییر commission، تضمین پرداخت provider یا محاسبه دوباره مبلغ در Frontend.

### UC-03 — Customer activity summary

مصرف‌کننده: Customer نشست فعلی.

هدف: نمایش plan فعال، purchase summary، wallet balance و activity مجاز خود کاربر.

خارج از scope: داده کاربر دیگر، audit داخلی، اطلاعات provider خصوصی یا ادعای پرداخت خارجی.

## KPI Contract Matrix

| KPI | Source | Owner | Allowed consumers | Calculation rule | Refresh semantics | Period meaning | Currency handling | Privacy boundary |
|---|---|---|---|---|---|---|---|---|
| `active_plan` | `BenefitMembership` + plan relation | Backend customer summary | current customer | latest membership by backend ordering; no client inference | request-time snapshot | not period-filtered | no amount | current user only |
| `purchase_count` | `PlanPurchase` | Backend customer summary | current customer | contract-defined returned purchase set; do not infer lifetime count unless explicitly named | request-time snapshot | current contract uses recent set | amounts carry snapshot currency | current user only |
| `wallet_balance` | `WalletTransaction` ledger | Wallet/domain backend | customer, authorized representative self view | signed ledger sum for selected wallet currency | request-time snapshot | all ledger entries unless contract says otherwise | one explicit `currency_code`; mixed currencies rejected/segregated | owner wallet only |
| `attributed_customer_count` | active `SalesAttribution` | Representative summary backend | owning representative | count rows with status `ACTIVE` | request-time snapshot | current contract uses current total | not monetary | representative-owned customers only |
| `new_attributed_customer_count` | `SalesAttribution.createdAt` | Representative summary backend | owning representative | active rows with `createdAt >= since` | request-time snapshot | `7d`/`30d` means rolling days from request time; `all` means no lower bound | not monetary | representative-owned customers only |
| `commission_pending` | `SalesCommission` | Commission domain/backend | owning representative; authorized Admin surfaces | sum `PENDING_APPROVAL` rows in one currency context | request-time snapshot | selected period for representative summary | mixed currency must fail closed | no other representative data |
| `commission_available` | `SalesCommission` | Commission domain/backend | owning representative; authorized Admin surfaces | sum `APPROVED` rows in one currency context | request-time snapshot | selected period as defined by endpoint | explicit currency context | no payment guarantee |
| `commission_reversed` | `SalesCommission` | Commission domain/backend | owning representative; authorized Admin surfaces | sum `REVERSED` rows in one currency context | request-time snapshot | selected period as defined by endpoint | explicit currency context | no raw ledger exposure |
| `withdrawal_readiness` | wallet ledger + `WithdrawalRequest` | Withdrawal/wallet backend | owning representative/customer; Admin operational scope | expose available balance and open requests; no client recompute | request-time snapshot | open request statuses only | each amount carries its currency | owner-scoped; Admin least privilege |
| `admin_users_by_status` | `User.groupBy(status)` | Admin dashboard backend | authorized Admin | grouped count; no user-level payload | request-time snapshot | period only where endpoint explicitly applies | not monetary | aggregate only |
| `admin_providers_by_status` | `Provider.groupBy(status)` | Admin dashboard backend | authorized Admin | grouped count | request-time snapshot | current admin contract semantics | not monetary | aggregate only |
| `admin_purchases_by_status` | `PlanPurchase.groupBy(status)` | Admin dashboard backend | authorized Admin | grouped count, optional createdAt period | request-time snapshot | `7d`/`30d` rolling createdAt; `all` unbounded | not monetary | aggregate only |
| `admin_withdrawals_by_status` | `WithdrawalRequest.groupBy(status)` | Admin dashboard backend | authorized Admin | grouped count | request-time snapshot | current contract semantics | not monetary | aggregate only |
| `attention_queue` | status-filtered domain rows | Admin dashboard backend | authorized Admin | only pending purchase/withdrawal/provider keys; zero-count entries omitted | request-time snapshot | current operational state, not historical period | not monetary | aggregate links only |

## Read-only API Proposal (Design Only)

No endpoint is implemented by this document. The following is a candidate contract shape for a future approval.

### Proposal A — `GET /api/v1/reports/admin/overview`

Permission: existing Admin reporting capability must be explicitly selected; do not silently reuse a broader capability in implementation.

Query: `period=7d|30d|all`, optional bounded pagination only for an activity collection.

Response concept:

```text
{
  surface: "admin",
  period: "7d",
  generatedAt: ISO-8601,
  metrics: { usersByStatus, providersByStatus, purchasesByStatus, withdrawalsByStatus },
  attentionQueue: [{ key, count, href }],
  recentActivity: [{ type, id, status, createdAt }]
}
```

Privacy: aggregate metrics by default; no phone, national ID, address, token, beneficiary or raw audit payload.

### Proposal B — `GET /api/v1/reports/representative/overview`

Permission: existing `commissions.summary_read` or a separately approved narrower reporting capability.

Query: `period=7d|30d|all`.

Response concept: attributed counts, commission status amounts with explicit currency, withdrawal readiness and bounded activity.

Boundary: current representative identity only; no cross-representative comparison until separately authorized.

### Proposal C — `GET /api/v1/reports/customer/activity`

Permission: current authenticated customer session.

Response concept: active plan, bounded purchase summary, wallet balance and paginated self-scoped activity.

Boundary: no raw internal audit events, no provider private fields and no financial recalculation in the client.

## Period Semantics

- `7d` and `30d` mean rolling windows from request time using backend time, not browser time.
- `all` means no lower bound only where the source query explicitly supports it.
- Every KPI contract must state whether period applies to record creation, status transition, settlement or current state. A current-state count must not be presented as a historical event count.
- Server-generated `generatedAt` is required for future reports so consumers can label snapshot freshness.

## Currency Semantics

- Monetary values remain integer minor units plus explicit currency code.
- A report must never sum different currencies into one number.
- Existing representative summary already fails closed on mixed commission currencies; future contracts must preserve that behavior.
- Frontend formatting is presentation only; conversion rates and cross-currency aggregation are out of scope.
- Wallet balance is scoped to a wallet currency; withdrawals carry their own currency.

## Privacy and Security Review

- Use least-privilege capability checks at the API boundary.
- Default to aggregates and bounded lists; expose identifiers only when required for navigation.
- Never include passwords, session/refresh tokens, national IDs, beneficiary snapshots, raw provider credentials or private audit payloads.
- Keep customer and representative data self-scoped; prevent IDOR through backend ownership checks.
- Reporting reads must remain read-only and must not emit financial mutations or trigger payout/payment actions.
- Logs must not contain raw report payloads or sensitive fields.

## Ownership and Contract Rules

1. Backend/domain owns source selection, authorization, period filtering and financial aggregation.
2. Frontend owns labels, formatting, loading/error/empty states and navigation only.
3. A KPI cannot be added without an owner, source, formula, period semantics and privacy boundary.
4. Existing dashboard contracts remain stable until a versioned replacement is approved.
5. Historical trends and exports require explicit retention, pagination and performance decisions.

## Risks and Open Decisions

| Risk / decision | Consequence | Gate before implementation |
|---|---|---|
| Reusing `users.read` as generic reporting permission | over-broad access | choose explicit existing capability or approve a new one |
| Ambiguous purchase count semantics | misleading KPI | name it recent count or define lifetime count |
| Mixed currency | invalid financial interpretation | reject/partition currencies; never sum implicitly |
| Current state vs event period | false historical trend | define timestamp and snapshot semantics per KPI |
| Duplicate dashboard aggregations | drift from backend authority | keep all KPI calculation server-side |
| Unbounded activity/export | performance and privacy risk | bound, paginate and rate-limit future endpoints |
| Admin raw payload exposure | privacy breach | aggregate/default projection and explicit field allow-list |

## Recommendation for the Next Wave

Before implementation, Project Owner should select exactly one use case (recommended: Admin operational overview), approve its read-only capability boundary and ratify the KPI matrix. Then a separate implementation wave may build one versioned consumer without changing financial domain behavior.

## Verification

- Use cases: defined.
- KPI ownership: mapped.
- Read-only boundary: defined as proposal only.
- Privacy and mixed-currency risks: reviewed.
- Implementation: NONE.
- API/schema/migration/dashboard: UNCHANGED.
- `git diff --check`: required after this documentation-only change.
- Production: NONE / LOCKED / NO-GO.
