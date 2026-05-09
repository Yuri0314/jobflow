import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import type { AutomationPage, AutomationPageSession } from "./page-session.js";

type EnvLike = Record<string, string | undefined>;
type ExistsFn = (path: string) => boolean;

export type ChromiumLaunchArgsOptions = {
  userDataDir: string;
  debuggingPort: number;
  url: string;
  headless?: boolean;
};

export type ChromiumPageSessionOptions = {
  browserPath?: string;
  userDataDir?: string;
  debuggingPort?: number;
  headless?: boolean;
  keepProfile?: boolean;
};

export type ChromiumPageSession = AutomationPageSession & {
  close(): Promise<void>;
};

type DevToolsTarget = {
  id: string;
  url?: string;
  type?: string;
  webSocketDebuggerUrl?: string;
};

type RuntimeEvaluateResult = {
  result?: {
    value?: unknown;
  };
};

type PendingMessage = {
  resolve(value: unknown): void;
  reject(error: Error): void;
};

class CdpClient {
  static async connect(url: string): Promise<CdpClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", () => resolveOpen(), { once: true });
      socket.addEventListener("error", () => rejectOpen(new Error("CDP WebSocket failed")), {
        once: true
      });
    });
    return new CdpClient(socket);
  }

  private nextId = 1;
  private pending = new Map<number, PendingMessage>();

  private constructor(private readonly socket: WebSocket) {
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;

      const pending = this.pending.get(message.id);
      if (!pending) return;

      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    });
  }

  send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId;
    this.nextId += 1;
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject
      });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close(): void {
    this.socket.close();
  }
}

export function findChromiumExecutable(
  env: EnvLike = process.env,
  exists: ExistsFn = existsSync
): string | undefined {
  for (const explicitPath of [env.CHROME_PATH, env.EDGE_PATH].filter(Boolean)) {
    if (explicitPath && exists(explicitPath)) {
      return explicitPath;
    }
  }

  const candidates = [
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    env.LOCALAPPDATA ? `${env.LOCALAPPDATA}/Microsoft/Edge/Application/msedge.exe` : undefined,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    env.LOCALAPPDATA ? `${env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe` : undefined
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => exists(candidate));
}

export function buildChromiumLaunchArgs(options: ChromiumLaunchArgsOptions): string[] {
  const args = [
    `--user-data-dir=${options.userDataDir}`,
    `--remote-debugging-port=${options.debuggingPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking"
  ];

  if (options.headless) {
    args.push("--headless=new");
  }

  args.push("--new-window", options.url);
  return args;
}

export async function createChromiumPageSession(
  options: ChromiumPageSessionOptions = {}
): Promise<ChromiumPageSession> {
  const browserPath = options.browserPath ?? findChromiumExecutable();
  if (!browserPath) {
    throw new Error("Could not find Chrome or Edge. Set CHROME_PATH or EDGE_PATH.");
  }
  const executablePath = browserPath;

  const debuggingPort = options.debuggingPort ?? (await findFreePort());
  const userDataDir = options.userDataDir ?? (await mkdtemp(join(tmpdir(), "jobflow-chromium-")));
  const ownsProfile = !options.userDataDir;
  let browser: ChildProcess | undefined;

  async function open(url: string): Promise<AutomationPage> {
    const launchedBrowser = spawn(
      executablePath,
      buildChromiumLaunchArgs({
        userDataDir,
        debuggingPort,
        url,
        headless: options.headless ?? false
      }),
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    browser = launchedBrowser;

    const output: string[] = [];
    launchedBrowser.stdout?.on("data", (chunk) => output.push(chunk.toString()));
    launchedBrowser.stderr?.on("data", (chunk) => output.push(chunk.toString()));
    launchedBrowser.on("exit", (code) => {
      if (code !== null && code !== 0 && process.env.JOBFLOW_SMOKE_DEBUG === "1") {
        console.error(`Chromium exited with code ${code}:\n${output.join("")}`);
      }
    });

    await waitForDevTools(debuggingPort);
    const target = await waitForTarget(debuggingPort, (item) => item.url === url);
    await activateTarget(debuggingPort, target.id);

    if (!target.webSocketDebuggerUrl) {
      throw new Error("Chromium target did not expose a CDP WebSocket URL");
    }

    const client = await CdpClient.connect(target.webSocketDebuggerUrl);
    try {
      await client.send("Runtime.enable");
      const evaluated = await client.send<RuntimeEvaluateResult>("Runtime.evaluate", {
        expression: "document.documentElement.outerHTML",
        awaitPromise: true,
        returnByValue: true
      });
      const html = evaluated.result?.value;
      if (typeof html !== "string") {
        throw new Error("Chromium did not return page HTML");
      }

      return {
        url: target.url ?? url,
        html
      };
    } finally {
      client.close();
    }
  }

  async function close(): Promise<void> {
    if (browser && !browser.killed) {
      browser.kill();
      await Promise.race([once(browser, "exit"), delay(5000)]);
    }
    if (ownsProfile && !options.keepProfile) {
      await rm(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
    }
  }

  return { open, close };
}

async function findFreePort(): Promise<number> {
  const instance = createServer();
  await new Promise<void>((resolveListen) => instance.listen(0, "127.0.0.1", resolveListen));
  const address = instance.address();
  await new Promise<void>((resolveClose) => instance.close(() => resolveClose()));
  if (!address || typeof address === "string") {
    throw new Error("Could not reserve debugging port");
  }
  return address.port;
}

async function waitForDevTools(port: number): Promise<void> {
  await retry(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (!response.ok) {
      throw new Error(`DevTools not ready: ${response.status}`);
    }
  });
}

async function waitForTarget(
  port: number,
  predicate: (target: DevToolsTarget) => boolean
): Promise<DevToolsTarget> {
  return retry(async () => {
    const targets = await listTargets(port);
    const target = targets.find(predicate);
    if (!target) {
      throw new Error("Chromium target not found yet");
    }
    return target;
  });
}

async function listTargets(port: number): Promise<DevToolsTarget[]> {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) {
    throw new Error(`Could not list Chromium targets: ${response.status}`);
  }
  return response.json() as Promise<DevToolsTarget[]>;
}

async function activateTarget(port: number, targetId: string): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${port}/json/activate/${targetId}`);
  if (!response.ok) {
    throw new Error(`Could not activate Chromium target ${targetId}: ${response.status}`);
  }
}

async function retry<T>(task: () => Promise<T>, attempts = 40): Promise<T> {
  let lastError: unknown;
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
