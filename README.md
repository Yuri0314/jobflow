# jobflow

`jobflow` is a personal job-search runtime designed around a CLI core.

The first stage of the project focuses on:

- a CLI runtime that manages job intake, normalization, scoring, and pipeline state
- a browser extension that captures page context and forwards structured input to the CLI
- shared schemas and protocols that let external agents invoke `jobflow` capabilities

The first stage explicitly does not include:

- a standalone web frontend/backend system
- platform auto-apply flows
- deep anti-bot automation against recruiting platforms
- a general-purpose agent shell competing with Claude Code or OpenAI agents

## Repository Layout

```text
jobflow/
  apps/
    cli/
    browser-extension/
  packages/
    schema/
    protocol/
    browser-automation/
  docs/
    design/
  scripts/
```

## Status

This repository currently contains the first CLI runtime slice:

- raw job ingest
- simple normalization and scoring
- pipeline and next-action state
- resume references
- state inspection and export
- protocol envelope ingestion, normalization, scoring, next-action reads, pipeline updates, and fixture automation search for external tools
- experimental fixture automation search that collects local fixture results into ingests

## Long-Term Direction

The first stage is CLI-first, but the long-term direction is broader: `jobflow`
should become a local-first job-search automation runtime that can be used from
both a future desktop workbench and external AI agents through CLI/protocol
entry points.

See `docs/design/2026-05-09-jobflow-runtime-and-automation-roadmap.md` for the
current roadmap covering shared runtime extraction, desktop usage, agent/skill
integration, browser automation, and staged apply automation.

## First Phase Smoke Test

```powershell
corepack pnpm install
$env:JOBFLOW_HOME="D:\tmp\jobflow-smoke"
corepack pnpm --filter @jobflow/cli dev ingest --source text --title "TypeScript Backend Engineer" --company "Example Tech" --text "Node.js TypeScript backend role" --json
corepack pnpm --filter @jobflow/cli dev normalize --ingest-id "<ingest_id>" --json
corepack pnpm --filter @jobflow/cli dev score --job-id "<job_id>" --json
corepack pnpm --filter @jobflow/cli dev pipeline update --job-id "<job_id>" --status reviewing --priority high --next-action "review and tailor resume" --json
corepack pnpm --filter @jobflow/cli dev next --json
```

## Resume Reference Smoke Test

```powershell
$env:JOBFLOW_HOME="D:\tmp\jobflow-smoke"
corepack pnpm --filter @jobflow/cli dev resume add --label "Backend Resume" --source-type file --file-path "D:\resumes\backend.pdf" --target-roles "backend,typescript" --default --json
corepack pnpm --filter @jobflow/cli dev resume list --json
corepack pnpm --filter @jobflow/cli dev resume set-default --resume-id "<resume_id>" --json
```

## State Inspection Smoke Test

```powershell
$env:JOBFLOW_HOME="D:\tmp\jobflow-smoke"
corepack pnpm --filter @jobflow/cli dev state inspect --json
corepack pnpm --filter @jobflow/cli dev state export --output "D:\tmp\jobflow-smoke-state.json" --json
```

## Browser Automation Fixture Smoke Test

This verifies the CLI-to-automation path without launching a real browser or touching a real
recruiting site. The command generates a local fixture result, parses it through
`@jobflow/browser-automation`, stores the collected job as an ingest, and writes
an automation task audit record into local state.

```powershell
$env:JOBFLOW_HOME="D:\tmp\jobflow-automation-smoke"
corepack pnpm --filter @jobflow/cli dev automation search --site fixture --keyword "TypeScript" --limit 1 --json
corepack pnpm --filter @jobflow/cli dev automation tasks --limit 1 --status completed --json
corepack pnpm --filter @jobflow/cli dev state inspect --json
```

For local fixture-page smoke tests, pass `--fixture-url <url>` to make the automation
controller open that page before parsing results.

To inspect one recorded automation task, copy a `task_id` from the list output:

```powershell
corepack pnpm --filter @jobflow/cli dev automation task --task-id "<task_id>" --json
```

To verify the same controller through a real Chromium/Edge DevTools session, run:

```powershell
corepack pnpm --filter @jobflow/browser-automation smoke:fixture-browser
```

The CLI can also use the Chromium session for local fixture URLs:

```powershell
corepack pnpm --filter @jobflow/cli dev automation search --site fixture --keyword "TypeScript" --fixture-url "<local-fixture-url>" --session chromium --json
```

## Generic Protocol Smoke Test

```powershell
$env:JOBFLOW_HOME="D:\tmp\jobflow-smoke"
@'
{
  "version": "1",
  "type": "ingest_job",
  "request_id": "req_smoke_run_01",
  "sent_at": "2026-05-07T00:00:00.000Z",
  "payload": {
    "source_type": "extension",
    "captured_at": "2026-05-07T00:00:00.000Z",
    "title_hint": "TypeScript Backend Engineer",
    "company_hint": "Example Tech"
  }
}
'@ | Set-Content -Path "D:\tmp\jobflow-protocol-envelope.json"
corepack pnpm --filter @jobflow/cli dev protocol run --input "D:\tmp\jobflow-protocol-envelope.json" --json
```

## Protocol Automation Search Smoke Test

External agents can trigger the fixture automation search through the generic protocol
runner. This keeps the agent-facing contract JSON-based while reusing the same automation
controller and local state write path as the direct CLI command. The run stores both
collected ingests and an `automation_tasks` audit record.

```powershell
$env:JOBFLOW_HOME="D:\tmp\jobflow-protocol-automation-smoke"
@'
{
  "version": "1",
  "type": "automation_search",
  "request_id": "req_automation_smoke_01",
  "sent_at": "2026-05-09T00:00:00.000Z",
  "payload": {
    "site": "fixture",
    "keyword": "TypeScript",
    "limit": 1,
    "session": "fetch",
    "fixture_html": "<main><article data-job-card data-url=\"https://example.test/jobs/protocol-smoke\"><h2 data-job-title>Protocol Automation Engineer</h2><p data-company>Example Automation Co</p><p data-summary>Collect fixture results through protocol run.</p></article></main>"
  }
}
'@ | Set-Content -Path "D:\tmp\jobflow-automation-envelope.json"
corepack pnpm --filter @jobflow/cli dev protocol run --input "D:\tmp\jobflow-automation-envelope.json" --json
@'
{
  "version": "1",
  "type": "get_automation_tasks",
  "request_id": "req_automation_tasks_01",
  "sent_at": "2026-05-09T00:01:00.000Z",
  "payload": {
    "limit": 1,
    "status": "completed"
  }
}
'@ | Set-Content -Path "D:\tmp\jobflow-automation-tasks-envelope.json"
corepack pnpm --filter @jobflow/cli dev protocol run --input "D:\tmp\jobflow-automation-tasks-envelope.json" --json
corepack pnpm --filter @jobflow/cli dev state inspect --json
```

## Browser Extension Capture Smoke Test

The browser extension is the first external capture entry. It does not call the local CLI
directly yet; it captures the active job page and produces an `ingest_job` protocol envelope
that can be copied or downloaded.

```powershell
corepack pnpm --filter @jobflow/browser-extension build
```

Then load `apps/browser-extension/dist` as an unpacked extension in Chromium-based browsers.
Open a job page, select the useful job description text if needed, click `Capture`, and either
copy or download the generated JSON.

To verify the extension capture path without manual clicking, run the headed E2E smoke test:

```powershell
corepack pnpm --filter @jobflow/browser-extension smoke:e2e
```

The smoke test opens a temporary Chromium-based browser profile, loads the unpacked extension,
visits a local fixture job page, asks the extension background worker to capture the active tab,
and verifies that an `ingest_job` envelope was produced. It prefers Microsoft Edge on Windows
because this environment's Chrome ignores the extension isolation flag; set `EDGE_PATH` or
`CHROME_PATH` to override the browser executable.

Feed the downloaded envelope into the CLI:

```powershell
$env:JOBFLOW_HOME="D:\tmp\jobflow-smoke"
corepack pnpm --filter @jobflow/cli dev protocol run --input "<downloaded-envelope.json>" --json
```

## Protocol Ingest Smoke Test

```powershell
$env:JOBFLOW_HOME="D:\tmp\jobflow-smoke"
@'
{
  "version": "1",
  "type": "ingest_job",
  "request_id": "req_smoke_01",
  "sent_at": "2026-05-07T00:00:00.000Z",
  "payload": {
    "source_type": "extension",
    "source_site": "boss",
    "captured_at": "2026-05-07T00:00:00.000Z",
    "job_url": "https://example.com/job/1",
    "title_hint": "TypeScript Backend Engineer",
    "company_hint": "Example Tech"
  }
}
'@ | Set-Content -Path "D:\tmp\jobflow-ingest-envelope.json"
corepack pnpm --filter @jobflow/cli dev protocol ingest-job --input "D:\tmp\jobflow-ingest-envelope.json" --json
corepack pnpm --filter @jobflow/cli dev state inspect --json
```

## Protocol Normalize Smoke Test

```powershell
$env:JOBFLOW_HOME="D:\tmp\jobflow-smoke"
@'
{
  "version": "1",
  "type": "normalize_job",
  "request_id": "req_smoke_02",
  "sent_at": "2026-05-07T00:01:00.000Z",
  "payload": {
    "ingest_id": "<ingest_id>"
  }
}
'@ | Set-Content -Path "D:\tmp\jobflow-normalize-envelope.json"
corepack pnpm --filter @jobflow/cli dev protocol normalize-job --input "D:\tmp\jobflow-normalize-envelope.json" --json
corepack pnpm --filter @jobflow/cli dev state inspect --json
```

## Protocol Score Smoke Test

```powershell
$env:JOBFLOW_HOME="D:\tmp\jobflow-smoke"
@'
{
  "version": "1",
  "type": "score_job",
  "request_id": "req_smoke_03",
  "sent_at": "2026-05-07T00:02:00.000Z",
  "payload": {
    "job_id": "<job_id>"
  }
}
'@ | Set-Content -Path "D:\tmp\jobflow-score-envelope.json"
corepack pnpm --filter @jobflow/cli dev protocol score-job --input "D:\tmp\jobflow-score-envelope.json" --json
corepack pnpm --filter @jobflow/cli dev state inspect --json
```

## Protocol Next Actions Smoke Test

```powershell
$env:JOBFLOW_HOME="D:\tmp\jobflow-smoke"
@'
{
  "version": "1",
  "type": "get_next_actions",
  "request_id": "req_smoke_04",
  "sent_at": "2026-05-07T00:03:00.000Z",
  "payload": {
    "limit": 5
  }
}
'@ | Set-Content -Path "D:\tmp\jobflow-next-actions-envelope.json"
corepack pnpm --filter @jobflow/cli dev protocol get-next-actions --input "D:\tmp\jobflow-next-actions-envelope.json" --json
corepack pnpm --filter @jobflow/cli dev state inspect --json
```

## Protocol Pipeline Update Smoke Test

```powershell
$env:JOBFLOW_HOME="D:\tmp\jobflow-smoke"
@'
{
  "version": "1",
  "type": "update_pipeline",
  "request_id": "req_smoke_05",
  "sent_at": "2026-05-07T00:04:00.000Z",
  "payload": {
    "job_id": "<job_id>",
    "status": "reviewing",
    "priority": "high",
    "next_action": "review and tailor resume"
  }
}
'@ | Set-Content -Path "D:\tmp\jobflow-update-pipeline-envelope.json"
corepack pnpm --filter @jobflow/cli dev protocol update-pipeline --input "D:\tmp\jobflow-update-pipeline-envelope.json" --json
corepack pnpm --filter @jobflow/cli dev state inspect --json
```
