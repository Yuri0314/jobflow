import { jobIngestPayloadSchema } from "@jobflow/schema";
import { z } from "zod";

export const protocolVersionSchema = z.literal("1");

export const commandRequestTypeSchema = z.enum(["ingest_job"]);
export const commandResponseTypeSchema = z.enum(["ingest_job_result"]);

export const protocolErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.unknown()).optional()
});

export const ingestJobRequestEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  type: z.literal("ingest_job"),
  request_id: z.string().min(1),
  sent_at: z.string().datetime(),
  payload: jobIngestPayloadSchema
});

export const responseEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  type: commandResponseTypeSchema,
  request_id: z.string().min(1),
  ok: z.boolean(),
  payload: z.record(z.unknown()).nullable(),
  error: protocolErrorSchema.nullable()
});

export type IngestJobRequestEnvelope = z.infer<typeof ingestJobRequestEnvelopeSchema>;
export type ResponseEnvelope = z.infer<typeof responseEnvelopeSchema>;
