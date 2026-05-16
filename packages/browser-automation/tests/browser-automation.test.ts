import { describe, expect, it } from "vitest";
import {
  buildChromiumLaunchArgs,
  automationResultSchema,
  bossAdapter,
  createAdapterRegistry,
  executeSearchTask,
  findChromiumExecutable,
  fetchPageSession,
  fixtureAdapter,
  parseBossSearchResults,
  parseFixtureSearchResults,
  searchTaskSchema
} from "../src/index.js";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
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

  it("parses controlled BOSS fixture search result HTML into ingest payloads", () => {
    const payloads = parseBossSearchResults(
      `<!doctype html>
<main>
  <div class="job-card-wrapper" data-job-card>
    <a class="job-name" href="/job_detail/abc123.html">TypeScript Backend Engineer</a>
    <span class="boss-name">BOSS Fixture Co</span>
    <span class="job-area">上海</span>
    <div class="job-info">Node.js TypeScript 平台服务</div>
  </div>
</main>`,
      "2026-05-09T00:00:00.000Z"
    );

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      source_type: "extension",
      source_site: "boss",
      job_url: "https://www.zhipin.com/job_detail/abc123.html",
      title_hint: "TypeScript Backend Engineer",
      company_hint: "BOSS Fixture Co"
    });
    expect(payloads[0]?.raw_text).toContain("上海");
  });

  it("parses BOSS fixture data attributes passed through PowerShell CLI arguments", () => {
    const payloads = parseBossSearchResults(
      `<!doctype html>
<main>
  <div data-job-card data-url=https://www.zhipin.com/job_detail/powershell.html>
    <h2 data-job-title>BOSS PowerShell Fixture Engineer</h2>
    <p data-company>BOSS Shell Co</p>
  </div>
</main>`,
      "2026-05-09T00:00:00.000Z"
    );

    expect(payloads[0]).toMatchObject({
      source_site: "boss",
      job_url: "https://www.zhipin.com/job_detail/powershell.html",
      title_hint: "BOSS PowerShell Fixture Engineer",
      company_hint: "BOSS Shell Co"
    });
  });

  it("detects controlled BOSS blocked pages", () => {
    expect(bossAdapter.detectBlockedPage?.("<main>请先登录后继续使用</main>")).toMatchObject({
      code: "LOGIN_REQUIRED"
    });
    expect(bossAdapter.detectBlockedPage?.("<main>请输入验证码进行验证</main>")).toMatchObject({
      code: "CAPTCHA_REQUIRED"
    });
    expect(bossAdapter.detectBlockedPage?.("<main>访问异常，请稍后再试</main>")).toMatchObject({
      code: "PLATFORM_BLOCKED"
    });
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

  it("returns a blocked result when the adapter detects a blocked page", async () => {
    const result = await executeSearchTask(
      {
        task_id: "task_boss_blocked",
        site: "boss",
        keyword: "TypeScript",
        created_at: "2026-05-09T00:00:00.000Z"
      },
      {
        adapterRegistry: createAdapterRegistry([bossAdapter]),
        html: "<main>请先登录后继续使用</main>"
      }
    );

    expect(result).toMatchObject({
      status: "blocked",
      error: {
        code: "LOGIN_REQUIRED"
      }
    });
    expect(result.action_log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "detect_blocked_page",
          status: "blocked"
        })
      ])
    );
  });

  it("fetches HTML from a local fixture page session", async () => {
    const server = await import("node:http").then(({ createServer }) =>
      createServer((_request, response) => {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end("<!doctype html><main data-fixture>ok</main>");
      })
    );

    const port = await listenOnFetchSafePort(server);
    try {
      const page = await fetchPageSession.open(`http://127.0.0.1:${port}/fixture`);

      expect(page.url).toContain("/fixture");
      expect(page.html).toContain("data-fixture");
    } finally {
      await closeServer(server);
    }
  });

  it("identifies fetch-forbidden ports for local fixture servers", () => {
    expect(isFetchForbiddenPort(6000)).toBe(true);
    expect(isFetchForbiddenPort(6667)).toBe(true);
    expect(isFetchForbiddenPort(10080)).toBe(true);
    expect(isFetchForbiddenPort(49152)).toBe(false);
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

const fetchForbiddenPorts = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79,
  87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137,
  139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723,
  2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6697, 10080
]);

function isFetchForbiddenPort(port: number): boolean {
  return fetchForbiddenPorts.has(port);
}

async function listenOnFetchSafePort(server: Server): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        server.off("error", onError);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      server.once("error", onError);
      server.listen(0, "127.0.0.1", () => {
        cleanup();
        resolve();
      });
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("fixture server did not expose a port");
    }
    if (!isFetchForbiddenPort(address.port)) {
      return address.port;
    }

    await closeServer(server);
  }

  throw new Error("fixture server could not find a fetch-safe port");
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
