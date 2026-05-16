import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listenOnFetchSafePort } from "@jobflow/browser-automation";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cliMain = join(scriptDir, "../dist/main.js");

let server;
let jobflowHome;

try {
  server = await startFixtureServer();
  jobflowHome = await mkdtemp(join(tmpdir(), "jobflow-cli-browser-smoke-"));

  const pageUrl = `http://127.0.0.1:${server.port}/search`;
  const search = await runCli(
    [
      "automation",
      "search",
      "--site",
      "fixture",
      "--keyword",
      "Automation",
      "--limit",
      "1",
      "--fixture-url",
      pageUrl,
      "--session",
      "chromium",
      "--process-results",
      "--json"
    ],
    { JOBFLOW_HOME: jobflowHome }
  );

  assertEqual(search.ok, true, "automation search ok");
  assertEqual(search.data.collected_count, 1, "collected_count");
  assertEqual(search.data.processed?.count, 1, "processed count");
  assertEqual(search.data.processed?.next_actions?.length, 1, "next action count");

  const state = await runCli(["state", "inspect", "--json"], { JOBFLOW_HOME: jobflowHome });
  assertEqual(state.ok, true, "state inspect ok");
  assertEqual(state.data.counts.ingests, 1, "ingest count");
  assertEqual(state.data.counts.jobs, 1, "job count");
  assertEqual(state.data.counts.scores, 1, "score count");
  assertEqual(state.data.counts.pipeline, 1, "pipeline count");
  assertEqual(state.data.counts.automation_tasks, 1, "automation task count");

  console.log(
    JSON.stringify(
      {
        ok: true,
        command: "cli.automation.fixture_browser_smoke",
        collected_count: search.data.collected_count,
        processed_count: search.data.processed?.count,
        next_action_count: search.data.processed?.next_actions?.length,
        state_counts: state.data.counts,
        actions: search.data.result.action_log.map((entry) => entry.action)
      },
      null,
      2
    )
  );
} finally {
  await closeServer(server?.instance);
  if (jobflowHome) {
    await rm(jobflowHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
  }
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
  <head><title>CLI Chromium fixture search</title></head>
  <body>
    <main>
      <article data-job-card data-url="https://example.test/jobs/cli-chromium-smoke">
        <h2 data-job-title>CLI Chromium Fixture Engineer</h2>
        <p data-company>CLI Browser Smoke Co</p>
        <p data-location>Remote</p>
        <p data-summary>Run CLI automation search through a local browser fixture.</p>
      </article>
    </main>
  </body>
</html>`);
  });

  const port = await listenOnFetchSafePort(instance);
  return { instance, port };
}

function runCli(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliMain, ...args], {
      env: {
        ...process.env,
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`CLI exited with ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`CLI did not emit JSON\nstdout:\n${stdout}\nstderr:\n${stderr}\n${error}`));
      }
    });
  });
}

async function closeServer(server) {
  if (!server?.listening) return;

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`Expected ${label} to be ${expected}, received ${actual}`);
  }
}
