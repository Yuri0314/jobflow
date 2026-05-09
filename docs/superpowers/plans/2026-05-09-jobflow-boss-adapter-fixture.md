# Jobflow BOSS Adapter Fixture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe BOSS adapter skeleton that works only against controlled fixture HTML/URLs and can identify blocked pages before any real-site automation is enabled.

**Architecture:** `packages/browser-automation` will expose `bossAdapter` and let adapters optionally detect blocked pages. The controller will check `detectBlockedPage()` before parsing results. The CLI will include `bossAdapter` in the registry only for controlled fixture input and will return a stable blocked error when `--site boss` is requested without fixture input.

**Tech Stack:** TypeScript, zod, vitest, commander, `@jobflow/browser-automation`, `@jobflow/cli`.

---

### Task 1: Safe BOSS Fixture Adapter

**Files:**
- Modify: `packages/browser-automation/src/adapter.ts`
- Create: `packages/browser-automation/src/adapters/boss.ts`
- Modify: `packages/browser-automation/src/controller.ts`
- Modify: `packages/browser-automation/src/index.ts`
- Modify: `packages/browser-automation/tests/browser-automation.test.ts`
- Modify: `apps/cli/src/commands/automation.ts`
- Modify: `apps/cli/tests/automation-command.test.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-05-09-jobflow-boss-adapter-fixture.md`

- [x] **Step 1: Write failing browser automation tests**

Add tests for:

- `parseBossSearchResults()` parses controlled BOSS-like fixture cards
- `bossAdapter.detectBlockedPage()` detects login/captcha/platform-blocked fixture pages
- `executeSearchTask()` returns blocked when the adapter detects a blocked page

- [x] **Step 2: Write failing CLI tests**

Add tests for:

- `runAutomationSearch(...site: "boss", fixtureHtml)` persists BOSS fixture results
- `runAutomationSearch(...site: "boss")` returns `SITE_FIXTURE_REQUIRED` and does not touch the real platform

- [x] **Step 3: Verify tests fail**

Run:

```powershell
corepack pnpm vitest run packages/browser-automation/tests/browser-automation.test.ts apps/cli/tests/automation-command.test.ts
```

Expected: FAIL because `bossAdapter` and blocked-page detection do not exist yet.

- [x] **Step 4: Implement adapter blocked-page detection**

Add optional `detectBlockedPage(html)` to `SiteAdapter` and have `executeSearchTask()` return a blocked `AutomationResult` when it reports a block.

- [x] **Step 5: Implement BOSS fixture adapter**

Add `packages/browser-automation/src/adapters/boss.ts` with controlled fixture parsing and blocked-page detection. Export `bossAdapter` and `parseBossSearchResults`.

- [x] **Step 6: Wire CLI safely**

Update `runAutomationSearch()` so:

- `boss` with `fixtureHtml` or `fixtureUrl` can use `bossAdapter`
- `boss` without controlled fixture input returns `SITE_FIXTURE_REQUIRED`
- other unsupported sites still return `ADAPTER_NOT_FOUND`

- [x] **Step 7: Verify focused and full tests**

Run:

```powershell
corepack pnpm --filter @jobflow/browser-automation build
corepack pnpm vitest run packages/browser-automation/tests/browser-automation.test.ts apps/cli/tests/automation-command.test.ts apps/cli/tests/protocol-command.test.ts
corepack pnpm check
```

Expected: PASS.

- [x] **Step 8: Smoke**

Run `automation search --site boss --fixture-html "<controlled BOSS fixture>" --process-results --json` and confirm it collects one BOSS fixture job without visiting the real site.

- [ ] **Step 9: Commit and push**

```powershell
git add packages/browser-automation apps/cli README.md docs/superpowers/plans/2026-05-09-jobflow-boss-adapter-fixture.md
git commit -m "feat: add safe boss fixture adapter"
git push origin main
```
