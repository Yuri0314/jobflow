# Jobflow Extension Site Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move browser extension site detection behind a small adapter registry so future platform-specific capture logic can grow without bloating envelope generation.

**Architecture:** Add `apps/browser-extension/src/site-adapters.ts` with one adapter per known platform plus a generic fallback. `envelope.ts` will resolve the adapter for the current page URL, keep its existing protocol envelope behavior, and include the matched adapter id in `source_metadata` for auditability.

**Tech Stack:** TypeScript, vitest, Chrome extension source scripts, `@jobflow/protocol`.

---

### Task 1: Extension Site Adapter Registry

**Files:**
- Create: `apps/browser-extension/src/site-adapters.ts`
- Modify: `apps/browser-extension/src/envelope.ts`
- Modify: `apps/browser-extension/tests/envelope.test.ts`
- Modify: `docs/superpowers/plans/2026-05-09-jobflow-extension-site-adapters.md`

- [x] **Step 1: Write failing tests**

Add tests that require:

- `resolveExtensionSiteAdapter("https://www.zhipin.com/job_detail/abc")` returns a BOSS adapter.
- known site detection still returns `boss`, `liepin`, `lagou`, `linkedin`, and `unknown`.
- `createIngestJobEnvelope()` includes `source_metadata.site_adapter`.

- [x] **Step 2: Verify tests fail**

Run:

```powershell
corepack pnpm vitest run apps/browser-extension/tests/envelope.test.ts
```

Expected: FAIL because `site-adapters.ts` and `source_metadata.site_adapter` do not exist yet.

- [x] **Step 3: Implement adapter registry**

Create `apps/browser-extension/src/site-adapters.ts` with:

- `SourceSite`
- `ExtensionSiteAdapter`
- one adapter each for BOSS, Liepin, Lagou, LinkedIn
- a generic fallback adapter
- `resolveExtensionSiteAdapter(url)`
- `detectSourceSite(url)`

- [x] **Step 4: Wire envelope generation**

Update `createIngestJobEnvelope()` to resolve the adapter once and set:

- `payload.source_site`
- `payload.source_metadata.site_adapter`

Keep the existing payload shape and raw text fallback behavior unchanged.

- [x] **Step 5: Verify extension and full checks**

Run:

```powershell
corepack pnpm vitest run apps/browser-extension/tests/envelope.test.ts apps/browser-extension/tests/extension-e2e.test.ts
corepack pnpm check
```

Expected: PASS.

- [ ] **Step 6: Commit and push**

```powershell
git add apps/browser-extension docs/superpowers/plans/2026-05-09-jobflow-extension-site-adapters.md
git commit -m "refactor: add extension site adapter registry"
git push origin main
```
