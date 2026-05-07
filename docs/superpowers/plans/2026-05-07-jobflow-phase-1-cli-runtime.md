# Jobflow Phase 1 CLI Runtime Implementation Plan

> 中文可读版在：`docs/superpowers/plans/2026-05-07-jobflow-phase-1-cli-runtime.zh.md`。
>
> 当前这份是偏“执行代理/工程细节”的详细计划，保留英文代码、命令、文件名和包名，方便后续直接照着实现。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first verifiable `jobflow` CLI runtime loop: ingest a job input, normalize it, score it, track pipeline state, and return next actions as stable JSON.

**Architecture:** Use a TypeScript pnpm workspace with a CLI app under `apps/cli` and shared packages under `packages/schema` and `packages/protocol`. The CLI owns local runtime behavior and file-backed state, while shared packages define stable domain objects and integration envelopes for future browser-extension and agent usage.

**Tech Stack:** TypeScript, Node.js, pnpm workspaces, commander, zod, vitest, tsx, tsup, Prettier.

---

## Current State

The repository currently contains design documents and empty module directories. It is not a git repository yet. Code directories contain only `.gitkeep` files.

Primary source docs:

- `README.md`
- `docs/design/2026-04-21-jobflow-foundation-design.md`
- `docs/design/2026-04-21-jobflow-state-and-schema-design.md`
- `docs/design/2026-04-21-jobflow-cli-and-integration-design.md`
- `docs/design/2026-04-21-jobflow-implementation-plan.md`

## Implementation Boundary

Build in this pass:

- pnpm monorepo scaffold
- shared schema package
- shared protocol package
- runnable CLI package
- file-backed local state
- commands: `ingest`, `normalize`, `score`, `pipeline list`, `pipeline get`, `pipeline update`, `next`
- stable JSON success/error output
- unit tests and one end-to-end CLI test

Keep out of this pass:

- browser extension UI
- platform-specific scraping
- auto-apply flows
- database or ORM abstraction
- conversational agent shell
- complex scoring or resume rewriting

## File Structure

Create or modify these files:

```text
jobflow/
  .gitignore
  .prettierrc.json
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  vitest.config.ts
  apps/
    cli/
      package.json
      tsconfig.json
      src/
        main.ts
        cli.ts
        commands/
          ingest.ts
          normalize.ts
          score.ts
          pipeline.ts
          next.ts
        runtime/
          ids.ts
          normalize.ts
          score.ts
          next.ts
          pipeline.ts
        state/
          fs-store.ts
          state-schema.ts
        output.ts
      tests/
        cli-help.test.ts
        ingest.test.ts
        normalize-score-next.test.ts
        pipeline.test.ts
  packages/
    schema/
      package.json
      tsconfig.json
      src/
        index.ts
      tests/
        schema.test.ts
    protocol/
      package.json
      tsconfig.json
      src/
        index.ts
      tests/
        protocol.test.ts
```

Responsibility map:

- `packages/schema/src/index.ts`: domain enums, zod schemas, inferred TypeScript types.
- `packages/protocol/src/index.ts`: versioned request/response envelopes and command names.
- `apps/cli/src/output.ts`: single JSON success/error response contract.
- `apps/cli/src/state/fs-store.ts`: all local JSON file persistence.
- `apps/cli/src/runtime/*.ts`: pure domain functions that are easy to test.
- `apps/cli/src/commands/*.ts`: commander command wiring and IO handling.
- `apps/cli/src/cli.ts`: CLI root and command registration.
- `apps/cli/src/main.ts`: executable entrypoint.

## Task 1: Workspace Scaffold

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.prettierrc.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize git repository**

Run:

```powershell
git init
```

Expected:

```text
Initialized empty Git repository
```

- [ ] **Step 2: Create root package files**

Create `package.json`:

```json
{
  "name": "jobflow",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "build": "pnpm -r build",
    "test": "vitest run",
    "format": "prettier --write .",
    "check": "pnpm build && pnpm test"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "prettier": "^3.4.2",
    "tsx": "^4.19.2",
    "tsup": "^8.3.5",
    "typescript": "^5.7.3",
    "vitest": "^2.1.8"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/*/tests/**/*.test.ts", "packages/*/tests/**/*.test.ts"],
    environment: "node"
  }
});
```

Create `.prettierrc.json`:

```json
{
  "printWidth": 100,
  "semi": true,
  "trailingComma": "none"
}
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.jobflow/
*.log
```

- [ ] **Step 3: Install dependencies**

Run:

```powershell
corepack enable
pnpm install
```

Expected:

```text
Done
```

- [ ] **Step 4: Verify empty workspace scripts**

Run:

```powershell
pnpm test
```

Expected:

```text
No test files found
```

`vitest` may exit non-zero when no tests exist. After Task 2, `pnpm test` must exit zero.

- [ ] **Step 5: Commit scaffold**

Run:

```powershell
git add .gitignore .prettierrc.json package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts pnpm-lock.yaml
git commit -m "chore: initialize TypeScript workspace"
```

## Task 2: Shared Schema Package

**Files:**

- Create: `packages/schema/package.json`
- Create: `packages/schema/tsconfig.json`
- Create: `packages/schema/src/index.ts`
- Create: `packages/schema/tests/schema.test.ts`

- [ ] **Step 1: Write schema tests**

Create `packages/schema/tests/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  jobIngestRecordSchema,
  jobRecordSchema,
  pipelineRecordSchema,
  scoreRecordSchema
} from "../src/index.js";

describe("jobflow schema", () => {
  it("accepts a minimal link ingest record", () => {
    const result = jobIngestRecordSchema.parse({
      ingest_id: "ingest_01",
      source_type: "link",
      captured_at: "2026-05-07T00:00:00.000Z",
      job_url: "https://example.com/job/1"
    });

    expect(result.source_type).toBe("link");
  });

  it("rejects an ingest record without any usable job evidence", () => {
    expect(() =>
      jobIngestRecordSchema.parse({
        ingest_id: "ingest_01",
        source_type: "manual",
        captured_at: "2026-05-07T00:00:00.000Z"
      })
    ).toThrow();
  });

  it("accepts the minimum normalized job", () => {
    const result = jobRecordSchema.parse({
      job_id: "job_01",
      title: "Backend Engineer",
      company_name: "Example Tech",
      created_at: "2026-05-07T00:00:00.000Z",
      normalized_at: "2026-05-07T00:00:00.000Z"
    });

    expect(result.title).toBe("Backend Engineer");
  });

  it("accepts a score record with stable action values", () => {
    const result = scoreRecordSchema.parse({
      score_id: "score_01",
      job_id: "job_01",
      score: 78,
      confidence: "medium",
      reasons: ["技术栈匹配"],
      risks: [],
      suggested_action: "review",
      scored_at: "2026-05-07T00:00:00.000Z"
    });

    expect(result.suggested_action).toBe("review");
  });

  it("accepts a pipeline record in saved state", () => {
    const result = pipelineRecordSchema.parse({
      job_id: "job_01",
      status: "saved",
      priority: "medium",
      updated_at: "2026-05-07T00:00:00.000Z"
    });

    expect(result.status).toBe("saved");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
pnpm test packages/schema/tests/schema.test.ts
```

Expected:

```text
Cannot find module '../src/index.js'
```

- [ ] **Step 3: Implement schema package**

Create `packages/schema/package.json`:

```json
{
  "name": "@jobflow/schema",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts"
  },
  "dependencies": {
    "zod": "^3.24.1"
  }
}
```

Create `packages/schema/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

Create `packages/schema/src/index.ts`:

```ts
import { z } from "zod";

export const isoDateTimeSchema = z.string().datetime();

export const sourceTypeSchema = z.enum(["extension", "link", "text", "file", "manual"]);
export const sourceSiteSchema = z.enum(["boss", "liepin", "lagou", "linkedin", "unknown"]);
export const confidenceSchema = z.enum(["low", "medium", "high"]);
export const suggestedActionSchema = z.enum(["ignore", "review", "prepare", "apply"]);
export const prioritySchema = z.enum(["low", "medium", "high"]);
export const pipelineStatusSchema = z.enum([
  "new",
  "saved",
  "reviewing",
  "ready",
  "applied",
  "follow_up",
  "closed"
]);
export const closedReasonSchema = z.enum([
  "not_fit",
  "duplicate",
  "expired",
  "applied_elsewhere",
  "manual_drop",
  "unknown"
]);
export const resumeSourceTypeSchema = z.enum(["file", "text", "generated"]);

const metadataSchema = z.record(z.unknown());

const jobIngestPayloadBaseSchema = z.object({
  source_type: sourceTypeSchema,
  source_site: sourceSiteSchema.optional(),
  captured_at: isoDateTimeSchema,
  job_url: z.string().url().optional(),
  page_url: z.string().url().optional(),
  title_hint: z.string().min(1).optional(),
  company_hint: z.string().min(1).optional(),
  raw_text: z.string().min(1).optional(),
  raw_html_excerpt: z.string().min(1).optional(),
  source_metadata: metadataSchema.optional()
});

function hasMinimumIngestEvidence(value: {
  job_url?: string;
  raw_text?: string;
  title_hint?: string;
  company_hint?: string;
}): boolean {
  return Boolean(value.job_url || value.raw_text || (value.title_hint && value.company_hint));
}

function addMinimumIngestEvidenceIssue(
  value: {
    job_url?: string;
    raw_text?: string;
    title_hint?: string;
    company_hint?: string;
  },
  ctx: z.RefinementCtx
): void {
  if (!hasMinimumIngestEvidence(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "ingest requires job_url, raw_text, or title_hint plus company_hint"
    });
  }
}

export const jobIngestPayloadSchema =
  jobIngestPayloadBaseSchema.superRefine(addMinimumIngestEvidenceIssue);

export const jobIngestRecordSchema = jobIngestPayloadBaseSchema
  .extend({
    ingest_id: z.string().min(1),
    job_id: z.string().min(1).optional()
  })
  .superRefine(addMinimumIngestEvidenceIssue);

export const jobRecordSchema = z.object({
  job_id: z.string().min(1),
  canonical_url: z.string().url().optional(),
  source_site: sourceSiteSchema.optional(),
  source_job_key: z.string().min(1).optional(),
  title: z.string().min(1),
  company_name: z.string().min(1),
  city: z.string().min(1).optional(),
  salary_text: z.string().min(1).optional(),
  experience_text: z.string().min(1).optional(),
  education_text: z.string().min(1).optional(),
  description_text: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).default([]),
  source_metadata: metadataSchema.optional(),
  created_at: isoDateTimeSchema,
  normalized_at: isoDateTimeSchema
});

export const scoreRecordSchema = z.object({
  score_id: z.string().min(1),
  job_id: z.string().min(1),
  resume_id: z.string().min(1).optional(),
  score: z.number().int().min(0).max(100),
  confidence: confidenceSchema,
  reasons: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  suggested_action: suggestedActionSchema,
  scoring_profile: metadataSchema.optional(),
  scored_at: isoDateTimeSchema
});

export const pipelineRecordSchema = z.object({
  job_id: z.string().min(1),
  status: pipelineStatusSchema,
  priority: prioritySchema.default("medium"),
  next_action: z.string().min(1).optional(),
  follow_up_at: isoDateTimeSchema.optional(),
  notes: z.string().optional(),
  resume_id: z.string().min(1).optional(),
  updated_at: isoDateTimeSchema,
  closed_reason: closedReasonSchema.optional()
});

export const resumeRecordSchema = z.object({
  resume_id: z.string().min(1),
  label: z.string().min(1),
  file_path: z.string().min(1).optional(),
  source_type: resumeSourceTypeSchema,
  is_default: z.boolean(),
  target_roles: z.array(z.string().min(1)).default([]),
  summary: z.string().optional(),
  updated_at: isoDateTimeSchema
});

export type SourceType = z.infer<typeof sourceTypeSchema>;
export type JobIngestPayload = z.infer<typeof jobIngestPayloadSchema>;
export type JobIngestRecord = z.infer<typeof jobIngestRecordSchema>;
export type JobRecord = z.infer<typeof jobRecordSchema>;
export type ScoreRecord = z.infer<typeof scoreRecordSchema>;
export type PipelineRecord = z.infer<typeof pipelineRecordSchema>;
export type ResumeRecord = z.infer<typeof resumeRecordSchema>;
```

- [ ] **Step 4: Run schema tests**

Run:

```powershell
pnpm test packages/schema/tests/schema.test.ts
```

Expected:

```text
5 passed
```

- [ ] **Step 5: Commit schema package**

Run:

```powershell
git add packages/schema package.json pnpm-lock.yaml
git commit -m "feat: add shared jobflow schemas"
```

## Task 3: Shared Protocol Package

**Files:**

- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/src/index.ts`
- Create: `packages/protocol/tests/protocol.test.ts`

- [ ] **Step 1: Write protocol tests**

Create `packages/protocol/tests/protocol.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ingestJobRequestEnvelopeSchema, responseEnvelopeSchema } from "../src/index.js";

describe("jobflow protocol", () => {
  it("accepts an ingest_job request envelope", () => {
    const result = ingestJobRequestEnvelopeSchema.parse({
      version: "1",
      type: "ingest_job",
      request_id: "req_01",
      sent_at: "2026-05-07T00:00:00.000Z",
      payload: {
        source_type: "extension",
        source_site: "boss",
        captured_at: "2026-05-07T00:00:00.000Z",
        job_url: "https://example.com/job/1"
      }
    });

    expect(result.type).toBe("ingest_job");
  });

  it("accepts a successful response envelope", () => {
    const result = responseEnvelopeSchema.parse({
      version: "1",
      type: "ingest_job_result",
      request_id: "req_01",
      ok: true,
      payload: {
        job_id: "job_01",
        ingest_id: "ingest_01",
        status: "accepted"
      },
      error: null
    });

    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
pnpm test packages/protocol/tests/protocol.test.ts
```

Expected:

```text
Cannot find module '../src/index.js'
```

- [ ] **Step 3: Implement protocol package**

Create `packages/protocol/package.json`:

```json
{
  "name": "@jobflow/protocol",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts"
  },
  "dependencies": {
    "@jobflow/schema": "workspace:*",
    "zod": "^3.24.1"
  }
}
```

Create `packages/protocol/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

Create `packages/protocol/src/index.ts`:

```ts
import { jobIngestPayloadSchema } from "@jobflow/schema";
import { z } from "zod";

export const protocolVersionSchema = z.literal("1");

export const commandRequestTypeSchema = z.enum(["ingest_job"]);
export const commandResponseTypeSchema = z.enum(["ingest_job_result"]);

export const protocolErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.unknown()).optional()
});

export const ingestJobRequestEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  type: z.literal("ingest_job"),
  request_id: z.string().min(1),
  sent_at: z.string().datetime(),
  payload: jobIngestPayloadSchema
});

export const responseEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  type: commandResponseTypeSchema,
  request_id: z.string().min(1),
  ok: z.boolean(),
  payload: z.record(z.unknown()).nullable(),
  error: protocolErrorSchema.nullable()
});

export type IngestJobRequestEnvelope = z.infer<typeof ingestJobRequestEnvelopeSchema>;
export type ResponseEnvelope = z.infer<typeof responseEnvelopeSchema>;
```

- [ ] **Step 4: Run protocol tests**

Run:

```powershell
pnpm test packages/protocol/tests/protocol.test.ts
```

Expected:

```text
2 passed
```

- [ ] **Step 5: Commit protocol package**

Run:

```powershell
git add packages/protocol package.json pnpm-lock.yaml
git commit -m "feat: add shared protocol envelopes"
```

## Task 4: CLI App Scaffold and JSON Output

**Files:**

- Create: `apps/cli/package.json`
- Create: `apps/cli/tsconfig.json`
- Create: `apps/cli/src/main.ts`
- Create: `apps/cli/src/cli.ts`
- Create: `apps/cli/src/output.ts`
- Create: `apps/cli/tests/cli-help.test.ts`

- [ ] **Step 1: Write CLI help test**

Create `apps/cli/tests/cli-help.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCli } from "../src/cli.js";

describe("jobflow cli", () => {
  it("prints help with core commands", () => {
    const program = createCli();
    const help = program.helpInformation();

    expect(help).toContain("ingest");
    expect(help).toContain("normalize");
    expect(help).toContain("score");
    expect(help).toContain("pipeline");
    expect(help).toContain("next");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
pnpm test apps/cli/tests/cli-help.test.ts
```

Expected:

```text
Cannot find module '../src/cli.js'
```

- [ ] **Step 3: Implement CLI scaffold**

Create `apps/cli/package.json`:

```json
{
  "name": "@jobflow/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "jobflow": "dist/main.js"
  },
  "scripts": {
    "build": "tsup src/main.ts --format esm --dts --banner:js \"#!/usr/bin/env node\"",
    "dev": "tsx src/main.ts"
  },
  "dependencies": {
    "@jobflow/protocol": "workspace:*",
    "@jobflow/schema": "workspace:*",
    "commander": "^12.1.0",
    "zod": "^3.24.1"
  }
}
```

Create `apps/cli/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

Create `apps/cli/src/output.ts`:

```ts
export type JsonError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type JsonResponse<T> =
  | {
      ok: true;
      command: string;
      data: T;
      warnings: string[];
      error: null;
    }
  | {
      ok: false;
      command: string;
      data: null;
      warnings: string[];
      error: JsonError;
    };

export function ok<T>(command: string, data: T, warnings: string[] = []): JsonResponse<T> {
  return { ok: true, command, data, warnings, error: null };
}

export function fail(command: string, error: JsonError, warnings: string[] = []): JsonResponse<never> {
  return { ok: false, command, data: null, warnings, error };
}

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
```

Create `apps/cli/src/cli.ts`:

```ts
import { Command } from "commander";

export function createCli(): Command {
  const program = new Command();

  program.name("jobflow").description("Personal job-search CLI runtime").version("0.1.0");

  program.command("ingest").description("accept raw job input");
  program.command("normalize").description("derive a normalized job record");
  program.command("score").description("score a normalized job");

  const pipeline = program.command("pipeline").description("manage job pipeline state");
  pipeline.command("list").description("list pipeline records");
  pipeline.command("get").description("get one pipeline record");
  pipeline.command("update").description("update one pipeline record");

  program.command("next").description("summarize recommended next actions");

  return program;
}
```

Create `apps/cli/src/main.ts`:

```ts
#!/usr/bin/env node
import { createCli } from "./cli.js";

await createCli().parseAsync(process.argv);
```

- [ ] **Step 4: Run CLI help test**

Run:

```powershell
pnpm test apps/cli/tests/cli-help.test.ts
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Run CLI help manually**

Run:

```powershell
pnpm --filter @jobflow/cli dev -- --help
```

Expected:

```text
Usage: jobflow [options] [command]
```

- [ ] **Step 6: Commit CLI scaffold**

Run:

```powershell
git add apps/cli package.json pnpm-lock.yaml
git commit -m "feat: scaffold jobflow CLI"
```

## Task 5: File-Backed State Store

**Files:**

- Create: `apps/cli/src/state/state-schema.ts`
- Create: `apps/cli/src/state/fs-store.ts`
- Create: `apps/cli/src/runtime/ids.ts`
- Create: `apps/cli/tests/state-store.test.ts`

- [ ] **Step 1: Write state store tests**

Create `apps/cli/tests/state-store.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFsStore } from "../src/state/fs-store.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "jobflow-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("fs store", () => {
  it("starts with empty collections", async () => {
    const store = createFsStore(dir);
    const state = await store.read();

    expect(state.ingests).toEqual([]);
    expect(state.jobs).toEqual([]);
    expect(state.scores).toEqual([]);
    expect(state.pipeline).toEqual([]);
    expect(state.resumes).toEqual([]);
  });

  it("persists state across store instances", async () => {
    const store = createFsStore(dir);
    const state = await store.read();
    state.ingests.push({
      ingest_id: "ingest_01",
      source_type: "text",
      captured_at: "2026-05-07T00:00:00.000Z",
      raw_text: "Backend Engineer at Example Tech"
    });
    await store.write(state);

    const reloaded = await createFsStore(dir).read();
    expect(reloaded.ingests).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
pnpm test apps/cli/tests/state-store.test.ts
```

Expected:

```text
Cannot find module '../src/state/fs-store.js'
```

- [ ] **Step 3: Implement state schema and store**

Create `apps/cli/src/state/state-schema.ts`:

```ts
import {
  jobIngestRecordSchema,
  jobRecordSchema,
  pipelineRecordSchema,
  resumeRecordSchema,
  scoreRecordSchema
} from "@jobflow/schema";
import { z } from "zod";

export const stateSchema = z.object({
  ingests: z.array(jobIngestRecordSchema),
  jobs: z.array(jobRecordSchema),
  scores: z.array(scoreRecordSchema),
  pipeline: z.array(pipelineRecordSchema),
  resumes: z.array(resumeRecordSchema)
});

export type JobflowState = z.infer<typeof stateSchema>;

export function createEmptyState(): JobflowState {
  return {
    ingests: [],
    jobs: [],
    scores: [],
    pipeline: [],
    resumes: []
  };
}
```

Create `apps/cli/src/state/fs-store.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createEmptyState, type JobflowState, stateSchema } from "./state-schema.js";

export type FsStore = {
  read(): Promise<JobflowState>;
  write(state: JobflowState): Promise<void>;
};

export function createFsStore(rootDir = ".jobflow"): FsStore {
  const statePath = join(rootDir, "state.json");

  return {
    async read() {
      try {
        const raw = await readFile(statePath, "utf8");
        return stateSchema.parse(JSON.parse(raw));
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return createEmptyState();
        }
        throw error;
      }
    },
    async write(state) {
      await mkdir(rootDir, { recursive: true });
      await writeFile(statePath, `${JSON.stringify(stateSchema.parse(state), null, 2)}\n`, "utf8");
    }
  };
}
```

Create `apps/cli/src/runtime/ids.ts`:

```ts
import { randomUUID } from "node:crypto";

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}
```

- [ ] **Step 4: Run state store tests**

Run:

```powershell
pnpm test apps/cli/tests/state-store.test.ts
```

Expected:

```text
2 passed
```

- [ ] **Step 5: Commit state store**

Run:

```powershell
git add apps/cli/src/state apps/cli/src/runtime/ids.ts apps/cli/tests/state-store.test.ts
git commit -m "feat: add file-backed state store"
```

## Task 6: Ingest Command

**Files:**

- Create: `apps/cli/src/commands/ingest.ts`
- Modify: `apps/cli/src/cli.ts`
- Create: `apps/cli/tests/ingest.test.ts`

- [ ] **Step 1: Write ingest tests**

Create `apps/cli/tests/ingest.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runIngest } from "../src/commands/ingest.js";
import { createFsStore } from "../src/state/fs-store.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "jobflow-ingest-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("ingest", () => {
  it("stores a link ingest record", async () => {
    const store = createFsStore(dir);
    const response = await runIngest(store, {
      source: "link",
      url: "https://example.com/job/1"
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.status).toBe("accepted");

    const state = await store.read();
    expect(state.ingests).toHaveLength(1);
  });

  it("returns stable error for invalid input", async () => {
    const response = await runIngest(createFsStore(dir), {
      source: "manual"
    });

    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.error.code).toBe("INVALID_INPUT");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
pnpm test apps/cli/tests/ingest.test.ts
```

Expected:

```text
Cannot find module '../src/commands/ingest.js'
```

- [ ] **Step 3: Implement ingest command logic**

Create `apps/cli/src/commands/ingest.ts`:

```ts
import { type JobIngestRecord, jobIngestRecordSchema, type SourceType } from "@jobflow/schema";
import { Command } from "commander";
import { z } from "zod";
import { createId } from "../runtime/ids.js";
import type { FsStore } from "../state/fs-store.js";
import { fail, ok, type JsonResponse, writeJson } from "../output.js";

const ingestOptionsSchema = z.object({
  source: z.enum(["extension", "link", "text", "file", "manual"]),
  url: z.string().url().optional(),
  text: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  company: z.string().min(1).optional()
});

type IngestOptions = z.infer<typeof ingestOptionsSchema>;

type IngestResult = {
  ingest_id: string;
  job_id: null;
  status: "accepted";
};

export async function runIngest(
  store: FsStore,
  rawOptions: unknown
): Promise<JsonResponse<IngestResult>> {
  const parsedOptions = ingestOptionsSchema.safeParse(rawOptions);
  if (!parsedOptions.success) {
    return fail("ingest", {
      code: "INVALID_INPUT",
      message: "invalid ingest options",
      details: parsedOptions.error.flatten()
    });
  }

  const options = parsedOptions.data;
  const record: JobIngestRecord = {
    ingest_id: createId("ingest"),
    source_type: options.source as SourceType,
    captured_at: new Date().toISOString(),
    job_url: options.url,
    raw_text: options.text,
    title_hint: options.title,
    company_hint: options.company
  };

  const parsedRecord = jobIngestRecordSchema.safeParse(record);
  if (!parsedRecord.success) {
    return fail("ingest", {
      code: "INVALID_INPUT",
      message: "ingest requires a URL, raw text, or title and company hints",
      details: parsedRecord.error.flatten()
    });
  }

  const state = await store.read();
  state.ingests.push(parsedRecord.data);
  await store.write(state);

  return ok("ingest", {
    ingest_id: parsedRecord.data.ingest_id,
    job_id: null,
    status: "accepted"
  });
}

export function registerIngestCommand(program: Command, store: FsStore): void {
  program
    .command("ingest")
    .description("accept raw job input")
    .requiredOption("--source <source>", "input source: extension, link, text, file, manual")
    .option("--url <url>", "job URL")
    .option("--text <text>", "raw job description text")
    .option("--title <title>", "title hint")
    .option("--company <company>", "company hint")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runIngest(store, options));
    });
}
```

Modify `apps/cli/src/cli.ts` so command registration uses the real ingest command:

```ts
import { Command } from "commander";
import { registerIngestCommand } from "./commands/ingest.js";
import { createFsStore } from "./state/fs-store.js";

export function createCli(): Command {
  const program = new Command();
  const store = createFsStore(process.env.JOBFLOW_HOME ?? ".jobflow");

  program.name("jobflow").description("Personal job-search CLI runtime").version("0.1.0");

  registerIngestCommand(program, store);
  program.command("normalize").description("derive a normalized job record");
  program.command("score").description("score a normalized job");

  const pipeline = program.command("pipeline").description("manage job pipeline state");
  pipeline.command("list").description("list pipeline records");
  pipeline.command("get").description("get one pipeline record");
  pipeline.command("update").description("update one pipeline record");

  program.command("next").description("summarize recommended next actions");

  return program;
}
```

- [ ] **Step 4: Run ingest tests**

Run:

```powershell
pnpm test apps/cli/tests/ingest.test.ts
```

Expected:

```text
2 passed
```

- [ ] **Step 5: Manually verify ingest command**

Run:

```powershell
$env:JOBFLOW_HOME="D:\tmp\jobflow-manual"; pnpm --filter @jobflow/cli dev -- ingest --source link --url "https://example.com/job/1" --json
```

Expected JSON fields:

```json
{
  "ok": true,
  "command": "ingest",
  "data": {
    "status": "accepted"
  },
  "error": null
}
```

- [ ] **Step 6: Commit ingest**

Run:

```powershell
git add apps/cli/src/commands/ingest.ts apps/cli/src/cli.ts apps/cli/tests/ingest.test.ts
git commit -m "feat: implement ingest command"
```

## Task 7: Normalize, Score, Pipeline, and Next Runtime

**Files:**

- Create: `apps/cli/src/runtime/normalize.ts`
- Create: `apps/cli/src/runtime/score.ts`
- Create: `apps/cli/src/runtime/pipeline.ts`
- Create: `apps/cli/src/runtime/next.ts`
- Create: `apps/cli/tests/normalize-score-next.test.ts`
- Create: `apps/cli/tests/pipeline.test.ts`

- [ ] **Step 1: Write runtime tests**

Create `apps/cli/tests/normalize-score-next.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeIngest } from "../src/runtime/normalize.js";
import { scoreJob } from "../src/runtime/score.js";
import { summarizeNext } from "../src/runtime/next.js";

describe("normalize, score, next runtime", () => {
  it("normalizes title and company hints", () => {
    const job = normalizeIngest(
      {
        ingest_id: "ingest_01",
        source_type: "manual",
        captured_at: "2026-05-07T00:00:00.000Z",
        title_hint: "Backend Engineer",
        company_hint: "Example Tech"
      },
      "job_01",
      "2026-05-07T00:00:00.000Z"
    );

    expect(job.title).toBe("Backend Engineer");
    expect(job.company_name).toBe("Example Tech");
  });

  it("scores a job with useful text signals", () => {
    const score = scoreJob(
      {
        job_id: "job_01",
        title: "TypeScript Backend Engineer",
        company_name: "Example Tech",
        description_text: "Node.js TypeScript backend role",
        tags: [],
        created_at: "2026-05-07T00:00:00.000Z",
        normalized_at: "2026-05-07T00:00:00.000Z"
      },
      "score_01",
      "2026-05-07T00:00:00.000Z"
    );

    expect(score.score).toBeGreaterThanOrEqual(60);
    expect(score.suggested_action).toBe("review");
  });

  it("summarizes open pipeline entries by priority and score", () => {
    const items = summarizeNext({
      jobs: [
        {
          job_id: "job_01",
          title: "Backend Engineer",
          company_name: "Example Tech",
          tags: [],
          created_at: "2026-05-07T00:00:00.000Z",
          normalized_at: "2026-05-07T00:00:00.000Z"
        }
      ],
      scores: [
        {
          score_id: "score_01",
          job_id: "job_01",
          score: 80,
          confidence: "medium",
          reasons: [],
          risks: [],
          suggested_action: "review",
          scored_at: "2026-05-07T00:00:00.000Z"
        }
      ],
      pipeline: [
        {
          job_id: "job_01",
          status: "saved",
          priority: "high",
          next_action: "review JD",
          updated_at: "2026-05-07T00:00:00.000Z"
        }
      ]
    });

    expect(items[0]?.job_id).toBe("job_01");
  });
});
```

Create `apps/cli/tests/pipeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canTransitionPipelineStatus } from "../src/runtime/pipeline.js";

describe("pipeline transitions", () => {
  it("allows saved to reviewing", () => {
    expect(canTransitionPipelineStatus("saved", "reviewing")).toBe(true);
  });

  it("does not allow saved to applied", () => {
    expect(canTransitionPipelineStatus("saved", "applied")).toBe(false);
  });

  it("allows closed to reviewing for manual reopen", () => {
    expect(canTransitionPipelineStatus("closed", "reviewing")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
pnpm test apps/cli/tests/normalize-score-next.test.ts apps/cli/tests/pipeline.test.ts
```

Expected:

```text
Cannot find module
```

- [ ] **Step 3: Implement runtime modules**

Create `apps/cli/src/runtime/normalize.ts`:

```ts
import type { JobIngestRecord, JobRecord } from "@jobflow/schema";

export function normalizeIngest(
  ingest: JobIngestRecord,
  jobId: string,
  now: string
): JobRecord {
  const rawText = ingest.raw_text ?? "";
  const title = ingest.title_hint ?? firstNonEmptyLine(rawText) ?? "Untitled job";
  const companyName = ingest.company_hint ?? "Unknown company";

  return {
    job_id: jobId,
    canonical_url: ingest.job_url,
    source_site: ingest.source_site,
    title,
    company_name: companyName,
    description_text: ingest.raw_text,
    tags: [],
    source_metadata: ingest.source_metadata,
    created_at: now,
    normalized_at: now
  };
}

function firstNonEmptyLine(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}
```

Create `apps/cli/src/runtime/score.ts`:

```ts
import type { JobRecord, ScoreRecord } from "@jobflow/schema";

export function scoreJob(job: JobRecord, scoreId: string, now: string): ScoreRecord {
  const text = `${job.title} ${job.description_text ?? ""} ${job.tags.join(" ")}`.toLowerCase();
  const reasons: string[] = [];
  const risks: string[] = [];
  let score = 50;

  for (const keyword of ["typescript", "node", "backend", "后端", "远程", "remote"]) {
    if (text.includes(keyword.toLowerCase())) {
      score += 8;
      reasons.push(`matched keyword: ${keyword}`);
    }
  }

  if (!job.description_text) {
    score -= 10;
    risks.push("missing job description");
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const suggested_action = boundedScore >= 80 ? "prepare" : boundedScore >= 55 ? "review" : "ignore";

  return {
    score_id: scoreId,
    job_id: job.job_id,
    score: boundedScore,
    confidence: job.description_text ? "medium" : "low",
    reasons,
    risks,
    suggested_action,
    scored_at: now
  };
}
```

Create `apps/cli/src/runtime/pipeline.ts`:

```ts
import type { PipelineRecord } from "@jobflow/schema";

const allowedTransitions: Record<PipelineRecord["status"], PipelineRecord["status"][]> = {
  new: ["saved", "reviewing"],
  saved: ["reviewing"],
  reviewing: ["ready", "closed", "saved"],
  ready: ["applied", "closed", "reviewing"],
  applied: ["follow_up", "closed"],
  follow_up: ["closed"],
  closed: ["reviewing"]
};

export function canTransitionPipelineStatus(
  from: PipelineRecord["status"],
  to: PipelineRecord["status"]
): boolean {
  return from === to || allowedTransitions[from].includes(to);
}
```

Create `apps/cli/src/runtime/next.ts`:

```ts
import type { JobRecord, PipelineRecord, ScoreRecord } from "@jobflow/schema";

export type NextInput = {
  jobs: JobRecord[];
  scores: ScoreRecord[];
  pipeline: PipelineRecord[];
};

export type NextItem = {
  job_id: string;
  title: string;
  company_name: string;
  recommended_action: string;
  priority: PipelineRecord["priority"];
  score: number | null;
};

const priorityRank: Record<PipelineRecord["priority"], number> = {
  high: 3,
  medium: 2,
  low: 1
};

export function summarizeNext(input: NextInput): NextItem[] {
  return input.pipeline
    .filter((entry) => entry.status !== "closed")
    .map((entry) => {
      const job = input.jobs.find((candidate) => candidate.job_id === entry.job_id);
      const score = latestScore(input.scores, entry.job_id);

      if (!job) return null;

      return {
        job_id: job.job_id,
        title: job.title,
        company_name: job.company_name,
        recommended_action: entry.next_action ?? score?.suggested_action ?? "review",
        priority: entry.priority,
        score: score?.score ?? null
      };
    })
    .filter((item): item is NextItem => item !== null)
    .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority] || (b.score ?? 0) - (a.score ?? 0));
}

function latestScore(scores: ScoreRecord[], jobId: string): ScoreRecord | undefined {
  return scores
    .filter((score) => score.job_id === jobId)
    .sort((a, b) => b.scored_at.localeCompare(a.scored_at))[0];
}
```

- [ ] **Step 4: Run runtime tests**

Run:

```powershell
pnpm test apps/cli/tests/normalize-score-next.test.ts apps/cli/tests/pipeline.test.ts
```

Expected:

```text
6 passed
```

- [ ] **Step 5: Commit runtime logic**

Run:

```powershell
git add apps/cli/src/runtime apps/cli/tests/normalize-score-next.test.ts apps/cli/tests/pipeline.test.ts
git commit -m "feat: add core jobflow runtime logic"
```

## Task 8: Wire Normalize, Score, Pipeline, and Next Commands

**Files:**

- Create: `apps/cli/src/commands/normalize.ts`
- Create: `apps/cli/src/commands/score.ts`
- Create: `apps/cli/src/commands/pipeline.ts`
- Create: `apps/cli/src/commands/next.ts`
- Modify: `apps/cli/src/cli.ts`
- Create: `apps/cli/tests/e2e.test.ts`

- [ ] **Step 1: Write end-to-end CLI-level test**

Create `apps/cli/tests/e2e.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runIngest } from "../src/commands/ingest.js";
import { runNext } from "../src/commands/next.js";
import { runNormalize } from "../src/commands/normalize.js";
import { runPipelineUpdate } from "../src/commands/pipeline.js";
import { runScore } from "../src/commands/score.js";
import { createFsStore } from "../src/state/fs-store.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "jobflow-e2e-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("jobflow first phase loop", () => {
  it("runs ingest to next", async () => {
    const store = createFsStore(dir);

    const ingest = await runIngest(store, {
      source: "text",
      text: "TypeScript Backend Engineer\nExample Tech\nNode.js backend role",
      title: "TypeScript Backend Engineer",
      company: "Example Tech"
    });
    expect(ingest.ok).toBe(true);
    if (!ingest.ok) return;

    const normalized = await runNormalize(store, { ingestId: ingest.data.ingest_id });
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;

    const scored = await runScore(store, { jobId: normalized.data.job.job_id });
    expect(scored.ok).toBe(true);

    const updated = await runPipelineUpdate(store, {
      jobId: normalized.data.job.job_id,
      status: "reviewing",
      priority: "high",
      nextAction: "review and tailor resume"
    });
    expect(updated.ok).toBe(true);

    const next = await runNext(store);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.data.items[0]?.recommended_action).toBe("review and tailor resume");
  });
});
```

- [ ] **Step 2: Run e2e test to verify failure**

Run:

```powershell
pnpm test apps/cli/tests/e2e.test.ts
```

Expected:

```text
Cannot find module '../src/commands/next.js'
```

- [ ] **Step 3: Implement command modules**

Create `apps/cli/src/commands/normalize.ts`:

```ts
import type { JobRecord, PipelineRecord } from "@jobflow/schema";
import { Command } from "commander";
import { createId } from "../runtime/ids.js";
import { normalizeIngest } from "../runtime/normalize.js";
import { fail, ok, type JsonResponse, writeJson } from "../output.js";
import type { FsStore } from "../state/fs-store.js";

type NormalizeOptions = {
  ingestId: string;
};

export async function runNormalize(
  store: FsStore,
  options: NormalizeOptions
): Promise<JsonResponse<{ job: JobRecord }>> {
  const state = await store.read();
  const ingestIndex = state.ingests.findIndex((ingest) => ingest.ingest_id === options.ingestId);

  if (ingestIndex === -1) {
    return fail("normalize", {
      code: "NOT_FOUND",
      message: `ingest not found: ${options.ingestId}`
    });
  }

  const ingest = state.ingests[ingestIndex];
  const existingJob = ingest.job_id
    ? state.jobs.find((job) => job.job_id === ingest.job_id)
    : findDuplicateJob(state.jobs, ingest.job_url);

  if (existingJob) {
    state.ingests[ingestIndex] = { ...ingest, job_id: existingJob.job_id };
    await store.write(state);
    return ok("normalize", { job: existingJob }, ["reused existing job"]);
  }

  const now = new Date().toISOString();
  const job = normalizeIngest(ingest, createId("job"), now);
  state.jobs.push(job);
  state.ingests[ingestIndex] = { ...ingest, job_id: job.job_id };

  if (!state.pipeline.some((entry) => entry.job_id === job.job_id)) {
    state.pipeline.push(createInitialPipeline(job.job_id, now));
  }

  await store.write(state);
  return ok("normalize", { job });
}

function findDuplicateJob(jobs: JobRecord[], jobUrl: string | undefined): JobRecord | undefined {
  if (!jobUrl) return undefined;
  return jobs.find((job) => job.canonical_url === jobUrl);
}

function createInitialPipeline(jobId: string, now: string): PipelineRecord {
  return {
    job_id: jobId,
    status: "new",
    priority: "medium",
    updated_at: now
  };
}

export function registerNormalizeCommand(program: Command, store: FsStore): void {
  program
    .command("normalize")
    .description("derive a normalized job record")
    .requiredOption("--ingest-id <ingestId>", "ingest record ID")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runNormalize(store, options));
    });
}
```

Create `apps/cli/src/commands/score.ts`:

```ts
import type { ScoreRecord } from "@jobflow/schema";
import { Command } from "commander";
import { createId } from "../runtime/ids.js";
import { scoreJob } from "../runtime/score.js";
import { fail, ok, type JsonResponse, writeJson } from "../output.js";
import type { FsStore } from "../state/fs-store.js";

type ScoreOptions = {
  jobId: string;
};

export async function runScore(
  store: FsStore,
  options: ScoreOptions
): Promise<JsonResponse<{ score: ScoreRecord }>> {
  const state = await store.read();
  const job = state.jobs.find((candidate) => candidate.job_id === options.jobId);

  if (!job) {
    return fail("score", {
      code: "NOT_FOUND",
      message: `job not found: ${options.jobId}`
    });
  }

  const score = scoreJob(job, createId("score"), new Date().toISOString());
  state.scores.push(score);
  await store.write(state);

  return ok("score", { score });
}

export function registerScoreCommand(program: Command, store: FsStore): void {
  program
    .command("score")
    .description("score a normalized job")
    .requiredOption("--job-id <jobId>", "job ID")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runScore(store, options));
    });
}
```

Create `apps/cli/src/commands/pipeline.ts`:

```ts
import {
  type PipelineRecord,
  pipelineStatusSchema,
  prioritySchema
} from "@jobflow/schema";
import { Command } from "commander";
import { canTransitionPipelineStatus } from "../runtime/pipeline.js";
import { fail, ok, type JsonResponse, writeJson } from "../output.js";
import type { FsStore } from "../state/fs-store.js";

type PipelineUpdateOptions = {
  jobId: string;
  status: PipelineRecord["status"];
  priority?: PipelineRecord["priority"];
  nextAction?: string;
};

export async function runPipelineUpdate(
  store: FsStore,
  options: PipelineUpdateOptions
): Promise<JsonResponse<{ pipeline: PipelineRecord }>> {
  const parsedStatus = pipelineStatusSchema.safeParse(options.status);
  const parsedPriority = options.priority ? prioritySchema.safeParse(options.priority) : undefined;

  if (!parsedStatus.success || parsedPriority?.success === false) {
    return fail("pipeline.update", {
      code: "INVALID_INPUT",
      message: "invalid pipeline status or priority"
    });
  }

  const state = await store.read();
  const job = state.jobs.find((candidate) => candidate.job_id === options.jobId);

  if (!job) {
    return fail("pipeline.update", {
      code: "NOT_FOUND",
      message: `job not found: ${options.jobId}`
    });
  }

  const existingIndex = state.pipeline.findIndex((entry) => entry.job_id === options.jobId);
  const existing = existingIndex >= 0 ? state.pipeline[existingIndex] : undefined;

  if (existing && !canTransitionPipelineStatus(existing.status, parsedStatus.data)) {
    return fail("pipeline.update", {
      code: "PIPELINE_UPDATE_FAILED",
      message: `cannot transition pipeline from ${existing.status} to ${parsedStatus.data}`
    });
  }

  const updated: PipelineRecord = {
    job_id: options.jobId,
    status: parsedStatus.data,
    priority: parsedPriority?.success ? parsedPriority.data : existing?.priority ?? "medium",
    next_action: options.nextAction ?? existing?.next_action,
    follow_up_at: existing?.follow_up_at,
    notes: existing?.notes,
    resume_id: existing?.resume_id,
    updated_at: new Date().toISOString(),
    closed_reason: existing?.closed_reason
  };

  if (existingIndex >= 0) {
    state.pipeline[existingIndex] = updated;
  } else {
    state.pipeline.push(updated);
  }

  await store.write(state);
  return ok("pipeline.update", { pipeline: updated });
}

export function registerPipelineCommand(program: Command, store: FsStore): void {
  const pipeline = program.command("pipeline").description("manage job pipeline state");

  pipeline
    .command("list")
    .description("list pipeline records")
    .option("--json", "emit JSON output", true)
    .action(async () => {
      const state = await store.read();
      writeJson(ok("pipeline.list", { items: state.pipeline }));
    });

  pipeline
    .command("get")
    .description("get one pipeline record")
    .requiredOption("--job-id <jobId>", "job ID")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      const state = await store.read();
      const pipelineRecord = state.pipeline.find((entry) => entry.job_id === options.jobId);
      writeJson(
        pipelineRecord
          ? ok("pipeline.get", { pipeline: pipelineRecord })
          : fail("pipeline.get", {
              code: "NOT_FOUND",
              message: `pipeline record not found: ${options.jobId}`
            })
      );
    });

  pipeline
    .command("update")
    .description("update one pipeline record")
    .requiredOption("--job-id <jobId>", "job ID")
    .requiredOption("--status <status>", "new, saved, reviewing, ready, applied, follow_up, closed")
    .option("--priority <priority>", "low, medium, high")
    .option("--next-action <nextAction>", "next action text")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runPipelineUpdate(store, options));
    });
}
```

Create `apps/cli/src/commands/next.ts`:

```ts
import { Command } from "commander";
import { summarizeNext, type NextItem } from "../runtime/next.js";
import { ok, type JsonResponse, writeJson } from "../output.js";
import type { FsStore } from "../state/fs-store.js";

export async function runNext(store: FsStore): Promise<JsonResponse<{ items: NextItem[] }>> {
  const state = await store.read();
  return ok("next", {
    items: summarizeNext({
      jobs: state.jobs,
      scores: state.scores,
      pipeline: state.pipeline
    })
  });
}

export function registerNextCommand(program: Command, store: FsStore): void {
  program
    .command("next")
    .description("summarize recommended next actions")
    .option("--json", "emit JSON output", true)
    .action(async () => {
      writeJson(await runNext(store));
    });
}
```

- [ ] **Step 4: Register all commands in CLI root**

Modify `apps/cli/src/cli.ts`:

```ts
import { Command } from "commander";
import { registerIngestCommand } from "./commands/ingest.js";
import { registerNextCommand } from "./commands/next.js";
import { registerNormalizeCommand } from "./commands/normalize.js";
import { registerPipelineCommand } from "./commands/pipeline.js";
import { registerScoreCommand } from "./commands/score.js";
import { createFsStore } from "./state/fs-store.js";

export function createCli(): Command {
  const program = new Command();
  const store = createFsStore(process.env.JOBFLOW_HOME ?? ".jobflow");

  program.name("jobflow").description("Personal job-search CLI runtime").version("0.1.0");

  registerIngestCommand(program, store);
  registerNormalizeCommand(program, store);
  registerScoreCommand(program, store);
  registerPipelineCommand(program, store);
  registerNextCommand(program, store);

  return program;
}
```

- [ ] **Step 5: Run command tests**

Run:

```powershell
pnpm test apps/cli/tests/e2e.test.ts apps/cli/tests/cli-help.test.ts
```

Expected:

```text
2 passed
```

- [ ] **Step 6: Run full verification**

Run:

```powershell
pnpm check
```

Expected:

```text
All tests pass
```

- [ ] **Step 7: Commit wired commands**

Run:

```powershell
git add apps/cli/src/commands apps/cli/src/cli.ts apps/cli/tests/e2e.test.ts
git commit -m "feat: wire first phase CLI commands"
```

## Task 9: Manual End-to-End Smoke Test

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Add first-run instructions to README**

Append this section to `README.md`:

````md
## First Phase Smoke Test

```powershell
pnpm install
$env:JOBFLOW_HOME="D:\tmp\jobflow-smoke"
pnpm --filter @jobflow/cli dev -- ingest --source text --title "TypeScript Backend Engineer" --company "Example Tech" --text "Node.js TypeScript backend role" --json
pnpm --filter @jobflow/cli dev -- normalize --ingest-id "<ingest_id>" --json
pnpm --filter @jobflow/cli dev -- score --job-id "<job_id>" --json
pnpm --filter @jobflow/cli dev -- pipeline update --job-id "<job_id>" --status reviewing --priority high --next-action "review and tailor resume" --json
pnpm --filter @jobflow/cli dev -- next --json
```
````

- [ ] **Step 2: Run the smoke test**

Run the commands from the README with real IDs returned by earlier commands.

Expected final `next` output:

```json
{
  "ok": true,
  "command": "next",
  "data": {
    "items": [
      {
        "recommended_action": "review and tailor resume",
        "priority": "high"
      }
    ]
  },
  "error": null
}
```

- [ ] **Step 3: Commit README smoke test**

Run:

```powershell
git add README.md
git commit -m "docs: add first phase smoke test"
```

## Self-Review Checklist

- [ ] Product boundary is covered: CLI runtime first, browser extension deferred to protocol compatibility.
- [ ] State model is covered: ingests, jobs, scores, pipeline, resumes exist in local state.
- [ ] Core commands are covered: ingest, normalize, score, pipeline, next.
- [ ] JSON response shape is centralized through `output.ts`.
- [ ] Tests start with failing imports before implementation steps.
- [ ] Manual smoke test validates the full first-phase loop.
- [ ] No browser scraping, auto-apply, database abstraction, or web UI is introduced.

## Execution Handoff

Recommended execution mode: Inline Execution in this session, because the repository is tiny and tasks depend on sequential scaffolding. Subagent-driven execution becomes useful after the workspace exists and command modules can be split safely.
