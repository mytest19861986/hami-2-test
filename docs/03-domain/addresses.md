# Addresses

Addresses belong to exactly one User and every read, update, and delete is scoped by the authenticated user's `userId`. Province/City are shared Geography entities; the API rejects a city whose province differs from the selected province. A PostgreSQL partial unique index and transactional switch enforce at most one default address per user.
