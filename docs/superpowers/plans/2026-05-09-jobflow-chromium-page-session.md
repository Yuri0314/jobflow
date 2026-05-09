# Jobflow Chromium Page Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real Chromium/Edge CDP-backed page session for local fixture automation smoke tests.

**Architecture:** `@jobflow/browser-automation` keeps the generic `AutomationPageSession` interface and adds a Chromium implementation beside the existing fetch implementation. The smoke script starts a local fixture HTTP page, launches Chromium/Edge with a temporary profile and remote debugging port, reads page HTML through CDP, then runs `executeSearchTask()` through the existing fixture adapter.

**Tech Stack:** TypeScript, Node child process/http/fs APIs, Chrome DevTools Protocol over WebSocket, pnpm workspace, vitest, existing browser-automation controller.

---

### Task 1: Add Chromium Page Session

**Files:**
- Create: `packages/browser-automation/src/chromium-page-session.ts`
- Modify: `packages/browser-automation/src/index.ts`
- Modify: `packages/browser-automation/tests/browser-automation.test.ts`

- [x] **Step 1: Write failing tests**

Add tests that verify:

- `findChromiumExecutable()` prefers explicit `CHROME_PATH` / `EDGE_PATH`.
- `findChromiumExecutable()` falls back to known Windows Chrome/Edge paths when they exist.
- `buildChromiumLaunchArgs()` includes user profile, remote debugging port, first-run disabling flags, and the page URL.

- [x] **Step 2: Verify tests fail**

Run:

```powershell
corepack pnpm vitest run packages/browser-automation/tests/browser-automation.test.ts
```

Expected: FAIL because `chromium-page-session.ts` exports do not exist yet.

- [x] **Step 3: Implement minimal Chromium session**

Create `chromium-page-session.ts` with:

- `findChromiumExecutable(env, exists)`
- `buildChromiumLaunchArgs(options)`
- `createChromiumPageSession(options)` returning `AutomationPageSession & { close(): Promise<void> }`
- small CDP helpers for `/json/version`, `/json/list`, `/json/activate/:id`, and `Runtime.evaluate(document.documentElement.outerHTML)`

- [x] **Step 4: Verify package tests pass**

Run:

```powershell
corepack pnpm vitest run packages/browser-automation/tests/browser-automation.test.ts
```

Expected: PASS.

### Task 2: Add Browser Automation Smoke Script

**Files:**
- Create: `packages/browser-automation/scripts/smoke-fixture-browser.mjs`
- Modify: `packages/browser-automation/package.json`
- Modify: `README.md`

- [x] **Step 1: Write failing static smoke test**

Add a test that reads `scripts/smoke-fixture-browser.mjs` and verifies it uses:

- `createChromiumPageSession`
- `executeSearchTask`
- `fixtureAdapter`
- `data-job-card`

- [x] **Step 2: Verify static smoke test fails**

Run:

```powershell
corepack pnpm vitest run packages/browser-automation/tests/browser-automation.test.ts
```

Expected: FAIL because the smoke script does not exist yet.

- [x] **Step 3: Implement smoke script and package script**

The smoke script should:

- start a local HTTP fixture page
- call `createChromiumPageSession()`
- execute a fixture search task against the local URL
- assert one collected payload
- print a compact JSON success payload
- always close the browser session and local server

Add:

```json
"smoke:fixture-browser": "corepack pnpm build && node scripts/smoke-fixture-browser.mjs"
```

- [x] **Step 4: Verify full check and smoke**

Run:

```powershell
corepack pnpm check
corepack pnpm --filter @jobflow/browser-automation smoke:fixture-browser
```

Expected: build and tests pass; smoke prints `ok: true`.

- [x] **Step 5: Commit and push**

```powershell
git add packages/browser-automation README.md docs/superpowers/plans/2026-05-09-jobflow-chromium-page-session.md
git commit -m "feat: add chromium automation session"
git push origin main
```
