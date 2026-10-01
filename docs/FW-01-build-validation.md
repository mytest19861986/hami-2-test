# FW-01 Build Validation

## Commands and outcomes

- `node --test apps/web/test/*.test.mjs` — PASS, 30/30
- ESLint direct binary — PASS
- TypeScript direct binary with `--noEmit` — PASS
- `next build` — PASS; 24 static pages generated

The initial environment lacked npm/npx wrappers and had incomplete executable links. npm was restored through the existing runtime package-manager store, then dependencies were installed deterministically from `package-lock.json`.

