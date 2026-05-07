import { ingestJobRequestEnvelopeSchema } from "@jobflow/protocol";
import { describe, expect, test } from "vitest";

import { createIngestJobEnvelope, detectSourceSite } from "../src/envelope";

describe("browser extension ingest envelope", () => {
  test("creates a protocol-valid ingest envelope from selected page text", () => {
    const envelope = createIngestJobEnvelope(
      {
        pageUrl: "https://www.linkedin.com/jobs/view/123",
        tabTitle: "TypeScript Engineer - Example Tech",
        selectionText: "Build Node.js and TypeScript services.",
        bodyText: "This full page text should only be used when there is no selection."
      },
      {
        requestId: "req_test_capture_1",
        now: new Date("2026-05-07T00:00:00.000Z")
      }
    );

    expect(() => ingestJobRequestEnvelopeSchema.parse(envelope)).not.toThrow();
    expect(envelope).toMatchObject({
      version: "1",
      type: "ingest_job",
      request_id: "req_test_capture_1",
      sent_at: "2026-05-07T00:00:00.000Z",
      payload: {
        source_type: "extension",
        source_site: "linkedin",
        captured_at: "2026-05-07T00:00:00.000Z",
        job_url: "https://www.linkedin.com/jobs/view/123",
        page_url: "https://www.linkedin.com/jobs/view/123",
        title_hint: "TypeScript Engineer - Example Tech",
        raw_text: "Build Node.js and TypeScript services.",
        source_metadata: {
          tab_title: "TypeScript Engineer - Example Tech",
          raw_text_source: "selection",
          selection_text_present: true
        }
      }
    });
  });

  test("falls back to clipped body text when there is no selection", () => {
    const longText = `${"remote ".repeat(3000)}final words`;

    const envelope = createIngestJobEnvelope(
      {
        pageUrl: "https://jobs.example.com/opening/42",
        tabTitle: "Remote Backend Role",
        bodyText: longText
      },
      {
        requestId: "req_test_capture_2",
        now: new Date("2026-05-07T00:01:00.000Z")
      }
    );

    expect(() => ingestJobRequestEnvelopeSchema.parse(envelope)).not.toThrow();
    expect(envelope.payload.source_site).toBe("unknown");
    expect(envelope.payload.raw_text).toHaveLength(12000);
    expect(envelope.payload.source_metadata).toMatchObject({
      raw_text_source: "body",
      selection_text_present: false
    });
  });

  test("omits page urls when the browser cannot provide a valid page url", () => {
    const envelope = createIngestJobEnvelope(
      {
        pageUrl: "",
        tabTitle: "Captured text only",
        selectionText: "A useful job description without an accessible tab URL."
      },
      {
        requestId: "req_test_capture_3",
        now: new Date("2026-05-07T00:02:00.000Z")
      }
    );

    expect(() => ingestJobRequestEnvelopeSchema.parse(envelope)).not.toThrow();
    expect(envelope.payload.job_url).toBeUndefined();
    expect(envelope.payload.page_url).toBeUndefined();
    expect(envelope.payload.source_site).toBe("unknown");
  });

  test.each([
    ["https://www.zhipin.com/job_detail/abc", "boss"],
    ["https://www.liepin.com/job/123", "liepin"],
    ["https://www.lagou.com/jobs/123.html", "lagou"],
    ["https://www.linkedin.com/jobs/view/123", "linkedin"],
    ["https://jobs.example.com/123", "unknown"]
  ])("detects source site for %s", (url, expected) => {
    expect(detectSourceSite(url)).toBe(expected);
  });
});
