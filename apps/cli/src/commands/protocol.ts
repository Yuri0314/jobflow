import {
  ingestJobRequestEnvelopeSchema,
  normalizeJobRequestEnvelopeSchema,
  responseEnvelopeSchema,
  type ResponseEnvelope
} from "@jobflow/protocol";
import { jobIngestRecordSchema } from "@jobflow/schema";
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { z } from "zod";
import { runNormalize } from "./normalize.js";
import type { JsonError } from "../output.js";
import { writeJson } from "../output.js";
import { createId } from "../runtime/ids.js";
import type { FsStore } from "../state/fs-store.js";

type ProtocolIngestPayload = {
  ingest_id: string;
  job_id: null;
  status: "accepted";
};

type ProtocolNormalizePayload = {
  ingest_id: string;
  job_id: string;
  status: "normalized";
  pipeline_status: string | null;
  job: Record<string, unknown>;
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
    return createProtocolEnvelope("ingest_job_result", requestId, false, null, {
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
    "ingest_job_result",
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

export async function runProtocolNormalizeJob(
  store: FsStore,
  rawEnvelope: unknown
): Promise<ResponseEnvelope> {
  const parsedEnvelope = normalizeJobRequestEnvelopeSchema.safeParse(rawEnvelope);
  const requestId = findRequestId(rawEnvelope);

  if (!parsedEnvelope.success) {
    return createProtocolEnvelope("normalize_job_result", requestId, false, null, {
      code: "INVALID_PROTOCOL_ENVELOPE",
      message: "invalid normalize_job request envelope",
      details: {
        issues: parsedEnvelope.error.issues
      }
    });
  }

  const ingestId = parsedEnvelope.data.payload.ingest_id;
  const normalized = await runNormalize(store, { ingestId });

  if (!normalized.ok) {
    return createProtocolEnvelope(
      "normalize_job_result",
      parsedEnvelope.data.request_id,
      false,
      null,
      normalized.error
    );
  }

  const state = await store.read();
  const pipelineEntry = state.pipeline.find((entry) => entry.job_id === normalized.data.job.job_id);

  return createProtocolEnvelope<ProtocolNormalizePayload>(
    "normalize_job_result",
    parsedEnvelope.data.request_id,
    true,
    {
      ingest_id: ingestId,
      job_id: normalized.data.job.job_id,
      status: "normalized",
      pipeline_status: pipelineEntry?.status ?? null,
      job: normalized.data.job
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

  protocol
    .command("normalize-job")
    .description("accept a normalize_job protocol envelope")
    .option("--input <input>", "request envelope JSON file")
    .option("--stdin", "read request envelope JSON from stdin")
    .option("--json", "emit JSON output", true)
    .action(async (options: ProtocolIngestOptions) => {
      const rawEnvelope = await readEnvelopeInput(options);
      writeJson(await runProtocolNormalizeJob(store, rawEnvelope));
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
  type: "ingest_job_result" | "normalize_job_result",
  requestId: string,
  ok: true,
  payload: TPayload,
  error: null
): ResponseEnvelope;
function createProtocolEnvelope(
  type: "ingest_job_result" | "normalize_job_result",
  requestId: string,
  ok: false,
  payload: null,
  error: JsonError
): ResponseEnvelope;
function createProtocolEnvelope(
  type: "ingest_job_result" | "normalize_job_result",
  requestId: string,
  ok: boolean,
  payload: Record<string, unknown> | null,
  error: ResponseEnvelope["error"]
): ResponseEnvelope {
  return responseEnvelopeSchema.parse({
    version: "1",
    type,
    request_id: requestId,
    ok,
    payload,
    error
  });
}
