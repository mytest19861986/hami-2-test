# Identity Privacy Model

National IDs are validated before persistence, are nullable during onboarding, and are masked in admin summaries. Profile and address access is scoped to the active authenticated user. Audit events record entity/action only; national-ID values and authentication secrets are never written to audit metadata or returned by admin endpoints.
