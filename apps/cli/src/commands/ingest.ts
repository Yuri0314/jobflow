import { type JobIngestRecord, jobIngestRecordSchema, type SourceType } from "@jobflow/schema";
import { createId, type FsStore } from "@jobflow/runtime";
import { Command } from "commander";
import { z } from "zod";
import { fail, ok, type JsonResponse, writeJson } from "../output.js";

const ingestOptionsSchema = z.object({
  source: z.enum(["extension", "link", "text", "file", "manual"]),
  url: z.string().url().optional(),
  text: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  company: z.string().min(1).optional()
});

type IngestResult = {
  ingest_id: string;
  job_id: null;
  status: "accepted";
};

export async function runIngest(
  store: FsStore,
  rawOptions: unknown
): Promise<JsonResponse<IngestResult>> {
  const parsedOptions = ingestOptionsSchema.safeParse(rawOptions);
  if (!parsedOptions.success) {
    return fail("ingest", {
      code: "INVALID_INPUT",
      message: "invalid ingest options",
      details: parsedOptions.error.flatten()
    });
  }

  const options = parsedOptions.data;
  const record: JobIngestRecord = {
    ingest_id: createId("ingest"),
    source_type: options.source as SourceType,
    captured_at: new Date().toISOString(),
    job_url: options.url,
    raw_text: options.text,
    title_hint: options.title,
    company_hint: options.company
  };

  const parsedRecord = jobIngestRecordSchema.safeParse(record);
  if (!parsedRecord.success) {
    return fail("ingest", {
      code: "INVALID_INPUT",
      message: "ingest requires a URL, raw text, or title and company hints",
      details: parsedRecord.error.flatten()
    });
  }

  const state = await store.read();
  state.ingests.push(parsedRecord.data);
  await store.write(state);

  return ok("ingest", {
    ingest_id: parsedRecord.data.ingest_id,
    job_id: null,
    status: "accepted"
  });
}

export function registerIngestCommand(program: Command, store: FsStore): void {
  program
    .command("ingest")
    .description("accept raw job input")
    .requiredOption("--source <source>", "input source: extension, link, text, file, manual")
    .option("--url <url>", "job URL")
    .option("--text <text>", "raw job description text")
    .option("--title <title>", "title hint")
    .option("--company <company>", "company hint")
    .option("--json", "emit JSON output", true)
    .action(async (options) => {
      writeJson(await runIngest(store, options));
    });
}
