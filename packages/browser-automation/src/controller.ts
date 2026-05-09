import type { AdapterRegistry } from "./adapter.js";
import { automationResultSchema, type AutomationResult } from "./result.js";
import { searchTaskSchema, type SearchTask } from "./task.js";
import type { AutomationPageSession } from "./page-session.js";

export type ExecuteSearchTaskOptions = {
  adapterRegistry: AdapterRegistry;
  pageSession?: AutomationPageSession;
  pageUrl?: string;
  html?: string;
};

export async function executeSearchTask(
  rawTask: SearchTask,
  options: ExecuteSearchTaskOptions
): Promise<AutomationResult> {
  const task = searchTaskSchema.parse(rawTask);
  const startedAt = new Date().toISOString();
  const adapter = options.adapterRegistry.get(task.site);

  if (!adapter) {
    return automationResultSchema.parse({
      task_id: task.task_id,
      status: "blocked",
      site: task.site,
      collected: [],
      action_log: [],
      error: {
        code: "ADAPTER_NOT_FOUND",
        message: `automation adapter is not available for site: ${task.site}`,
        details: {
          site: task.site
        }
      },
      started_at: startedAt,
      finished_at: new Date().toISOString()
    });
  }

  const actionLog = [];
  let html = options.html;

  if (options.pageUrl) {
    if (!options.pageSession) {
      return automationResultSchema.parse({
        task_id: task.task_id,
        status: "failed",
        site: task.site,
        collected: [],
        action_log: [],
        error: {
          code: "PAGE_NAVIGATION_FAILED",
          message: "pageUrl requires a pageSession"
        },
        started_at: startedAt,
        finished_at: new Date().toISOString()
      });
    }

    const page = await options.pageSession.open(options.pageUrl);
    html = page.html;
    actionLog.push({
      at: new Date().toISOString(),
      action: "open_page",
      status: "completed" as const,
      details: {
        url: page.url
      }
    });
  }

  if (!html) {
    return automationResultSchema.parse({
      task_id: task.task_id,
      status: "failed",
      site: task.site,
      collected: [],
      action_log: actionLog,
      error: {
        code: "RESULTS_NOT_FOUND",
        message: "automation search requires html or pageUrl"
      },
      started_at: startedAt,
      finished_at: new Date().toISOString()
    });
  }

  const collected = adapter.parseSearchResults(html, startedAt, task).slice(0, task.limit ?? 50);
  actionLog.push({
    at: new Date().toISOString(),
    action: "parse_search_results",
    status: "completed" as const,
    details: {
      collected_count: collected.length
    }
  });

  return automationResultSchema.parse({
    task_id: task.task_id,
    status: "completed",
    site: task.site,
    collected,
    action_log: actionLog,
    started_at: startedAt,
    finished_at: new Date().toISOString()
  });
}
