# Wave 42 — Representative Customer Registration Attribution

## Contract

- An authenticated representative with `sales_attributions.create` can create a registration invitation through `POST /sales-partner/customers`.
- The API returns a cryptographically random, one-time code with a seven-day expiry. Only its SHA-256 hash is persisted. The representative identity is taken from the authenticated session; client-supplied user or representative IDs are not accepted as attribution authority.
- The prospective customer enters the optional code in the normal registration form and completes the existing mobile OTP and password setup flow. The invite is redeemed and `SalesAttribution` is created in the same database transaction that activates the customer account.
- Existing active accounts cannot be attached, reassigned, or transferred. A consumed, expired, malformed, or unknown invite is rejected. The unique `SalesAttribution.customerUserId` constraint remains the final one-attribution-per-customer guard.
- `GET /sales-partner/customers` remains self-scoped and returns only opaque customer references, display aliases, status, and creation time. It does not expose phone numbers or raw customer IDs.
- Registration attribution alone creates no commission, wallet, purchase, membership, or balance mutation. Existing purchase-driven commission behavior is unchanged.

## Data and operations

Migration `0026_sales_registration_invites` adds only the invitation table and indexes; it does not rewrite existing users, attributions, or financial records. The invitation code is returned once and is not recoverable from the database after the response is lost; the representative can issue another invite. Production remains LOCKED / NO-GO.

## Verification targets

- Anonymous requests are denied; ordinary customer accounts cannot create or read representative attributions.
- Each representative sees only their own customer list.
- OTP verification and invitation redemption are single-use under concurrent requests.
- Existing accounts and reused invite codes cannot create duplicate or reassigned attributions.
- A completed invitation registration creates one active customer and one attribution, with no registration-time commission or wallet rows.
