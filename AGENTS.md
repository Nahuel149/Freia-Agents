# Repository Guidelines

Concise standards for contributing to this monorepo. Use these defaults unless a nested AGENTS.md overrides them.

## Project Structure & Module Organization
- Monorepo via `pnpm` workspaces (Node >=18.15 or ^20; pnpm >=9).
- Key paths:
  - `packages/server/` – API + CLI (TypeScript, oclif). Runs on `PORT` (default 3000). Env in `.env` (see `.env.example`).
  - `packages/ui/` – React (Vite). Dev server on `VITE_PORT` (default 8080) with proxy to server using `packages/server/.env`.
  - `packages/components/` – Shared TS components/nodes with Jest unit tests.
  - `packages/api-documentation/` – Swagger/OpenAPI config.
  - `docs/`, `docker/`, `.github/` – guides, Docker Compose, CI.

## Build, Test, and Development Commands
- Install: `pnpm install`
- Dev (all): `pnpm dev` (runs UI + server in parallel)
- Server dev: `pnpm --filter "./packages/server" dev`
- UI dev: `pnpm --filter "./packages/ui" dev` (set `VITE_PORT=8080` if needed)
- Build all: `pnpm build`; clean: `pnpm clean`; nuke: `pnpm nuke`
- Lint/format: `pnpm lint`, `pnpm lint-fix`, `pnpm format`, quick staged: `pnpm quick`
- Tests (all workspaces): `pnpm test`; targeted: `pnpm --filter "./packages/components" test`
- TypeORM migrations (server):
  - Generate: `pnpm --filter "./packages/server" run typeorm:migration-generate`
  - Run: `pnpm --filter "./packages/server" run typeorm:migration-run`

## Coding Style & Naming Conventions
- ESLint + Prettier enforced. Prettier: width 140, single quotes (incl. JSX), no semicolons, 4-space tabs.
- Symbols: `camelCase` for vars/functions; `PascalCase` for types/classes/React components.
- Files: React components `PascalCase.tsx/jsx`; utilities/hooks `kebab-case.ts/tsx`.
- Avoid unused imports (`unused-imports` plugin). Limit `console` to `info|warn|error`.

## Testing Guidelines
- Unit: Jest in `packages/server` and `packages/components`.
- Test locations: `__tests__/` or `*.test.ts(x)` / `*.spec.ts(x)` near sources.
- UI: Testing Library available; prefer `data-testid` selectors; keep tests deterministic.
- E2E: Cypress in server package (`e2e`, `cypress:run`, `cypress:open`).
- Run `pnpm test` locally and fix flakiness before PR.

## Commit & Pull Request Guidelines
- Commits: imperative, scoped; prefer Conventional style, e.g. `feat(server): add email login`.
- PRs: include purpose, scope, linked issues, screenshots for UI, testing notes, and breaking-change callouts.
- Pre-submit: `pnpm lint && pnpm build && pnpm test`.
- CI: GitHub Actions runs pnpm install/lint/build and Cypress on Node 18.15 (see `.github/workflows/`).

## Security & Configuration Tips
- Never commit secrets. Start from `packages/server/.env.example` → `.env`.
- Databases and Docker: see `docs/POSTGRESQL_*`, `docs/DEPLOYMENT_GUIDE.md`, and `docker/`.
- Hardening: `docs/SECURITY_DOCKER.md`. Disable telemetry via env if required.

## Agent-Specific Instructions
- Make small, targeted patches; preserve structure, names, and scripts.
- Respect workspace boundaries and use `--filter` for package-specific commands.
