# Hamayat Card

Local foundation for a Persian RTL benefits platform.

## Run
1. Copy `.env.example` to `.env` and change local values if needed.
2. Run `docker compose up --build`.
3. Open `http://localhost:8080/` and `http://localhost:8080/api/v1/health`.

PostgreSQL applies the RBAC foundation migration automatically on first database initialization from `infra/docker/postgres/`.

## Checks
With Node installed, run `node scripts/check-foundation.mjs`. The current environment must also provide npm for workspace dependency installation.
