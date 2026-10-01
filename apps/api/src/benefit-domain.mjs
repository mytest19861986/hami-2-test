const transitions = {
  plan: { DRAFT: ['ACTIVE'], ACTIVE: ['INACTIVE', 'ARCHIVED'], INACTIVE: ['ACTIVE', 'ARCHIVED'], ARCHIVED: [] },
  purchase: { PENDING_PAYMENT: ['PAID', 'CANCELLED'], PAID: ['REFUNDED'], CANCELLED: [], REFUNDED: [] },
  membership: { PENDING: ['ACTIVE'], ACTIVE: ['EXPIRED', 'CANCELLED'], EXPIRED: [], CANCELLED: [] },
};

export function assertTransition(kind, from, to) {
  if (!transitions[kind]?.[from]?.includes(to)) throw new Error('INVALID_STATE_TRANSITION');
  return to;
}

export function membershipWindow({ status, startsAt, endsAt }, now = new Date()) {
  return status === 'ACTIVE' && startsAt <= now && now < endsAt;
}
