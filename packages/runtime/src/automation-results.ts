import {
  automationTaskRecordSchema,
  jobIngestRecordSchema,
  type AutomationTaskRecord,
  type JobIngestPayload,
  type JobIngestRecord
} from "@jobflow/schema";

export type AutomationSearchPersistenceInput = {
  task: {
    task_id: string;
    site: string;
    keyword: string;
    city?: string;
    created_at: string;
  };
  session: AutomationTaskRecord["session"];
  status: AutomationTaskRecord["status"];
  startedAt?: string;
  finishedAt?: string;
  persistedAt?: string;
  collected?: JobIngestPayload[];
  actionLog?: AutomationTaskRecord["action_log"];
  error?: AutomationTaskRecord["error"];
  createIngestId: () => string;
};

export type AutomationSearchPersistenceResult = {
  taskRecord: AutomationTaskRecord;
  ingests: JobIngestRecord[];
};

export function createAutomationSearchPersistence(
  input: AutomationSearchPersistenceInput
): AutomationSearchPersistenceResult {
  const ingests = (input.collected ?? []).map((payload) =>
    jobIngestRecordSchema.parse({
      ...payload,
      ingest_id: input.createIngestId()
    })
  );
  const actionLog = [...(input.actionLog ?? [])];

  if (input.persistedAt && ingests.length > 0) {
    actionLog.push({
      at: input.persistedAt,
      action: "persist_ingests",
      status: "completed",
      details: {
        ingest_ids: ingests.map((record) => record.ingest_id)
      }
    });
  }

  const taskRecord = automationTaskRecordSchema.parse({
    task_id: input.task.task_id,
    kind: "search",
    site: input.task.site,
    keyword: input.task.keyword,
    city: input.task.city,
    session: input.session,
    status: input.status,
    created_at: input.task.created_at,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    collected_count: ingests.length,
    ingest_ids: ingests.map((record) => record.ingest_id),
    action_log: actionLog,
    error: input.error
  });

  return {
    taskRecord,
    ingests
  };
}
