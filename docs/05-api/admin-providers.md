# Admin Provider API

Admin operations are permission-based: `providers.read`, `providers.create`, `providers.update`, `providers.approve`, and `providers.suspend`.

Status transitions are explicit and invalid transitions are rejected. Public responses never expose membership, auth, or audit internals.
