import { type PipelineRecord, pipelineStatusSchema, prioritySchema } from "@jobflow/schema";
import { canTransitionPipelineStatus, type FsStore } from "@jobflow/runtime";
import { Command } from "commander";
import { fail, ok, type JsonResponse, writeJson } from "../output.js";

type PipelineUpdateOptions = {
  jobId: string;
  status: PipelineRecord["status"];
  priority?: PipelineRecord["priority"];
  nextAction?: string;
};

export async function runPipelineUpdate(
  store: FsStore,
  options: PipelineUpdateOptions
): Promise<JsonResponse<{ pipeline: PipelineRecord }>> {
  const parsedStatus = pipelineStatusSchema.safeParse(options.status);
  const parsedPriority = options.priority ? prioritySchema.safeParse(options.priority) : undefined;

  if (!parsedStatus.success || parsedPriority?.success === false) {
    return fail("pipeline.update", {
      code: "INVALID_INPUT",
      message: "invalid pipeline status or priority"
    });
  }

  const state = await store.read();
  const job = state.jobs.find((candidate) => candidate.job_id === options.jobId);

  if (!job) {
    return fail("pipeline.update", {
      code: "NOT_FOUND",
      message: `job not found: ${options.jobId}`
    });
  }

  const existingIndex = state.pipeline.findIndex((entry) => entry.job_id === options.jobId);
  const existing = existingIndex >= 0 ? state.pipeline[existingIndex] : undefined;

  if (existing && !canTransitionPipelineStatus(existing.status, parsedStatus.data)) {
    return fail("pipeline.update", {
      code: "PIPELINE_UPDATE_FAILED",
      message: `cannot transition pipeline from ${existing.status} to ${parsedStatus.data}`
    });
  }

  const updated: PipelineRecord = {
    job_id: options.jobId,
    status: parsedStatus.data,
    priority: parsedPriority?.success ? parsedPriority.data : existing?.priority ?? "medium",
    next_action: options.nextAction ?? existing?.next_action,
    follow_up_at: existing?.follow_up_at,
    notes: existing?.notes,
    resume_id: existing?.resume_id,
    updated_at: new Date().toISOString(),
    closed_reason: existing?.closed_reason
  };

  if (existingIndex >= 0) {
    state.pipeline[existingIndex] = updated;
  } else {
    state.pipeline.push(updated);
  }

  await store.write(state);
  return ok("pipeline.update", { pipeline: updated });
}

export function registerPipelineCommand(program: Command, store: FsStore): void {
  const pipeline = program.command("pipeline").description("manage job pipeline state");

  pipeline
    .command("list")
    .description("list pipeline records")
    .option("--json", "emit JSON output", true)
    .action(async () => {
      const state = await store.read();
      writeJson(ok("pipeline.list", { items: state.pipeline }));
    });

  pipeline
    .command("get")
    .description("get one pipeline record")
    .requiredOption("--job-id <jobId>", "job ID")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      const state = await store.read();
      const pipelineRecord = state.pipeline.find((entry) => entry.job_id === options.jobId);
      writeJson(
        pipelineRecord
          ? ok("pipeline.get", { pipeline: pipelineRecord })
          : fail("pipeline.get", {
              code: "NOT_FOUND",
              message: `pipeline record not found: ${options.jobId}`
            })
      );
    });

  pipeline
    .command("update")
    .description("update one pipeline record")
    .requiredOption("--job-id <jobId>", "job ID")
    .requiredOption("--status <status>", "new, saved, reviewing, ready, applied, follow_up, closed")
    .option("--priority <priority>", "low, medium, high")
    .option("--next-action <nextAction>", "next action text")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runPipelineUpdate(store, options));
    });
}
