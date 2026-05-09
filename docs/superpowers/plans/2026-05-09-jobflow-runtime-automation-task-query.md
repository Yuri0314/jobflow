# Jobflow Runtime Automation Task Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move automation task query primitives into `packages/runtime` so CLI, protocol, and future desktop code share the same task audit read behavior.

**Architecture:** `packages/runtime` will expose pure task query helpers that accept in-memory automation task records. `apps/cli` remains responsible for command-line option validation and JSON response shape, but delegates filtering, sorting, and lookup to runtime. Protocol behavior stays unchanged because it already delegates through the CLI command functions.

**Tech Stack:** TypeScript, zod, vitest, `@jobflow/schema`, `@jobflow/runtime`, commander.

---

### Task 1: Add Runtime Automation Task Query Primitives

**Files:**
- Modify: `packages/runtime/src/index.ts`
- Create: `packages/runtime/src/automation-tasks.ts`
- Modify: `packages/runtime/tests/runtime.test.ts`
- Modify: `apps/cli/src/commands/automation.ts`
- Modify: `docs/superpowers/plans/2026-05-09-jobflow-runtime-automation-task-query.md`

- [x] **Step 1: Write failing runtime tests**

Add tests proving runtime can:

- list automation tasks newest first
- filter by task status
- honor a limit
- find one task by id
- return `null` for an unknown task id

- [x] **Step 2: Verify runtime tests fail**

Run:

```powershell
corepack pnpm vitest run packages/runtime/tests/runtime.test.ts
```

Expected: FAIL because runtime does not export task query helpers yet.

- [x] **Step 3: Implement runtime helpers**

Create `packages/runtime/src/automation-tasks.ts` with:

- `listAutomationTasks(tasks, options)`
- `getAutomationTask(tasks, taskId)`
- exported `AutomationTaskListOptions`
- exported `AutomationTaskListResult`

`listAutomationTasks()` must sort by `finished_at ?? started_at ?? created_at` descending, then apply `limit`.

- [x] **Step 4: Export runtime helpers**

Update `packages/runtime/src/index.ts` to export the new helpers and types.

- [x] **Step 5: Refactor CLI to reuse runtime**

Update `apps/cli/src/commands/automation.ts` so `runAutomationTasks()` and `runAutomationTaskGet()` delegate to runtime helpers instead of implementing filtering and lookup directly.

- [x] **Step 6: Verify focused tests pass**

Run:

```powershell
corepack pnpm vitest run packages/runtime/tests/runtime.test.ts apps/cli/tests/automation-command.test.ts apps/cli/tests/protocol-command.test.ts
```

Expected: PASS.

- [x] **Step 7: Verify all workspaces**

Run:

```powershell
corepack pnpm check
```

Expected: PASS.

- [x] **Step 8: Commit and push**

```powershell
git add packages/runtime apps/cli/src/commands/automation.ts docs/superpowers/plans/2026-05-09-jobflow-runtime-automation-task-query.md
git commit -m "refactor: move automation task queries into runtime"
git push origin main
```
