import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFsStore } from "@jobflow/runtime";

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
    expect(state.automation_tasks).toEqual([]);
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

  it("loads legacy state files without automation task records", async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "state.json"),
      JSON.stringify({
        ingests: [],
        jobs: [],
        scores: [],
        pipeline: [],
        resumes: []
      }),
      "utf8"
    );

    const state = await createFsStore(dir).read();

    expect(state.automation_tasks).toEqual([]);
  });
});
