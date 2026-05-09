import { summarizeNext, type FsStore, type NextItem } from "@jobflow/runtime";
import { Command } from "commander";
import { ok, type JsonResponse, writeJson } from "../output.js";

export async function runNext(store: FsStore): Promise<JsonResponse<{ items: NextItem[] }>> {
  const state = await store.read();
  return ok("next", {
    items: summarizeNext({
      jobs: state.jobs,
      scores: state.scores,
      pipeline: state.pipeline
    })
  });
}

export function registerNextCommand(program: Command, store: FsStore): void {
  program
    .command("next")
    .description("summarize recommended next actions")
    .option("--json", "emit JSON output", true)
    .action(async () => {
      writeJson(await runNext(store));
    });
}
