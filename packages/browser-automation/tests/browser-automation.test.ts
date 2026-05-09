import { describe, expect, it } from "vitest";
import {
  buildChromiumLaunchArgs,
  automationResultSchema,
  createAdapterRegistry,
  executeSearchTask,
  findChromiumExecutable,
  fetchPageSession,
  fixtureAdapter,
  parseFixtureSearchResults,
  searchTaskSchema
} from "../src/index.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

  it("executes a fixture search task through an injected page session", async () => {
    const openedUrls: string[] = [];
    const result = await executeSearchTask(
      {
        task_id: "task_controller_01",
        site: "fixture",
        keyword: "TypeScript",
        limit: 1,
        created_at: "2026-05-09T00:00:00.000Z"
      },
      {
        adapterRegistry: createAdapterRegistry([fixtureAdapter]),
        pageSession: {
          async open(url) {
            openedUrls.push(url);
            return {
              url,
              html: `<!doctype html>
<main>
  <article data-job-card data-url="https://example.test/jobs/1">
    <h2 data-job-title>Senior TypeScript Engineer</h2>
    <p data-company>Smoke Corp</p>
    <p data-location>Remote</p>
    <p data-summary>Build browser automation workflows.</p>
  </article>
  <article data-job-card data-url="https://example.test/jobs/2">
    <h2 data-job-title>Node.js Engineer</h2>
    <p data-company>Example Tech</p>
    <p data-location>Shanghai</p>
    <p data-summary>Build local-first CLI workflows.</p>
  </article>
</main>`
            };
          }
        },
        pageUrl: "http://127.0.0.1:18888/search"
      }
    );

    expect(openedUrls).toEqual(["http://127.0.0.1:18888/search"]);
    expect(result).toMatchObject({
      task_id: "task_controller_01",
      status: "completed",
      site: "fixture"
    });
    expect(result.collected).toHaveLength(1);
    expect(result.collected[0]?.title_hint).toBe("Senior TypeScript Engineer");
    expect(result.action_log.map((entry) => entry.action)).toEqual([
      "open_page",
      "parse_search_results"
    ]);
  });

  it("returns a blocked result when the adapter is missing", async () => {
    const result = await executeSearchTask(
      {
        task_id: "task_missing_adapter",
        site: "boss",
        keyword: "TypeScript",
        created_at: "2026-05-09T00:00:00.000Z"
      },
      {
        adapterRegistry: createAdapterRegistry([]),
        html: "<main></main>"
      }
    );

    expect(result).toMatchObject({
      status: "blocked",
      error: {
        code: "ADAPTER_NOT_FOUND"
      }
    });
  });

  it("fetches HTML from a local fixture page session", async () => {
    const server = await import("node:http").then(({ createServer }) =>
      createServer((_request, response) => {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end("<!doctype html><main data-fixture>ok</main>");
      })
    );

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("fixture server did not expose a port");
      }

      const page = await fetchPageSession.open(`http://127.0.0.1:${address.port}/fixture`);

      expect(page.url).toContain("/fixture");
      expect(page.html).toContain("data-fixture");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("prefers explicit Chromium executable environment variables", () => {
    const exists = (path: string) => path === "C:/Tools/chrome.exe";

    expect(
      findChromiumExecutable(
        {
          CHROME_PATH: "C:/Tools/chrome.exe",
          EDGE_PATH: "C:/Tools/msedge.exe"
        },
        exists
      )
    ).toBe("C:/Tools/chrome.exe");
  });

  it("falls back to known Chromium executable locations", () => {
    const exists = (path: string) => path === "C:/Program Files/Microsoft/Edge/Application/msedge.exe";

    expect(findChromiumExecutable({}, exists)).toBe(
      "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
    );
  });

  it("builds Chromium launch args for a temporary automation profile", () => {
    const args = buildChromiumLaunchArgs({
      userDataDir: "D:/tmp/jobflow-profile",
      debuggingPort: 9222,
      url: "http://127.0.0.1:3000/search",
      headless: true
    });

    expect(args).toContain("--user-data-dir=D:/tmp/jobflow-profile");
    expect(args).toContain("--remote-debugging-port=9222");
    expect(args).toContain("--no-first-run");
    expect(args).toContain("--no-default-browser-check");
    expect(args).toContain("--headless=new");
    expect(args.at(-1)).toBe("http://127.0.0.1:3000/search");
  });

  it("ships a Chromium fixture browser smoke script", async () => {
    const script = await readFile(
      join(import.meta.dirname, "../scripts/smoke-fixture-browser.mjs"),
      "utf8"
    );

    expect(script).toContain("createChromiumPageSession");
    expect(script).toContain("executeSearchTask");
    expect(script).toContain("fixtureAdapter");
    expect(script).toContain("data-job-card");
  });
});
