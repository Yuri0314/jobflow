import {
  automationTaskRecordSchema,
  jobIngestRecordSchema,
  jobRecordSchema,
  pipelineRecordSchema,
  resumeRecordSchema,
  scoreRecordSchema
} from "@jobflow/schema";
import { z } from "zod";

export const stateSchema = z.object({
  ingests: z.array(jobIngestRecordSchema),
  jobs: z.array(jobRecordSchema),
  scores: z.array(scoreRecordSchema),
  pipeline: z.array(pipelineRecordSchema),
  resumes: z.array(resumeRecordSchema),
  automation_tasks: z.array(automationTaskRecordSchema).default([])
});

export type JobflowState = z.infer<typeof stateSchema>;

export function createEmptyState(): JobflowState {
  return {
    ingests: [],
    jobs: [],
    scores: [],
    pipeline: [],
    resumes: [],
    automation_tasks: []
  };
}
