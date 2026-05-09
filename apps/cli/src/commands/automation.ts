import {
  createAdapterRegistry,
  executeSearchTask,
  fetchPageSession,
  fixtureAdapter,
  searchTaskSchema,
  type AutomationResult,
  type SearchTask
} from "@jobflow/browser-automation";
import { type FsStore, createId } from "@jobflow/runtime";
import { jobIngestRecordSchema } from "@jobflow/schema";
import { Command } from "commander";
import { z } from "zod";
import { fail, ok, type JsonResponse, writeJson } from "../output.js";

const searchOptionsSchema = z.object({
  site: z.enum(["fixture", "boss", "liepin", "lagou", "linkedin"]),
  keyword: z.string().min(1),
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

export async function runAutomationSearch(
  store: FsStore,
  rawOptions: unknown
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

  if (task.site !== "fixture") {
    return fail("automation.search", {
      code: "ADAPTER_NOT_FOUND",
      message: `automation adapter is not available for site: ${task.site}`,
      details: {
        site: task.site
      }
    });
  }

  const result = await executeSearchTask(task, {
    adapterRegistry: createAdapterRegistry([fixtureAdapter]),
    pageSession: fetchPageSession,
    pageUrl: parsedOptions.data.fixtureUrl,
    html: parsedOptions.data.fixtureHtml ?? createDefaultFixtureHtml(task)
  });
  const collected = result.collected;

  const records = collected.map((payload) =>
    jobIngestRecordSchema.parse({
      ...payload,
      ingest_id: createId("ingest")
    })
  );

  if (records.length > 0) {
    const state = await store.read();
    state.ingests.push(...records);
    await store.write(state);
  }

  result.action_log.push({
    at: new Date().toISOString(),
    action: "persist_ingests",
    status: "completed",
    details: {
      ingest_ids: records.map((record) => record.ingest_id)
    }
  });

  return ok("automation.search", {
    task,
    result,
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
    .option("--fixture-html <fixtureHtml>", "inline fixture HTML for local smoke testing")
    .option("--fixture-url <fixtureUrl>", "local fixture page URL for automation smoke testing")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runAutomationSearch(store, options));
    });
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
