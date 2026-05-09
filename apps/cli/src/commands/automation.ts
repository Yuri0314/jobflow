import {
  createAdapterRegistry,
  createChromiumPageSession,
  bossAdapter,
  executeSearchTask,
  fetchPageSession,
  fixtureAdapter,
  searchTaskSchema,
  type AutomationPageSession,
  type ChromiumPageSession,
  type AutomationResult,
  type SearchTask
} from "@jobflow/browser-automation";
import {
  createAutomationSearchPersistence,
  getAutomationTask,
  listAutomationTasks,
  type NextItem,
  type FsStore,
  createId
} from "@jobflow/runtime";
import {
  automationTaskStatusSchema,
  type AutomationTaskRecord,
  type JobIngestRecord
} from "@jobflow/schema";
import { Command } from "commander";
import { z } from "zod";
import { runNext } from "./next.js";
import { runNormalize } from "./normalize.js";
import { runScore } from "./score.js";
import { fail, ok, type JsonError, type JsonResponse, writeJson } from "../output.js";

const searchOptionsSchema = z.object({
  site: z.enum(["fixture", "boss", "liepin", "lagou", "linkedin"]),
  keyword: z.string().min(1),
  session: z.enum(["fetch", "chromium"]).default("fetch"),
  city: z.string().min(1).optional(),
  limit: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      if (typeof value === "number") return value;
      if (typeof value === "string") return Number(value);
      return value;
    }, z.number().int().min(1).max(50).optional()),
  processResults: z.boolean().default(false),
  fixtureHtml: z.string().min(1).optional(),
  fixtureUrl: z.string().url().optional()
});

const numericLimitSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value;
}, z.number().int().min(1).max(50).optional());

const taskListOptionsSchema = z.object({
  limit: numericLimitSchema,
  status: automationTaskStatusSchema.optional()
});

const taskGetOptionsSchema = z.object({
  taskId: z.string().min(1)
});

type AutomationSearchData = {
  task: SearchTask;
  result: AutomationResult;
  collected_count: number;
  ingest_ids: string[];
  processed?: AutomationProcessedData;
};

type AutomationSearchDependencies = {
  fetchSession?: AutomationPageSession;
  createChromiumSession?: () => Promise<ChromiumPageSession>;
};

type AutomationTasksData = {
  items: AutomationTaskRecord[];
  count: number;
  total: number;
};

type AutomationTaskGetData = {
  task: AutomationTaskRecord;
};

type AutomationProcessedData = {
  count: number;
  job_ids: string[];
  score_ids: string[];
  next_actions: NextItem[];
};

export async function runAutomationSearch(
  store: FsStore,
  rawOptions: unknown,
  dependencies: AutomationSearchDependencies = {}
): Promise<JsonResponse<AutomationSearchData>> {
  const parsedOptions = searchOptionsSchema.safeParse(rawOptions);
  if (!parsedOptions.success) {
    return fail("automation.search", {
      code: "INVALID_INPUT",
      message: "invalid automation search options",
      details: parsedOptions.error.flatten()
    });
  }

  const startedAt = new Date().toISOString();
  const task = searchTaskSchema.parse({
    task_id: createId("task"),
    site: parsedOptions.data.site,
    keyword: parsedOptions.data.keyword,
    city: parsedOptions.data.city,
    limit: parsedOptions.data.limit,
    created_at: startedAt
  });
  const sessionSelection = parsedOptions.data.session;
  const hasControlledFixture = Boolean(parsedOptions.data.fixtureHtml || parsedOptions.data.fixtureUrl);

  if (task.site === "boss" && !hasControlledFixture) {
    const error = {
      code: "SITE_FIXTURE_REQUIRED",
      message: "BOSS automation is only enabled for controlled fixture HTML or fixture URL",
      details: {
        site: task.site
      }
    };
    await persistAutomationTask(store, {
      task,
      session: sessionSelection,
      status: "blocked",
      finishedAt: new Date().toISOString(),
      error,
      actionLog: [
        {
          at: new Date().toISOString(),
          action: "validate_site_fixture",
          status: "blocked",
          details: {
            site: task.site
          }
        }
      ]
    });
    return fail("automation.search", error);
  }

  if (!isSupportedAutomationSite(task.site)) {
    const error = {
      code: "ADAPTER_NOT_FOUND",
      message: `automation adapter is not available for site: ${task.site}`,
      details: {
        site: task.site
      }
    };
    await persistAutomationTask(store, {
      task,
      session: sessionSelection,
      status: "blocked",
      finishedAt: new Date().toISOString(),
      error,
      actionLog: [
        {
          at: new Date().toISOString(),
          action: "resolve_adapter",
          status: "blocked",
          details: {
            site: task.site
          }
        }
      ]
    });
    return fail("automation.search", error);
  }

  if (sessionSelection === "chromium" && !parsedOptions.data.fixtureUrl) {
    const error = {
      code: "INVALID_INPUT",
      message: "fixtureUrl is required when session is chromium"
    };
    await persistAutomationTask(store, {
      task,
      session: sessionSelection,
      status: "failed",
      finishedAt: new Date().toISOString(),
      error,
      actionLog: [
        {
          at: new Date().toISOString(),
          action: "validate_session",
          status: "failed",
          details: {
            session: sessionSelection
          }
        }
      ]
    });
    return fail("automation.search", error);
  }

  let closeableSession: ChromiumPageSession | undefined;

  let result: AutomationResult;
  try {
    closeableSession =
      sessionSelection === "chromium"
        ? await (dependencies.createChromiumSession ?? createDefaultChromiumSession)()
        : undefined;

    result = await executeSearchTask(task, {
      adapterRegistry: createAdapterRegistry([fixtureAdapter, bossAdapter]),
      pageSession:
        sessionSelection === "chromium"
          ? closeableSession
          : dependencies.fetchSession ?? fetchPageSession,
      pageUrl: parsedOptions.data.fixtureUrl,
      html:
        parsedOptions.data.fixtureUrl || sessionSelection === "chromium"
          ? parsedOptions.data.fixtureHtml
          : parsedOptions.data.fixtureHtml ?? createDefaultFixtureHtml(task)
    });
  } catch (error) {
    const jsonError = toJsonError(error);
    await persistAutomationTask(store, {
      task,
      session: sessionSelection,
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: jsonError,
      actionLog: [
        {
          at: new Date().toISOString(),
          action: "execute_search_task",
          status: "failed",
          details: {
            message: jsonError.message
          }
        }
      ]
    });
    return fail("automation.search", jsonError);
  } finally {
    await closeableSession?.close();
  }
  const persistence = await persistAutomationTask(store, {
    task,
    session: sessionSelection,
    status: result.status,
    startedAt: result.started_at,
    finishedAt: result.finished_at,
    persistedAt: new Date().toISOString(),
    collected: result.collected,
    actionLog: result.action_log,
    error: result.error
  });
  const resultWithPersist: AutomationResult = {
    ...result,
    action_log: persistence.taskRecord.action_log
  };
  const processed = parsedOptions.data.processResults
    ? await processCollectedIngests(
        store,
        persistence.ingests.map((record) => record.ingest_id)
      )
    : undefined;

  if (processed && !processed.ok) {
    return fail("automation.search", {
      code: "AUTOMATION_PROCESSING_FAILED",
      message: "automation search collected results but processing failed",
      details: {
        cause: processed.error
      }
    });
  }

  return ok("automation.search", {
    task,
    result: resultWithPersist,
    collected_count: persistence.ingests.length,
    ingest_ids: persistence.ingests.map((record) => record.ingest_id),
    processed: processed?.data
  });
}

export async function runAutomationTasks(
  store: FsStore,
  rawOptions: unknown
): Promise<JsonResponse<AutomationTasksData>> {
  const parsedOptions = taskListOptionsSchema.safeParse(rawOptions ?? {});
  if (!parsedOptions.success) {
    return fail("automation.tasks", {
      code: "INVALID_INPUT",
      message: "invalid automation task list options",
      details: parsedOptions.error.flatten()
    });
  }

  const { automation_tasks: tasks } = await store.read();

  return ok("automation.tasks", listAutomationTasks(tasks, parsedOptions.data));
}

export async function runAutomationTaskGet(
  store: FsStore,
  rawOptions: unknown
): Promise<JsonResponse<AutomationTaskGetData>> {
  const parsedOptions = taskGetOptionsSchema.safeParse(rawOptions);
  if (!parsedOptions.success) {
    return fail("automation.task", {
      code: "INVALID_INPUT",
      message: "invalid automation task lookup options",
      details: parsedOptions.error.flatten()
    });
  }

  const { automation_tasks: tasks } = await store.read();
  const task = getAutomationTask(tasks, parsedOptions.data.taskId);

  if (!task) {
    return fail("automation.task", {
      code: "NOT_FOUND",
      message: `automation task not found: ${parsedOptions.data.taskId}`
    });
  }

  return ok("automation.task", { task });
}

export function registerAutomationCommand(program: Command, store: FsStore): void {
  const automation = program
    .command("automation")
    .description("run experimental browser automation tasks");

  automation
    .command("search")
    .description("search jobs through a site adapter")
    .requiredOption("--site <site>", "site adapter: fixture, boss, liepin, lagou, linkedin")
    .requiredOption("--keyword <keyword>", "search keyword")
    .option("--city <city>", "search city")
    .option("--limit <limit>", "maximum number of jobs to collect")
    .option("--session <session>", "page session: fetch, chromium", "fetch")
    .option("--process-results", "normalize, score, and summarize collected results")
    .option("--fixture-html <fixtureHtml>", "inline fixture HTML for local smoke testing")
    .option("--fixture-url <fixtureUrl>", "local fixture page URL for automation smoke testing")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runAutomationSearch(store, options));
    });

  automation
    .command("tasks")
    .description("list automation task audit records")
    .option("--limit <limit>", "maximum number of tasks to return")
    .option(
      "--status <status>",
      "filter by status: queued, running, completed, failed, blocked"
    )
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runAutomationTasks(store, options));
    });

  automation
    .command("task")
    .description("get one automation task audit record")
    .requiredOption("--task-id <taskId>", "automation task id")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runAutomationTaskGet(store, options));
    });
}

async function processCollectedIngests(
  store: FsStore,
  ingestIds: string[]
): Promise<JsonResponse<AutomationProcessedData>> {
  const jobIds: string[] = [];
  const scoreIds: string[] = [];

  for (const ingestId of ingestIds) {
    const normalized = await runNormalize(store, { ingestId });
    if (!normalized.ok) {
      return fail("automation.process", normalized.error);
    }

    const jobId = normalized.data.job.job_id;
    jobIds.push(jobId);

    const scored = await runScore(store, { jobId });
    if (!scored.ok) {
      return fail("automation.process", scored.error);
    }
    scoreIds.push(scored.data.score.score_id);
  }

  const next = await runNext(store);
  const nextActions = next.data.items.filter((item) => jobIds.includes(item.job_id));

  return ok("automation.process", {
    count: jobIds.length,
    job_ids: jobIds,
    score_ids: scoreIds,
    next_actions: nextActions
  });
}

function isSupportedAutomationSite(site: SearchTask["site"]): boolean {
  return site === "fixture" || site === "boss";
}

async function createDefaultChromiumSession(): Promise<ChromiumPageSession> {
  return createChromiumPageSession({ headless: true });
}

function createDefaultFixtureHtml(task: SearchTask): string {
  const location = escapeHtml(task.city ?? "Remote");
  const keyword = escapeHtml(task.keyword);

  return `<!doctype html>
<main>
  <article data-job-card data-url="https://fixture.jobflow.local/jobs/${encodeURIComponent(
    task.task_id
  )}">
    <h2 data-job-title>${keyword} Engineer</h2>
    <p data-company>Fixture Company</p>
    <p data-location>${location}</p>
    <p data-summary>Fixture search result generated for ${keyword}.</p>
  </article>
</main>`;
}

type AutomationTaskInput = {
  task: SearchTask;
  session: "fetch" | "chromium";
  status: AutomationResult["status"];
  startedAt?: string;
  finishedAt?: string;
  persistedAt?: string;
  collected?: AutomationResult["collected"];
  actionLog?: AutomationTaskRecord["action_log"];
  error?: JsonError;
};

type PersistedAutomationTask = {
  taskRecord: AutomationTaskRecord;
  ingests: JobIngestRecord[];
};

async function persistAutomationTask(
  store: FsStore,
  input: AutomationTaskInput
): Promise<PersistedAutomationTask> {
  const persistence = createAutomationSearchPersistence({
    task: input.task,
    session: input.session,
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    persistedAt: input.persistedAt,
    collected: input.collected,
    actionLog: input.actionLog,
    error: input.error,
    createIngestId: () => createId("ingest")
  });
  const state = await store.read();
  state.ingests.push(...persistence.ingests);
  state.automation_tasks.push(persistence.taskRecord);
  await store.write(state);

  return persistence;
}

function toJsonError(error: unknown): JsonError {
  return {
    code: "AUTOMATION_FAILED",
    message: error instanceof Error ? error.message : "automation search failed"
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
