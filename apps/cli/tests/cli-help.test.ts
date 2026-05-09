import { describe, expect, it } from "vitest";
import { createCli } from "../src/cli.js";

describe("jobflow cli", () => {
  it("prints help with core commands", () => {
    const program = createCli();
    const help = program.helpInformation();

    expect(help).toContain("ingest");
    expect(help).toContain("normalize");
    expect(help).toContain("score");
    expect(help).toContain("pipeline");
    expect(help).toContain("protocol");
    expect(help).toContain("next");
    expect(help).toContain("automation");
  });

  it("prints protocol help with the generic run command", () => {
    const program = createCli();
    const protocol = program.commands.find((command) => command.name() === "protocol");

    expect(protocol?.commands.some((command) => command.name() === "run")).toBe(true);
  });

  it("prints automation help with the search command", () => {
    const program = createCli();
    const automation = program.commands.find((command) => command.name() === "automation");

    expect(automation?.commands.some((command) => command.name() === "search")).toBe(true);
  });
});
