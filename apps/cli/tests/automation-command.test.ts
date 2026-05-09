import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFsStore } from "@jobflow/runtime";
import { runAutomationSearch } from "../src/commands/automation.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "jobflow-automation-command-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("automation search", () => {
  it("collects fixture search results and stores them as ingests", async () => {
    const store = createFsStore(dir);
    const response = await runAutomationSearch(store, {
      site: "fixture",
      keyword: "TypeScript",
      city: "Remote",
      limit: 1,
      fixtureHtml: `<!doctype html>
<main>
  <article data-job-card data-url="https://example.test/jobs/1">
    <h2 data-job-title>Senior TypeScript Engineer</h2>
    <p data-company>Smoke Corp</p>
    <p data-location>Remote</p>
    <p data-summary>Build TypeScript services and browser extension workflows.</p>
  </article>
  <article data-job-card data-url="https://example.test/jobs/2">
    <h2 data-job-title>Node.js Platform Engineer</h2>
    <p data-company>Example Tech</p>
    <p data-location>Shanghai</p>
    <p data-summary>Own CLI and local-first data handoff.</p>
  </article>
</main>`
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.result.status).toBe("completed");
    expect(response.data.collected_count).toBe(1);
    expect(response.data.ingest_ids).toHaveLength(1);
    expect(response.data.result.action_log.map((entry) => entry.action)).toEqual([
      "create_search_task",
      "parse_fixture_results",
      "persist_ingests"
    ]);

    const state = await store.read();
    expect(state.ingests).toHaveLength(1);
    expect(state.ingests[0]).toMatchObject({
      source_type: "extension",
      source_site: "unknown",
      job_url: "https://example.test/jobs/1",
      title_hint: "Senior TypeScript Engineer",
      company_hint: "Smoke Corp"
    });
  });

  it("returns a stable error before real site adapters are enabled", async () => {
    const response = await runAutomationSearch(createFsStore(dir), {
      site: "boss",
      keyword: "TypeScript"
    });

    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.error.code).toBe("ADAPTER_NOT_FOUND");
    expect(response.command).toBe("automation.search");
  });
});
