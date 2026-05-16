import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listenOnFetchSafePort } from "@jobflow/browser-automation";
import { createFsStore } from "@jobflow/runtime";
import {
  runAutomationSearch,
  runAutomationSites,
  runAutomationTaskGet,
  runAutomationTasks
} from "../src/commands/automation.js";

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
      "parse_search_results",
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
    expect(state.automation_tasks).toHaveLength(1);
    expect(state.automation_tasks[0]).toMatchObject({
      task_id: response.data.task.task_id,
      kind: "search",
      site: "fixture",
      keyword: "TypeScript",
      session: "fetch",
      status: "completed",
      collected_count: 1,
      ingest_ids: response.data.ingest_ids
    });
    expect(state.automation_tasks[0]?.action_log.map((entry) => entry.action)).toEqual([
      "parse_search_results",
      "persist_ingests"
    ]);
  });

  it("optionally processes collected results into jobs, scores, and next actions", async () => {
    const store = createFsStore(dir);
    const response = await runAutomationSearch(store, {
      site: "fixture",
      keyword: "TypeScript",
      limit: 1,
      processResults: true,
      fixtureHtml: `<!doctype html>
<main>
  <article data-job-card data-url="https://example.test/jobs/process">
    <h2 data-job-title>Processed TypeScript Engineer</h2>
    <p data-company>Process Corp</p>
    <p data-location>Remote</p>
    <p data-summary>Build TypeScript services and local-first workflows.</p>
  </article>
</main>`
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.processed).toMatchObject({
      count: 1
    });
    expect(response.data.processed?.job_ids).toHaveLength(1);
    expect(response.data.processed?.score_ids).toHaveLength(1);
    expect(response.data.processed?.next_actions).toHaveLength(1);

    const state = await store.read();
    expect(state.ingests).toHaveLength(1);
    expect(state.jobs).toHaveLength(1);
    expect(state.scores).toHaveLength(1);
    expect(state.pipeline).toHaveLength(1);
    expect(state.ingests[0]?.job_id).toBe(state.jobs[0]?.job_id);
  });

  it("returns a stable error before real site adapters are enabled", async () => {
    const store = createFsStore(dir);
    const response = await runAutomationSearch(store, {
      site: "boss",
      keyword: "TypeScript"
    });

    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.error.code).toBe("SITE_FIXTURE_REQUIRED");
    expect(response.command).toBe("automation.search");

    const state = await store.read();
    expect(state.automation_tasks).toHaveLength(1);
    expect(state.automation_tasks[0]).toMatchObject({
      site: "boss",
      keyword: "TypeScript",
      session: "fetch",
      status: "blocked",
      collected_count: 0,
      ingest_ids: [],
      error: {
        code: "SITE_FIXTURE_REQUIRED"
      }
    });
  });

  it("blocks sites marked not enabled in the runtime capability catalog", async () => {
    const store = createFsStore(dir);
    const response = await runAutomationSearch(store, {
      site: "liepin",
      keyword: "TypeScript",
      fixtureHtml: "<main></main>"
    });

    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.error.code).toBe("SITE_NOT_ENABLED");
    expect(response.error.details).toMatchObject({
      site: "liepin",
      status: "not_enabled"
    });

    const state = await store.read();
    expect(state.automation_tasks).toHaveLength(1);
    expect(state.automation_tasks[0]).toMatchObject({
      site: "liepin",
      keyword: "TypeScript",
      status: "blocked",
      error: {
        code: "SITE_NOT_ENABLED"
      }
    });
    expect(state.automation_tasks[0]?.action_log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "validate_site_capability",
          status: "blocked"
        })
      ])
    );
  });

  it("collects controlled BOSS fixture search results without touching the real site", async () => {
    const store = createFsStore(dir);
    const response = await runAutomationSearch(store, {
      site: "boss",
      keyword: "TypeScript",
      limit: 1,
      fixtureHtml: `<!doctype html>
<main>
  <div class="job-card-wrapper" data-job-card>
    <a class="job-name" href="/job_detail/cli-boss.html">BOSS Fixture Engineer</a>
    <span class="boss-name">BOSS CLI Co</span>
    <span class="job-area">北京</span>
    <div class="job-info">Build local-first job automation.</div>
  </div>
</main>`
    });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.result.status).toBe("completed");
    expect(response.data.collected_count).toBe(1);

    const state = await store.read();
    expect(state.ingests[0]).toMatchObject({
      source_site: "boss",
      job_url: "https://www.zhipin.com/job_detail/cli-boss.html",
      title_hint: "BOSS Fixture Engineer",
      company_hint: "BOSS CLI Co"
    });
    expect(state.automation_tasks[0]).toMatchObject({
      site: "boss",
      status: "completed"
    });
  });

  it("collects fixture search results from a local fixture URL", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
<main>
  <article data-job-card data-url="https://example.test/jobs/from-url">
    <h2 data-job-title>Browser Automation Engineer</h2>
    <p data-company>Fixture Browser Co</p>
    <p data-location>Remote</p>
    <p data-summary>Open fixture pages and hand data to CLI workflows.</p>
  </article>
</main>`);
    });
    const url = await listen(server);

    try {
      const store = createFsStore(dir);
      const response = await runAutomationSearch(store, {
        site: "fixture",
        keyword: "Automation",
        fixtureUrl: url
      });

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      expect(response.data.result.action_log.map((entry) => entry.action)).toEqual([
        "open_page",
        "parse_search_results",
        "persist_ingests"
      ]);

      const state = await store.read();
      expect(state.ingests[0]).toMatchObject({
        job_url: "https://example.test/jobs/from-url",
        title_hint: "Browser Automation Engineer",
        company_hint: "Fixture Browser Co"
      });
    } finally {
      await close(server);
    }
  });

  it("uses an injected Chromium session and closes it after fixture URL collection", async () => {
    const openedUrls: string[] = [];
    let closed = false;
    const store = createFsStore(dir);

    const response = await runAutomationSearch(
      store,
      {
        site: "fixture",
        keyword: "Automation",
        session: "chromium",
        fixtureUrl: "http://127.0.0.1:12345/search"
      },
      {
        async createChromiumSession() {
          return {
            async open(url: string) {
              openedUrls.push(url);
              return {
                url,
                html: `<!doctype html>
<main>
  <article data-job-card data-url="https://example.test/jobs/chromium-cli">
    <h2 data-job-title>CLI Chromium Engineer</h2>
    <p data-company>Browser CLI Co</p>
    <p data-location>Remote</p>
    <p data-summary>Run fixture collection through an injected Chromium session.</p>
  </article>
</main>`
              };
            },
            async close() {
              closed = true;
            }
          };
        }
      }
    );

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(openedUrls).toEqual(["http://127.0.0.1:12345/search"]);
    expect(closed).toBe(true);
    expect(response.data.result.action_log.map((entry) => entry.action)).toEqual([
      "open_page",
      "parse_search_results",
      "persist_ingests"
    ]);

    const state = await store.read();
    expect(state.ingests[0]).toMatchObject({
      job_url: "https://example.test/jobs/chromium-cli",
      title_hint: "CLI Chromium Engineer",
      company_hint: "Browser CLI Co"
    });
  });

  it("requires a fixture URL for Chromium session searches", async () => {
    const store = createFsStore(dir);
    const response = await runAutomationSearch(store, {
      site: "fixture",
      keyword: "Automation",
      session: "chromium"
    });

    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.error.code).toBe("INVALID_INPUT");
    expect(response.error.message).toContain("fixtureUrl");

    const state = await store.read();
    expect(state.automation_tasks).toHaveLength(1);
    expect(state.automation_tasks[0]).toMatchObject({
      site: "fixture",
      keyword: "Automation",
      session: "chromium",
      status: "failed",
      error: {
        code: "INVALID_INPUT"
      }
    });
  });
});

describe("automation task queries", () => {
  it("lists automation site capabilities", async () => {
    const response = await runAutomationSites();

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          site: "fixture",
          status: "enabled",
          requires_fixture: false
        }),
        expect.objectContaining({
          site: "boss",
          status: "fixture_only",
          requires_fixture: true
        }),
        expect.objectContaining({
          site: "liepin",
          status: "not_enabled"
        })
      ])
    );
  });

  it("lists recent automation tasks with status filtering and limit", async () => {
    const store = createFsStore(dir);
    const state = await store.read();

    state.automation_tasks.push(
      {
        task_id: "task_completed_old",
        kind: "search",
        site: "fixture",
        keyword: "TypeScript",
        session: "fetch",
        status: "completed",
        created_at: "2026-05-09T00:00:00.000Z",
        started_at: "2026-05-09T00:00:01.000Z",
        finished_at: "2026-05-09T00:00:02.000Z",
        collected_count: 1,
        ingest_ids: ["ingest_old"],
        action_log: []
      },
      {
        task_id: "task_failed_new",
        kind: "search",
        site: "fixture",
        keyword: "Rust",
        session: "fetch",
        status: "failed",
        created_at: "2026-05-09T00:01:00.000Z",
        started_at: "2026-05-09T00:01:01.000Z",
        finished_at: "2026-05-09T00:01:02.000Z",
        collected_count: 0,
        ingest_ids: [],
        action_log: [],
        error: { code: "AUTOMATION_FAILED", message: "fixture failure" }
      }
    );

    await store.write(state);

    const recent = await runAutomationTasks(store, { limit: 1 });
    expect(recent.ok).toBe(true);
    if (!recent.ok) return;
    expect(recent.data.count).toBe(1);
    expect(recent.data.total).toBe(2);
    expect(recent.data.items[0]?.task_id).toBe("task_failed_new");

    const completed = await runAutomationTasks(store, { status: "completed" });
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.data.count).toBe(1);
    expect(completed.data.items[0]?.task_id).toBe("task_completed_old");
  });

  it("gets one automation task by id", async () => {
    const store = createFsStore(dir);
    const state = await store.read();

    state.automation_tasks.push({
      task_id: "task_lookup",
      kind: "search",
      site: "fixture",
      keyword: "Node.js",
      session: "fetch",
      status: "completed",
      created_at: "2026-05-09T00:02:00.000Z",
      started_at: "2026-05-09T00:02:01.000Z",
      finished_at: "2026-05-09T00:02:02.000Z",
      collected_count: 2,
      ingest_ids: ["ingest_lookup_1", "ingest_lookup_2"],
      action_log: []
    });

    await store.write(state);

    const found = await runAutomationTaskGet(store, { taskId: "task_lookup" });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.data.task.status).toBe("completed");
  });

  it("returns NOT_FOUND for an unknown automation task", async () => {
    const store = createFsStore(dir);

    const found = await runAutomationTaskGet(store, { taskId: "missing_task" });

    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.command).toBe("automation.task");
    expect(found.error.code).toBe("NOT_FOUND");
  });

  it("ships a CLI browser fixture automation smoke script", async () => {
    const script = await readFile(
      join(import.meta.dirname, "../scripts/smoke-automation-fixture-browser.mjs"),
      "utf8"
    );
    const manifest = JSON.parse(
      await readFile(join(import.meta.dirname, "../package.json"), "utf8")
    );

    expect(manifest.scripts["smoke:automation-fixture-browser"]).toContain(
      "smoke-automation-fixture-browser.mjs"
    );
    expect(script).toContain("automation");
    expect(script).toContain("--session");
    expect(script).toContain("--process-results");
    expect(script).toContain("listenOnFetchSafePort");
  });
});

async function listen(server: Server): Promise<string> {
  const port = await listenOnFetchSafePort(server);
  return `http://127.0.0.1:${port}/search`;
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;

  await new Promise<void>((resolve) => server.close(() => resolve()));
}
