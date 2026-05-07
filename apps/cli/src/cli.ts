import { Command } from "commander";
import { registerIngestCommand } from "./commands/ingest.js";
import { registerNextCommand } from "./commands/next.js";
import { registerNormalizeCommand } from "./commands/normalize.js";
import { registerPipelineCommand } from "./commands/pipeline.js";
import { registerScoreCommand } from "./commands/score.js";
import { createFsStore } from "./state/fs-store.js";

export function createCli(): Command {
  const program = new Command();
  const store = createFsStore(process.env.JOBFLOW_HOME ?? ".jobflow");

  program.name("jobflow").description("Personal job-search CLI runtime").version("0.1.0");

  registerIngestCommand(program, store);
  registerNormalizeCommand(program, store);
  registerScoreCommand(program, store);
  registerPipelineCommand(program, store);
  registerNextCommand(program, store);

  return program;
}
