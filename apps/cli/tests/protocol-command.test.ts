import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  runProtocolGetNextActions,
  runProtocolIngestJob,
  runProtocolNormalizeJob,
  runProtocolScoreJob,
  runProtocolUpdatePipeline
} from "../src/commands/protocol.js";
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

describe("protocol score-job", () => {
  it("scores a normalized job request envelope and returns a protocol result envelope", async () => {
    const store = createFsStore(dir);
    const ingest = await runProtocolIngestJob(store, {
      version: "1",
      type: "ingest_job",
      request_id: "req_ingest",
      sent_at: "2026-05-07T00:00:00.000Z",
      payload: {
        source_type: "extension",
        captured_at: "2026-05-07T00:00:00.000Z",
        title_hint: "TypeScript Backend Engineer",
        company_hint: "Example Tech",
        raw_text: "Node.js TypeScript backend role"
      }
    });
    const normalized = await runProtocolNormalizeJob(store, {
      version: "1",
      type: "normalize_job",
      request_id: "req_normalize",
      sent_at: "2026-05-07T00:01:00.000Z",
      payload: {
        ingest_id: ingest.payload?.ingest_id
      }
    });
    const jobId = normalized.payload?.job_id;

    const response = await runProtocolScoreJob(store, {
      version: "1",
      type: "score_job",
      request_id: "req_score",
      sent_at: "2026-05-07T00:02:00.000Z",
      payload: {
        job_id: jobId
      }
    });

    expect(response).toMatchObject({
      version: "1",
      type: "score_job_result",
      request_id: "req_score",
      ok: true,
      error: null
    });
    expect(response.payload).toMatchObject({
      job_id: jobId,
      status: "scored",
      suggested_action: "review"
    });
    expect(response.payload?.score_id).toMatch(/^score_/);
    expect(response.payload?.score).toBeGreaterThanOrEqual(60);

    const state = await store.read();
    expect(state.scores).toHaveLength(1);
    expect(state.scores[0]?.job_id).toBe(jobId);
  });

  it("returns a protocol error envelope when the job does not exist", async () => {
    const response = await runProtocolScoreJob(createFsStore(dir), {
      version: "1",
      type: "score_job",
      request_id: "req_missing_job",
      sent_at: "2026-05-07T00:02:00.000Z",
      payload: {
        job_id: "job_missing"
      }
    });

    expect(response).toMatchObject({
      version: "1",
      type: "score_job_result",
      request_id: "req_missing_job",
      ok: false,
      payload: null
    });
    expect(response.error?.code).toBe("NOT_FOUND");
  });
});

describe("protocol get-next-actions", () => {
  it("returns recommended next actions without mutating state", async () => {
    const store = createFsStore(dir);
    const ingest = await runProtocolIngestJob(store, {
      version: "1",
      type: "ingest_job",
      request_id: "req_ingest",
      sent_at: "2026-05-07T00:00:00.000Z",
      payload: {
        source_type: "extension",
        captured_at: "2026-05-07T00:00:00.000Z",
        title_hint: "TypeScript Backend Engineer",
        company_hint: "Example Tech",
        raw_text: "Node.js TypeScript backend role"
      }
    });
    const normalized = await runProtocolNormalizeJob(store, {
      version: "1",
      type: "normalize_job",
      request_id: "req_normalize",
      sent_at: "2026-05-07T00:01:00.000Z",
      payload: {
        ingest_id: ingest.payload?.ingest_id
      }
    });
    await runProtocolScoreJob(store, {
      version: "1",
      type: "score_job",
      request_id: "req_score",
      sent_at: "2026-05-07T00:02:00.000Z",
      payload: {
        job_id: normalized.payload?.job_id
      }
    });
    const before = await store.read();

    const response = await runProtocolGetNextActions(store, {
      version: "1",
      type: "get_next_actions",
      request_id: "req_next",
      sent_at: "2026-05-07T00:03:00.000Z",
      payload: {
        limit: 1
      }
    });
    const after = await store.read();

    expect(response).toMatchObject({
      version: "1",
      type: "get_next_actions_result",
      request_id: "req_next",
      ok: true,
      error: null
    });
    expect(response.payload).toMatchObject({
      count: 1
    });
    expect(response.payload?.items).toHaveLength(1);
    expect(response.payload?.items?.[0]).toMatchObject({
      job_id: normalized.payload?.job_id,
      recommended_action: "review",
      priority: "medium"
    });
    expect(response.payload?.items?.[0]?.score).toBeGreaterThanOrEqual(60);
    expect(after).toEqual(before);
  });

  it("returns a protocol error envelope for invalid request input", async () => {
    const response = await runProtocolGetNextActions(createFsStore(dir), {
      version: "1",
      type: "get_next_actions",
      request_id: "req_bad_next",
      sent_at: "2026-05-07T00:03:00.000Z",
      payload: {
        limit: 0
      }
    });

    expect(response).toMatchObject({
      version: "1",
      type: "get_next_actions_result",
      request_id: "req_bad_next",
      ok: false,
      payload: null
    });
    expect(response.error?.code).toBe("INVALID_PROTOCOL_ENVELOPE");
  });
});

describe("protocol update-pipeline", () => {
  it("updates pipeline state for a normalized job", async () => {
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
    const normalized = await runProtocolNormalizeJob(store, {
      version: "1",
      type: "normalize_job",
      request_id: "req_normalize",
      sent_at: "2026-05-07T00:01:00.000Z",
      payload: {
        ingest_id: ingest.payload?.ingest_id
      }
    });

    const response = await runProtocolUpdatePipeline(store, {
      version: "1",
      type: "update_pipeline",
      request_id: "req_pipeline",
      sent_at: "2026-05-07T00:04:00.000Z",
      payload: {
        job_id: normalized.payload?.job_id,
        status: "reviewing",
        priority: "high",
        next_action: "review and tailor resume"
      }
    });

    expect(response).toMatchObject({
      version: "1",
      type: "update_pipeline_result",
      request_id: "req_pipeline",
      ok: true,
      error: null
    });
    expect(response.payload).toMatchObject({
      job_id: normalized.payload?.job_id,
      status: "updated",
      pipeline_status: "reviewing",
      priority: "high",
      next_action: "review and tailor resume"
    });

    const state = await store.read();
    expect(state.pipeline[0]).toMatchObject({
      job_id: normalized.payload?.job_id,
      status: "reviewing",
      priority: "high",
      next_action: "review and tailor resume"
    });
  });

  it("returns a protocol error envelope for invalid pipeline transitions", async () => {
    const store = createFsStore(dir);
    const state = await store.read();
    state.jobs.push({
      job_id: "job_01",
      title: "Backend Engineer",
      company_name: "Example Tech",
      tags: [],
      created_at: "2026-05-07T00:00:00.000Z",
      normalized_at: "2026-05-07T00:00:00.000Z"
    });
    state.pipeline.push({
      job_id: "job_01",
      status: "saved",
      priority: "medium",
      updated_at: "2026-05-07T00:00:00.000Z"
    });
    await store.write(state);

    const response = await runProtocolUpdatePipeline(store, {
      version: "1",
      type: "update_pipeline",
      request_id: "req_pipeline_bad",
      sent_at: "2026-05-07T00:04:00.000Z",
      payload: {
        job_id: "job_01",
        status: "applied"
      }
    });

    expect(response).toMatchObject({
      version: "1",
      type: "update_pipeline_result",
      request_id: "req_pipeline_bad",
      ok: false,
      payload: null
    });
    expect(response.error?.code).toBe("PIPELINE_UPDATE_FAILED");
  });
});
