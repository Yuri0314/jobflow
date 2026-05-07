import type { JobIngestRecord, JobRecord } from "@jobflow/schema";

export function normalizeIngest(
  ingest: JobIngestRecord,
  jobId: string,
  now: string
): JobRecord {
  const rawText = ingest.raw_text ?? "";
  const title = ingest.title_hint ?? firstNonEmptyLine(rawText) ?? "Untitled job";
  const companyName = ingest.company_hint ?? "Unknown company";

  return {
    job_id: jobId,
    canonical_url: ingest.job_url,
    source_site: ingest.source_site,
    title,
    company_name: companyName,
    description_text: ingest.raw_text,
    tags: [],
    source_metadata: ingest.source_metadata,
    created_at: now,
    normalized_at: now
  };
}

function firstNonEmptyLine(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}
