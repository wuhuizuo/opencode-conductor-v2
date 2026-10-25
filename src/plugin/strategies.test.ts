import { describe, expect, it } from "vitest";
import {
  hasSubagentAgent,
  loadStrategyText,
  parseDelegationMode,
  promptsRoot,
  resolveStrategy,
} from "./strategies.js";

describe("parseDelegationMode", () => {
  it("accepts the documented modes", () => {
    expect(parseDelegationMode("manual")).toBe("manual");
    expect(parseDelegationMode("delegate")).toBe("delegate");
    expect(parseDelegationMode("auto")).toBe("auto");
  });

  it("falls back to manual for unknown or missing values", () => {
    expect(parseDelegationMode(undefined)).toBe("manual");
    expect(parseDelegationMode("bogus")).toBe("manual");
    expect(parseDelegationMode(42)).toBe("manual");
  });
});

describe("resolveStrategy", () => {
  it("defaults to manual", () => {
    expect(resolveStrategy("manual", true)).toBe("manual");
  });

  it("honours an explicit delegate mode", () => {
    expect(resolveStrategy("delegate", false)).toBe("delegate");
  });

  it("auto only delegates when a subagent exists", () => {
    expect(resolveStrategy("auto", true)).toBe("delegate");
    expect(resolveStrategy("auto", false)).toBe("manual");
  });
});

describe("hasSubagentAgent", () => {
  it("handles bare arrays and the client envelope", () => {
    expect(hasSubagentAgent([{ mode: "subagent" }])).toBe(true);
    expect(hasSubagentAgent({ data: [{ mode: "all" }] })).toBe(true);
    expect(hasSubagentAgent({ data: [{ mode: "primary" }] })).toBe(false);
    expect(hasSubagentAgent(undefined)).toBe(false);
  });
});

describe("loadStrategyText", () => {
  it("loads the packaged manual and delegate guidance", () => {
    expect(loadStrategyText("manual", promptsRoot())).toContain("Manual Implementation");
    expect(loadStrategyText("delegate", promptsRoot())).toContain("DELEGATED");
  });

  it("names the built-in subagent tool in the delegated strategy", () => {
    expect(loadStrategyText("delegate", promptsRoot())).toContain("`subagent` tool");
  });
});
