import { describe, expect, it } from "vitest";
import { canTransitionPipelineStatus } from "../src/runtime/pipeline.js";

describe("pipeline transitions", () => {
  it("allows saved to reviewing", () => {
    expect(canTransitionPipelineStatus("saved", "reviewing")).toBe(true);
  });

  it("does not allow saved to applied", () => {
    expect(canTransitionPipelineStatus("saved", "applied")).toBe(false);
  });

  it("allows closed to reviewing for manual reopen", () => {
    expect(canTransitionPipelineStatus("closed", "reviewing")).toBe(true);
  });
});
