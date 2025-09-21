# Repository Guidelines

Follow these defaults unless a nested `AGENTS.md` overrides them. Keep changes scoped, reproducible, and well-tested.

## Project Structure & Module Organization
- Monorepo managed with `pnpm` workspaces (Node >=18.15 or ^20).
- `packages/server/`: TypeScript API + oclif CLI. Env config lives in `.env` seeded from `.env.example`.
- `packages/ui/`: Vite + React frontend. Proxies API requests using values from `packages/server/.env`.
- `packages/components/`: Shared TypeScript modules with colocated Jest specs.
- `packages/api-documentation/`: OpenAPI/Swagger definitions surfaced to clients.
- Reference docs, CI, and container assets in `docs/`, `.github/`, and `docker/` respectively.

## Build, Test, and Development Commands
- `pnpm install`: install all workspace dependencies.
- `pnpm dev`: launch UI + server concurrently.
- `pnpm --filter "./packages/server" dev`: run API watcher on `PORT` (default 3000).
- `pnpm --filter "./packages/ui" dev`: run Vite at `VITE_PORT` (default 8080).
- `pnpm build` | `pnpm clean` | `pnpm nuke`: compile, remove build artifacts, or reset caches.
- `pnpm lint`, `pnpm lint-fix`, `pnpm format`, `pnpm quick`: enforce linting/formatting, especially before commits.
- `pnpm test`: execute workspace tests. Filter with `--filter` (e.g., components).
- Server migrations: `pnpm --filter "./packages/server" run typeorm:migration-generate` / `typeorm:migration-run`.

## Coding Style & Naming Conventions
- ESLint + Prettier (width 140, single quotes, no semicolons, 4-space tabs) gate all packages.
- Use `camelCase` for functions/variables, `PascalCase` for React components, types, and classes.
- File names: React components `PascalCase.tsx`; utilities/hooks `kebab-case.ts`.
- Remove unused imports via the `unused-imports` plugin; limit `console` to `info`, `warn`, `error`.

## Testing Guidelines
- Jest powers unit tests in server and components packages (`__tests__/`, `*.test.tsx?`, `*.spec.tsx?`).
- UI testing via Testing Library; favor `data-testid` selectors and deterministic assertions.
- Cypress E2E lives in `packages/server/e2e`; run with `pnpm --filter "./packages/server" cypress:run|cypress:open`.
- Always run `pnpm test` before submitting; fix flaky behavior locally.

## Commit & Pull Request Guidelines
- Prefer Conventional commits: `feat(server): add email login`.
- PRs must describe scope, link issues, note breaking changes, and include UI screenshots when relevant.
- Verify `pnpm lint && pnpm build && pnpm test` prior to opening PRs; CI re-runs the same suite on Node 18.15.

## Security & Configuration Tips
- Never commit secrets; derive `.env` from `packages/server/.env.example`.
- Review `docs/POSTGRESQL_*`, `docs/DEPLOYMENT_GUIDE.md`, and `docs/SECURITY_DOCKER.md` before deploying.
- Use env flags to disable telemetry or opt in to hardened Docker defaults when required.

## Agent-Specific Instructions
- Deliver minimal, targeted diffs and respect package boundaries.
- Use pnpm filters for package-scoped scripts; avoid cross-package coupling without coordination.
- Pause and request guidance if unexpected repo changes appear during execution.
