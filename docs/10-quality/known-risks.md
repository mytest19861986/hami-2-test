# Known quality risks

## Dependency audit

The earlier partial-tree audit reported 5 npm vulnerabilities (1 moderate, 4 high). That result is superseded: `npm audit --json` against the final API and Web images reports total 0 across all severities. No automatic `npm audit fix --force` was applied.

## Host tooling

The host has Node.js but no host `npm` executable. Foundation validation therefore runs inside the reproducible Docker images. The Docker images remain the supported local validation path until host tooling is provisioned.

## Next validation cache

Web lint and typecheck now run independently through ESLint CLI and `tsc --noEmit`; the production image build runs a real `next build`. Wave 1 starts with explicit Compose healthchecks for API/Web/Nginx; foundation smoke-test coverage remains intentionally shallow and must expand with Auth.
