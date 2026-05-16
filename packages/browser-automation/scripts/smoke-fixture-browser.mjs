import { createServer } from "node:http";
import {
  createAdapterRegistry,
  createChromiumPageSession,
  executeSearchTask,
  fixtureAdapter,
  listenOnFetchSafePort
} from "../dist/index.js";

let server;
let session;

try {
  server = await startFixtureServer();
  const pageUrl = `http://127.0.0.1:${server.port}/search`;
  session = await createChromiumPageSession({
    headless: process.env.JOBFLOW_SMOKE_HEADLESS !== "0"
  });

  const result = await executeSearchTask(
    {
      task_id: "task_smoke_fixture_browser",
      site: "fixture",
      keyword: "Automation",
      limit: 1,
      created_at: new Date().toISOString()
    },
    {
      adapterRegistry: createAdapterRegistry([fixtureAdapter]),
      pageSession: session,
      pageUrl
    }
  );

  if (result.status !== "completed") {
    throw new Error(`Expected completed result, received ${result.status}`);
  }
  if (result.collected.length !== 1) {
    throw new Error(`Expected one collected job, received ${result.collected.length}`);
  }
  assertEqual(result.collected[0].title_hint, "Chromium Fixture Engineer", "title_hint");
  assertEqual(result.collected[0].company_hint, "Browser Smoke Co", "company_hint");

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: result.status,
        collected_count: result.collected.length,
        title: result.collected[0].title_hint,
        actions: result.action_log.map((entry) => entry.action)
      },
      null,
      2
    )
  );
} finally {
  await session?.close();
  await new Promise((resolveClose) => server?.instance.close(resolveClose));
}

async function startFixtureServer() {
  const instance = createServer((request, response) => {
    if (request.url !== "/search") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
<html>
  <head><title>Chromium fixture search</title></head>
  <body>
    <main>
      <article data-job-card data-url="https://example.test/jobs/chromium-smoke">
        <h2 data-job-title>Chromium Fixture Engineer</h2>
        <p data-company>Browser Smoke Co</p>
        <p data-location>Remote</p>
        <p data-summary>Open a local page through Chromium CDP and collect the result.</p>
      </article>
    </main>
  </body>
</html>`);
  });

  const port = await listenOnFetchSafePort(instance);
  return { instance, port };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`Expected ${label} to be ${expected}, received ${actual}`);
  }
}
