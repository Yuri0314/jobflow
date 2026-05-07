import {
  ingestJobRequestEnvelopeSchema,
  responseEnvelopeSchema,
  type ResponseEnvelope
} from "@jobflow/protocol";
import { jobIngestRecordSchema } from "@jobflow/schema";
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { z } from "zod";
import { writeJson } from "../output.js";
import { createId } from "../runtime/ids.js";
import type { FsStore } from "../state/fs-store.js";

type ProtocolIngestPayload = {
  ingest_id: string;
  job_id: null;
  status: "accepted";
};

type ProtocolIngestOptions = {
  input?: string;
  stdin?: boolean;
};

export async function runProtocolIngestJob(
  store: FsStore,
  rawEnvelope: unknown
): Promise<ResponseEnvelope> {
  const parsedEnvelope = ingestJobRequestEnvelopeSchema.safeParse(rawEnvelope);
  const requestId = findRequestId(rawEnvelope);

  if (!parsedEnvelope.success) {
    return createProtocolEnvelope(requestId, false, null, {
      code: "INVALID_PROTOCOL_ENVELOPE",
      message: "invalid ingest_job request envelope",
      details: {
        issues: parsedEnvelope.error.issues
      }
    });
  }

  const record = jobIngestRecordSchema.parse({
    ...parsedEnvelope.data.payload,
    ingest_id: createId("ingest")
  });

  const state = await store.read();
  state.ingests.push(record);
  await store.write(state);

  return createProtocolEnvelope<ProtocolIngestPayload>(
    parsedEnvelope.data.request_id,
    true,
    {
      ingest_id: record.ingest_id,
      job_id: null,
      status: "accepted"
    },
    null
  );
}

export function registerProtocolCommand(program: Command, store: FsStore): void {
  const protocol = program.command("protocol").description("run protocol envelope adapters");

  protocol
    .command("ingest-job")
    .description("accept an ingest_job protocol envelope")
    .option("--input <input>", "request envelope JSON file")
    .option("--stdin", "read request envelope JSON from stdin")
    .option("--json", "emit JSON output", true)
    .action(async (options: ProtocolIngestOptions) => {
      const rawEnvelope = await readEnvelopeInput(options);
      writeJson(await runProtocolIngestJob(store, rawEnvelope));
    });
}

async function readEnvelopeInput(options: ProtocolIngestOptions): Promise<unknown> {
  if (options.stdin) {
    return JSON.parse(await readStdin());
  }

  if (options.input) {
    return JSON.parse(await readFile(options.input, "utf8"));
  }

  throw new Error("protocol ingest-job requires --input or --stdin");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function findRequestId(rawEnvelope: unknown): string {
  const parsed = z.object({ request_id: z.string().min(1) }).safeParse(rawEnvelope);
  return parsed.success ? parsed.data.request_id : "unknown";
}

function createProtocolEnvelope<TPayload extends Record<string, unknown>>(
  requestId: string,
  ok: true,
  payload: TPayload,
  error: null
): ResponseEnvelope;
function createProtocolEnvelope(
  requestId: string,
  ok: false,
  payload: null,
  error: NonNullable<ResponseEnvelope["error"]>
): ResponseEnvelope;
function createProtocolEnvelope(
  requestId: string,
  ok: boolean,
  payload: Record<string, unknown> | null,
  error: ResponseEnvelope["error"]
): ResponseEnvelope {
  return responseEnvelopeSchema.parse({
    version: "1",
    type: "ingest_job_result",
    request_id: requestId,
    ok,
    payload,
    error
  });
}
