import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFsStore } from "@jobflow/runtime";
import { runIngest } from "../src/commands/ingest.js";
import { runNext } from "../src/commands/next.js";
import { runNormalize } from "../src/commands/normalize.js";
import { runPipelineUpdate } from "../src/commands/pipeline.js";
import { runScore } from "../src/commands/score.js";

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
