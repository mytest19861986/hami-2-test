# Eligibility API

Provider eligibility checks are membership-scoped and require an APPROVED provider. Unknown and ineligible identities return the same minimal `{ eligible: false }` shape; full national IDs never appear in response or audit payloads.
