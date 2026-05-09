import type { JobRecord, PipelineRecord } from "@jobflow/schema";
import { createId, normalizeIngest, type FsStore } from "@jobflow/runtime";
import { Command } from "commander";
import { fail, ok, type JsonResponse, writeJson } from "../output.js";

type NormalizeOptions = {
  ingestId: string;
};

export async function runNormalize(
  store: FsStore,
  options: NormalizeOptions
): Promise<JsonResponse<{ job: JobRecord }>> {
  const state = await store.read();
  const ingestIndex = state.ingests.findIndex((ingest) => ingest.ingest_id === options.ingestId);

  if (ingestIndex === -1) {
    return fail("normalize", {
      code: "NOT_FOUND",
      message: `ingest not found: ${options.ingestId}`
    });
  }

  const ingest = state.ingests[ingestIndex];
  const existingJob = ingest.job_id
    ? state.jobs.find((job) => job.job_id === ingest.job_id)
    : findDuplicateJob(state.jobs, ingest.job_url);

  if (existingJob) {
    state.ingests[ingestIndex] = { ...ingest, job_id: existingJob.job_id };
    await store.write(state);
    return ok("normalize", { job: existingJob }, ["reused existing job"]);
  }

  const now = new Date().toISOString();
  const job = normalizeIngest(ingest, createId("job"), now);
  state.jobs.push(job);
  state.ingests[ingestIndex] = { ...ingest, job_id: job.job_id };

  if (!state.pipeline.some((entry) => entry.job_id === job.job_id)) {
    state.pipeline.push(createInitialPipeline(job.job_id, now));
  }

  await store.write(state);
  return ok("normalize", { job });
}

function findDuplicateJob(jobs: JobRecord[], jobUrl: string | undefined): JobRecord | undefined {
  if (!jobUrl) return undefined;
  return jobs.find((job) => job.canonical_url === jobUrl);
}

function createInitialPipeline(jobId: string, now: string): PipelineRecord {
  return {
    job_id: jobId,
    status: "new",
    priority: "medium",
    updated_at: now
  };
}

export function registerNormalizeCommand(program: Command, store: FsStore): void {
  program
    .command("normalize")
    .description("derive a normalized job record")
    .requiredOption("--ingest-id <ingestId>", "ingest record ID")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runNormalize(store, options));
    });
}
