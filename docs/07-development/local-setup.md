# Local Setup

1. Copy `.env.example` to `.env`.
2. Run `docker compose up --build`.
3. Open `http://localhost:8080/`.
4. Check `http://localhost:8080/api/v1/health`.

The current host runtime exposes Node but not npm. Dependency installation must remain inside a working Node/npm environment until the host tooling issue is diagnosed.
