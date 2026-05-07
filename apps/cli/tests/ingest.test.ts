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
