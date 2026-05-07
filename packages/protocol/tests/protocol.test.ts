import { describe, expect, it } from "vitest";
import {
  getNextActionsRequestEnvelopeSchema,
  ingestJobRequestEnvelopeSchema,
  normalizeJobRequestEnvelopeSchema,
  responseEnvelopeSchema,
  scoreJobRequestEnvelopeSchema,
  updatePipelineRequestEnvelopeSchema
} from "../src/index.js";

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

  it("accepts a normalize_job request envelope", () => {
    const result = normalizeJobRequestEnvelopeSchema.parse({
      version: "1",
      type: "normalize_job",
      request_id: "req_02",
      sent_at: "2026-05-07T00:01:00.000Z",
      payload: {
        ingest_id: "ingest_01"
      }
    });

    expect(result.type).toBe("normalize_job");
    expect(result.payload.ingest_id).toBe("ingest_01");
  });

  it("accepts a normalize_job_result response envelope", () => {
    const result = responseEnvelopeSchema.parse({
      version: "1",
      type: "normalize_job_result",
      request_id: "req_02",
      ok: true,
      payload: {
        ingest_id: "ingest_01",
        job_id: "job_01",
        status: "normalized",
        pipeline_status: "new"
      },
      error: null
    });

    expect(result.type).toBe("normalize_job_result");
  });

  it("accepts a score_job request envelope", () => {
    const result = scoreJobRequestEnvelopeSchema.parse({
      version: "1",
      type: "score_job",
      request_id: "req_03",
      sent_at: "2026-05-07T00:02:00.000Z",
      payload: {
        job_id: "job_01",
        resume_id: "resume_01"
      }
    });

    expect(result.type).toBe("score_job");
    expect(result.payload.job_id).toBe("job_01");
  });

  it("accepts a score_job_result response envelope", () => {
    const result = responseEnvelopeSchema.parse({
      version: "1",
      type: "score_job_result",
      request_id: "req_03",
      ok: true,
      payload: {
        job_id: "job_01",
        score_id: "score_01",
        status: "scored",
        score: 72,
        suggested_action: "review"
      },
      error: null
    });

    expect(result.type).toBe("score_job_result");
  });

  it("accepts a get_next_actions request envelope", () => {
    const result = getNextActionsRequestEnvelopeSchema.parse({
      version: "1",
      type: "get_next_actions",
      request_id: "req_04",
      sent_at: "2026-05-07T00:03:00.000Z",
      payload: {
        limit: 5
      }
    });

    expect(result.type).toBe("get_next_actions");
    expect(result.payload.limit).toBe(5);
  });

  it("accepts a get_next_actions_result response envelope", () => {
    const result = responseEnvelopeSchema.parse({
      version: "1",
      type: "get_next_actions_result",
      request_id: "req_04",
      ok: true,
      payload: {
        items: [
          {
            job_id: "job_01",
            title: "Backend Engineer",
            company_name: "Example Tech",
            recommended_action: "review",
            priority: "medium",
            score: 74
          }
        ],
        count: 1
      },
      error: null
    });

    expect(result.type).toBe("get_next_actions_result");
  });

  it("accepts an update_pipeline request envelope", () => {
    const result = updatePipelineRequestEnvelopeSchema.parse({
      version: "1",
      type: "update_pipeline",
      request_id: "req_05",
      sent_at: "2026-05-07T00:04:00.000Z",
      payload: {
        job_id: "job_01",
        status: "reviewing",
        priority: "high",
        next_action: "review and tailor resume"
      }
    });

    expect(result.type).toBe("update_pipeline");
    expect(result.payload.status).toBe("reviewing");
  });

  it("accepts an update_pipeline_result response envelope", () => {
    const result = responseEnvelopeSchema.parse({
      version: "1",
      type: "update_pipeline_result",
      request_id: "req_05",
      ok: true,
      payload: {
        job_id: "job_01",
        status: "updated",
        pipeline_status: "reviewing",
        priority: "high"
      },
      error: null
    });

    expect(result.type).toBe("update_pipeline_result");
  });
});
