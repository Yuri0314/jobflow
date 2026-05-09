# Jobflow CLI Chromium Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the CLI fixture automation command choose between fetch-backed page loading and real Chromium/Edge page loading.

**Architecture:** The CLI remains an entry point and persistence layer. `@jobflow/browser-automation` remains the execution layer. The new CLI option selects which `AutomationPageSession` to create, then always calls `executeSearchTask()` and persists the returned collected payloads.

**Tech Stack:** TypeScript, commander, zod, vitest, `@jobflow/browser-automation`, `@jobflow/runtime`.

---

### Task 1: Add CLI Session Selection

**Files:**
- Modify: `apps/cli/src/commands/automation.ts`
- Modify: `apps/cli/tests/automation-command.test.ts`
- Modify: `apps/cli/tests/cli-help.test.ts`
- Modify: `README.md`

- [x] **Step 1: Write failing tests**

Add tests that verify:

- `runAutomationSearch()` defaults to the fetch page session for fixture URLs.
- `runAutomationSearch()` accepts `session: "chromium"` and calls an injected Chromium session factory.
- Chromium sessions are closed after the search completes.
- `session: "chromium"` without `fixtureUrl` returns stable `INVALID_INPUT`.
- CLI help includes `--session <session>`.

- [x] **Step 2: Verify tests fail**

Run:

```powershell
corepack pnpm vitest run apps/cli/tests/automation-command.test.ts apps/cli/tests/cli-help.test.ts
```

Expected: FAIL because `session` option and injected Chromium session selection do not exist yet.

- [x] **Step 3: Implement minimal CLI integration**

Update `runAutomationSearch()` to:

- parse `session` as `"fetch" | "chromium"` with default `"fetch"`
- accept optional test dependency injection for fetch session and Chromium session creation
- require `fixtureUrl` when `session === "chromium"`
- call `createChromiumPageSession({ headless: true })` for Chromium mode
- close the Chromium session in a `finally` block
- keep unsupported real sites returning `ADAPTER_NOT_FOUND`

Update `registerAutomationCommand()` to expose:

```text
--session <session>  page session: fetch, chromium
```

- [x] **Step 4: Verify focused tests pass**

Run:

```powershell
corepack pnpm vitest run apps/cli/tests/automation-command.test.ts apps/cli/tests/cli-help.test.ts
```

Expected: PASS.

- [x] **Step 5: Verify all workspaces and smoke**

Run:

```powershell
corepack pnpm check
corepack pnpm --filter @jobflow/browser-automation smoke:fixture-browser
```

Expected: build/tests pass and browser smoke prints `ok: true`.

- [x] **Step 6: Commit and push**

```powershell
git add apps/cli README.md docs/superpowers/plans/2026-05-09-jobflow-cli-chromium-session.md
git commit -m "feat: let cli use chromium automation session"
git push origin main
```
