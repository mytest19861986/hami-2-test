# ADR-0001: Local modular-monolith foundation

## Decision
Use a TypeScript-ready monorepo layout with separate web/API containers, PostgreSQL, and Nginx reverse proxy. The initial executable slice keeps the API dependency-light and exposes `/api/v1/health`; Prisma/database migrations are the next required foundation increment.

## Scope
No commercial features are included in HC-W0-01.
