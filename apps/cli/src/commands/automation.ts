import {
  createAdapterRegistry,
  createChromiumPageSession,
  executeSearchTask,
  fetchPageSession,
  fixtureAdapter,
  searchTaskSchema,
  type AutomationPageSession,
  type ChromiumPageSession,
  type AutomationResult,
  type SearchTask
} from "@jobflow/browser-automation";
import { type FsStore, createId } from "@jobflow/runtime";
import {
  automationTaskRecordSchema,
  jobIngestRecordSchema,
  type AutomationTaskRecord,
  type JobIngestRecord
} from "@jobflow/schema";
import { Command } from "commander";
import { z } from "zod";
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
  fixtureHtml: z.string().min(1).optional(),
  fixtureUrl: z.string().url().optional()
});

type AutomationSearchData = {
  task: SearchTask;
  result: AutomationResult;
  collected_count: number;
  ingest_ids: string[];
};

type AutomationSearchDependencies = {
  fetchSession?: AutomationPageSession;
  createChromiumSession?: () => Promise<ChromiumPageSession>;
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

  if (task.site !== "fixture") {
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
      adapterRegistry: createAdapterRegistry([fixtureAdapter]),
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
  const collected = result.collected;

  const records = collected.map((payload) =>
    jobIngestRecordSchema.parse({
      ...payload,
      ingest_id: createId("ingest")
    })
  );

  const persistAction = {
    at: new Date().toISOString(),
    action: "persist_ingests",
    status: "completed" as const,
    details: {
      ingest_ids: records.map((record) => record.ingest_id)
    }
  };
  const resultWithPersist: AutomationResult = {
    ...result,
    action_log: [...result.action_log, persistAction]
  };

  await persistAutomationTask(
    store,
    {
      task,
      session: sessionSelection,
      status: result.status,
      startedAt: result.started_at,
      finishedAt: result.finished_at,
      collectedCount: collected.length,
      ingestIds: records.map((record) => record.ingest_id),
      actionLog: resultWithPersist.action_log,
      error: result.error
    },
    records
  );

  return ok("automation.search", {
    task,
    result: resultWithPersist,
    collected_count: collected.length,
    ingest_ids: records.map((record) => record.ingest_id)
  });
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
    .option("--fixture-html <fixtureHtml>", "inline fixture HTML for local smoke testing")
    .option("--fixture-url <fixtureUrl>", "local fixture page URL for automation smoke testing")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runAutomationSearch(store, options));
    });
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
  collectedCount?: number;
  ingestIds?: string[];
  actionLog?: AutomationTaskRecord["action_log"];
  error?: JsonError;
};

async function persistAutomationTask(
  store: FsStore,
  input: AutomationTaskInput,
  records: JobIngestRecord[] = []
): Promise<void> {
  const state = await store.read();
  state.ingests.push(...records);
  state.automation_tasks.push(createAutomationTaskRecord(input));
  await store.write(state);
}

function createAutomationTaskRecord(input: AutomationTaskInput): AutomationTaskRecord {
  return automationTaskRecordSchema.parse({
    task_id: input.task.task_id,
    kind: "search",
    site: input.task.site,
    keyword: input.task.keyword,
    city: input.task.city,
    session: input.session,
    status: input.status,
    created_at: input.task.created_at,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    collected_count: input.collectedCount ?? 0,
    ingest_ids: input.ingestIds ?? [],
    action_log: input.actionLog ?? [],
    error: input.error
  });
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
