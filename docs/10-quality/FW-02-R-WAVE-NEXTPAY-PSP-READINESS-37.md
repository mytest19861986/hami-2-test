# FW-02-R-WAVE-NEXTPAY-PSP-READINESS-37

**Status:** `BLOCKED_BY_SANDBOX_ACCESS` (provider contract reviewed; no live calls)
**Selected PSP for technical validation:** NextPay (provisional; Commander decision)
**Production PSP selection:** PROVISIONAL / NOT FROZEN
**Production:** LOCKED / NO-GO
**Implementation / schema / migration / financial mutation:** None

## Official sources reviewed

- [NextPay API & RESTful web-service documentation](https://nextpay.org/nx/docs)
- [NextPay inquiry web-services documentation](https://nextpay.org/nx/docs-inquiry)

These findings describe the published documentation, not a tested integration.
The docs page was indexed by search but timed out on direct fetch during this
review; no endpoint was called. No credential value was copied from docs or
local configuration.

## Official API contract (as documented)

| Operation | Published contract | Readiness notes |
|---|---|---|
| Create payment | `POST https://nextpay.org/nx/gateway/token`; `api_key`, `order_id`, integer `amount`, `callback_uri`; optional `currency` (`IRT`/`IRR`). Amount defaults to toman. A successful token response is documented with `trans_id`; redirect to `/nx/gateway/payment/{trans_id}`. | `trans_id`, order ID, and amount must be durably associated; never trust the browser redirect as payment proof. |
| Callback | Browser returns to merchant `callback_uri` with GET `trans_id`, `order_id`, and `amount`. | No cryptographic callback signature is documented. Treat callback parameters as untrusted hints. |
| Verify payment | `POST https://nextpay.org/nx/gateway/verify` with backend-held `api_key`, `trans_id`, `amount`, and optional currency. Docs specify verification within 10 minutes; otherwise a paid amount is returned. `code=0` means success; other codes mean unsuccessful payment. Response includes amount/order ID and may include masked payer data and Shaparak reference. | Verify server-to-server and match transaction, local purchase/order, exact amount, and currency before recording payment. Do not persist unnecessary payer/card data. |
| Refund successful payment | Same `POST .../nx/gateway/verify` endpoint with `api_key`, `trans_id`, `amount`, and required `refund_request=yes_money_back`. Docs say the request must be made within **20 minutes after payment confirmation**. `code=-90` means returned/cancelled; other codes mean not cancelled. | The docs do not describe a separate refund-status inquiry, signed webhook, refund-id field, or retry/idempotency contract. A timeout/ambiguous response must remain unresolved; do not retry blindly or claim completion. |

### Authentication and callback trust

The published API uses an `api_key` request parameter; protect it as a secret,
keep it server-side, and never put it in browser code, URLs, logs, docs, or
screenshots. The docs describe a customer-browser GET callback, not a signed
server event. Payment completion therefore depends on backend verification.
No HMAC/signature scheme or key-rotation procedure was found in the reviewed
payment documentation.

### Reference, amount, and currency mapping

- Generate an opaque, unique `order_id` mapped to one Hami purchase; persist
  `trans_id`, expected amount, currency, and purchase relation before redirect.
- Compare verified `order_id`, `trans_id`, amount, and currency against the
  stored operation; mismatches must fail closed and enter reconciliation.
- NextPay documents amounts as integer toman by default and supports optional
  `IRT` or `IRR`. Hami purchase snapshots use a currency field and examples in
  the repository use `IRR`; conversion/scale semantics must be explicitly
  normalized and exact before any sandbox test. Never infer a 10x conversion.
- The docs advise storing `trans_id`, amount, and order number to mitigate
  double-spend risk. They do not specify a refund idempotency key or safe
  replay behavior for `yes_money_back`; local deduplication alone cannot prove
  what happened at the PSP after a lost response.

## 20-minute limitation and Hami compatibility

The documented refund window is at most 20 minutes after payment confirmation.
Hami activation rejection may occur after that window, so NextPay cannot be the
sole refund mechanism for delayed rejection/reconciliation cases on current
evidence. Compatibility disposition:

**`NEXTPAY_LIMITED_GO` for technical payment evaluation only; refund is
unsuitable as the sole path for delayed cases.** A separate, Owner-approved
late-refund/reconciliation mechanism or another provider with a suitable
documented refund window would be required. This finding does not authorize any
refund call or `REFUNDED` transition.

## Sandbox and test access gate

- The reviewed official docs use a sample UUID-shaped `api_key`; it is an
  example, not a sandbox credential. No official sandbox host, sandbox mode,
  or test credential procedure was documented in the reviewed material.
- Local `.env` and process environment were checked for PSP/NextPay/payment/
  gateway/merchant variable names: none were present. Values were not emitted,
  copied, or used.
- Therefore sandbox availability and credentials are **not verified**.
  **Status: `BLOCKED_BY_SANDBOX_ACCESS`.** Do not call the published API,
  attempt token creation, initiate a payment/refund, or use production
  credentials. Obtain written confirmation and sandbox credentials through
  Project Owner/provider support before a separate explicitly scoped test.

## Retry, idempotency, and failure handling

| Condition | Safe disposition |
|---|---|
| Browser callback missing/replayed/forged | Ignore as authority; fetch/verify server-to-server using stored transaction identity |
| Verified amount, order, currency, or `trans_id` mismatch | Freeze and audit discrepancy; no financial transition |
| Nonzero payment verification code | Do not mark paid; preserve provider response code safely |
| Refund response `code=-90` | Provider docs identify successful refund; still outside this Wave's authority to mutate Hami financial state |
| Any other refund response code | Not a confirmed refund; do not mark refunded or reverse ledger state |
| Timeout or connection loss during refund | Unknown outcome; freeze for reconciliation. No blind retry because provider refund replay semantics/status query are undocumented |
| Late request beyond 20 minutes | Do not send; provider docs say the supported refund window has expired; escalate to an approved alternative process |

## Exact next gate

Before any adapter/test implementation, Project Owner/Commander must provide
or obtain confirmation of an official NextPay sandbox/test account, its
non-production API key handling procedure, and permission to run a bounded
sandbox-only transaction. Provider support must clarify whether any supported
refund path exists after 20 minutes and whether duplicate/ambiguous refund
requests can be queried or safely retried. If no late-refund facility exists,
keep NextPay limited to payment and select a separate compliant refund path.

No provider call, real customer payment, real refund, webhook/signature
invention, Purchase `REFUNDED` transition, wallet/commission/referral reversal,
or production activity was performed or authorized in Wave 37.
