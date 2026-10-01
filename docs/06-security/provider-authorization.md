# Provider Authorization

Provider ownership is represented by `ProviderMembership`; owner/manager updates are scoped by provider membership. Public directory queries require `status=APPROVED`. Self-registration cannot approve itself. Administrative actions use permissions rather than role-name checks.
