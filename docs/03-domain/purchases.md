# Purchases

PlanPurchase stores amount and currency snapshots. Payment confirmation is a separate idempotent boundary; it must atomically transition the purchase and create at most one membership.
