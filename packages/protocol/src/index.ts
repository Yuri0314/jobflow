import {
  automationTaskStatusSchema,
  jobIngestPayloadSchema,
  pipelineStatusSchema,
  prioritySchema
} from "@jobflow/schema";
import { z } from "zod";

export const protocolVersionSchema = z.literal("1");

export const commandRequestTypeSchema = z.enum([
  "ingest_job",
  "normalize_job",
  "score_job",
  "get_next_actions",
  "update_pipeline",
  "automation_search",
  "get_automation_tasks",
  "get_automation_task"
]);
export const commandResponseTypeSchema = z.enum([
  "protocol_error",
  "ingest_job_result",
  "normalize_job_result",
  "score_job_result",
  "get_next_actions_result",
  "update_pipeline_result",
  "automation_search_result",
  "get_automation_tasks_result",
  "get_automation_task_result"
]);

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

export const normalizeJobRequestEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  type: z.literal("normalize_job"),
  request_id: z.string().min(1),
  sent_at: z.string().datetime(),
  payload: z.object({
    ingest_id: z.string().min(1)
  })
});

export const scoreJobRequestEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  type: z.literal("score_job"),
  request_id: z.string().min(1),
  sent_at: z.string().datetime(),
  payload: z.object({
    job_id: z.string().min(1),
    resume_id: z.string().min(1).optional()
  })
});

export const getNextActionsRequestEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  type: z.literal("get_next_actions"),
  request_id: z.string().min(1),
  sent_at: z.string().datetime(),
  payload: z.object({
    limit: z.number().int().min(1).max(50).optional()
  })
});

export const updatePipelineRequestEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  type: z.literal("update_pipeline"),
  request_id: z.string().min(1),
  sent_at: z.string().datetime(),
  payload: z.object({
    job_id: z.string().min(1),
    status: pipelineStatusSchema,
    priority: prioritySchema.optional(),
    next_action: z.string().min(1).optional()
  })
});

export const automationSearchRequestEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  type: z.literal("automation_search"),
  request_id: z.string().min(1),
  sent_at: z.string().datetime(),
  payload: z.object({
    site: z.enum(["fixture", "boss", "liepin", "lagou", "linkedin"]),
    keyword: z.string().min(1),
    city: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    session: z.enum(["fetch", "chromium"]).default("fetch"),
    fixture_html: z.string().min(1).optional(),
    fixture_url: z.string().url().optional()
  })
});

export const getAutomationTasksRequestEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  type: z.literal("get_automation_tasks"),
  request_id: z.string().min(1),
  sent_at: z.string().datetime(),
  payload: z.object({
    limit: z.number().int().min(1).max(50).optional(),
    status: automationTaskStatusSchema.optional()
  })
});

export const getAutomationTaskRequestEnvelopeSchema = z.object({
  version: protocolVersionSchema,
  type: z.literal("get_automation_task"),
  request_id: z.string().min(1),
  sent_at: z.string().datetime(),
  payload: z.object({
    task_id: z.string().min(1)
  })
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
export type NormalizeJobRequestEnvelope = z.infer<typeof normalizeJobRequestEnvelopeSchema>;
export type ScoreJobRequestEnvelope = z.infer<typeof scoreJobRequestEnvelopeSchema>;
export type GetNextActionsRequestEnvelope = z.infer<typeof getNextActionsRequestEnvelopeSchema>;
export type UpdatePipelineRequestEnvelope = z.infer<typeof updatePipelineRequestEnvelopeSchema>;
export type AutomationSearchRequestEnvelope = z.infer<
  typeof automationSearchRequestEnvelopeSchema
>;
export type GetAutomationTasksRequestEnvelope = z.infer<
  typeof getAutomationTasksRequestEnvelopeSchema
>;
export type GetAutomationTaskRequestEnvelope = z.infer<
  typeof getAutomationTaskRequestEnvelopeSchema
>;
export type ResponseEnvelope = z.infer<typeof responseEnvelopeSchema>;
