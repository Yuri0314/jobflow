import type { ScoreRecord } from "@jobflow/schema";
import { Command } from "commander";
import { fail, ok, type JsonResponse, writeJson } from "../output.js";
import { createId } from "../runtime/ids.js";
import { scoreJob } from "../runtime/score.js";
import type { FsStore } from "../state/fs-store.js";

type ScoreOptions = {
  jobId: string;
};

export async function runScore(
  store: FsStore,
  options: ScoreOptions
): Promise<JsonResponse<{ score: ScoreRecord }>> {
  const state = await store.read();
  const job = state.jobs.find((candidate) => candidate.job_id === options.jobId);

  if (!job) {
    return fail("score", {
      code: "NOT_FOUND",
      message: `job not found: ${options.jobId}`
    });
  }

  const score = scoreJob(job, createId("score"), new Date().toISOString());
  state.scores.push(score);
  await store.write(state);

  return ok("score", { score });
}

export function registerScoreCommand(program: Command, store: FsStore): void {
  program
    .command("score")
    .description("score a normalized job")
    .requiredOption("--job-id <jobId>", "job ID")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runScore(store, options));
    });
}
