import type { AutomationTaskRecord } from "@jobflow/schema";

export type AutomationTaskListOptions = {
  limit?: number;
  status?: AutomationTaskRecord["status"];
};

export type AutomationTaskListResult = {
  items: AutomationTaskRecord[];
  count: number;
  total: number;
};

export function listAutomationTasks(
  tasks: AutomationTaskRecord[],
  options: AutomationTaskListOptions = {}
): AutomationTaskListResult {
  const filtered = options.status
    ? tasks.filter((task) => task.status === options.status)
    : tasks;
  const sorted = [...filtered].sort((left, right) =>
    taskSortTimestamp(right).localeCompare(taskSortTimestamp(left))
  );
  const items = options.limit ? sorted.slice(0, options.limit) : sorted;

  return {
    items,
    count: items.length,
    total: filtered.length
  };
}

export function getAutomationTask(
  tasks: AutomationTaskRecord[],
  taskId: string
): AutomationTaskRecord | null {
  return tasks.find((task) => task.task_id === taskId) ?? null;
}

function taskSortTimestamp(task: AutomationTaskRecord): string {
  return task.finished_at ?? task.started_at ?? task.created_at;
}
