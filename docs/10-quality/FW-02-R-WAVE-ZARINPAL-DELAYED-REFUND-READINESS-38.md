# FW-02-R-WAVE-ZARINPAL-DELAYED-REFUND-READINESS-38

**Status:** `ZARINPAL_NO_GO_FOR_DELAYED_REFUND` (capability not proven by the reviewed official contract)
**Mode:** LOCAL / TEST ONLY
**Production:** LOCKED / NO-GO
**Runtime integration / schema / migration / financial mutation:** None

## Official sources reviewed

- [ZarinPal Node.js SDK configuration](https://www.zarinpal.com/docs/sdk/nodejs/configuration)
- [ZarinPal Node.js transaction inquiry](https://www.zarinpal.com/docs/sdk/nodejs/method/inquiry)
- [ZarinPal Node.js reverse transaction](https://www.zarinpal.com/docs/sdk/nodejs/method/reverse)
- [Official ZarinPal Node SDK repository](https://github.com/ZarinPal/ZarinPal-node-SDK)
- [Official SDK refund implementation](https://github.com/ZarinPal/ZarinPal-node-SDK/blob/main/src/resources/Refunds.ts)
- [Official SDK configuration and API clients](https://github.com/ZarinPal/ZarinPal-node-SDK/blob/main/src/Zarinpal.ts)

The SDK source is first-party implementation evidence, but it is not a complete
provider service-level or financial settlement contract. No API was called and
no credential was used.

## Readiness findings

| Area | Official-source evidence | Hami readiness |
|---|---|---|
| Payment sandbox | Official Node SDK configuration documents `sandbox: true`; its REST base URL switches to `https://sandbox.zarinpal.com` (otherwise `https://payment.zarinpal.com`). | A sandbox setting exists for REST payment operations. No non-production credential or successful sandbox test was present in the local environment; availability/access is not verified. |
| Payment create / verify / inquiry | Official SDK advertises payment create, verify, and inquiry. The official inquiry docs require `merchant_id` and `authority` and describe code `100` as successful. | Protocol must still be bound to Hami purchase IDs and exact amount/currency before any separate sandbox test. No test was authorized or run here. |
| Reverse | Official docs say successful transactions can be reversed without a fee only within 30 minutes; input includes merchant ID and transaction authority. | This operation is not a delayed-refund solution. Do not equate `reverse` with the separate refund API. |
| Refund request | Official first-party SDK `Refunds.create` sends GraphQL `AddRefund(session_id, amount, description, method, reason)`. The requested fields include refund `id`, `amount`, and timeline entries (`refund_amount`, `refund_time`, `refund_status`). | This establishes that the SDK exposes a refund-request operation, but the reviewed official docs do not establish that it can refund after 30 minutes, whether it means payout/completed return, or its settlement time. |
| Refund status / identifier | SDK `retrieve(refundId)` queries `GetRefund(id)` and requests `id`, `amount`, `status`, `created_at`, and `description`; `list` queries by `terminal_id`. | A refund ID and status field exist in SDK queries. The authoritative terminal success values, finality, uniqueness guarantees, and relationship to the original payment/authority are not defined in the reviewed official docs. |
| Refund authentication / sandbox | SDK configuration uses `accessToken` for GraphQL requests, sent as a Bearer token. `Zarinpal.ts` sets GraphQL base URL to `https://next.zarinpal.com/api/v4/graphql/` independently of the `sandbox` flag; only REST base URL branches on sandbox. | Refund GraphQL sandbox isolation is **not demonstrated**. Do not send refund mutations using production credentials or assume the REST sandbox setting makes GraphQL non-production. |
| Amount / currency / partial refund | The SDK mutation accepts a `BigInteger` amount, but the reviewed refund source does not document currency units, partial/full refund rules, amount bounds, or exact-match behavior. | Cannot freeze exact amount/currency semantics; Hami uses IRR examples, so no conversion or unit should be guessed. |
| Retry / idempotency / replay / timeout | No idempotency key, replay protection, retry contract, refund webhook, or ambiguous-timeout resolution is documented in the reviewed SDK refund implementation/docs. | On timeout or uncertain response, freeze for reconciliation. No automatic or blind retry; do not mark complete based solely on request acceptance. |

## Delayed-refund decision

The 30-minute constraint is explicitly documented for **Reverse** only. A
separate GraphQL Refund operation exists in the official SDK, but the reviewed
official sources do not prove its eligibility after 30 minutes, its completion
semantics, or a sandbox-safe execution path. Therefore:

**`ZARINPAL_NO_GO_FOR_DELAYED_REFUND` on current evidence.** This is an
evidence/readiness decision, not a claim that the provider technically cannot
refund later. No integration or refund action is authorized. Do not choose
ZarinPal as Hami's delayed-refund source of truth until the provider publishes
or confirms the missing contract and non-production route.

## Exact evidence needed to reopen

Project Owner/Commander should obtain written, provider-authoritative answers
for:

1. Whether GraphQL `AddRefund` accepts a payment/session older than 30 minutes,
   and the maximum supported age.
2. Whether the returned refund `id` and `status` mean request-created,
   processing, or financially completed; exact final-success states and
   server-side status inquiry behavior.
3. Whether refund GraphQL has a genuine sandbox endpoint and non-production
   `accessToken`, given the official SDK's fixed GraphQL host.
4. Original payment/session binding, exact amount and currency units, partial
   refund rules, and provider refund-ID uniqueness.
5. Idempotency/replay behavior, safe recovery from timeout/unknown outcome,
   and any completion event/webhook authentication contract.

Until then, keep the refund case unresolved and use a separately approved
reconciliation path; never manufacture provider proof.

## Security and hard locks

- Credentials remain in a local secret store/environment only; none were read,
  emitted, committed, or sent to a provider.
- No payment/refund API call, real or sandbox transaction, provider account
  access, or external support request was made.
- No fake adapter/event, `Purchase -> REFUNDED` transition, wallet/commission/
  referral reversal, runtime change, schema/migration, or production action.
- Production remains `LOCKED / NO-GO`.

## Evidence and disposition

- Inspected current checkout: branch `main`, `hami2test/main`, clean before
  this docs-only change; HEAD `8e8596a0ececdfa0630f9ec8ba4644fea3b41fe1`.
- Reviewed official configuration, inquiry, reverse docs and first-party SDK
  source for refund creation/retrieval/listing and endpoint configuration.
- Did not make provider calls or infer a sandbox refund from the REST sandbox
  configuration.
- No runtime, database, credentials, or financial state was changed.

**Disposition:** `ZARINPAL_NO_GO_FOR_DELAYED_REFUND` pending authoritative
provider answers and verified non-production refund support.
