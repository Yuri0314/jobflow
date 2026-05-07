import { describe, expect, it } from "vitest";
import { summarizeNext } from "../src/runtime/next.js";
import { normalizeIngest } from "../src/runtime/normalize.js";
import { scoreJob } from "../src/runtime/score.js";

describe("normalize, score, next runtime", () => {
  it("normalizes title and company hints", () => {
    const job = normalizeIngest(
      {
        ingest_id: "ingest_01",
        source_type: "manual",
        captured_at: "2026-05-07T00:00:00.000Z",
        title_hint: "Backend Engineer",
        company_hint: "Example Tech"
      },
      "job_01",
      "2026-05-07T00:00:00.000Z"
    );

    expect(job.title).toBe("Backend Engineer");
    expect(job.company_name).toBe("Example Tech");
  });

  it("scores a job with useful text signals", () => {
    const score = scoreJob(
      {
        job_id: "job_01",
        title: "TypeScript Backend Engineer",
        company_name: "Example Tech",
        description_text: "Node.js TypeScript backend role",
        tags: [],
        created_at: "2026-05-07T00:00:00.000Z",
        normalized_at: "2026-05-07T00:00:00.000Z"
      },
      "score_01",
      "2026-05-07T00:00:00.000Z"
    );

    expect(score.score).toBeGreaterThanOrEqual(60);
    expect(score.suggested_action).toBe("review");
  });

  it("summarizes open pipeline entries by priority and score", () => {
    const items = summarizeNext({
      jobs: [
        {
          job_id: "job_01",
          title: "Backend Engineer",
          company_name: "Example Tech",
          tags: [],
          created_at: "2026-05-07T00:00:00.000Z",
          normalized_at: "2026-05-07T00:00:00.000Z"
        }
      ],
      scores: [
        {
          score_id: "score_01",
          job_id: "job_01",
          score: 80,
          confidence: "medium",
          reasons: [],
          risks: [],
          suggested_action: "review",
          scored_at: "2026-05-07T00:00:00.000Z"
        }
      ],
      pipeline: [
        {
          job_id: "job_01",
          status: "saved",
          priority: "high",
          next_action: "review JD",
          updated_at: "2026-05-07T00:00:00.000Z"
        }
      ]
    });

    expect(items[0]?.job_id).toBe("job_01");
  });
});
