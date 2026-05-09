# Jobflow Automation Search Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let automation search optionally continue from collected ingests into normalized jobs, scores, and next actions.

**Architecture:** The default automation search behavior remains collection-only. A new explicit `processResults` / `process_results` option runs the existing normalize, score, and next-action command functions after successful persistence, reusing the same runtime primitives and local state. Protocol callers get the same optional processing capability through the automation search envelope.

**Tech Stack:** TypeScript, zod, commander, vitest, `@jobflow/runtime`, `@jobflow/protocol`.

---

### Task 1: Optional Search Result Processing

**Files:**
- Modify: `apps/cli/src/commands/automation.ts`
- Modify: `apps/cli/src/commands/protocol.ts`
- Modify: `apps/cli/tests/automation-command.test.ts`
- Modify: `apps/cli/tests/protocol-command.test.ts`
- Modify: `apps/cli/tests/cli-help.test.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/tests/protocol.test.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-05-09-jobflow-automation-search-processing.md`

- [x] **Step 1: Write failing CLI/protocol tests**

Add tests proving:

- `runAutomationSearch(..., { processResults: true })` creates jobs, scores, pipeline entries, and next actions
- `automation search` help includes `--process-results`
- `automation_search` protocol envelopes accept `process_results`
- protocol automation search returns a `processed` payload when requested

- [x] **Step 2: Verify tests fail**

Run:

```powershell
corepack pnpm vitest run packages/protocol/tests/protocol.test.ts apps/cli/tests/automation-command.test.ts apps/cli/tests/protocol-command.test.ts apps/cli/tests/cli-help.test.ts
```

Expected: FAIL because processing options and payloads do not exist.

- [x] **Step 3: Implement CLI processing**

Update `runAutomationSearch()` to accept `processResults`. After successful persistence, normalize and score the collected ingest ids, then call `runNext()`.

- [x] **Step 4: Implement protocol processing option**

Add `process_results?: boolean` to `automationSearchRequestEnvelopeSchema`, pass it through protocol command handling, and include `processed` in the protocol result payload when present.

- [x] **Step 5: Update docs**

Add README examples for `automation search --process-results` and protocol `process_results`.

- [x] **Step 6: Verify focused and full tests**

Run:

```powershell
corepack pnpm vitest run packages/protocol/tests/protocol.test.ts apps/cli/tests/automation-command.test.ts apps/cli/tests/protocol-command.test.ts apps/cli/tests/cli-help.test.ts
corepack pnpm check
```

Expected: PASS.

- [x] **Step 7: Smoke**

Run fixture `automation search --process-results`, then inspect state to confirm one ingest, one job, one score, one pipeline entry, and one completed automation task.

- [x] **Step 8: Commit and push**

```powershell
git add apps/cli packages/protocol README.md docs/superpowers/plans/2026-05-09-jobflow-automation-search-processing.md
git commit -m "feat: process automation search results"
git push origin main
```
