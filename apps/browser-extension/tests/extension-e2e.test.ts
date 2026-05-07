import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("browser extension e2e harness", () => {
  test("ships a Chrome DevTools smoke script", () => {
    const script = readFileSync(
      join(import.meta.dirname, "../scripts/smoke-extension.mjs"),
      "utf8"
    );

    expect(script).toContain("--load-extension");
    expect(script).toContain("background.global.js");
    expect(script).toContain("jobflowSmokeCaptureActiveTab()");
    expect(script).toContain("Runtime.evaluate");
    expect(script).toContain("Jobflow Capture");
  });
});
