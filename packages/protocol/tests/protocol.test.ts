import { describe, expect, it } from "vitest";
import {
  ingestJobRequestEnvelopeSchema,
  normalizeJobRequestEnvelopeSchema,
  responseEnvelopeSchema,
  scoreJobRequestEnvelopeSchema
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
});
