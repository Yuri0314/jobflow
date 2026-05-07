import { describe, expect, it } from "vitest";
import { ingestJobRequestEnvelopeSchema, responseEnvelopeSchema } from "../src/index.js";

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
});
