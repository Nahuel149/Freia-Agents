# Workspace & Organization Removal Plan (OSS Simplification)

This document outlines **how to eliminate the current `workspace` / `organization` scaffolding** from the Freia monorepo so that *all authenticated users* get immediate, unrestricted access to every feature.  
The goal is to keep the refactor **incremental, low-risk and easily revertible** until we design and ship an improved multi-tenant solution.

---

## 1. Objectives

1. 🟢 **Simplify onboarding** – no concept of workspaces or orgs; users log in and use the app immediately.
2. 🟢 **Reduce maintenance complexity** – delete code paths we don’t need in OSS mode.
3. 🛡️ **Maintain security** – keep existing auth (sessions / JWT) but scope authorisation checks to *user* instead of workspace.
4. 🚮 **Delete deprecated enterprise code** – fully remove enterprise-only modules, license checks, and flags.

---

## 2. Current Usage Snapshot

| Layer | Files / Folders (non-exhaustive) | Purpose |
|-------|----------------------------------|---------|
| Database | `packages/server/src/oss/database/entities/workspace.entity.ts`<br>`packages/server/src/**/entities/*organization*.ts` | TypeORM entities & relations |
| Services | `packages/server/src/services/**` & util queries (e.g. `chatflows/index.ts`) | Query filtering by `workspaceId` / `organizationId` |
| Controllers / Routes | `packages/server/src/routes/**` | Require `workspaceId` param or read from session |
| UI | `packages/ui/src/**` | Workspace selector components, filters in fetch calls |

(Use `rg -i "workspaceId" packages/server` to get full list.)

---

## 3. High-Level Strategy

<!-- Progress block inserted by OSS refactor automation -->
### Progress Update *(2024-06-10)*

This block is deliberately verbose so that **any developer or LLM can resume the refactor without additional context**.

---

#### 3.1 Status Overview

| Category | Done | In-Progress | Not Started |
|----------|------|------------|-------------|
| Backend services | upsertVector, buildChatflow, openai-realtime | createAttachment | ChatFlow, Agent, Credential, Storage, APIKeys, others |
| Auth/RBAC | — | Session de-scoping PoC | Full removal of workspace/org checks |
| DB Entities | — | Workspace → nullable experiment branch | Full migration script |
| Frontend | — | Route guards research | UI cleanup + new hooks |
| Tests | Partial (patched failing suites) | OSS_MODE gating of entire Jest run | 100 % green w/ flag |

---

#### 3.2 Detailed Work Log

1. **Added Global Flag**  
   • New env var `OSS_MODE` (boolean), defaults to `true` when `.env` is absent.  
   • Helper `isOssMode()` created in `<root>/packages/server/src/utils/ossMode.ts`.  
   • Server bootstrap (`main.ts`) warns in logs when running in Enterprise mode.

2. **Guard-Clauses Implementation**  
   Implemented pattern *«If `isOssMode()` short-circuit, else perform workspace/org logic»* in three critical execution paths:
   • <mcfile name="upsertVector.ts" path="packages/server/src/utils/upsertVector.ts"></mcfile>  
   • <mcfile name="buildChatflow.ts" path="packages/server/src/utils/buildChatflow.ts"></mcfile>  
   • <mcfile name="index.ts" path="packages/server/src/services/openai-realtime/index.ts"></mcfile>  
   All three now accept `workspaceId` being `null | undefined | 'bypass-workspace'` without crashing.  
   Regression: **All vector-store updates succeed under OSS flag**.

3. **Quota Helpers Compatibility**  
   Functions <mcsymbol name="checkStorage" filename="quotaUsage.ts" path="packages/server/src/utils/quotaUsage.ts" startline="1" type="function"></mcsymbol> & <mcsymbol name="updateStorageUsage" filename="quotaUsage.ts" path="packages/server/src/utils/quotaUsage.ts" startline="80" type="function"></mcsymbol> now treat `workspaceId` as optional.  
   Unit tests added in `quotaUsage.test.ts` (see commit `oss-simplify-no-workspace/quota-helpers`).

4. **CI Adjustments**  
   New script `pnpm test:oss` runs Jest with `OSS_MODE=true`. Failing suites (8) were patched; 5 remain (see section 3.3).

---

#### 3.3 Pending / Next Steps (ordered)

1. **Finish `createAttachment.ts` Patch**  
   File partially refactored; still throws 404 if Workspace missing. Replace with noop when OSS.
2. **Service-Wide Guard Pass**  
   Search pattern `find\(.*workspaceId` and apply guard to:
   • `packages/server/src/services/chatflows/index.ts`
   • `packages/server/src/services/credential/index.ts`
   • `packages/server/src/services/agentflows/**` (graph builder & executor)  
   Tip: replicate approach from `buildChatflow.ts` – keep variables `orgId`, `subscriptionId` defaulted to `null`.
3. **Auth / RBAC Simplification**  
   • Update `<root>/packages/server/src/auth/serialize.ts` to stop writing `workspaceId` into session payload.  
   • Remove `workspaceId` guards in middlewares (`requireWorkspaceAccess`).
4. **Routes & Controllers**  
   For each route param `<:workspaceId>` or `<:organizationId>`:
   • Add alias without those params behind `OSS_MODE` check.  
   • Mark old route as deprecated (throw 410 in OSS).
5. **Entity Migration**  
   • Update TypeORM entities: set `workspaceId?: string | null` everywhere.  
   • Generate migration (`pnpm typeorm migration:generate -n MakeWorkspaceNullable`).  
   • Verify Postgres FK constraints allow `NULL`.
6. **Frontend Cleanup**  
   • Remove `WorkspaceDropdown` component and its Redux/Zustand store.  
   • Refactor API hooks (`useChatflows`, `useAgents`) to stop sending `workspaceId` header.
7. **Test Suite**  
   • Toggle `OSS_MODE` in `.env.test`.  
   • Fix 5 failing specs (see `pnpm --filter flowise test` output).  
   • Add new end-to-end Cypress paths for simplified onboarding.
8. **Delete Enterprise Modules**  
   • Remove `/packages/server/src/enterprise/**` folder entirely once all imports are gone.  
   • Ensure Docker & PM2 configs don’t reference enterprise env vars.

---

#### 3.4 Helpful Commands

```bash
# Run server with OSS flag (ts-node)
OSS_MODE=true pnpm --filter server dev

# Jest quick pass ignoring enterprise tests
pnpm test:oss

# Grep workspace usage
rg -i "workspaceId" packages/server | head -n 50
```

Feel free to **append** to this section after each PR merge.


---

1. **Introduce an `OSS_MODE` build flag** (default `true` in open-source) that disables all workspace/org checks at runtime.
2. **Gradually strip runtime references** to workspace/org when `OSS_MODE` is enabled.
3. **Keep DB schema untouched** initially – set nullable & default values so migrations are optional.
4. **Clean up UI** to remove workspace selector.
5. **Permanently delete enterprise-only modules & license code**.

This ensures that existing data keeps working and we do **not** break enterprise builds while OSS users get the simplified flow.

---

## 4. Detailed Task List

### 4.1 Config & Flags

- [ ] Add `OSS_MODE=true` to `.env.example` and read it via `process.env.OSS_MODE` in server bootstrap.
- [ ] Provide helper `isOssMode()` in `packages/server/src/utils/env.ts`.
- [ ] In UI, expose the same flag via Vite define plugin (`import.meta.env.VITE_OSS_MODE`).

### 4.2 Backend Refactor

1. **Guard clauses**  
   - Wrap any `workspaceId` / `organizationId` query filters with `if (!isOssMode())`.

2. **TypeORM Entity Tweaks**  
   - `Workspace` entity: mark as deprecated for OSS; use a dummy row seeded at startup **or** skip entirely when flag on.
   - Set relations `nullable: true` and remove `NOT NULL` constraints in migrations.

3. **Service Layer**  
   - Replace functions like `getAllChatflowsCountByOrganization()` with no-workspace variants when flag on.  
   - Example patch:  
     ```ts
     export const getAllChatflowsCount = async () => {
       if (isOssMode()) {
         return ChatFlow.count();
       }
       // old implementation
     };
     ```

4. **Auth & RBAC**  
   - Remove workspace scoping in session serialisation.
   - Ensure permissions are checked **per user** or globally.

### 4.3 Frontend Changes

- Delete / hide Workspace switcher component (grep `WorkspaceDropdown`).
- Update API hooks to call new endpoints that no longer send `workspaceId`.
- Remove organisation create / invite screens.

### 4.4 API Contract

- Deprecate routes beginning with `/org/:organizationId/...` or `/workspace/:workspaceId/...`.
- Introduce aliases without those params for OSS.
- Keep old routes for enterprise behind flag.

### 4.5 Data Migration (Optional)

If existing OSS installations have rows with non-null workspace/org values:

```sql
UPDATE "ChatFlow" SET "workspaceId" = NULL;
UPDATE "Agent"    SET "workspaceId" = NULL;
-- Repeat per table
```

### 4.6 Tests

- Adjust Jest unit tests that expect workspace filtering.
- Add integration test “user can create chatflow without workspace”.

---

## 5. Timeline & Milestones

| Week | Milestone |
|------|-----------|
| 1 | Add `OSS_MODE` flag, compile server & UI with flag ON |
| 2 | Backend service patches (ChatFlow, Agent, Credential) |
| 3 | Frontend cleanup, new API routes stable |
| 4 | Data migration script, regression tests pass |
| 5 | Delete dead code, documentation PR |

---

## 6. Future: Bring-Your-Own-Workspace Design

Once the OSS version is stable we can design a **plugin-based multi-tenant layer**:

1. **Workspace Provider Interface** – swap in/out Enterprise vs OSS implementations.
2. **RBAC Roles** – configurable per provider.
3. **Billing Hooks** – charge per workspace in SaaS, ignored in OSS.

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hidden workspace assumptions in code | Runtime errors | Enable `OSS_MODE` in CI to catch build failures |
| Residual enterprise-only code causes dead imports | Build or runtime errors | Remove enterprise modules & run tree-shaking build checks |
| Data with non-null workspaceId causes foreign-key errors | App crash | Make FKs nullable + provide migration SQL |

---

## 8. Deliverables

- PR series labelled `oss-simplify-no-workspace/*` implementing above tasks.
- This markdown kept in `docs/workspace_org_removal_plan.md`.
- CI workflow step `pnpm run test:oss` with `OSS_MODE=true`.

---

> **Outcome**: The open-source build becomes single-tenant & frictionless, while the codebase remains ready for a richer multi-tenant plugin in the future.