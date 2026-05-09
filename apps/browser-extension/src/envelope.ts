import type { IngestJobRequestEnvelope } from "@jobflow/protocol";
import { resolveExtensionSiteAdapter } from "./site-adapters";

export { detectSourceSite, type SourceSite } from "./site-adapters";

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
  const siteAdapter = resolveExtensionSiteAdapter(pageUrl ?? capture.pageUrl);

  return {
    version: "1",
    type: "ingest_job",
    request_id: options.requestId ?? createRequestId(),
    sent_at: capturedAt,
    payload: {
      source_type: "extension",
      source_site: siteAdapter.site,
      captured_at: capturedAt,
      ...(pageUrl ? { job_url: pageUrl, page_url: pageUrl } : {}),
      ...(title ? { title_hint: title } : {}),
      ...(rawText ? { raw_text: rawText } : {}),
      source_metadata: {
        site_adapter: siteAdapter.id,
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
