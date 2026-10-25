import { describe, expect, it } from "vitest";
import { composeCommandText } from "./commandText.js";
import type { ProjectContext } from "./context.js";

const context: ProjectContext = {
  directory: "/work/project",
  conductorPath: "/work/project/conductor",
  setupCompleted: true,
  files: ["/work/project/conductor/index.md"],
};

describe("composeCommandText", () => {
  it("includes the template, environment block and trailing newline", () => {
    const text = composeCommandText({ template: "TEMPLATE BODY", context });

    expect(text.startsWith("TEMPLATE BODY")).toBe(true);
    expect(text).toContain("Environment Details:");
    expect(text).toContain("Directory: /work/project");
    expect(text).toContain("Conductor Setup: true");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("omits the strategy and arguments sections when not provided", () => {
    const text = composeCommandText({ template: "TEMPLATE", context });

    expect(text).not.toContain("Execution Strategy");
    expect(text).not.toContain("User Arguments");
  });

  it("adds strategy guidance between template and environment", () => {
    const text = composeCommandText({ template: "TEMPLATE", context, strategySection: "STRATEGY" });

    expect(text.indexOf("TEMPLATE")).toBeLessThan(text.indexOf("Execution Strategy"));
    expect(text.indexOf("Execution Strategy")).toBeLessThan(text.indexOf("STRATEGY"));
    expect(text.indexOf("STRATEGY")).toBeLessThan(text.indexOf("Environment Details"));
  });

  it("forwards raw user arguments", () => {
    const text = composeCommandText({ template: "TEMPLATE", context, userArguments: "add login page" });

    expect(text).toContain("## User Arguments");
    expect(text).toContain("add login page");
  });

  it("trims surrounding whitespace from inputs", () => {
    const text = composeCommandText({
      template: "  TEMPLATE  ",
      context,
      userArguments: "   track-1   ",
    });

    expect(text.startsWith("TEMPLATE")).toBe(true);
    expect(text).toContain("track-1\n");
  });
});
