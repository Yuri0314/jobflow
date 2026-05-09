import { jobIngestPayloadSchema } from "@jobflow/schema";
import { z } from "zod";
import { automationErrorSchema } from "./errors.js";
import { automationSiteSchema } from "./task.js";

export const automationActionStatusSchema = z.enum(["started", "completed", "failed", "blocked"]);

export const automationActionLogSchema = z.object({
  at: z.string().datetime(),
  action: z.string().min(1),
  status: automationActionStatusSchema,
  message: z.string().min(1).optional(),
  details: z.record(z.unknown()).optional()
});

export const automationResultSchema = z.object({
  task_id: z.string().min(1),
  status: z.enum(["completed", "partial", "failed", "blocked"]),
  site: automationSiteSchema,
  collected: z.array(jobIngestPayloadSchema),
  action_log: z.array(automationActionLogSchema),
  error: automationErrorSchema.optional(),
  started_at: z.string().datetime(),
  finished_at: z.string().datetime()
});

export type AutomationActionLog = z.infer<typeof automationActionLogSchema>;
export type AutomationResult = z.infer<typeof automationResultSchema>;
