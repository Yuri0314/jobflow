import { jobIngestPayloadSchema, type JobIngestPayload } from "@jobflow/schema";
import type { BlockedPageDetection, SiteAdapter } from "../adapter.js";

type BossCard = {
  url?: string;
  title?: string;
  company?: string;
  location?: string;
  summary?: string;
};

export const bossAdapter: SiteAdapter = {
  site: "boss",
  detectBlockedPage: detectBossBlockedPage,
  parseSearchResults: parseBossSearchResults
};

export function parseBossSearchResults(html: string, capturedAt: string): JobIngestPayload[] {
  return extractCards(html)
    .map((card) => toPayload(card, capturedAt))
    .filter((payload): payload is JobIngestPayload => payload !== null);
}

export function detectBossBlockedPage(html: string): BlockedPageDetection | null {
  const text = decodeHtml(stripTags(html)).replace(/\s+/g, "");

  if (hasAny(text, ["请先登录", "登录后", "未登录"])) {
    return blockedPage("LOGIN_REQUIRED", "BOSS login is required before automation can continue", "login");
  }

  if (hasAny(text, ["验证码", "安全验证", "拖动滑块"])) {
    return blockedPage(
      "CAPTCHA_REQUIRED",
      "BOSS captcha or safety verification is required before automation can continue",
      "captcha"
    );
  }

  if (hasAny(text, ["访问异常", "请求过于频繁", "稍后再试", "系统繁忙", "行为异常"])) {
    return blockedPage(
      "PLATFORM_BLOCKED",
      "BOSS reported an abnormal or rate-limited access page",
      "platform_blocked"
    );
  }

  return null;
}

function extractCards(html: string): BossCard[] {
  const cards = html.match(/<(?:article|div|li)\b(?=[^>]*(?:data-job-card|job-card-wrapper|job-card))[^>]*>[\s\S]*?<\/(?:article|div|li)>/gi) ?? [];

  return cards.map((cardHtml) => ({
    url: normalizeBossUrl(
      readAttribute(cardHtml, "data-url") ??
        readLinkedClassHref(cardHtml, "job-name") ??
        readFirstHref(cardHtml)
    ),
    title: readTaggedText(cardHtml, "data-job-title") ?? readClassText(cardHtml, "job-name"),
    company:
      readTaggedText(cardHtml, "data-company") ??
      readClassText(cardHtml, "boss-name") ??
      readClassText(cardHtml, "company-name"),
    location: readTaggedText(cardHtml, "data-location") ?? readClassText(cardHtml, "job-area"),
    summary: readTaggedText(cardHtml, "data-summary") ?? readClassText(cardHtml, "job-info")
  }));
}

function toPayload(card: BossCard, capturedAt: string): JobIngestPayload | null {
  const rawText = [card.title, card.company, card.location, card.summary].filter(Boolean).join("\n");
  const parsed = jobIngestPayloadSchema.safeParse({
    source_type: "extension",
    source_site: "boss",
    captured_at: capturedAt,
    job_url: card.url,
    title_hint: card.title,
    company_hint: card.company,
    raw_text: rawText || undefined,
    source_metadata: {
      adapter: "boss",
      fixture_only: true
    }
  });

  return parsed.success ? parsed.data : null;
}

function blockedPage(
  code: BlockedPageDetection["code"],
  message: string,
  reason: string
): BlockedPageDetection {
  return {
    code,
    message,
    action: "detect_blocked_page",
    details: {
      site: "boss",
      reason
    }
  };
}

function hasAny(value: string, markers: string[]): boolean {
  return markers.some((marker) => value.includes(marker));
}

function readAttribute(html: string, attribute: string): string | undefined {
  const match = new RegExp(`${attribute}=(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`, "i").exec(html);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value ? decodeHtml(value.trim()) : undefined;
}

function readTaggedText(html: string, marker: string): string | undefined {
  const match = new RegExp(`<[^>]+${marker}[^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i").exec(html);
  return match?.[1] ? cleanText(match[1]) : undefined;
}

function readClassText(html: string, className: string): string | undefined {
  const match = new RegExp(
    `<[^>]+class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    "i"
  ).exec(html);
  return match?.[1] ? cleanText(match[1]) : undefined;
}

function readLinkedClassHref(html: string, className: string): string | undefined {
  const match = new RegExp(
    `<a\\b[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*href="([^"]+)"[^>]*>`,
    "i"
  ).exec(html);
  return match?.[1] ? decodeHtml(match[1].trim()) : undefined;
}

function readFirstHref(html: string): string | undefined {
  const match = /<a\b[^>]*href="([^"]+)"[^>]*>/i.exec(html);
  return match?.[1] ? decodeHtml(match[1].trim()) : undefined;
}

function normalizeBossUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://www.zhipin.com${value}`;
  return `https://www.zhipin.com/${value.replace(/^\/+/, "")}`;
}

function cleanText(value: string): string | undefined {
  const text = decodeHtml(stripTags(value)).replace(/\s+/g, " ").trim();
  return text || undefined;
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
