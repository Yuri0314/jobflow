import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFsStore } from "@jobflow/runtime";
import { runResumeAdd, runResumeList, runResumeSetDefault } from "../src/commands/resume.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "jobflow-resume-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("resume commands", () => {
  it("adds a resume reference", async () => {
    const store = createFsStore(dir);
    const response = await runResumeAdd(store, {
      label: "Backend Resume",
      sourceType: "file",
      filePath: "D:\\resumes\\backend.pdf",
      targetRoles: "backend,typescript",
      summary: "Backend-focused resume",
      default: true
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.resume.label).toBe("Backend Resume");
    expect(response.data.resume.is_default).toBe(true);

    const state = await store.read();
    expect(state.resumes).toHaveLength(1);
  });

  it("lists resume references", async () => {
    const store = createFsStore(dir);
    await runResumeAdd(store, {
      label: "Backend Resume",
      sourceType: "text"
    });

    const response = await runResumeList(store);

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.items).toHaveLength(1);
  });

  it("sets one resume as default and clears the previous default", async () => {
    const store = createFsStore(dir);
    const first = await runResumeAdd(store, {
      label: "General Resume",
      sourceType: "text",
      default: true
    });
    const second = await runResumeAdd(store, {
      label: "Backend Resume",
      sourceType: "text"
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const response = await runResumeSetDefault(store, {
      resumeId: second.data.resume.resume_id
    });

    expect(response.ok).toBe(true);
    const state = await store.read();
    expect(state.resumes.find((resume) => resume.resume_id === first.data.resume.resume_id)?.is_default).toBe(false);
    expect(state.resumes.find((resume) => resume.resume_id === second.data.resume.resume_id)?.is_default).toBe(true);
  });
});
