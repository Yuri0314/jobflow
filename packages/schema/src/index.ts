import { z } from "zod";

export const isoDateTimeSchema = z.string().datetime();

export const sourceTypeSchema = z.enum(["extension", "link", "text", "file", "manual"]);
export const sourceSiteSchema = z.enum(["boss", "liepin", "lagou", "linkedin", "unknown"]);
export const confidenceSchema = z.enum(["low", "medium", "high"]);
export const suggestedActionSchema = z.enum(["ignore", "review", "prepare", "apply"]);
export const prioritySchema = z.enum(["low", "medium", "high"]);
export const pipelineStatusSchema = z.enum([
  "new",
  "saved",
  "reviewing",
  "ready",
  "applied",
  "follow_up",
  "closed"
]);
export const closedReasonSchema = z.enum([
  "not_fit",
  "duplicate",
  "expired",
  "applied_elsewhere",
  "manual_drop",
  "unknown"
]);
export const resumeSourceTypeSchema = z.enum(["file", "text", "generated"]);
export const automationTaskKindSchema = z.enum(["search"]);
export const automationTaskStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "partial",
  "failed",
  "blocked"
]);
export const automationTaskSessionSchema = z.enum(["fetch", "chromium"]);
export const automationTaskActionStatusSchema = z.enum([
  "started",
  "completed",
  "failed",
  "blocked"
]);

const metadataSchema = z.record(z.unknown());

const jobIngestPayloadBaseSchema = z.object({
  source_type: sourceTypeSchema,
  source_site: sourceSiteSchema.optional(),
  captured_at: isoDateTimeSchema,
  job_url: z.string().url().optional(),
  page_url: z.string().url().optional(),
  title_hint: z.string().min(1).optional(),
  company_hint: z.string().min(1).optional(),
  raw_text: z.string().min(1).optional(),
  raw_html_excerpt: z.string().min(1).optional(),
  source_metadata: metadataSchema.optional()
});

function hasMinimumIngestEvidence(value: {
  job_url?: string;
  raw_text?: string;
  title_hint?: string;
  company_hint?: string;
}): boolean {
  return Boolean(value.job_url || value.raw_text || (value.title_hint && value.company_hint));
}

function addMinimumIngestEvidenceIssue(
  value: {
    job_url?: string;
    raw_text?: string;
    title_hint?: string;
    company_hint?: string;
  },
  ctx: z.RefinementCtx
): void {
  if (!hasMinimumIngestEvidence(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "ingest requires job_url, raw_text, or title_hint plus company_hint"
    });
  }
}

export const jobIngestPayloadSchema =
  jobIngestPayloadBaseSchema.superRefine(addMinimumIngestEvidenceIssue);

export const jobIngestRecordSchema = jobIngestPayloadBaseSchema
  .extend({
    ingest_id: z.string().min(1),
    job_id: z.string().min(1).optional()
  })
  .superRefine(addMinimumIngestEvidenceIssue);

export const jobRecordSchema = z.object({
  job_id: z.string().min(1),
  canonical_url: z.string().url().optional(),
  source_site: sourceSiteSchema.optional(),
  source_job_key: z.string().min(1).optional(),
  title: z.string().min(1),
  company_name: z.string().min(1),
  city: z.string().min(1).optional(),
  salary_text: z.string().min(1).optional(),
  experience_text: z.string().min(1).optional(),
  education_text: z.string().min(1).optional(),
  description_text: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).default([]),
  source_metadata: metadataSchema.optional(),
  created_at: isoDateTimeSchema,
  normalized_at: isoDateTimeSchema
});

export const scoreRecordSchema = z.object({
  score_id: z.string().min(1),
  job_id: z.string().min(1),
  resume_id: z.string().min(1).optional(),
  score: z.number().int().min(0).max(100),
  confidence: confidenceSchema,
  reasons: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  suggested_action: suggestedActionSchema,
  scoring_profile: metadataSchema.optional(),
  scored_at: isoDateTimeSchema
});

export const pipelineRecordSchema = z.object({
  job_id: z.string().min(1),
  status: pipelineStatusSchema,
  priority: prioritySchema.default("medium"),
  next_action: z.string().min(1).optional(),
  follow_up_at: isoDateTimeSchema.optional(),
  notes: z.string().optional(),
  resume_id: z.string().min(1).optional(),
  updated_at: isoDateTimeSchema,
  closed_reason: closedReasonSchema.optional()
});

export const resumeRecordSchema = z.object({
  resume_id: z.string().min(1),
  label: z.string().min(1),
  file_path: z.string().min(1).optional(),
  source_type: resumeSourceTypeSchema,
  is_default: z.boolean(),
  target_roles: z.array(z.string().min(1)).default([]),
  summary: z.string().optional(),
  updated_at: isoDateTimeSchema
});

export const automationTaskActionLogSchema = z.object({
  at: isoDateTimeSchema,
  action: z.string().min(1),
  status: automationTaskActionStatusSchema,
  details: metadataSchema.optional()
});

export const automationTaskRecordSchema = z.object({
  task_id: z.string().min(1),
  kind: automationTaskKindSchema,
  site: z.string().min(1),
  keyword: z.string().min(1),
  city: z.string().min(1).optional(),
  session: automationTaskSessionSchema,
  status: automationTaskStatusSchema,
  created_at: isoDateTimeSchema,
  started_at: isoDateTimeSchema.optional(),
  finished_at: isoDateTimeSchema.optional(),
  collected_count: z.number().int().min(0).default(0),
  ingest_ids: z.array(z.string().min(1)).default([]),
  action_log: z.array(automationTaskActionLogSchema).default([]),
  error: z
    .object({
      code: z.string().min(1),
      message: z.string().min(1),
      details: metadataSchema.optional()
    })
    .optional(),
  source_metadata: metadataSchema.optional()
});

export type SourceType = z.infer<typeof sourceTypeSchema>;
export type JobIngestPayload = z.infer<typeof jobIngestPayloadSchema>;
export type JobIngestRecord = z.infer<typeof jobIngestRecordSchema>;
export type JobRecord = z.infer<typeof jobRecordSchema>;
export type ScoreRecord = z.infer<typeof scoreRecordSchema>;
export type PipelineRecord = z.infer<typeof pipelineRecordSchema>;
export type ResumeRecord = z.infer<typeof resumeRecordSchema>;
export type AutomationTaskRecord = z.infer<typeof automationTaskRecordSchema>;
