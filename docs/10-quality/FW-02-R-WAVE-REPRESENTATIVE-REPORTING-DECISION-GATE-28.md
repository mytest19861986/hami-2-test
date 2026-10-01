# FW-02-R-WAVE-REPRESENTATIVE-REPORTING-DECISION-GATE-28

## Decision Status

این سند Frozen Decision Gate برای تعیین Contract قابل‌پیاده‌سازی Reporting نماینده است. بر اساس مدل واقعی Prisma، APIهای موجود و UI فعلی Repository تهیه شده است.

**نتیجه:** Contract برای Wave 29 در محدوده محدود و read-only قابل پیاده‌سازی است؛ KPIهای مبهم صریحاً غیرقابل پشتیبانی اعلام می‌شوند. هیچ API، UI، Dashboard، Commission، Wallet، Withdrawal/Payout، Schema، Migration یا Production تغییری در Wave 28 انجام نشده است.

قفل‌های اصلی:

- `ACTIVE_CUSTOMER_METRIC = NOT_ESTABLISHED`؛ heuristic مثل «خرید در ۳۰ روز اخیر» مجاز نیست.
- Commission فقط stateهای واقعی Repository را دارد؛ `PAID COMMISSION` وجود ندارد و نباید ساخته یا از Payout استنتاج شود.
- Commission، Withdrawal و Payout سه Domain جدا هستند.
- هیچ FX conversion وجود ندارد؛ mixed-currency aggregation ممنوع است.
- Timestampی که در Repository وجود ندارد، `PERIOD_METRIC_UNSUPPORTED` است.

## 1. Active Customer Semantics

Repository برای Representative یک مدل مستقل یا event معتبر برای «active customer» ندارد. `SalesAttribution.status=ACTIVE` فقط active بودن رابطه انتساب را نشان می‌دهد؛ `User.status` فقط وضعیت حساب است؛ `BenefitMembership.status` و `startsAt/endsAt` وضعیت عضویت را نشان می‌دهند. هیچ Contract فعلی آن‌ها را به یک KPI مرکب Representative تبدیل نکرده است.

### Frozen decision

`ACTIVE_CUSTOMER_METRIC = NOT_ESTABLISHED`.

Wave 29 حق ندارد active customer count بسازد یا از ترکیب زیر نتیجه‌گیری کند:

```text
attributed customer + paid purchase + valid membership
```

تا وقتی Domain مالک، رابطه و timestamp authoritative را تصویب نکند، فقط این facts جداگانه قابل گزارش‌اند:

- تعداد `SalesAttribution`های `ACTIVE` برای current attribution state؛
- وضعیت حساب مشتری، فقط در projection فعلی و بدون تبدیل به active-customer KPI؛
- وضعیت و بازه عضویت، فقط در صورت داشتن permission و contract مستقل.

## 2. Purchase Reporting Semantics

`PlanPurchase` منبع حقیقت Purchase است و فیلدهای `status`, `createdAt`, `paidAt`, `amountSnapshot`, `currencySnapshot` را دارد. Attribution با `SalesAttribution.createdAt` ثبت می‌شود و به‌صورت مستقل از زمان Purchase نگهداری می‌شود.

### Frozen decisions

| Metric | Decision | Authoritative timestamp | Period rule |
|---|---|---|---|
| Purchase count | SUPPORTED only as an explicitly scoped count of `PlanPurchase` rows after a future permission/contract decision | `PlanPurchase.createdAt` for created activity; `paidAt` for paid activity | These are different metrics and must not be named interchangeably |
| Purchase status | SUPPORTED as a state projection of actual `PurchaseStatus` | Current row state; no historical state transition event exists | Current-state only unless an event source is added |
| Purchase period activity | SUPPORTED only when metric names the event (`created` or `paid`) | `createdAt` or non-null `paidAt`, respectively | No silent fallback from `paidAt` to `createdAt` |
| Attribution validity moment | `SalesAttribution.createdAt` is the only stored attribution timestamp | `SalesAttribution.createdAt` | It does not prove purchase causality or payment ownership |

Attribution is unique per `customerUserId` in the current schema. The existing representative list shows only the latest purchase snapshot per attributed customer; it is not a complete purchase history or event timeline.

## 3. Membership Semantics

`BenefitMembership.purchaseId` is unique and links a membership to its originating `PlanPurchase`. The current eligibility contract uses persisted membership status and validity dates. This is a relationship in the data model, not a Representative reporting authorization.

### Frozen decisions

| Metric | Decision | Timestamp / semantics |
|---|---|---|
| Membership activation count | `PERIOD_METRIC_UNSUPPORTED` for Representative | No approved activation event timestamp; `createdAt` alone is not declared activation |
| Current active memberships | Not a Representative KPI in the current contract | Would require explicit scope, permission, and valid-window rule (`status`, `startsAt`, `endsAt`) |
| Expired memberships | Not a Representative KPI in the current contract | Requires explicit status/time rule and privacy decision |
| Purchase-to-membership relation | SUPPORTED as an internal domain relation | `BenefitMembership.purchaseId` is unique; do not expose IDs or infer attribution ownership |

The following distinction is mandatory:

```text
"5 active memberships now" != "5 memberships activated this month"
```

## 4. Timestamp Authority Matrix

| KPI / lifecycle | Authoritative source | Timestamp | Decision |
|---|---|---|---|
| Customer attribution | `SalesAttribution` | `createdAt` | SUPPORTED for attribution-created activity |
| Purchase created activity | `PlanPurchase` | `createdAt` | SUPPORTED if explicitly named |
| Purchase paid activity | `PlanPurchase` | `paidAt` | SUPPORTED only for non-null paid events |
| Membership activation | No declared activation event | None | `PERIOD_METRIC_UNSUPPORTED` |
| Commission created | `SalesCommission` | `createdAt` | SUPPORTED for commission-created period activity |
| Commission approval | `SalesCommission` | `approvedAt` | Available for rows approved by current implementation; no historical event stream |
| Commission reversal | `SalesCommission` | `reversedAt` | Available only where populated; do not substitute `createdAt` |
| Withdrawal request | `WithdrawalRequest` | `createdAt` | SUPPORTED for request-created activity |
| Withdrawal lifecycle | `approvedAt`, `paidAt`, `rejectedAt`, `failedAt` | Status-specific timestamp | Report only the timestamp matching the named transition |
| Payout | `PayoutOperation` | `createdAt`, `acceptedAt`, `settledAt`, `failedAt` | Payout-domain reporting only; never rename as Commission state |

If a requested metric requires a missing timestamp or an unrecorded historical transition, its result must be `PERIOD_METRIC_UNSUPPORTED`, not an estimate.

## 5. Commission Semantics — Real States Only

The actual `CommissionStatus` enum is:

```text
PENDING_APPROVAL
APPROVED
REJECTED
REVERSED
```

Representative reporting may map these to presentation labels only with their real meaning:

| Repository state | Report meaning | Financial interpretation |
|---|---|---|
| `PENDING_APPROVAL` | Pending commission candidate | Not approved and not paid |
| `APPROVED` | Approved commission projection | Not proof of wallet credit or payout |
| `REJECTED` | Rejected commission | Not payable under current state |
| `REVERSED` | Reversed commission | Reversal/clawback state; not a payout event |

`PAID COMMISSION: DO NOT INVENT.` There is no `PAID` value in `CommissionStatus`, and no direct `SalesCommission` relation to `WalletTransaction` or `PayoutOperation`.

Payout statuses are reported only as Payout domain states. `WithdrawalRequest.PAID` and `PayoutOperation.PAID` must never be projected as `SalesCommission.PAID`.

## 6. Commission → Withdrawal → Payout Relationship Matrix

| Concept | Source model | Meaning | Financial authority | Representative-reportable? | Linkage decision |
|---|---|---|---|---|---|
| Commission | `SalesCommission` | Commission candidate/approval/reversal attached to a purchase and attribution | Commission domain | Yes, own bounded status/amount projection | Direct relation to `PlanPurchase`, `SalesAttribution`; no payout link |
| Withdrawal Request | `WithdrawalRequest` | User request and withdrawal lifecycle | Withdrawal domain + wallet transaction reservation | Yes, own open lifecycle states if permitted | Directly linked to `Wallet` and `PayoutOperation`; not to Commission |
| Payout | `PayoutOperation` | External payout operation, provider evidence, idempotency and settlement state | Payout domain | Only as a separate payout-domain projection if approved | Directly linked to Withdrawal; not to Commission |
| Wallet/Ledger | `Wallet`, `WalletTransaction` | Signed ledger events and wallet currency | Wallet domain | Own readiness projection only under existing contract | No stored commission-to-wallet transfer relation |

The concepts are related at product level but not fully linked in the current schema. Therefore Wave 29 must not claim that an approved commission is withdrawable, credited, reserved, or paid unless a future authoritative transfer relation is introduced and approved.

## 7. Currency Decision

1. Commission amounts use `SalesCommission.currencySnapshot`.
2. Wallet/withdrawal amounts use wallet/transaction/withdrawal currency.
3. Payout uses `PayoutOperation.currencySnapshot`.
4. These are separate currency contexts; equality of a code does not prove financial ownership or transfer.
5. Current commission summary fails closed when more than one commission currency is present (`COMMISSION_CURRENCY_CONTEXT_REQUIRED`). This behavior is retained.
6. There is no approved FX conversion source or rate owner.

### Frozen rule

Representative financial output is **currency-separated only**:

```text
IRR: <amounts in IRR>
USD: <amounts in USD>
```

There is no combined `Total`, no implicit conversion, and no silent mixed-currency sum.

## 8. Privacy Decision

Allowed in representative reporting, subject to existing capability and self-scope:

- aggregate attribution counts;
- safe attribution reference/alias already used by `/sales-partner/customers`;
- customer account status only where the existing contract already exposes it;
- latest plan/purchase status only as the existing privacy-safe projection;
- own commission status/amount with currency context;
- own withdrawal lifecycle summary without beneficiary data.

Forbidden:

- `nationalId`;
- unnecessary phone/email;
- address and private profile fields;
- raw customer user IDs;
- beneficiary/destination snapshots;
- provider references or payout credentials;
- cross-representative rows;
- financial data outside the representative's scope.

Backend permissions remain authoritative. Current relevant capabilities are `sales_attributions.read`, `commissions.summary_read`, and separate admin capabilities such as `commissions.read`; frontend visibility is not authorization.

## 9. Frozen Decision Matrix

| Metric | Supported? | Source | Authoritative timestamp | Period semantics | Currency | Privacy | Permission | Wave 29 implementation rule |
|---|---|---|---|---|---|---|---|---|
| Active customer count | UNSUPPORTED | No approved composed source | None | None | N/A | No customer detail | N/A | Do not build |
| Active attribution count | SUPPORTED | `SalesAttribution.status=ACTIVE` | `createdAt` for created-in-period | Current relation; period count only if named | N/A | Aggregate only | `commissions.summary_read` | Keep distinct from active customer |
| New attribution count | SUPPORTED | `SalesAttribution` | `createdAt` | Attribution-created window | N/A | Aggregate only | `commissions.summary_read` | Do not call it qualified/paid |
| Purchase created count | CONDITIONAL | `PlanPurchase` | `createdAt` | Created-event period | Per purchase currency; no mixed sum | Count only unless approved fields | New read permission decision required | Implement only if explicitly scoped |
| Paid purchase count | CONDITIONAL | `PlanPurchase.status` + `paidAt` | `paidAt` | Paid-event period | Count only by default | No private detail | New read permission decision required | No fallback timestamp |
| Purchase status | SUPPORTED | `PlanPurchase.status` | Current row | Current state | Amount only with explicit currency | Safe status/plan label | Existing attribution read scope for current list | Do not call history |
| Membership activation count | UNSUPPORTED | No activation event | None | None | N/A | N/A | N/A | Return `PERIOD_METRIC_UNSUPPORTED` |
| Current active membership count | UNSUPPORTED for current rep surface | Membership model exists, rep contract absent | Validity requires explicit rule | Current-state only if later approved | N/A | Membership details restricted | New permission decision | Do not build in Wave 29 baseline |
| Commission pending/approved/reversed | SUPPORTED | `SalesCommission.status` | `createdAt` / status-specific timestamp | Current state plus named creation/status period | Currency-separated | Own aggregate | `commissions.summary_read` | Use real enum only |
| Paid commission | UNSUPPORTED | No source/state/link | None | None | N/A | N/A | N/A | Never build |
| Withdrawal state | SEPARATE DOMAIN SUPPORTED | `WithdrawalRequest` | Lifecycle-specific timestamp | Current/request/lifecycle period | Withdrawal currency | Exclude beneficiary | Existing self scope | Never label commission paid |
| Payout state | SEPARATE DOMAIN CONDITIONAL | `PayoutOperation` | `createdAt`/`settledAt`/`failedAt` | Payout event period | `currencySnapshot` | Exclude provider/reference | New permission decision | Report as payout only |

## 10. Wave 29 Implementation Boundary

Wave 29 may implement only a read-only Representative Reporting projection that:

- exposes already-approved, self-scoped attribution and real commission states;
- names every period and timestamp explicitly;
- keeps commission, wallet, withdrawal, and payout sections separate;
- separates currencies and fails closed on unsupported mixed context;
- returns only allow-listed privacy-safe fields;
- performs no financial calculation in the browser;
- performs no commission recalculation, wallet mutation, withdrawal action, or payout action;
- does not create active-customer, membership-activation, or paid-commission KPIs.

Wave 29 may not add a schema field, enum state, migration, FX conversion, ownership relation, or new financial behavior unless a separate authorized decision changes this boundary.

## Acceptance Criteria

- Active-customer decision: `FROZEN — NOT_ESTABLISHED`.
- Purchase semantics: `FROZEN — createdAt and paidAt are distinct; no silent fallback`.
- Membership semantics: `FROZEN — activation period unsupported without event source`.
- Authoritative timestamps: `FROZEN / explicitly unsupported where absent`.
- Commission states: `REAL STATES ONLY`.
- Paid Commission: `NOT PRESENT / DO NOT INVENT`.
- Commission vs Withdrawal vs Payout: `FROZEN / separate domains`.
- Currency: `SEPARATED / NO SILENT AGGREGATION / NO FX`.
- Privacy: `FROZEN / allow-list only`.
- Permission: `FROZEN / backend authoritative`.
- Implementation in Wave 28: `NONE`.
- Production: `NONE / LOCKED / NO-GO`.
