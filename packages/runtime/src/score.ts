import type { JobRecord, ScoreRecord } from "@jobflow/schema";

export function scoreJob(job: JobRecord, scoreId: string, now: string): ScoreRecord {
  const text = `${job.title} ${job.description_text ?? ""} ${job.tags.join(" ")}`.toLowerCase();
  const reasons: string[] = [];
  const risks: string[] = [];
  let score = 50;

  for (const keyword of ["typescript", "node", "backend", "后端", "远程", "remote"]) {
    if (text.includes(keyword.toLowerCase())) {
      score += 8;
      reasons.push(`matched keyword: ${keyword}`);
    }
  }

  if (!job.description_text) {
    score -= 10;
    risks.push("missing job description");
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const suggested_action = boundedScore >= 80 ? "prepare" : boundedScore >= 55 ? "review" : "ignore";

  return {
    score_id: scoreId,
    job_id: job.job_id,
    score: boundedScore,
    confidence: job.description_text ? "medium" : "low",
    reasons,
    risks,
    suggested_action,
    scored_at: now
  };
}
