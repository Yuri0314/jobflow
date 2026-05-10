# Jobflow Automation Site Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let humans and external agents discover which automation sites are currently enabled, fixture-only, or unavailable before launching a search task.

**Architecture:** Add a runtime-owned static capability catalog so CLI, protocol, and future desktop code share the same site availability truth. The CLI exposes it as `automation sites`; protocol exposes it as `get_automation_sites`.

**Tech Stack:** TypeScript, zod, vitest, commander, `@jobflow/runtime`, `@jobflow/protocol`, `@jobflow/cli`.

---

### Task 1: Automation Site Capability Catalog

**Files:**
- Create: `packages/runtime/src/automation-sites.ts`
- Modify: `packages/runtime/src/index.ts`
- Modify: `packages/runtime/tests/runtime.test.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/tests/protocol.test.ts`
- Modify: `apps/cli/src/commands/automation.ts`
- Modify: `apps/cli/src/commands/protocol.ts`
- Modify: `apps/cli/tests/automation-command.test.ts`
- Modify: `apps/cli/tests/protocol-command.test.ts`
- Modify: `apps/cli/tests/cli-help.test.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-05-10-jobflow-automation-site-capabilities.md`

- [x] **Step 1: Write failing runtime and CLI tests**

Add tests proving:

- runtime lists `fixture`, `boss`, `liepin`, `lagou`, and `linkedin`
- `fixture` is enabled without fixture input
- `boss` is fixture-only and requires controlled fixture input
- unsupported sites are marked `not_enabled`
- `runAutomationSites()` returns the catalog
- CLI help includes `automation sites`

- [x] **Step 2: Write failing protocol tests**

Add tests proving:

- protocol schemas accept `get_automation_sites`
- `runProtocolEnvelope()` returns a `get_automation_sites_result` envelope with the same catalog
- protocol help includes `get-automation-sites`

- [x] **Step 3: Verify tests fail**

```powershell
corepack pnpm vitest run packages/runtime/tests/runtime.test.ts packages/protocol/tests/protocol.test.ts apps/cli/tests/automation-command.test.ts apps/cli/tests/protocol-command.test.ts apps/cli/tests/cli-help.test.ts
```

Expected: FAIL because the catalog, CLI command, and protocol envelope do not exist yet.

- [x] **Step 4: Implement runtime catalog**

Create `listAutomationSites()` in runtime and export it from `packages/runtime/src/index.ts`.

- [x] **Step 5: Wire CLI**

Add `runAutomationSites()` and `automation sites --json`.

- [x] **Step 6: Wire protocol**

Add `get_automation_sites` request and `get_automation_sites_result` response handling.

- [x] **Step 7: Document and verify**

Add a README example, then run:

```powershell
corepack pnpm check
```

Expected: PASS.

- [ ] **Step 8: Smoke, commit, and push**

Run:

```powershell
node apps/cli/dist/main.js automation sites --json
node apps/cli/dist/main.js protocol run --input "<get_automation_sites envelope>" --json
git add packages/runtime packages/protocol apps/cli README.md docs/superpowers/plans/2026-05-10-jobflow-automation-site-capabilities.md
git commit -m "feat: add automation site capability discovery"
git push origin main
```
