# User API

- `GET /api/v1/users/me/profile`
- `PUT /api/v1/users/me/profile`
- `GET /api/v1/users/me/addresses`
- `POST /api/v1/users/me/addresses`
- `PUT /api/v1/users/me/addresses/:id`
- `DELETE /api/v1/users/me/addresses/:id`
- `PUT /api/v1/users/me/addresses/:id/default` (reserved contract; default is currently selected via `isDefault` in the PUT body)
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/:id`
- `PATCH /api/v1/admin/users/:id/status`
