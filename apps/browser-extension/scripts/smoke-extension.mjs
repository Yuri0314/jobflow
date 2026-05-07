import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = resolve(packageDir, "dist");
const smokeTmpRoot = resolve(packageDir, ".tmp");
await mkdir(smokeTmpRoot, { recursive: true });
const profileDir = await mkdtemp(resolve(smokeTmpRoot, "profile-"));
const packedExtensionDir = resolve(profileDir, "jobflow-extension");
const extensionDirForChrome = packedExtensionDir.replaceAll("\\", "/");
let browser;
let server;
let ok = false;
let browserOutput = "";

class CdpClient {
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", resolveOpen, { once: true });
      socket.addEventListener("error", rejectOpen, { once: true });
    });
    return new CdpClient(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });
    const promise = new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
    });
    this.socket.send(payload);
    return promise;
  }

  close() {
    this.socket.close();
    return Promise.resolve();
  }
}

try {
  assertBuiltExtension();
  await cp(extensionDir, packedExtensionDir, { recursive: true });

  server = await startFixtureServer();
  const pageUrl = `http://127.0.0.1:${server.port}/test-job.html`;
  const debuggingPort = await findFreePort();
  const browserPath = findBrowserExecutable();
  const browserArgs = [
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${debuggingPort}`,
    `--disable-extensions-except=${extensionDirForChrome}`,
    `--load-extension=${extensionDirForChrome}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    "--enable-logging=stderr",
    "--v=1",
    "--new-window",
    pageUrl
  ];

  if (process.env.JOBFLOW_SMOKE_DEBUG === "1") {
    console.error(`Launching browser: ${browserPath}`);
    console.error(`Browser args: ${JSON.stringify(browserArgs, null, 2)}`);
  }

  browser = spawn(browserPath, browserArgs, { stdio: ["ignore", "pipe", "pipe"] });
  browser.stdout?.on("data", (chunk) => {
    browserOutput += chunk.toString();
  });
  browser.stderr?.on("data", (chunk) => {
    browserOutput += chunk.toString();
  });

  browser.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`Browser exited early with code ${code}`);
    }
  });

  await waitForDevTools(debuggingPort);
  if (process.env.JOBFLOW_SMOKE_DEBUG === "1") {
    console.error(`DevTools targets after launch: ${JSON.stringify(await listTargets(debuggingPort), null, 2)}`);
  }
  const pageTarget = await waitForTarget(debuggingPort, (target) => target.url === pageUrl);
  await activateTarget(debuggingPort, pageTarget.id);

  const backgroundTarget = await waitForTarget(
    debuggingPort,
    (target) => target.type === "service_worker" && target.url?.endsWith("/background.global.js")
  );

  const client = await CdpClient.connect(backgroundTarget.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  const envelope = await captureEnvelopeFromBackground(client);

  assertEqual(envelope.version, "1", "version");
  assertEqual(envelope.type, "ingest_job", "type");
  assertEqual(envelope.payload.source_type, "extension", "source_type");
  assertEqual(envelope.payload.source_site, "unknown", "source_site");
  assertIncludes(envelope.payload.page_url, pageUrl, "page_url");
  assertIncludes(envelope.payload.raw_text, "Senior TypeScript Engineer", "raw_text");

  console.log(
    JSON.stringify(
      {
        ok: true,
        browser: browserPath,
        extension_url: backgroundTarget.url,
        page_url: envelope.payload.page_url,
        type: envelope.type,
        raw_text_chars: envelope.payload.raw_text.length
      },
      null,
      2
    )
  );

  await client.close();
  ok = true;
} finally {
  if (!ok && process.env.JOBFLOW_SMOKE_DEBUG === "1" && browserOutput.trim()) {
    console.error(`Browser output:\n${browserOutput.trim()}`);
  }
  if (browser && !browser.killed) {
    browser.kill();
    await Promise.race([once(browser, "exit"), delay(5000)]);
  }
  await new Promise((resolveClose) => server?.instance.close(resolveClose));
  if (process.env.JOBFLOW_KEEP_PROFILE === "1" && !ok) {
    console.error(`Keeping failed smoke profile for inspection: ${profileDir}`);
  } else {
    await retry(
      () => rm(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 }),
      8
    );
  }
}

function assertBuiltExtension() {
  const requiredFiles = [
    "manifest.json",
    "background.global.js",
    "content.global.js",
    "popup.global.js",
    "popup.html"
  ];
  for (const file of requiredFiles) {
    const path = resolve(extensionDir, file);
    if (!existsSync(path)) {
      throw new Error(`Missing built extension asset: ${path}. Run pnpm build first.`);
    }
  }
  const manifest = JSON.parse(readFileSyncUtf8(resolve(extensionDir, "manifest.json")));
  assertEqual(manifest.name, "Jobflow Capture", "extension name");
  if (!manifest.key) {
    throw new Error("Built extension manifest must include a stable key for E2E smoke tests");
  }
}

function readFileSyncUtf8(path) {
  return readFileSync(path, "utf8");
}

async function startFixtureServer() {
  const instance = createServer((request, response) => {
    if (request.url !== "/test-job.html") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
<html>
  <head><title>Senior TypeScript Engineer - Smoke Corp</title></head>
  <body>
    <article>
      <h1>Senior TypeScript Engineer</h1>
      <p>Smoke Corp - Remote - Full-time</p>
      <p>Build TypeScript services, browser extension integrations, and CLI workflows.</p>
      <p>Own protocol envelope capture and local-first data handoff.</p>
    </article>
  </body>
</html>`);
  });

  await new Promise((resolveListen) => instance.listen(0, "127.0.0.1", resolveListen));
  const address = instance.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start fixture server");
  }
  return { instance, port: address.port };
}

async function findFreePort() {
  const instance = createServer();
  await new Promise((resolveListen) => instance.listen(0, "127.0.0.1", resolveListen));
  const address = instance.address();
  await new Promise((resolveClose) => instance.close(resolveClose));
  if (!address || typeof address === "string") {
    throw new Error("Could not reserve debugging port");
  }
  return address.port;
}

function findBrowserExecutable() {
  for (const explicitPath of [process.env.CHROME_PATH, process.env.EDGE_PATH].filter(Boolean)) {
    if (existsSync(explicitPath)) {
      return explicitPath;
    }
  }

  const candidates = [
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    `${process.env.LOCALAPPDATA}/Microsoft/Edge/Application/msedge.exe`,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`
  ].filter(Boolean);

  const browserPath = candidates.find((candidate) => existsSync(candidate));
  if (!browserPath) {
    throw new Error("Could not find Chrome or Edge. Set CHROME_PATH or EDGE_PATH.");
  }
  return browserPath;
}

async function waitForDevTools(port) {
  await retry(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (!response.ok) {
      throw new Error(`DevTools not ready: ${response.status}`);
    }
    return response.json();
  });
}

async function waitForTarget(port, predicate) {
  return retry(async () => {
    const targets = await listTargets(port);
    const target = targets.find(predicate);
    if (!target) {
      throw new Error("Target not found yet");
    }
    return target;
  });
}

async function listTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) {
    throw new Error(`Could not list targets: ${response.status}`);
  }
  return response.json();
}

async function activateTarget(port, targetId) {
  const response = await fetch(`http://127.0.0.1:${port}/json/activate/${targetId}`);
  if (!response.ok) {
    throw new Error(`Could not activate target ${targetId}: ${response.status}`);
  }
}

async function captureEnvelopeFromBackground(client) {
  return retry(async () => {
    const result = await client.send("Runtime.evaluate", {
      expression: `jobflowSmokeCaptureActiveTab()`,
      awaitPromise: true,
      returnByValue: true
    });
    const envelope = result.result?.value;
    if (envelope?.type !== "ingest_job") {
      throw new Error("Background capture did not return an ingest_job envelope yet");
    }
    return envelope;
  }, 20);
}

async function retry(task, attempts = 40) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }
  throw lastError;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`Expected ${label} to be ${expected}, received ${actual}`);
  }
}

function assertIncludes(actual, expected, label) {
  if (!actual?.includes(expected)) {
    throw new Error(`Expected ${label} to include ${expected}, received ${actual}`);
  }
}
