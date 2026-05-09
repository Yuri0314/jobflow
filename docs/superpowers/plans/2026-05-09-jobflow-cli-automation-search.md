# Jobflow CLI Automation Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an experimental CLI command that triggers the browser automation package for fixture search collection and persists collected jobs as ingests.

**Architecture:** The CLI owns local state writes, while `@jobflow/browser-automation` owns task/result schemas and site parsing. The first command uses the fixture adapter only, so the command path can be tested without launching a real browser or touching live recruiting sites.

**Tech Stack:** TypeScript, commander, pnpm workspace, zod, vitest, `@jobflow/browser-automation`, `@jobflow/runtime`, `@jobflow/schema`.

---

### Task 1: Add CLI Automation Search Command

**Files:**
- Create: `apps/cli/src/commands/automation.ts`
- Modify: `apps/cli/src/cli.ts`
- Modify: `apps/cli/package.json`
- Modify: `README.md`
- Modify: `pnpm-lock.yaml`
- Test: `apps/cli/tests/automation-command.test.ts`
- Test: `apps/cli/tests/cli-help.test.ts`

- [x] **Step 1: Write failing tests**

Add tests that verify:

- `runAutomationSearch()` accepts a fixture task, parses controlled fixture HTML, persists collected payloads as ingest records, and returns an automation result with stored ingest ids.
- `runAutomationSearch()` rejects unsupported real-site execution for now with a stable `ADAPTER_NOT_FOUND` style error response.
- CLI help includes the `automation` command and `automation search` subcommand.

- [x] **Step 2: Verify tests fail**

Run:

```powershell
corepack pnpm vitest run apps/cli/tests/automation-command.test.ts apps/cli/tests/cli-help.test.ts
```

Expected: FAIL because `apps/cli/src/commands/automation.ts` and CLI registration do not exist yet.

- [x] **Step 3: Implement minimal command**

Create `apps/cli/src/commands/automation.ts` with:

- `runAutomationSearch(store, rawOptions)`
- a default fixture HTML generator for `site=fixture`
- adapter registry lookup using `fixtureAdapter`
- search task validation using `searchTaskSchema`
- automation result validation using `automationResultSchema`
- ingest persistence using `jobIngestRecordSchema` and `createId("ingest")`
- `registerAutomationCommand(program, store)`

Register the command in `apps/cli/src/cli.ts` and add `@jobflow/browser-automation` to `apps/cli/package.json`.

- [x] **Step 4: Verify focused tests pass**

Run:

```powershell
corepack pnpm vitest run apps/cli/tests/automation-command.test.ts apps/cli/tests/cli-help.test.ts
```

Expected: PASS.

- [x] **Step 5: Verify all workspaces**

Run:

```powershell
corepack pnpm install
corepack pnpm check
```

Expected: build passes and all tests pass.

- [x] **Step 6: Commit and push**

```powershell
git add apps/cli docs/superpowers/plans/2026-05-09-jobflow-cli-automation-search.md pnpm-lock.yaml
git commit -m "feat: add cli automation search"
git push origin main
```
