import { describe, expect, it } from "vitest";
import {
  automationSearchRequestEnvelopeSchema,
  getAutomationTaskRequestEnvelopeSchema,
  getAutomationSitesRequestEnvelopeSchema,
  getAutomationTasksRequestEnvelopeSchema,
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

  it("accepts an automation_search request envelope", () => {
    const result = automationSearchRequestEnvelopeSchema.parse({
      version: "1",
      type: "automation_search",
      request_id: "req_automation_01",
      sent_at: "2026-05-09T00:00:00.000Z",
      payload: {
        site: "fixture",
        keyword: "TypeScript",
        city: "Remote",
        limit: 1,
        session: "fetch",
        process_results: true,
        fixture_html: `<article data-job-card data-url="https://example.test/jobs/1">
  <h2 data-job-title>TypeScript Engineer</h2>
  <p data-company>Example Co</p>
</article>`
      }
    });

    expect(result.type).toBe("automation_search");
    expect(result.payload.session).toBe("fetch");
    expect(result.payload.process_results).toBe(true);
  });

  it("accepts a controlled BOSS automation_search fixture envelope", () => {
    const result = automationSearchRequestEnvelopeSchema.parse({
      version: "1",
      type: "automation_search",
      request_id: "req_boss_automation_01",
      sent_at: "2026-05-09T00:00:00.000Z",
      payload: {
        site: "boss",
        keyword: "TypeScript",
        limit: 1,
        session: "fetch",
        process_results: true,
        fixture_html: `<main><div data-job-card data-url="https://www.zhipin.com/job_detail/protocol-boss.html"><h2 data-job-title>BOSS Protocol Engineer</h2><p data-company>BOSS Protocol Co</p></div></main>`
      }
    });

    expect(result.type).toBe("automation_search");
    expect(result.payload.site).toBe("boss");
    expect(result.payload.fixture_html).toContain("BOSS Protocol Engineer");
    expect(result.payload.process_results).toBe(true);
  });

  it("accepts an automation_search_result response envelope", () => {
    const result = responseEnvelopeSchema.parse({
      version: "1",
      type: "automation_search_result",
      request_id: "req_automation_01",
      ok: true,
      payload: {
        task_id: "task_01",
        task_status: "completed",
        site: "fixture",
        collected_count: 1,
        ingest_ids: ["ingest_01"],
        action_log: [
          {
            at: "2026-05-09T00:00:01.000Z",
            action: "parse_search_results",
            status: "completed"
          }
        ]
      },
      error: null
    });

    expect(result.type).toBe("automation_search_result");
    expect(result.payload?.task_status).toBe("completed");
  });

  it("accepts a get_automation_tasks request envelope", () => {
    const result = getAutomationTasksRequestEnvelopeSchema.parse({
      version: "1",
      type: "get_automation_tasks",
      request_id: "req_tasks_01",
      sent_at: "2026-05-09T00:05:00.000Z",
      payload: {
        limit: 5,
        status: "completed"
      }
    });

    expect(result.type).toBe("get_automation_tasks");
    expect(result.payload.status).toBe("completed");
  });

  it("accepts a get_automation_sites request envelope", () => {
    const result = getAutomationSitesRequestEnvelopeSchema.parse({
      version: "1",
      type: "get_automation_sites",
      request_id: "req_sites_01",
      sent_at: "2026-05-09T00:05:00.000Z",
      payload: {}
    });

    expect(result.type).toBe("get_automation_sites");
  });

  it("accepts a get_automation_task request envelope", () => {
    const result = getAutomationTaskRequestEnvelopeSchema.parse({
      version: "1",
      type: "get_automation_task",
      request_id: "req_task_01",
      sent_at: "2026-05-09T00:06:00.000Z",
      payload: {
        task_id: "task_01"
      }
    });

    expect(result.type).toBe("get_automation_task");
    expect(result.payload.task_id).toBe("task_01");
  });

  it("accepts automation task query response envelopes", () => {
    const listResult = responseEnvelopeSchema.parse({
      version: "1",
      type: "get_automation_tasks_result",
      request_id: "req_tasks_01",
      ok: true,
      payload: {
        items: [],
        count: 0
      },
      error: null
    });
    const getResult = responseEnvelopeSchema.parse({
      version: "1",
      type: "get_automation_task_result",
      request_id: "req_task_01",
      ok: true,
      payload: {
        task: {
          task_id: "task_01",
          status: "completed"
        }
      },
      error: null
    });

    expect(listResult.type).toBe("get_automation_tasks_result");
    expect(getResult.type).toBe("get_automation_task_result");
  });
});
