# Jobflow Fixture Page Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move fixture automation from inline HTML parsing to a controller that can open a fixture page source, read HTML, parse results, and return a structured `AutomationResult`.

**Architecture:** `@jobflow/browser-automation` owns the controller and page-session boundary. The CLI creates a search task and persists collected payloads, while the controller handles page loading and adapter execution. This step uses an injectable page session and a fetch-backed session for local fixture URLs; real Chromium/CDP launch remains a later smoke layer.

**Tech Stack:** TypeScript, zod, vitest, pnpm workspace, Node `fetch`, existing `@jobflow/browser-automation` and `@jobflow/cli`.

---

### Task 1: Add Controller and Page Session Boundary

**Files:**
- Create: `packages/browser-automation/src/controller.ts`
- Create: `packages/browser-automation/src/page-session.ts`
- Modify: `packages/browser-automation/src/index.ts`
- Modify: `packages/browser-automation/tests/browser-automation.test.ts`

- [x] **Step 1: Write failing tests**

Add tests that verify:

- `executeSearchTask()` opens a URL through an injected page session and parses returned fixture HTML into collected payloads.
- `executeSearchTask()` returns a blocked result with `ADAPTER_NOT_FOUND` when no adapter exists for the task site.
- `fetchPageSession.open()` reads HTML from a local HTTP fixture endpoint.

- [x] **Step 2: Verify tests fail**

Run:

```powershell
corepack pnpm vitest run packages/browser-automation/tests/browser-automation.test.ts
```

Expected: FAIL because `controller.ts` and `page-session.ts` do not exist yet.

- [x] **Step 3: Implement minimal package code**

Create:

- `AutomationPageSession` type with `open(url): Promise<{ url: string; html: string }>`
- `fetchPageSession`
- `executeSearchTask(task, options)` that:
  - validates the task
  - resolves the adapter from a registry
  - opens `options.pageUrl` when provided
  - otherwise uses `options.html`
  - parses collected payloads
  - applies `task.limit`
  - returns `automationResultSchema` output

- [x] **Step 4: Verify package tests pass**

Run:

```powershell
corepack pnpm vitest run packages/browser-automation/tests/browser-automation.test.ts
```

Expected: PASS.

### Task 2: Wire CLI to Controller Page URLs

**Files:**
- Modify: `apps/cli/src/commands/automation.ts`
- Modify: `apps/cli/tests/automation-command.test.ts`
- Modify: `README.md`

- [x] **Step 1: Write failing CLI test**

Add a test that starts a local HTTP fixture endpoint, calls `runAutomationSearch()` with `fixtureUrl`, and verifies the collected ingest came from that URL.

- [x] **Step 2: Verify CLI test fails**

Run:

```powershell
corepack pnpm vitest run apps/cli/tests/automation-command.test.ts
```

Expected: FAIL because the CLI options do not support `fixtureUrl` yet.

- [x] **Step 3: Implement CLI integration**

Update `runAutomationSearch()` to:

- accept `fixtureUrl`
- create a `SearchTask`
- call `executeSearchTask()` with `fetchPageSession`, fixture adapter registry, `pageUrl`, and fallback fixture HTML
- persist `result.collected`
- keep unsupported real sites returning `ADAPTER_NOT_FOUND`

- [x] **Step 4: Verify CLI tests pass**

Run:

```powershell
corepack pnpm vitest run apps/cli/tests/automation-command.test.ts apps/cli/tests/cli-help.test.ts
```

Expected: PASS.

- [x] **Step 5: Verify all workspaces and smoke**

Run:

```powershell
corepack pnpm check
```

Run a CLI smoke against a temporary local fixture URL if possible; otherwise run the default fixture command and state inspect.

- [x] **Step 6: Commit and push**

```powershell
git add packages/browser-automation apps/cli README.md docs/superpowers/plans/2026-05-09-jobflow-fixture-page-controller.md
git commit -m "feat: add fixture automation controller"
git push origin main
```
