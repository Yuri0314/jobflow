import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canTransitionPipelineStatus,
  createFsStore,
  normalizeIngest,
  scoreJob,
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
});
