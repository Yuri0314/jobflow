# Jobflow Protocol BOSS Fixture Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock down the agent-facing `automation_search` protocol path for controlled BOSS fixture searches.

**Architecture:** Keep protocol as a thin envelope layer. It validates `site: "boss"`, forwards `fixture_html`, `fixture_url`, and `process_results` to `runAutomationSearch()`, and returns the same structured success or blocked error envelope as other automation searches.

**Tech Stack:** TypeScript, zod, vitest, commander, `@jobflow/protocol`, `@jobflow/cli`.

---

### Task 1: Protocol BOSS Fixture Coverage

**Files:**
- Modify: `packages/protocol/tests/protocol.test.ts`
- Modify: `apps/cli/tests/protocol-command.test.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-05-09-jobflow-protocol-boss-fixture.md`

- [x] **Step 1: Add protocol schema coverage**

Add a schema test proving `automation_search` accepts:

- `site: "boss"`
- `process_results: true`
- controlled `fixture_html`

- [x] **Step 2: Add protocol command coverage**

Add command tests proving:

- `runProtocolEnvelope(... automation_search site: "boss", fixture_html, process_results)` persists a BOSS ingest and produces processed output.
- `runProtocolEnvelope(... automation_search site: "boss")` returns `SITE_FIXTURE_REQUIRED`.

- [x] **Step 3: Run focused tests**

```powershell
corepack pnpm vitest run packages/protocol/tests/protocol.test.ts apps/cli/tests/protocol-command.test.ts
```

Expected: PASS if the existing thin protocol pass-through already supports the behavior.

- [x] **Step 4: Document the agent-facing BOSS fixture path**

Update `README.md` with a controlled BOSS `automation_search` envelope example.

- [x] **Step 5: Verify full repo**

```powershell
corepack pnpm check
```

Expected: PASS.

- [ ] **Step 6: Commit and push**

```powershell
git add packages/protocol/tests/protocol.test.ts apps/cli/tests/protocol-command.test.ts README.md docs/superpowers/plans/2026-05-09-jobflow-protocol-boss-fixture.md
git commit -m "test: cover protocol boss fixture search"
git push origin main
```
