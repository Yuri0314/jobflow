# Jobflow Runtime Automation Result Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move automation search result persistence record creation into `packages/runtime` so CLI, protocol, and future desktop code share the same audit and ingest conversion behavior.

**Architecture:** `packages/runtime` will expose a pure helper that converts a search task, session selection, collected ingest payloads, action log, status, and optional error into validated `AutomationTaskRecord` and `JobIngestRecord[]` values. CLI keeps browser execution and store read/write ownership for now, but no longer builds automation task audit records itself. Schema will accept `partial` automation task status to match browser automation results.

**Tech Stack:** TypeScript, zod, vitest, `@jobflow/schema`, `@jobflow/runtime`, `@jobflow/browser-automation`.

---

### Task 1: Runtime Automation Result Persistence

**Files:**
- Modify: `packages/schema/src/index.ts`
- Modify: `packages/schema/tests/schema.test.ts`
- Create: `packages/runtime/src/automation-results.ts`
- Modify: `packages/runtime/src/index.ts`
- Modify: `packages/runtime/tests/runtime.test.ts`
- Modify: `apps/cli/src/commands/automation.ts`
- Modify: `docs/superpowers/plans/2026-05-09-jobflow-runtime-automation-result-persistence.md`

- [x] **Step 1: Write failing schema/runtime tests**

Add tests proving:

- `automationTaskRecordSchema` accepts `partial`
- runtime can create a validated automation task audit record plus ingest records from collected payloads
- runtime can create a blocked/failed task audit record without collected ingests

- [x] **Step 2: Verify tests fail**

Run:

```powershell
corepack pnpm vitest run packages/schema/tests/schema.test.ts packages/runtime/tests/runtime.test.ts
```

Expected: FAIL because `partial` and the runtime persistence helper do not exist yet.

- [x] **Step 3: Implement schema and runtime helper**

Add `partial` to `automationTaskStatusSchema`.

Create `packages/runtime/src/automation-results.ts` with:

- `createAutomationSearchPersistence(input)`
- `AutomationSearchPersistenceInput`
- `AutomationSearchPersistenceResult`

The helper must validate all output through shared schema, generate ingest ids through an injected callback, and preserve action logs and structured errors.

- [x] **Step 4: Export runtime helper**

Update `packages/runtime/src/index.ts` to export the new helper and types.

- [x] **Step 5: Refactor CLI persistence**

Update `apps/cli/src/commands/automation.ts` so `persistAutomationTask()` delegates record creation to runtime. CLI should still own store read/write and browser execution.

- [x] **Step 6: Verify focused tests pass**

Run:

```powershell
corepack pnpm --filter @jobflow/schema build
corepack pnpm --filter @jobflow/runtime build
corepack pnpm vitest run packages/schema/tests/schema.test.ts packages/runtime/tests/runtime.test.ts apps/cli/tests/automation-command.test.ts apps/cli/tests/protocol-command.test.ts
```

Expected: PASS.

- [x] **Step 7: Verify all workspaces and smoke**

Run:

```powershell
corepack pnpm check
```

Then run fixture automation search plus `automation tasks --limit 1 --status completed`.

- [x] **Step 8: Commit and push**

```powershell
git add packages/schema packages/runtime apps/cli/src/commands/automation.ts docs/superpowers/plans/2026-05-09-jobflow-runtime-automation-result-persistence.md
git commit -m "refactor: move automation result persistence into runtime"
git push origin main
```
