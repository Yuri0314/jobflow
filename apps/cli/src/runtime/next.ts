import type { JobRecord, PipelineRecord, ScoreRecord } from "@jobflow/schema";

export type NextInput = {
  jobs: JobRecord[];
  scores: ScoreRecord[];
  pipeline: PipelineRecord[];
};

export type NextItem = {
  job_id: string;
  title: string;
  company_name: string;
  recommended_action: string;
  priority: PipelineRecord["priority"];
  score: number | null;
};

const priorityRank: Record<PipelineRecord["priority"], number> = {
  high: 3,
  medium: 2,
  low: 1
};

export function summarizeNext(input: NextInput): NextItem[] {
  return input.pipeline
    .filter((entry) => entry.status !== "closed")
    .map((entry) => {
      const job = input.jobs.find((candidate) => candidate.job_id === entry.job_id);
      const score = latestScore(input.scores, entry.job_id);

      if (!job) return null;

      return {
        job_id: job.job_id,
        title: job.title,
        company_name: job.company_name,
        recommended_action: entry.next_action ?? score?.suggested_action ?? "review",
        priority: entry.priority,
        score: score?.score ?? null
      };
    })
    .filter((item): item is NextItem => item !== null)
    .sort(
      (a, b) => priorityRank[b.priority] - priorityRank[a.priority] || (b.score ?? 0) - (a.score ?? 0)
    );
}

function latestScore(scores: ScoreRecord[], jobId: string): ScoreRecord | undefined {
  return scores
    .filter((score) => score.job_id === jobId)
    .sort((a, b) => b.scored_at.localeCompare(a.scored_at))[0];
}
