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

This repository currently contains the initial design documentation and project skeleton.

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
