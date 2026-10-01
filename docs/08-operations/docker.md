# Docker local runtime

## Dependency placement

The API image is built from the repository root. `npm ci` runs during the image build using the root `package-lock.json`, so dependency installation is deterministic and independent of the Windows bind-mounted source filesystem.

The API service keeps `/workspace/node_modules` in the Docker image layer. The current Compose service has no repository bind mount, so rebuilds replace dependencies deterministically without a stale named-volume layer. PostgreSQL data is independent and is not removed by API rebuilds.

## Why this layout exists

The decisive probe installed the full dependency graph, including Prisma, successfully in container-local `/probe` (`npm ci` exit code 0; 78 packages). Earlier partial installs stalled while writing the project dependency tree. The Docker-managed volume avoids placing `node_modules` on the host bind-mounted filesystem.

## Rebuild and validate

```powershell
docker compose build api
docker compose up -d api
docker compose exec api npx prisma --version
docker compose ps
curl.exe http://localhost:8080/api/v1/health
```

Do not use `docker compose down -v` during routine recovery; it can remove database data. To rebuild dependencies, rebuild the API image and recreate only the API service. Preserve `package-lock.json`.

## Recovery evidence

- Container-local `npm ci`: exit code 0; 78 packages installed; Prisma pre/postinstall exit code 0.
- API image build: exit code 0; same dependency graph installed in 75.6 seconds.
- `npx prisma --version`: Prisma 6.19.3, Linux musl x64 engine available.
- API health through Nginx: `{"status":"ok"}`.
