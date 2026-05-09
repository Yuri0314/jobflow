import { readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFsStore } from "@jobflow/runtime";
import { runStateExport, runStateInspect } from "../src/commands/state.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "jobflow-state-command-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("state commands", () => {
  it("summarizes local state collections", async () => {
    const store = createFsStore(dir);
    const state = await store.read();
    state.ingests.push({
      ingest_id: "ingest_01",
      source_type: "text",
      captured_at: "2026-05-07T00:00:00.000Z",
      raw_text: "Backend Engineer"
    });
    state.jobs.push({
      job_id: "job_01",
      title: "Backend Engineer",
      company_name: "Example Tech",
      tags: [],
      created_at: "2026-05-07T00:01:00.000Z",
      normalized_at: "2026-05-07T00:01:00.000Z"
    });
    state.resumes.push({
      resume_id: "resume_01",
      label: "Backend Resume",
      source_type: "text",
      is_default: true,
      target_roles: ["backend"],
      updated_at: "2026-05-07T00:02:00.000Z"
    });
    state.automation_tasks.push({
      task_id: "task_01",
      kind: "search",
      site: "fixture",
      keyword: "TypeScript",
      session: "fetch",
      status: "completed",
      created_at: "2026-05-07T00:03:00.000Z",
      started_at: "2026-05-07T00:03:01.000Z",
      finished_at: "2026-05-07T00:03:02.000Z",
      collected_count: 1,
      ingest_ids: ["ingest_01"],
      action_log: [
        {
          at: "2026-05-07T00:03:02.000Z",
          action: "persist_ingests",
          status: "completed"
        }
      ]
    });
    await store.write(state);

    const response = await runStateInspect(store);

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.counts.ingests).toBe(1);
    expect(response.data.counts.jobs).toBe(1);
    expect(response.data.counts.resumes).toBe(1);
    expect(response.data.counts.automation_tasks).toBe(1);
    expect(response.data.default_resume?.resume_id).toBe("resume_01");
    expect(response.data.latest_updated_at).toBe("2026-05-07T00:03:02.000Z");
  });

  it("exports complete state to a JSON file", async () => {
    const store = createFsStore(dir);
    const state = await store.read();
    state.resumes.push({
      resume_id: "resume_01",
      label: "Backend Resume",
      source_type: "text",
      is_default: true,
      target_roles: ["backend"],
      updated_at: "2026-05-07T00:02:00.000Z"
    });
    await store.write(state);

    const outputPath = join(dir, "exports", "state.json");
    const response = await runStateExport(store, { output: outputPath });

    expect(response.ok).toBe(true);
    await expect(stat(outputPath)).resolves.toBeTruthy();
    const exported = JSON.parse(await readFile(outputPath, "utf8"));
    expect(exported.resumes).toHaveLength(1);
    expect(exported.automation_tasks).toEqual([]);
  });
});
