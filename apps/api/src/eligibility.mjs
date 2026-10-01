export function evaluateEligibility({ user, provider, memberships, benefits, now = new Date() }) {
  if (!user || user.status !== 'ACTIVE' || !provider || provider.status !== 'APPROVED') return { eligible: false, benefits: [] };
  const validMemberships = (memberships ?? []).filter((membership) => membership.status === 'ACTIVE' && (!membership.purchase || membership.purchase.status === 'PAID') && membership.startsAt <= now && membership.endsAt > now);
  const valid = validMemberships.flatMap((membership) => (benefits ?? []).filter((benefit) => benefit.planId === membership.planId && benefit.providerId === provider.id && benefit.isActive && benefit.plan?.status === 'ACTIVE').map((benefit) => ({ planName: benefit.plan.name, discountType: benefit.discountType, discountValue: benefit.discountValue, validUntil: membership.endsAt })));
  return { eligible: valid.length > 0, benefits: valid };
}
