import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Command } from "commander";
import { fail, ok, type JsonResponse, writeJson } from "../output.js";
import type { FsStore } from "../state/fs-store.js";
import type { JobflowState } from "../state/state-schema.js";

type StateCounts = {
  ingests: number;
  jobs: number;
  scores: number;
  pipeline: number;
  resumes: number;
};

type DefaultResumeSummary = {
  resume_id: string;
  label: string;
} | null;

type StateInspectResult = {
  counts: StateCounts;
  default_resume: DefaultResumeSummary;
  latest_updated_at: string | null;
};

type StateExportOptions = {
  output: string;
};

export async function runStateInspect(
  store: FsStore
): Promise<JsonResponse<StateInspectResult>> {
  const state = await store.read();

  return ok("state.inspect", {
    counts: {
      ingests: state.ingests.length,
      jobs: state.jobs.length,
      scores: state.scores.length,
      pipeline: state.pipeline.length,
      resumes: state.resumes.length
    },
    default_resume: summarizeDefaultResume(state),
    latest_updated_at: findLatestTimestamp(state)
  });
}

export async function runStateExport(
  store: FsStore,
  options: StateExportOptions
): Promise<JsonResponse<{ output: string }>> {
  if (!options.output) {
    return fail("state.export", {
      code: "INVALID_INPUT",
      message: "missing required output path"
    });
  }

  const state = await store.read();
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  return ok("state.export", { output: options.output });
}

export function registerStateCommand(program: Command, store: FsStore): void {
  const state = program.command("state").description("inspect and export local jobflow state");

  state
    .command("inspect")
    .description("summarize local state")
    .option("--json", "emit JSON output", true)
    .action(async () => {
      writeJson(await runStateInspect(store));
    });

  state
    .command("export")
    .description("export full local state as JSON")
    .requiredOption("--output <output>", "output JSON file path")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runStateExport(store, options));
    });
}

function summarizeDefaultResume(state: JobflowState): DefaultResumeSummary {
  const defaultResume = state.resumes.find((resume) => resume.is_default);
  if (!defaultResume) return null;

  return {
    resume_id: defaultResume.resume_id,
    label: defaultResume.label
  };
}

function findLatestTimestamp(state: JobflowState): string | null {
  const timestamps = [
    ...state.ingests.map((ingest) => ingest.captured_at),
    ...state.jobs.map((job) => job.normalized_at),
    ...state.scores.map((score) => score.scored_at),
    ...state.pipeline.map((pipeline) => pipeline.updated_at),
    ...state.resumes.map((resume) => resume.updated_at)
  ];

  return timestamps.sort((a, b) => b.localeCompare(a))[0] ?? null;
}
