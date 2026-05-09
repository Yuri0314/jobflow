import { describe, expect, it } from "vitest";
import {
  automationResultSchema,
  createAdapterRegistry,
  fixtureAdapter,
  parseFixtureSearchResults,
  searchTaskSchema
} from "../src/index.js";

describe("browser automation scaffold", () => {
  it("accepts a fixture search task", () => {
    const task = searchTaskSchema.parse({
      task_id: "task_01",
      site: "fixture",
      keyword: "TypeScript",
      city: "Remote",
      limit: 5,
      created_at: "2026-05-09T00:00:00.000Z"
    });

    expect(task.site).toBe("fixture");
    expect(task.limit).toBe(5);
  });

  it("accepts blocked automation results with stable error codes", () => {
    const result = automationResultSchema.parse({
      task_id: "task_01",
      status: "blocked",
      site: "fixture",
      collected: [],
      action_log: [
        {
          at: "2026-05-09T00:00:00.000Z",
          action: "detect_blocked_page",
          status: "blocked",
          message: "login required"
        }
      ],
      error: {
        code: "LOGIN_REQUIRED",
        message: "login required"
      },
      started_at: "2026-05-09T00:00:00.000Z",
      finished_at: "2026-05-09T00:00:01.000Z"
    });

    expect(result.status).toBe("blocked");
    expect(result.error?.code).toBe("LOGIN_REQUIRED");
  });

  it("resolves adapters by site", () => {
    const registry = createAdapterRegistry([fixtureAdapter]);

    expect(registry.get("fixture")).toBe(fixtureAdapter);
    expect(registry.get("boss")).toBeUndefined();
  });

  it("parses controlled fixture search result HTML into ingest payloads", () => {
    const payloads = parseFixtureSearchResults(
      `<!doctype html>
<main>
  <article data-job-card data-url="https://example.test/jobs/1">
    <h2 data-job-title>Senior TypeScript Engineer</h2>
    <p data-company>Smoke Corp</p>
    <p data-location>Remote</p>
    <p data-summary>Build TypeScript services and browser automation workflows.</p>
  </article>
  <article data-job-card data-url="https://example.test/jobs/2">
    <h2 data-job-title>Backend Platform Engineer</h2>
    <p data-company>Example Tech</p>
    <p data-location>Shanghai</p>
    <p data-summary>Own Node.js APIs and local-first data workflows.</p>
  </article>
</main>`,
      "2026-05-09T00:00:00.000Z"
    );

    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toMatchObject({
      source_type: "extension",
      source_site: "unknown",
      job_url: "https://example.test/jobs/1",
      title_hint: "Senior TypeScript Engineer",
      company_hint: "Smoke Corp"
    });
    expect(payloads[0]?.raw_text).toContain("Remote");
  });
});
