# Jobflow Browser Automation Controller Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first `packages/browser-automation` scaffold for Level 1 search-and-collect automation.

**Architecture:** The new package exposes typed task/result/error contracts, an adapter registry, and a fixture adapter that parses controlled HTML into `JobIngestPayload` values. This phase intentionally does not launch a browser or touch real recruiting sites.

**Tech Stack:** TypeScript, pnpm workspace, zod, vitest, existing `@jobflow/schema` types.

---

### Task 1: Browser Automation Package Scaffold

**Files:**
- Create: `packages/browser-automation/package.json`
- Create: `packages/browser-automation/tsconfig.json`
- Create: `packages/browser-automation/src/index.ts`
- Create: `packages/browser-automation/src/task.ts`
- Create: `packages/browser-automation/src/result.ts`
- Create: `packages/browser-automation/src/errors.ts`
- Create: `packages/browser-automation/src/adapter.ts`
- Create: `packages/browser-automation/src/adapters/fixture.ts`
- Test: `packages/browser-automation/tests/browser-automation.test.ts`
- Modify: `pnpm-lock.yaml`

- [x] **Step 1: Write failing tests**

Add tests for:

- `searchTaskSchema` accepts a fixture search task.
- `automationResultSchema` accepts a blocked result with a stable error code.
- `createAdapterRegistry` resolves the fixture adapter by site.
- `parseFixtureSearchResults` converts controlled fixture HTML into valid ingest payloads.

- [x] **Step 2: Verify tests fail**

Run: `corepack pnpm vitest run packages/browser-automation/tests/browser-automation.test.ts`

Expected: FAIL because `packages/browser-automation/src/index.js` does not exist.

- [x] **Step 3: Implement minimal package**

Create the package files and export:

- task schemas and types
- result schemas and types
- error schemas and types
- adapter interface and registry
- fixture adapter parser

- [x] **Step 4: Verify package tests pass**

Run: `corepack pnpm vitest run packages/browser-automation/tests/browser-automation.test.ts`

Expected: PASS.

- [x] **Step 5: Verify all workspaces**

Run: `corepack pnpm install`

Run: `corepack pnpm check`

Expected: build passes and all tests pass.

- [x] **Step 6: Commit**

```bash
git add packages/browser-automation docs/superpowers/plans/2026-05-09-jobflow-browser-automation-controller-scaffold.md pnpm-lock.yaml
git commit -m "feat: scaffold browser automation package"
```
