import type { IngestJobRequestEnvelope } from "@jobflow/protocol";

export type SourceSite = "boss" | "liepin" | "lagou" | "linkedin" | "unknown";

export type PageCapture = {
  pageUrl: string;
  tabTitle?: string;
  selectionText?: string;
  bodyText?: string;
};

export type EnvelopeOptions = {
  requestId?: string;
  now?: Date;
};

const MAX_RAW_TEXT_LENGTH = 12000;

export function detectSourceSite(url: string): SourceSite {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }

  if (hostname.endsWith("zhipin.com") || hostname.endsWith("kanzhun.com")) {
    return "boss";
  }
  if (hostname.endsWith("liepin.com")) {
    return "liepin";
  }
  if (hostname.endsWith("lagou.com")) {
    return "lagou";
  }
  if (hostname.endsWith("linkedin.com")) {
    return "linkedin";
  }

  return "unknown";
}

export function createIngestJobEnvelope(
  capture: PageCapture,
  options: EnvelopeOptions = {}
): IngestJobRequestEnvelope {
  const now = options.now ?? new Date();
  const capturedAt = now.toISOString();
  const title = normalizeOptionalText(capture.tabTitle);
  const selectionText = clipText(capture.selectionText);
  const bodyText = clipText(capture.bodyText);
  const rawText = selectionText ?? bodyText;
  const rawTextSource = selectionText ? "selection" : bodyText ? "body" : "none";
  const pageUrl = normalizePageUrl(capture.pageUrl);

  return {
    version: "1",
    type: "ingest_job",
    request_id: options.requestId ?? createRequestId(),
    sent_at: capturedAt,
    payload: {
      source_type: "extension",
      source_site: detectSourceSite(pageUrl ?? capture.pageUrl),
      captured_at: capturedAt,
      ...(pageUrl ? { job_url: pageUrl, page_url: pageUrl } : {}),
      ...(title ? { title_hint: title } : {}),
      ...(rawText ? { raw_text: rawText } : {}),
      source_metadata: {
        tab_title: title,
        raw_text_source: rawTextSource,
        selection_text_present: Boolean(selectionText),
        raw_text_chars: rawText?.length ?? 0
      }
    }
  };
}

function normalizePageUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : undefined;
}

function clipText(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.slice(0, MAX_RAW_TEXT_LENGTH) : undefined;
}

function createRequestId(): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `req_${randomId}` : `req_${Date.now().toString(36)}`;
}
