# Jobflow Automation Task Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let CLI users and external protocol callers list recent automation tasks and fetch one task audit record by id.

**Architecture:** `apps/cli/src/commands/automation.ts` owns the direct local-state query functions because automation task records are already persisted there. `packages/protocol` defines stable request/result envelope types for external agents. `apps/cli/src/commands/protocol.ts` validates protocol envelopes and delegates to the same query functions so CLI and protocol stay consistent.

**Tech Stack:** TypeScript, zod, commander, vitest, `@jobflow/schema`, `@jobflow/runtime`, `@jobflow/protocol`.

---

### Task 1: Add Automation Task Query APIs

**Files:**
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/tests/protocol.test.ts`
- Modify: `apps/cli/src/commands/automation.ts`
- Modify: `apps/cli/src/commands/protocol.ts`
- Modify: `apps/cli/tests/automation-command.test.ts`
- Modify: `apps/cli/tests/protocol-command.test.ts`
- Modify: `apps/cli/tests/cli-help.test.ts`
- Modify: `README.md`

- [x] **Step 1: Write failing protocol schema tests**

Add tests for:

- `getAutomationTasksRequestEnvelopeSchema` with optional `limit` and `status`
- `getAutomationTaskRequestEnvelopeSchema` with required `task_id`
- `responseEnvelopeSchema` accepting `get_automation_tasks_result`
- `responseEnvelopeSchema` accepting `get_automation_task_result`

- [x] **Step 2: Verify protocol schema tests fail**

Run:

```powershell
corepack pnpm vitest run packages/protocol/tests/protocol.test.ts
```

Expected: FAIL because the new protocol schemas and response types do not exist.

- [x] **Step 3: Write failing CLI query tests**

Add tests for:

- `runAutomationTasks()` returns recent tasks sorted newest first
- `runAutomationTasks()` filters by status and honors limit
- `runAutomationTaskGet()` returns one task by id
- `runAutomationTaskGet()` returns `NOT_FOUND` for a missing id
- CLI help includes `automation tasks` and `automation task`

- [x] **Step 4: Write failing protocol dispatch tests**

Add tests for:

- `runProtocolEnvelope()` dispatches `get_automation_tasks`
- `runProtocolEnvelope()` dispatches `get_automation_task`
- protocol list/get payloads match the direct task records
- missing task id returns a `get_automation_task_result` error envelope with `NOT_FOUND`

- [x] **Step 5: Verify CLI/protocol tests fail**

Run:

```powershell
corepack pnpm vitest run apps/cli/tests/automation-command.test.ts apps/cli/tests/protocol-command.test.ts apps/cli/tests/cli-help.test.ts
```

Expected: FAIL because query functions, protocol dispatch, and help entries do not exist.

- [x] **Step 6: Implement protocol schemas**

Update `packages/protocol/src/index.ts` to:

- add `"get_automation_tasks"` and `"get_automation_task"` request types
- add `"get_automation_tasks_result"` and `"get_automation_task_result"` response types
- export `getAutomationTasksRequestEnvelopeSchema`
- export `getAutomationTaskRequestEnvelopeSchema`
- export matching inferred types

- [x] **Step 7: Implement CLI task query functions**

Update `apps/cli/src/commands/automation.ts` to add:

- `runAutomationTasks(store, options)`
- `runAutomationTaskGet(store, options)`
- `automation tasks --limit <limit> --status <status>`
- `automation task --task-id <task_id>`

List output should include `{ items, count }`, sorted by `finished_at ?? started_at ?? created_at` descending.

- [x] **Step 8: Implement protocol dispatch**

Update `apps/cli/src/commands/protocol.ts` to:

- dispatch `get_automation_tasks`
- dispatch `get_automation_task`
- add `protocol get-automation-tasks`
- add `protocol get-automation-task`
- delegate to `runAutomationTasks()` and `runAutomationTaskGet()`

- [x] **Step 9: Verify focused tests pass**

Run:

```powershell
corepack pnpm vitest run packages/protocol/tests/protocol.test.ts apps/cli/tests/automation-command.test.ts apps/cli/tests/protocol-command.test.ts apps/cli/tests/cli-help.test.ts
```

Expected: PASS.

- [x] **Step 10: Update README**

Add short CLI and protocol examples for querying automation tasks.

- [x] **Step 11: Verify all workspaces and smoke**

Run:

```powershell
corepack pnpm check
```

Then run a CLI smoke that:

1. executes a fixture `automation_search` protocol envelope
2. runs `automation tasks --limit 1`
3. runs `protocol run` with `get_automation_tasks`

Expected: check passes and both query paths return one completed task.

- [x] **Step 12: Commit and push**

```powershell
git add packages/protocol apps/cli README.md docs/superpowers/plans/2026-05-09-jobflow-automation-task-query.md
git commit -m "feat: add automation task query APIs"
git push origin main
```
