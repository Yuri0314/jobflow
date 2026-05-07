import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runProtocolIngestJob, runProtocolNormalizeJob } from "../src/commands/protocol.js";
import { createFsStore } from "../src/state/fs-store.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "jobflow-protocol-command-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("protocol ingest-job", () => {
  it("stores an ingest request envelope and returns a protocol result envelope", async () => {
    const store = createFsStore(dir);
    const response = await runProtocolIngestJob(store, {
      version: "1",
      type: "ingest_job",
      request_id: "req_01",
      sent_at: "2026-05-07T00:00:00.000Z",
      payload: {
        source_type: "extension",
        source_site: "boss",
        captured_at: "2026-05-07T00:00:00.000Z",
        job_url: "https://example.com/job/1",
        title_hint: "Backend Engineer",
        company_hint: "Example Tech"
      }
    });

    expect(response).toMatchObject({
      version: "1",
      type: "ingest_job_result",
      request_id: "req_01",
      ok: true,
      error: null
    });
    expect(response.payload).toMatchObject({
      status: "accepted"
    });
    expect(response.payload?.ingest_id).toMatch(/^ingest_/);

    const state = await store.read();
    expect(state.ingests).toHaveLength(1);
    expect(state.ingests[0]).toMatchObject({
      source_type: "extension",
      source_site: "boss",
      job_url: "https://example.com/job/1",
      title_hint: "Backend Engineer",
      company_hint: "Example Tech"
    });
  });

  it("returns a protocol error envelope without mutating state for invalid input", async () => {
    const store = createFsStore(dir);
    const response = await runProtocolIngestJob(store, {
      version: "1",
      type: "ingest_job",
      request_id: "req_bad",
      sent_at: "2026-05-07T00:00:00.000Z",
      payload: {
        source_type: "manual",
        captured_at: "2026-05-07T00:00:00.000Z"
      }
    });

    expect(response).toMatchObject({
      version: "1",
      type: "ingest_job_result",
      request_id: "req_bad",
      ok: false,
      payload: null
    });
    expect(response.error?.code).toBe("INVALID_PROTOCOL_ENVELOPE");

    const state = await store.read();
    expect(state.ingests).toHaveLength(0);
  });
});

describe("protocol normalize-job", () => {
  it("normalizes an ingest request envelope and returns a protocol result envelope", async () => {
    const store = createFsStore(dir);
    const ingest = await runProtocolIngestJob(store, {
      version: "1",
      type: "ingest_job",
      request_id: "req_ingest",
      sent_at: "2026-05-07T00:00:00.000Z",
      payload: {
        source_type: "extension",
        captured_at: "2026-05-07T00:00:00.000Z",
        title_hint: "Backend Engineer",
        company_hint: "Example Tech"
      }
    });
    const ingestId = ingest.payload?.ingest_id;

    const response = await runProtocolNormalizeJob(store, {
      version: "1",
      type: "normalize_job",
      request_id: "req_normalize",
      sent_at: "2026-05-07T00:01:00.000Z",
      payload: {
        ingest_id: ingestId
      }
    });

    expect(response).toMatchObject({
      version: "1",
      type: "normalize_job_result",
      request_id: "req_normalize",
      ok: true,
      error: null
    });
    expect(response.payload).toMatchObject({
      ingest_id: ingestId,
      status: "normalized",
      pipeline_status: "new"
    });
    expect(response.payload?.job_id).toMatch(/^job_/);

    const state = await store.read();
    expect(state.jobs).toHaveLength(1);
    expect(state.pipeline).toHaveLength(1);
    expect(state.ingests[0]?.job_id).toBe(response.payload?.job_id);
  });

  it("returns a protocol error envelope when the ingest does not exist", async () => {
    const response = await runProtocolNormalizeJob(createFsStore(dir), {
      version: "1",
      type: "normalize_job",
      request_id: "req_missing",
      sent_at: "2026-05-07T00:01:00.000Z",
      payload: {
        ingest_id: "ingest_missing"
      }
    });

    expect(response).toMatchObject({
      version: "1",
      type: "normalize_job_result",
      request_id: "req_missing",
      ok: false,
      payload: null
    });
    expect(response.error?.code).toBe("NOT_FOUND");
  });
});
