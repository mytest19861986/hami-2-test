# Permission Model

Permissions are enforced in the backend from the authenticated user's role links. `GET /api/v1/auth/admin/users` demonstrates the `users.read` guard. The UI must not be treated as an authorization boundary.
