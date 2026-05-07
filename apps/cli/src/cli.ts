import { Command } from "commander";

export function createCli(): Command {
  const program = new Command();

  program.name("jobflow").description("Personal job-search CLI runtime").version("0.1.0");

  program.command("ingest").description("accept raw job input");
  program.command("normalize").description("derive a normalized job record");
  program.command("score").description("score a normalized job");

  const pipeline = program.command("pipeline").description("manage job pipeline state");
  pipeline.command("list").description("list pipeline records");
  pipeline.command("get").description("get one pipeline record");
  pipeline.command("update").description("update one pipeline record");

  program.command("next").description("summarize recommended next actions");

  return program;
}
