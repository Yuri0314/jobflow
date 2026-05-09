import { jobIngestPayloadSchema, type JobIngestPayload } from "@jobflow/schema";
import type { SiteAdapter } from "../adapter.js";

type FixtureCard = {
  url?: string;
  title?: string;
  company?: string;
  location?: string;
  summary?: string;
};

export const fixtureAdapter: SiteAdapter = {
  site: "fixture",
  parseSearchResults: parseFixtureSearchResults
};

export function parseFixtureSearchResults(html: string, capturedAt: string): JobIngestPayload[] {
  return extractCards(html)
    .map((card) => toPayload(card, capturedAt))
    .filter((payload): payload is JobIngestPayload => payload !== null);
}

function extractCards(html: string): FixtureCard[] {
  const cards = html.match(/<article\b[^>]*data-job-card[^>]*>[\s\S]*?<\/article>/gi) ?? [];
  return cards.map((cardHtml) => ({
    url: readAttribute(cardHtml, "data-url"),
    title: readTaggedText(cardHtml, "data-job-title"),
    company: readTaggedText(cardHtml, "data-company"),
    location: readTaggedText(cardHtml, "data-location"),
    summary: readTaggedText(cardHtml, "data-summary")
  }));
}

function toPayload(card: FixtureCard, capturedAt: string): JobIngestPayload | null {
  const rawText = [card.title, card.company, card.location, card.summary].filter(Boolean).join("\n");
  const parsed = jobIngestPayloadSchema.safeParse({
    source_type: "extension",
    source_site: "unknown",
    captured_at: capturedAt,
    job_url: card.url,
    title_hint: card.title,
    company_hint: card.company,
    raw_text: rawText || undefined,
    source_metadata: {
      adapter: "fixture"
    }
  });

  return parsed.success ? parsed.data : null;
}

function readAttribute(html: string, attribute: string): string | undefined {
  const match = new RegExp(`${attribute}="([^"]+)"`, "i").exec(html);
  return match?.[1] ? decodeHtml(match[1].trim()) : undefined;
}

function readTaggedText(html: string, marker: string): string | undefined {
  const match = new RegExp(`<[^>]+${marker}[^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i").exec(html);
  return match?.[1] ? decodeHtml(stripTags(match[1]).trim()) : undefined;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}
