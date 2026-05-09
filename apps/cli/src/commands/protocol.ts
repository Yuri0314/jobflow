import {
  getNextActionsRequestEnvelopeSchema,
  ingestJobRequestEnvelopeSchema,
  normalizeJobRequestEnvelopeSchema,
  responseEnvelopeSchema,
  scoreJobRequestEnvelopeSchema,
  updatePipelineRequestEnvelopeSchema,
  type ResponseEnvelope
} from "@jobflow/protocol";
import { jobIngestRecordSchema } from "@jobflow/schema";
import { createId, type FsStore } from "@jobflow/runtime";
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { z } from "zod";
import { runNext } from "./next.js";
import { runNormalize } from "./normalize.js";
import { runPipelineUpdate } from "./pipeline.js";
import { runScore } from "./score.js";
import type { JsonError } from "../output.js";
import { writeJson } from "../output.js";

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

type ProtocolScorePayload = {
  job_id: string;
  score_id: string;
  status: "scored";
  score: number;
  suggested_action: string;
  score_record: Record<string, unknown>;
};

type ProtocolNextActionsPayload = {
  items: Record<string, unknown>[];
  count: number;
};

type ProtocolUpdatePipelinePayload = {
  job_id: string;
  status: "updated";
  pipeline_status: string;
  priority: string;
  next_action: string | null;
  pipeline: Record<string, unknown>;
};

type ProtocolIngestOptions = {
  input?: string;
  stdin?: boolean;
};

export async function runProtocolEnvelope(
  store: FsStore,
  rawEnvelope: unknown
): Promise<ResponseEnvelope> {
  const type = findEnvelopeType(rawEnvelope);

  switch (type) {
    case "ingest_job":
      return runProtocolIngestJob(store, rawEnvelope);
    case "normalize_job":
      return runProtocolNormalizeJob(store, rawEnvelope);
    case "score_job":
      return runProtocolScoreJob(store, rawEnvelope);
    case "get_next_actions":
      return runProtocolGetNextActions(store, rawEnvelope);
    case "update_pipeline":
      return runProtocolUpdatePipeline(store, rawEnvelope);
    default:
      return createProtocolEnvelope("protocol_error", findRequestId(rawEnvelope), false, null, {
        code: "UNSUPPORTED_PROTOCOL_TYPE",
        message: type ? `unsupported protocol type: ${type}` : "missing protocol type"
      });
  }
}

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

export async function runProtocolScoreJob(
  store: FsStore,
  rawEnvelope: unknown
): Promise<ResponseEnvelope> {
  const parsedEnvelope = scoreJobRequestEnvelopeSchema.safeParse(rawEnvelope);
  const requestId = findRequestId(rawEnvelope);

  if (!parsedEnvelope.success) {
    return createProtocolEnvelope("score_job_result", requestId, false, null, {
      code: "INVALID_PROTOCOL_ENVELOPE",
      message: "invalid score_job request envelope",
      details: {
        issues: parsedEnvelope.error.issues
      }
    });
  }

  const scored = await runScore(store, { jobId: parsedEnvelope.data.payload.job_id });

  if (!scored.ok) {
    return createProtocolEnvelope(
      "score_job_result",
      parsedEnvelope.data.request_id,
      false,
      null,
      scored.error
    );
  }

  return createProtocolEnvelope<ProtocolScorePayload>(
    "score_job_result",
    parsedEnvelope.data.request_id,
    true,
    {
      job_id: scored.data.score.job_id,
      score_id: scored.data.score.score_id,
      status: "scored",
      score: scored.data.score.score,
      suggested_action: scored.data.score.suggested_action,
      score_record: scored.data.score
    },
    null
  );
}

export async function runProtocolGetNextActions(
  store: FsStore,
  rawEnvelope: unknown
): Promise<ResponseEnvelope> {
  const parsedEnvelope = getNextActionsRequestEnvelopeSchema.safeParse(rawEnvelope);
  const requestId = findRequestId(rawEnvelope);

  if (!parsedEnvelope.success) {
    return createProtocolEnvelope("get_next_actions_result", requestId, false, null, {
      code: "INVALID_PROTOCOL_ENVELOPE",
      message: "invalid get_next_actions request envelope",
      details: {
        issues: parsedEnvelope.error.issues
      }
    });
  }

  const next = await runNext(store);
  const limit = parsedEnvelope.data.payload.limit;
  const items = limit ? next.data.items.slice(0, limit) : next.data.items;

  return createProtocolEnvelope<ProtocolNextActionsPayload>(
    "get_next_actions_result",
    parsedEnvelope.data.request_id,
    true,
    {
      items,
      count: items.length
    },
    null
  );
}

export async function runProtocolUpdatePipeline(
  store: FsStore,
  rawEnvelope: unknown
): Promise<ResponseEnvelope> {
  const parsedEnvelope = updatePipelineRequestEnvelopeSchema.safeParse(rawEnvelope);
  const requestId = findRequestId(rawEnvelope);

  if (!parsedEnvelope.success) {
    return createProtocolEnvelope("update_pipeline_result", requestId, false, null, {
      code: "INVALID_PROTOCOL_ENVELOPE",
      message: "invalid update_pipeline request envelope",
      details: {
        issues: parsedEnvelope.error.issues
      }
    });
  }

  const payload = parsedEnvelope.data.payload;
  const updated = await runPipelineUpdate(store, {
    jobId: payload.job_id,
    status: payload.status,
    priority: payload.priority,
    nextAction: payload.next_action
  });

  if (!updated.ok) {
    return createProtocolEnvelope(
      "update_pipeline_result",
      parsedEnvelope.data.request_id,
      false,
      null,
      updated.error
    );
  }

  return createProtocolEnvelope<ProtocolUpdatePipelinePayload>(
    "update_pipeline_result",
    parsedEnvelope.data.request_id,
    true,
    {
      job_id: updated.data.pipeline.job_id,
      status: "updated",
      pipeline_status: updated.data.pipeline.status,
      priority: updated.data.pipeline.priority,
      next_action: updated.data.pipeline.next_action ?? null,
      pipeline: updated.data.pipeline
    },
    null
  );
}

export function registerProtocolCommand(program: Command, store: FsStore): void {
  const protocol = program.command("protocol").description("run protocol envelope adapters");

  protocol
    .command("run")
    .description("dispatch a protocol envelope by type")
    .option("--input <input>", "request envelope JSON file")
    .option("--stdin", "read request envelope JSON from stdin")
    .option("--json", "emit JSON output", true)
    .action(async (options: ProtocolIngestOptions) => {
      const rawEnvelope = await readEnvelopeInput(options);
      writeJson(await runProtocolEnvelope(store, rawEnvelope));
    });

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

  protocol
    .command("score-job")
    .description("accept a score_job protocol envelope")
    .option("--input <input>", "request envelope JSON file")
    .option("--stdin", "read request envelope JSON from stdin")
    .option("--json", "emit JSON output", true)
    .action(async (options: ProtocolIngestOptions) => {
      const rawEnvelope = await readEnvelopeInput(options);
      writeJson(await runProtocolScoreJob(store, rawEnvelope));
    });

  protocol
    .command("get-next-actions")
    .description("accept a get_next_actions protocol envelope")
    .option("--input <input>", "request envelope JSON file")
    .option("--stdin", "read request envelope JSON from stdin")
    .option("--json", "emit JSON output", true)
    .action(async (options: ProtocolIngestOptions) => {
      const rawEnvelope = await readEnvelopeInput(options);
      writeJson(await runProtocolGetNextActions(store, rawEnvelope));
    });

  protocol
    .command("update-pipeline")
    .description("accept an update_pipeline protocol envelope")
    .option("--input <input>", "request envelope JSON file")
    .option("--stdin", "read request envelope JSON from stdin")
    .option("--json", "emit JSON output", true)
    .action(async (options: ProtocolIngestOptions) => {
      const rawEnvelope = await readEnvelopeInput(options);
      writeJson(await runProtocolUpdatePipeline(store, rawEnvelope));
    });
}

async function readEnvelopeInput(options: ProtocolIngestOptions): Promise<unknown> {
  if (options.stdin) {
    return JSON.parse(await readStdin());
  }

  if (options.input) {
    return JSON.parse(await readFile(options.input, "utf8"));
  }

  throw new Error("protocol command requires --input or --stdin");
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

function findEnvelopeType(rawEnvelope: unknown): string | null {
  const parsed = z.object({ type: z.string().min(1) }).safeParse(rawEnvelope);
  return parsed.success ? parsed.data.type : null;
}

function createProtocolEnvelope<TPayload extends Record<string, unknown>>(
  type:
    | "protocol_error"
    | "ingest_job_result"
    | "normalize_job_result"
    | "score_job_result"
    | "get_next_actions_result"
    | "update_pipeline_result",
  requestId: string,
  ok: true,
  payload: TPayload,
  error: null
): ResponseEnvelope;
function createProtocolEnvelope(
  type:
    | "protocol_error"
    | "ingest_job_result"
    | "normalize_job_result"
    | "score_job_result"
    | "get_next_actions_result"
    | "update_pipeline_result",
  requestId: string,
  ok: false,
  payload: null,
  error: JsonError
): ResponseEnvelope;
function createProtocolEnvelope(
  type:
    | "protocol_error"
    | "ingest_job_result"
    | "normalize_job_result"
    | "score_job_result"
    | "get_next_actions_result"
    | "update_pipeline_result",
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
