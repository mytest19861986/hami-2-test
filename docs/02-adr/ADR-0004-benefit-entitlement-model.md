# ADR-0004: Benefit Entitlement Model

Payment Provider, Purchase, Membership, and Eligibility are separate boundaries. A paid purchase creates one membership idempotently; eligibility reads current persisted membership and provider-benefit state. This separation supports future wallet, referral, and commission flows without coupling payment state to authorization.
