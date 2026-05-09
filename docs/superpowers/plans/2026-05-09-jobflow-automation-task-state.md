# Jobflow Automation Task State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist automation task status in local Jobflow state so CLI, protocol callers, and future desktop UI can audit automation runs consistently.

**Architecture:** `packages/schema` owns the task record contract. `packages/runtime` adds an `automation_tasks` state collection with a default so old state files continue to load. `apps/cli` writes a task record whenever a valid automation search task is created, including completed, blocked, and failed outcomes.

**Tech Stack:** TypeScript, zod, vitest, `@jobflow/schema`, `@jobflow/runtime`, `@jobflow/browser-automation`.

---

### Task 1: Add Automation Task State Records

**Files:**
- Modify: `packages/schema/src/index.ts`
- Modify: `packages/schema/tests/schema.test.ts`
- Modify: `packages/runtime/src/state-schema.ts`
- Modify: `packages/runtime/tests/runtime.test.ts`
- Modify: `apps/cli/src/commands/automation.ts`
- Modify: `apps/cli/src/commands/state.ts`
- Modify: `apps/cli/tests/automation-command.test.ts`
- Modify: `apps/cli/tests/protocol-command.test.ts`
- Modify: `apps/cli/tests/state-command.test.ts`
- Modify: `apps/cli/tests/state-store.test.ts`
- Modify: `README.md`

- [x] **Step 1: Write failing schema/runtime tests**

Add tests that expect:

- `automationTaskRecordSchema` accepts a completed search task with `action_log`, `collected_count`, and `ingest_ids`
- `createFsStore().read()` returns `automation_tasks: []`
- `stateSchema` loads legacy state JSON with no `automation_tasks` field and defaults it to `[]`

- [x] **Step 2: Verify schema/runtime tests fail**

Run:

```powershell
corepack pnpm vitest run packages/schema/tests/schema.test.ts packages/runtime/tests/runtime.test.ts apps/cli/tests/state-store.test.ts
```

Expected: FAIL because the schema and runtime state do not expose `automation_tasks` yet.

- [x] **Step 3: Write failing CLI persistence tests**

Add tests that expect:

- successful fixture automation search stores one completed automation task
- unsupported real site search stores one blocked automation task with `ADAPTER_NOT_FOUND`
- Chromium fixture search without `fixtureUrl` stores one failed automation task with `INVALID_INPUT`
- protocol `automation_search` stores the same completed task record
- `state inspect` counts automation tasks and uses task `finished_at` in `latest_updated_at`

- [x] **Step 4: Verify CLI tests fail**

Run:

```powershell
corepack pnpm vitest run apps/cli/tests/automation-command.test.ts apps/cli/tests/protocol-command.test.ts apps/cli/tests/state-command.test.ts
```

Expected: FAIL because automation search does not persist task records and state inspect does not count them.

- [x] **Step 5: Implement schemas and runtime default**

Update `packages/schema/src/index.ts` to export:

```ts
export const automationTaskKindSchema = z.enum(["search"]);
export const automationTaskStatusSchema = z.enum(["queued", "running", "completed", "failed", "blocked"]);
export const automationTaskSessionSchema = z.enum(["fetch", "chromium"]);
export const automationTaskActionLogSchema = z.object({
  at: isoDateTimeSchema,
  action: z.string().min(1),
  status: z.enum(["started", "completed", "failed", "blocked"]),
  details: metadataSchema.optional()
});
export const automationTaskRecordSchema = z.object({
  task_id: z.string().min(1),
  kind: automationTaskKindSchema,
  site: z.string().min(1),
  keyword: z.string().min(1),
  city: z.string().min(1).optional(),
  session: automationTaskSessionSchema,
  status: automationTaskStatusSchema,
  created_at: isoDateTimeSchema,
  started_at: isoDateTimeSchema.optional(),
  finished_at: isoDateTimeSchema.optional(),
  collected_count: z.number().int().min(0).default(0),
  ingest_ids: z.array(z.string().min(1)).default([]),
  action_log: z.array(automationTaskActionLogSchema).default([]),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: metadataSchema.optional()
  }).optional(),
  source_metadata: metadataSchema.optional()
});
```

Update `packages/runtime/src/state-schema.ts` to include `automation_tasks: z.array(automationTaskRecordSchema).default([])` and `createEmptyState()` to return `automation_tasks: []`.

- [x] **Step 6: Implement CLI task persistence**

Update `runAutomationSearch()` to:

- persist a task record after every valid task creation
- write `completed` when controller returns completed
- write `blocked` for unsupported sites
- write `failed` for invalid Chromium fixture options
- include action log, collected count, ingest ids, and stable errors
- keep invalid raw options from mutating state because no valid task exists

Update `runStateInspect()` to count `automation_tasks` and include automation task timestamps in `latest_updated_at`.

- [x] **Step 7: Verify focused tests pass**

Run:

```powershell
corepack pnpm vitest run packages/schema/tests/schema.test.ts packages/runtime/tests/runtime.test.ts apps/cli/tests/state-store.test.ts apps/cli/tests/automation-command.test.ts apps/cli/tests/protocol-command.test.ts apps/cli/tests/state-command.test.ts
```

Expected: PASS.

- [x] **Step 8: Update README**

Mention that automation smoke tests now write both ingests and automation task audit records.

- [x] **Step 9: Verify all workspaces and smoke**

Run:

```powershell
corepack pnpm check
```

Then run a real CLI smoke:

```powershell
jobflow protocol run automation_search fixture envelope
jobflow state inspect
```

Expected: build/tests pass and state inspect reports `automation_tasks: 1`.

- [x] **Step 10: Commit and push**

```powershell
git add packages/schema packages/runtime apps/cli README.md docs/superpowers/plans/2026-05-09-jobflow-automation-task-state.md
git commit -m "feat: persist automation task state"
git push origin main
```
