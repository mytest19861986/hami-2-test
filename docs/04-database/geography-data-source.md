# Geography Data Source

The project snapshots the SCI-derived 1404 geography dataset from the public IranCountryDivisions normalized source. The source distinguishes DivisionType 1 (Province), DivisionType 5 (City), and DivisionType 7 (urban zones); urban zones are excluded from normal city selection.

The snapshot is stored under `data/reference/iran-geography/1404/` with source metadata, SHA-256 checksums, 31 provinces, and 1,481 real cities. Prisma IDs are internal; `sourceCode` and `sourceVersion=SCI-1404` provide dataset identity. Seed import resolves parent relationships from the source data and is transactional/idempotent. Future SCI versions must compare sourceCode values and apply explicit add/update/deactivate policy rather than deleting and recreating all cities.
