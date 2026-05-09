import { createServer, type Server } from "node:http";
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
    const response = await runAutomationSearch(createFsStore(dir), {
      site: "fixture",
      keyword: "Automation",
      session: "chromium"
    });

    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.error.code).toBe("INVALID_INPUT");
    expect(response.error.message).toContain("fixtureUrl");
  });
});

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("fixture server did not expose a port");
  }
  return `http://127.0.0.1:${address.port}/search`;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
