# Jobflow Protocol Automation Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a protocol envelope that lets external agents trigger the existing fixture automation search through `jobflow protocol run`.

**Architecture:** `packages/protocol` defines the stable JSON contract. `apps/cli` dispatches the new envelope to the existing `runAutomationSearch()` path, so protocol callers share the same browser automation controller and local state write path as the direct CLI command. This first version supports fixture automation only and returns structured task status instead of introducing a separate long-running task database.

**Tech Stack:** TypeScript, zod, commander, vitest, `@jobflow/protocol`, `@jobflow/browser-automation`, `@jobflow/runtime`.

---

### Task 1: Add Automation Search Protocol Envelope

**Files:**
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/tests/protocol.test.ts`
- Modify: `apps/cli/src/commands/protocol.ts`
- Modify: `apps/cli/tests/protocol-command.test.ts`
- Modify: `apps/cli/tests/cli-help.test.ts`
- Modify: `README.md`

- [x] **Step 1: Write failing protocol schema tests**

Add tests showing that `automationSearchRequestEnvelopeSchema` accepts:

```json
{
  "version": "1",
  "type": "automation_search",
  "request_id": "req_automation_01",
  "sent_at": "2026-05-09T00:00:00.000Z",
  "payload": {
    "site": "fixture",
    "keyword": "TypeScript",
    "city": "Remote",
    "limit": 1,
    "session": "fetch",
    "fixture_html": "<article data-job-card data-url=\"https://example.test/jobs/1\"><h2 data-job-title>TypeScript Engineer</h2><p data-company>Example Co</p></article>"
  }
}
```

and `responseEnvelopeSchema` accepts `automation_search_result`.

- [x] **Step 2: Verify schema tests fail**

Run:

```powershell
corepack pnpm vitest run packages/protocol/tests/protocol.test.ts
```

Expected: FAIL because `automation_search` request and result types do not exist.

- [x] **Step 3: Write failing CLI protocol dispatch tests**

Add tests showing:

- `runProtocolEnvelope()` dispatches `automation_search`
- the response type is `automation_search_result`
- the response payload includes `task_id`, `task_status`, `collected_count`, `ingest_ids`, and `action_log`
- local state receives one ingest record
- invalid automation options return `INVALID_PROTOCOL_ENVELOPE`
- `protocol` help includes `automation-search`

- [x] **Step 4: Verify CLI protocol tests fail**

Run:

```powershell
corepack pnpm vitest run apps/cli/tests/protocol-command.test.ts apps/cli/tests/cli-help.test.ts
```

Expected: FAIL because the CLI dispatcher and help command do not know `automation_search`.

- [x] **Step 5: Implement protocol schemas**

Update `packages/protocol/src/index.ts` to:

- add `"automation_search"` to `commandRequestTypeSchema`
- add `"automation_search_result"` to `commandResponseTypeSchema`
- export `automationSearchRequestEnvelopeSchema`
- export `AutomationSearchRequestEnvelope`

The payload must include:

```ts
{
  site: z.enum(["fixture", "boss", "liepin", "lagou", "linkedin"]),
  keyword: z.string().min(1),
  city: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  session: z.enum(["fetch", "chromium"]).default("fetch"),
  fixture_html: z.string().min(1).optional(),
  fixture_url: z.string().url().optional()
}
```

- [x] **Step 6: Implement CLI protocol dispatch**

Update `apps/cli/src/commands/protocol.ts` to:

- import `automationSearchRequestEnvelopeSchema`
- import `runAutomationSearch`
- dispatch `automation_search` in `runProtocolEnvelope()`
- add `runProtocolAutomationSearch()`
- add a `protocol automation-search` subcommand
- map snake_case protocol payload fields to the existing camelCase CLI options
- return a response payload with:

```ts
{
  task_id: string,
  task_status: AutomationResult["status"],
  site: string,
  collected_count: number,
  ingest_ids: string[],
  action_log: AutomationResult["action_log"],
  task: Record<string, unknown>,
  result: Record<string, unknown>
}
```

- [x] **Step 7: Verify focused tests pass**

Run:

```powershell
corepack pnpm vitest run packages/protocol/tests/protocol.test.ts apps/cli/tests/protocol-command.test.ts apps/cli/tests/cli-help.test.ts
```

Expected: PASS.

- [x] **Step 8: Update README protocol example**

Add a short `automation_search` protocol envelope example that uses fixture HTML and `protocol run`.

- [x] **Step 9: Verify all workspaces**

Run:

```powershell
corepack pnpm check
```

Expected: build and tests pass.

- [x] **Step 10: Commit and push**

```powershell
git add packages/protocol apps/cli README.md docs/superpowers/plans/2026-05-09-jobflow-protocol-automation-search.md
git commit -m "feat: add automation search protocol envelope"
git push origin main
```
