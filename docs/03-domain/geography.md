# Geography

`Province` and `City` are reusable shared entities, not Doctor/Provider-owned tables. Province codes and the `(provinceId, name)` city key are deterministic and safe to upsert. Location reads are public; address writes remain authenticated and ownership-scoped.
