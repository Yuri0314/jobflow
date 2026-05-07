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
- protocol envelope ingestion, normalization, and scoring for external capture tools

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
