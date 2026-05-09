import type { PipelineRecord } from "@jobflow/schema";

const allowedTransitions: Record<PipelineRecord["status"], PipelineRecord["status"][]> = {
  new: ["saved", "reviewing"],
  saved: ["reviewing"],
  reviewing: ["ready", "closed", "saved"],
  ready: ["applied", "closed", "reviewing"],
  applied: ["follow_up", "closed"],
  follow_up: ["closed"],
  closed: ["reviewing"]
};

export function canTransitionPipelineStatus(
  from: PipelineRecord["status"],
  to: PipelineRecord["status"]
): boolean {
  return from === to || allowedTransitions[from].includes(to);
}
