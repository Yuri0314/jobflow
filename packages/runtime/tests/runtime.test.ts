import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canTransitionPipelineStatus,
  createAutomationSearchPersistence,
  createFsStore,
  getAutomationTask,
  listAutomationSites,
  listAutomationTasks,
  normalizeIngest,
  scoreJob,
  stateSchema,
  summarizeNext
} from "../src/index.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "jobflow-runtime-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runtime package", () => {
  it("exposes reusable state storage for non-CLI entry points", async () => {
    const store = createFsStore(dir);
    const state = await store.read();

    expect(state.ingests).toEqual([]);
    expect(state.jobs).toEqual([]);
    expect(state.scores).toEqual([]);
    expect(state.pipeline).toEqual([]);
    expect(state.resumes).toEqual([]);
    expect(state.automation_tasks).toEqual([]);
  });

  it("loads legacy state without automation task records", () => {
    const legacy = stateSchema.parse({
      ingests: [],
      jobs: [],
      scores: [],
      pipeline: [],
      resumes: []
    });

    expect(legacy.automation_tasks).toEqual([]);
  });

  it("exposes normalized job, scoring, pipeline, and next-action primitives", () => {
    const now = "2026-05-09T00:00:00.000Z";
    const job = normalizeIngest(
      {
        ingest_id: "ingest_01",
        source_type: "manual",
        captured_at: now,
        title_hint: "TypeScript Backend Engineer",
        company_hint: "Example Tech",
        raw_text: "Node.js TypeScript backend role"
      },
      "job_01",
      now
    );
    const score = scoreJob(job, "score_01", now);
    const next = summarizeNext({
      jobs: [job],
      scores: [score],
      pipeline: [
        {
          job_id: job.job_id,
          status: "saved",
          priority: "high",
          updated_at: now
        }
      ]
    });

    expect(job.title).toBe("TypeScript Backend Engineer");
    expect(score.score).toBeGreaterThanOrEqual(60);
    expect(canTransitionPipelineStatus("saved", "reviewing")).toBe(true);
    expect(next[0]?.job_id).toBe(job.job_id);
  });

  it("lists automation tasks newest first with status and limit filters", () => {
    const tasks = [
      {
        task_id: "task_completed_old",
        kind: "search" as const,
        site: "fixture",
        keyword: "TypeScript",
        session: "fetch" as const,
        status: "completed" as const,
        created_at: "2026-05-09T00:00:00.000Z",
        started_at: "2026-05-09T00:00:01.000Z",
        finished_at: "2026-05-09T00:00:02.000Z",
        collected_count: 1,
        ingest_ids: ["ingest_old"],
        action_log: []
      },
      {
        task_id: "task_failed_new",
        kind: "search" as const,
        site: "fixture",
        keyword: "Rust",
        session: "fetch" as const,
        status: "failed" as const,
        created_at: "2026-05-09T00:01:00.000Z",
        started_at: "2026-05-09T00:01:01.000Z",
        finished_at: "2026-05-09T00:01:02.000Z",
        collected_count: 0,
        ingest_ids: [],
        action_log: []
      },
      {
        task_id: "task_completed_new",
        kind: "search" as const,
        site: "fixture",
        keyword: "Node.js",
        session: "chromium" as const,
        status: "completed" as const,
        created_at: "2026-05-09T00:02:00.000Z",
        started_at: "2026-05-09T00:02:01.000Z",
        finished_at: "2026-05-09T00:02:02.000Z",
        collected_count: 2,
        ingest_ids: ["ingest_new_1", "ingest_new_2"],
        action_log: []
      }
    ];

    const recent = listAutomationTasks(tasks, { limit: 2 });
    expect(recent.items.map((task) => task.task_id)).toEqual([
      "task_completed_new",
      "task_failed_new"
    ]);
    expect(recent.count).toBe(2);
    expect(recent.total).toBe(3);

    const completed = listAutomationTasks(tasks, { status: "completed", limit: 1 });
    expect(completed.items.map((task) => task.task_id)).toEqual(["task_completed_new"]);
    expect(completed.count).toBe(1);
    expect(completed.total).toBe(2);
  });

  it("gets one automation task by id", () => {
    const tasks = [
      {
        task_id: "task_lookup",
        kind: "search" as const,
        site: "fixture",
        keyword: "TypeScript",
        session: "fetch" as const,
        status: "completed" as const,
        created_at: "2026-05-09T00:00:00.000Z",
        collected_count: 1,
        ingest_ids: ["ingest_lookup"],
        action_log: []
      }
    ];

    expect(getAutomationTask(tasks, "task_lookup")?.status).toBe("completed");
    expect(getAutomationTask(tasks, "missing_task")).toBeNull();
  });

  it("lists automation site capabilities for agent discovery", () => {
    const sites = listAutomationSites();

    expect(sites.map((site) => site.site)).toEqual([
      "fixture",
      "boss",
      "liepin",
      "lagou",
      "linkedin"
    ]);
    expect(sites.find((site) => site.site === "fixture")).toMatchObject({
      status: "enabled",
      requires_fixture: false,
      supports_process_results: true
    });
    expect(sites.find((site) => site.site === "boss")).toMatchObject({
      status: "fixture_only",
      requires_fixture: true,
      supports_process_results: true
    });
    expect(sites.find((site) => site.site === "liepin")).toMatchObject({
      status: "not_enabled",
      supports_process_results: false
    });
  });

  it("creates automation search persistence records from collected payloads", () => {
    const persistence = createAutomationSearchPersistence({
      task: {
        task_id: "task_persist",
        site: "fixture",
        keyword: "TypeScript",
        city: "Remote",
        limit: 2,
        created_at: "2026-05-09T00:00:00.000Z"
      },
      session: "fetch",
      status: "partial",
      startedAt: "2026-05-09T00:00:01.000Z",
      finishedAt: "2026-05-09T00:00:02.000Z",
      persistedAt: "2026-05-09T00:00:03.000Z",
      collected: [
        {
          source_type: "extension",
          source_site: "unknown",
          captured_at: "2026-05-09T00:00:01.500Z",
          job_url: "https://example.test/jobs/1",
          title_hint: "Runtime Persistence Engineer",
          company_hint: "Runtime Co"
        }
      ],
      actionLog: [
        {
          at: "2026-05-09T00:00:02.000Z",
          action: "parse_search_results",
          status: "completed",
          details: {
            collected_count: 1
          }
        }
      ],
      createIngestId: () => "ingest_persist"
    });

    expect(persistence.ingests).toHaveLength(1);
    expect(persistence.ingests[0]).toMatchObject({
      ingest_id: "ingest_persist",
      job_url: "https://example.test/jobs/1"
    });
    expect(persistence.taskRecord).toMatchObject({
      task_id: "task_persist",
      status: "partial",
      collected_count: 1,
      ingest_ids: ["ingest_persist"]
    });
    expect(persistence.taskRecord.action_log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "persist_ingests",
          status: "completed",
          details: {
            ingest_ids: ["ingest_persist"]
          }
        })
      ])
    );
  });

  it("creates blocked automation task records without collected payloads", () => {
    const persistence = createAutomationSearchPersistence({
      task: {
        task_id: "task_blocked",
        site: "boss",
        keyword: "TypeScript",
        created_at: "2026-05-09T00:00:00.000Z"
      },
      session: "fetch",
      status: "blocked",
      finishedAt: "2026-05-09T00:00:02.000Z",
      error: {
        code: "ADAPTER_NOT_FOUND",
        message: "automation adapter is not available for site: boss"
      },
      actionLog: [
        {
          at: "2026-05-09T00:00:02.000Z",
          action: "resolve_adapter",
          status: "blocked"
        }
      ],
      createIngestId: () => "ingest_unused"
    });

    expect(persistence.ingests).toEqual([]);
    expect(persistence.taskRecord).toMatchObject({
      task_id: "task_blocked",
      site: "boss",
      status: "blocked",
      collected_count: 0,
      ingest_ids: [],
      error: {
        code: "ADAPTER_NOT_FOUND"
      }
    });
  });
});
