# FW-02-R-WAVE-REPRESENTATIVE-REPORTING-CONTRACT-DESIGN-27

## 1. Executive Summary

این سند یک Design Gate برای گزارش‌دهی همکار فروش (Representative) است. بررسی بر اساس وضعیت فعلی Repository انجام شد و هیچ API، UI، Dashboard، منطق Commission/Wallet/Withdrawal، Schema، Migration یا Production action در این Wave انجام نشده است.

نتیجه اصلی: Repository یک read projection برای خلاصه نماینده دارد، اما همه KPIهای مورد انتظار یک Contract کامل و مستقل ندارند. بنابراین این سند مرزهای قابل اتکا را ثبت می‌کند و KPIهای فاقد Source of Truth یا semantics را صریحاً `UNDEFINED`/`GAP` نگه می‌دارد؛ هیچ مقدار یا رابطه مالی از روی نام فیلدها حدس زده نمی‌شود.

قواعد الزام‌آور:

- Attribution با Financial Ownership یکی نیست.
- Commission با Withdrawal یا Payout یکی نیست.
- Current state با Period activity یکی نیست.
- ارزهای متفاوت نباید بی‌صدا با هم جمع شوند.
- گزارش فقط read-only است و نباید هیچ mutation مالی ایجاد کند.

## 2. Current API/UI Inventory

### Existing API surfaces

| Surface | Route | Evidence | Scope |
|---|---|---|---|
| Representative dashboard summary | `GET /api/v1/rep/dashboard/summary?period=7d\|30d\|all` | `apps/api/src/main.mjs`, `DashboardController.representativeSummary` | Capability `commissions.summary_read`, self-scoped |
| Representative commission summary | `GET /api/v1/rep/commission/summary` | `apps/api/src/main.mjs`, `SalesCommissionController.representativeSummary` | Capability `commissions.summary_read`, self-scoped |
| Attributed customers | `GET /api/v1/sales-partner/customers` | `apps/api/src/main.mjs`, `myAttributions` | Capability `sales_attributions.read`, self-scoped |
| Create attribution | `POST /api/v1/sales-partner/customers` | `createAttribution` | Capability `sales_attributions.create`; mutation, not reporting |
| Admin commission list | `GET /api/v1/admin/commissions` | `commissions` | Capability `commissions.read`; cross-representative operational view |
| Own wallet | `GET /api/v1/users/me/wallet` and `/transactions` | `RewardsController.wallet/transactions` | Own wallet only |
| Own withdrawals | `GET /api/v1/users/me/wallet/withdrawals` | `RewardsController.myWithdrawals` | Own withdrawal lifecycle |

The dashboard summary accepts only `7d`, `30d`, and `all`; for bounded periods it filters attribution and commission `createdAt`. Withdrawal readiness is currently a current-state projection and is not period-filtered.

### Existing UI surfaces

- `apps/web/pages/rep-dashboard.jsx`: displays attributed count, new attributed count, available/pending commission, wallet readiness, open withdrawal count, and recent attribution/commission activity.
- `apps/web/pages/attributed-customers/index.jsx`: displays privacy-preserving alias/reference, attribution status, customer status, latest plan/purchase status, and attribution date.
- `apps/web/pages/commission-overview.jsx`: displays the read-only commission summary contract.
- `apps/web/pages/wallet.jsx`: displays the existing self-scoped wallet/withdrawal contract.

The UI does not calculate monetary totals; it formats server-provided minor units. This is preserved as a contract rule.

## 3. Representative KPI Matrix

| KPI | Source of Truth | Domain Owner | Allowed Consumer | Permission | Current-State / Event-Based | Period Semantics | Currency Semantics | Privacy Boundary | Existing API | Existing UI | Gap | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Attributed customer count | `SalesAttribution` rows owned by the representative, `status=ACTIVE` | Sales Attribution | Same representative | `commissions.summary_read` | Current state | Summary supports `7d/30d/all` by `createdAt`; count is not a historical distinct-series contract | Non-monetary | No raw customer identity in summary | `/rep/dashboard/summary` | Rep dashboard | No explicit denominator, deduplication/version contract beyond unique customer attribution | Ratify active-state count and historical event/count semantics before extension |
| New attributed customers | `SalesAttribution.createdAt` with `status=ACTIVE` | Sales Attribution | Same representative | `commissions.summary_read` | Event/time-window count with current status filter | `createdAt >= since` for `7d/30d`; `all` has no lower bound | Non-monetary | Same representative scope | `/rep/dashboard/summary` | Rep dashboard | “New” is not separately persisted; status changes can affect historical interpretation | Define whether new means attribution-created, first-qualified, or first-active |
| Active customer semantics | No authoritative active-customer definition in representative contract; customer `User.status` is exposed only in attribution list | Identity/Customer domain | Explicitly approved consumers only | `sales_attributions.read` for current list | Undefined as a reporting KPI | Undefined | Non-monetary | Do not expose private profile fields | `/sales-partner/customers` returns `customerStatus`; summary does not count active customers | Attribution list only | No contract connecting `User.status`, purchase, membership validity, or recent activity | Keep `UNDEFINED`; require domain decision and source rule |
| Purchase activity | `PlanPurchase` is authoritative for purchase lifecycle; attribution list selects only latest purchase per customer | Purchase domain | Representative, privacy-safe projection | `sales_attributions.read` | Event/state mixed in current list; latest purchase is a state snapshot | No purchase-period KPI in current rep summary | Purchase snapshots carry `currencySnapshot`; no mixed aggregation approved | Only latest status/plan label; no amount/customer identity | Latest purchase fields in `/sales-partner/customers` | Attribution list | No count, period, or event timeline contract | Define event inclusion, purchase statuses, and privacy-safe fields |
| Membership activation relation | `BenefitMembership.purchaseId` uniquely links membership to `PlanPurchase`; membership validity uses status and dates | Membership/Eligibility domain | Representative only if explicitly approved | No existing rep-specific membership permission | Current relation; activation event semantics not exposed | `createdAt`, `startsAt`, and `endsAt` have different meanings | Membership itself is non-monetary; purchase currency remains purchase-owned | Do not expose membership IDs or benefit details by default | No representative endpoint currently exposes this relation | None | No safe representative projection or definition of “activation” | Define activation as a domain event/state before reporting |
| Representative activity timeline | `SalesAttribution.createdAt/status` and `SalesCommission.createdAt/status` in current summary | Sales Attribution + Commission | Same representative | `commissions.summary_read` | Event-like rows, but current commission/attribution states can change | Filtered by `createdAt` for attribution and commission; limited to 10/5 rows | Commission rows require one currency context; attribution events are non-monetary | Activity is projected without raw IDs | `/rep/dashboard/summary` | Rep dashboard | Not a complete audit/event stream; no stable cursor or event identity | Keep as bounded snapshot; create a separate event contract only after audit/privacy review |
| Commission pending | `SalesCommission.status=PENDING_APPROVAL`, `amountSnapshot` | Commission domain | Same representative; admin operational consumers separately | `commissions.summary_read` | Current status grouped in summary | `createdAt` filter in dashboard; lifetime in commission summary | All rows must have one currency; multiple currencies fail closed | Monetary amount is representative-owned, not customer detail | Both representative summary routes | Rep dashboard/commission overview | Approval semantics and period aggregation need explicit contract | Define pending as unapproved earned candidate; no payout implication |
| Commission available | `SalesCommission.status=APPROVED`, `amountSnapshot` | Commission domain | Same representative | `commissions.summary_read` | Current status; not a payout settlement | Dashboard period filters commission creation; commission summary is lifetime | Currency-separated; cross-currency throws `COMMISSION_CURRENCY_CONTEXT_REQUIRED` | No customer details in projection | Both representative summary routes | Rep dashboard/commission overview | “Available” is a commission status projection, not wallet availability | Rename/describe as approved commission until financial transfer semantics exist |
| Commission reversed | `SalesCommission.status=REVERSED`, `amountSnapshot` | Commission domain | Same representative / authorized admin | `commissions.summary_read` or `commissions.read` | Current status, with `reversedAt` retained in schema | Current summary filters by creation date, not reversal date | Same currency rule | No customer details | Both representative summary routes | Rep dashboard shows reversed only indirectly; commission overview exposes clawback | Define reversal event timestamp and sign convention |
| Paid / payout-related commission state | No `PAID` state in `CommissionStatus`; payout states belong to `WithdrawalRequest`/`PayoutOperation` | Commission vs Payout/Withdrawal domains | None as a joined representative KPI | Separate permissions; no approved joined read contract | Undefined relationship | Undefined | Payout has `currencySnapshot`; must not be inferred from commission currency | Never expose provider/reference/beneficiary data in rep report | No existing joined endpoint | None | Do not label approved commission as paid; define explicit relation or keep separate |
| Withdrawal readiness | Wallet ledger plus open `WithdrawalRequest` states; backend computes wallet balance from transactions | Wallet/Withdrawal domain | Same representative | Existing wallet/summary capabilities | Current state | Not period activity; open requests are current lifecycle | Wallet currency and transaction currency must match; no mixed sum | Beneficiary/destination snapshots excluded | `/rep/dashboard/summary`, `/users/me/wallet/withdrawals` | Rep dashboard/wallet | “Available balance” is a backend projection but commission-to-wallet ownership is not defined | Keep separate from commission; require explicit transfer contract |

## 4. Commission Reporting Boundary

The current schema stores `SalesCommission` per unique `PlanPurchase`, with a sales partner, attribution, calculation type/value snapshot, amount/currency snapshot, status, and lifecycle timestamps. Current statuses are `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, and `REVERSED`. There is no commission `PAID` status.

The current commission summary maps:

- `PENDING_APPROVAL` → pending balance;
- `APPROVED` → available balance in the commission projection;
- `REVERSED` → clawback due and signed lifetime aggregation.

These labels are reporting projections only. They do not prove that funds entered the wallet or were paid out.

Withdrawal and payout are separate:

- `WithdrawalRequest` is a lifecycle state with `PENDING`, `APPROVED`, `PAYOUT_PENDING`, `PAYOUT_UNKNOWN`, `FAILED`, `PAID`, and other terminal states.
- `PayoutOperation` is uniquely linked to a withdrawal and owns provider reference/status, amount/currency snapshots, idempotency, and payout evidence.
- Wallet reservations/releases are `WalletTransaction` events and are not interchangeable with a withdrawal row.
- The current schema has no direct `SalesCommission` → `WalletTransaction` or `SalesCommission` → `PayoutOperation` ownership relation.

Therefore the Contract MUST NOT derive “paid commission” from `APPROVED`, wallet balance, withdrawal status, or payout status. A future joined KPI requires an explicit domain relation, event semantics, currency rule, permission decision, and reconciliation behavior.

## 5. Currency Rules

1. Every monetary result carries amount in integer minor units and an explicit currency code.
2. Commission summary currently sorts by currency and fails closed if more than one currency exists for the representative (`COMMISSION_CURRENCY_CONTEXT_REQUIRED`). This is the authoritative current behavior.
3. Wallet balance is the signed sum of transactions matching the wallet currency; the UI must not recalculate, convert, clamp, or silently combine currencies.
4. Commission currency and wallet/withdrawal currency are different domain contexts until an explicit transfer contract says otherwise.
5. Mixed currencies MUST be partitioned into separate results or rejected. No FX rate, conversion owner, or historical rate source is currently approved.
6. A period filter changes row selection, not currency meaning; a report must state whether it is lifetime, creation-period, approval-period, reversal-period, or payout-period.

## 6. Privacy / Permission Matrix

| Data | Representative | Admin | Contract decision |
|---|---|---|---|
| Own attribution count/status | Allowed with `commissions.summary_read` or `sales_attributions.read` as applicable | Allowed under approved operational permission | Self-scoped only for representative |
| Customer raw user ID | Forbidden in representative UI | Not required for aggregate | Use hashed `customerRef`/display alias where existing endpoint permits |
| Customer phone/national ID/contact | Forbidden | Outside this contract | Never add to report |
| Latest plan/purchase status | Existing privacy-safe list projection only | Separate permission/domain review | No purchase amount or private details by default |
| Own commission aggregate | Allowed with `commissions.summary_read` | Admin list with `commissions.read` | Currency and lifecycle labels required |
| Other representative commission rows | Forbidden | Admin operational scope only | No cross-representative leakage |
| Wallet balance/readiness | Existing self-scoped projection | Separate aggregate contract | Never imply commission ownership |
| Beneficiary/destination/provider references | Forbidden | Not part of this aggregate | Exclude from report |
| Authorization audit metadata | Not exposed to representative | Separate compliance capability | No audit internals in KPI response |

The backend remains the permission authority. Frontend visibility is not an authorization boundary.

## 7. Read-only API Proposal (Design Only)

No endpoint is implemented by this Wave. A future contract may expose a bounded, self-scoped read projection only after approval:

```text
GET /api/v1/rep/reporting/summary?period=7d|30d|all&currency=IRR
```

Candidate response sections:

- `attribution`: explicitly defined current count and event-window count;
- `customer_activity`: only approved privacy-safe, bounded projections;
- `membership_activity`: only if activation semantics and permission are approved;
- `commission`: pending/approved/reversed, with status timestamps and currency;
- `withdrawal`: current open lifecycle states, never presented as commission paid;
- `activity`: bounded, stable, cursor-based events if an event contract is approved;
- `provenance`: source, period semantics, and currency context.

Required contract properties:

- server-side calculation only;
- explicit currency filter or separate buckets;
- bounded date range and pagination/cursor semantics;
- no raw customer identifiers or financial beneficiary data;
- no mutation, payout initiation, withdrawal action, or commission recalculation;
- fail closed for unsupported mixed-currency or ambiguous ownership cases.

## 8. Risks

| Risk | Failure mode | Control |
|---|---|---|
| Calling approved commission “paid” | Financial misstatement | Keep Commission, Wallet, Withdrawal, and Payout separate |
| Active customer ambiguity | Incorrect KPI and stakeholder decisions | Require domain definition and authoritative source |
| Latest purchase treated as activity history | Historical distortion | Separate current snapshot from event-period contract |
| Mixed-currency aggregation | Invalid monetary result | Partition or reject; never implicit conversion |
| Attribution treated as ownership | Incorrect commission attribution | Preserve explicit attribution/ownership boundary |
| Open withdrawal treated as payout | False settlement claim | Use lifecycle status and payout evidence separately |
| Unbounded activity/identity exposure | Privacy/performance risk | Bounded projections, allow-list fields, cursor pagination |
| Status timestamp mismatch | Wrong period report | Define created/approved/reversed/paid timestamp per KPI |

## 9. Open Decisions

1. What is the authoritative definition of an “active customer”: user status, valid membership, purchase activity, or a composed rule?
2. Does “new attributed customer” mean attribution creation, first active attribution, qualification, or first purchase?
3. Which purchase statuses count as purchase activity, and is the metric event-based or current-state?
4. What exact event marks membership activation: paid purchase, membership status, `startsAt`, or eligibility validity?
5. Should commission reporting use creation, approval, reversal, or payout timestamps for periods?
6. Is there an approved financial relation from commission approval to wallet credit and then payout?
7. Which domain owns FX/conversion if future reports support more than one currency?
8. Which customer activity fields are safe for representatives, and which require a separate permission?
9. Is a stable activity event/cursor contract required, or is a bounded dashboard snapshot sufficient?

## 10. Recommended Wave 28

Recommended next Wave: `FW-02-R-WAVE-REPRESENTATIVE-REPORTING-DECISION-GATE-28` — resolve the open domain, privacy, permission, timestamp, and currency decisions above and approve one narrow read-only contract. Wave 28 should remain Design/Decision only until the ownership and payout relation is explicit. No implementation should begin from this document alone.

## Acceptance Evidence

- Repository inventory: completed from current `apps/api`, `apps/web`, `packages/database/prisma/schema.prisma`, and existing docs.
- Representative KPI ownership: defined where authoritative source exists; undefined gaps explicitly recorded.
- Commission semantics: current statuses and limits documented.
- Withdrawal/Payout relationship: kept separate; no unsupported paid relation inferred.
- Period semantics: current behavior and missing timestamp decisions documented.
- Currency semantics: currency-separated and fail-closed rules documented.
- Privacy/permission boundaries: reviewed against current capability-gated routes.
- API/UI gaps: documented; no implementation performed.
- Schema/migration/API/UI/financial behavior changes: NONE.
- Production action: NONE — LOCKED / NO-GO.
