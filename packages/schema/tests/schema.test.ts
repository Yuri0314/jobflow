import { describe, expect, it } from "vitest";
import {
  automationTaskRecordSchema,
  jobIngestRecordSchema,
  jobRecordSchema,
  pipelineRecordSchema,
  scoreRecordSchema
} from "../src/index.js";

describe("jobflow schema", () => {
  it("accepts a minimal link ingest record", () => {
    const result = jobIngestRecordSchema.parse({
      ingest_id: "ingest_01",
      source_type: "link",
      captured_at: "2026-05-07T00:00:00.000Z",
      job_url: "https://example.com/job/1"
    });

    expect(result.source_type).toBe("link");
  });

  it("rejects an ingest record without any usable job evidence", () => {
    expect(() =>
      jobIngestRecordSchema.parse({
        ingest_id: "ingest_01",
        source_type: "manual",
        captured_at: "2026-05-07T00:00:00.000Z"
      })
    ).toThrow();
  });

  it("accepts the minimum normalized job", () => {
    const result = jobRecordSchema.parse({
      job_id: "job_01",
      title: "Backend Engineer",
      company_name: "Example Tech",
      created_at: "2026-05-07T00:00:00.000Z",
      normalized_at: "2026-05-07T00:00:00.000Z"
    });

    expect(result.title).toBe("Backend Engineer");
  });

  it("accepts a score record with stable action values", () => {
    const result = scoreRecordSchema.parse({
      score_id: "score_01",
      job_id: "job_01",
      score: 78,
      confidence: "medium",
      reasons: ["技术栈匹配"],
      risks: [],
      suggested_action: "review",
      scored_at: "2026-05-07T00:00:00.000Z"
    });

    expect(result.suggested_action).toBe("review");
  });

  it("accepts a pipeline record in saved state", () => {
    const result = pipelineRecordSchema.parse({
      job_id: "job_01",
      status: "saved",
      priority: "medium",
      updated_at: "2026-05-07T00:00:00.000Z"
    });

    expect(result.status).toBe("saved");
  });

  it("accepts an automation search task audit record", () => {
    const result = automationTaskRecordSchema.parse({
      task_id: "task_01",
      kind: "search",
      site: "fixture",
      keyword: "TypeScript",
      city: "Remote",
      session: "fetch",
      status: "completed",
      created_at: "2026-05-09T00:00:00.000Z",
      started_at: "2026-05-09T00:00:01.000Z",
      finished_at: "2026-05-09T00:00:02.000Z",
      collected_count: 1,
      ingest_ids: ["ingest_01"],
      action_log: [
        {
          at: "2026-05-09T00:00:02.000Z",
          action: "persist_ingests",
          status: "completed",
          details: {
            ingest_ids: ["ingest_01"]
          }
        }
      ]
    });

    expect(result.status).toBe("completed");
    expect(result.ingest_ids).toEqual(["ingest_01"]);
  });

  it("accepts a partial automation search task audit record", () => {
    const result = automationTaskRecordSchema.parse({
      task_id: "task_partial",
      kind: "search",
      site: "fixture",
      keyword: "TypeScript",
      session: "fetch",
      status: "partial",
      created_at: "2026-05-09T00:00:00.000Z",
      started_at: "2026-05-09T00:00:01.000Z",
      finished_at: "2026-05-09T00:00:02.000Z",
      collected_count: 1,
      ingest_ids: ["ingest_partial"],
      action_log: []
    });

    expect(result.status).toBe("partial");
  });
});
