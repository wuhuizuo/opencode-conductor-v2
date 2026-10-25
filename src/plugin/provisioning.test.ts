import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultSourceFile,
  detectLegacyArtifacts,
  migrationNotice,
  provisionConductorAgent,
} from "./provisioning.js";

function makeHome(): string {
  return mkdtempSync(join(tmpdir(), "conductor-home-"));
}

const SOURCE = defaultSourceFile();

describe("provisionConductorAgent", () => {
  it("installs the agent into the v2 agents directory and not the legacy one", () => {
    const home = makeHome();

    const result = provisionConductorAgent({ home, sourceFile: SOURCE });

    const target = join(home, ".config", "opencode", "agents", "conductor.md");
    expect(result.target).toBe(target);
    expect(result.updated).toBe(true);
    expect(readFileSync(target, "utf-8")).toBe(readFileSync(SOURCE, "utf-8"));
    expect(existsSync(join(home, ".config", "opencode", "agent"))).toBe(false);
    expect(existsSync(join(home, ".config", "opencode", "command"))).toBe(false);
  });

  it("is idempotent across repeated runs", () => {
    const home = makeHome();

    provisionConductorAgent({ home, sourceFile: SOURCE });
    const second = provisionConductorAgent({ home, sourceFile: SOURCE });

    expect(second.updated).toBe(false);
    const agentsDir = join(home, ".config", "opencode", "agents");
    expect(readdirSync(agentsDir).filter((name: string) => name === "conductor.md")).toHaveLength(1);
  });

  it("overwrites a stale definition on upgrade", () => {
    const home = makeHome();
    const targetDir = join(home, ".config", "opencode", "agents");
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, "conductor.md"), "stale content");

    const result = provisionConductorAgent({ home, sourceFile: SOURCE });

    expect(result.updated).toBe(true);
    expect(readFileSync(join(targetDir, "conductor.md"), "utf-8")).toBe(readFileSync(SOURCE, "utf-8"));
  });

  it("leaves unrelated agents untouched", () => {
    const home = makeHome();
    const targetDir = join(home, ".config", "opencode", "agents");
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, "other.md"), "user agent");

    provisionConductorAgent({ home, sourceFile: SOURCE });

    expect(readFileSync(join(targetDir, "other.md"), "utf-8")).toBe("user agent");
  });

  it("reports legacy v1 artifacts without deleting them", () => {
    const home = makeHome();
    const legacyAgentDir = join(home, ".config", "opencode", "agent");
    const legacyCommandDir = join(home, ".config", "opencode", "command");
    mkdirSync(legacyAgentDir, { recursive: true });
    mkdirSync(legacyCommandDir, { recursive: true });
    writeFileSync(join(legacyAgentDir, "conductor.md"), "old agent");
    writeFileSync(join(legacyCommandDir, "conductor-setup.toml"), "old command");

    const result = provisionConductorAgent({ home, sourceFile: SOURCE });

    expect(result.legacyArtifacts).toHaveLength(2);
    expect(existsSync(join(legacyAgentDir, "conductor.md"))).toBe(true);
    expect(existsSync(join(legacyCommandDir, "conductor-setup.toml"))).toBe(true);
  });
});

describe("detectLegacyArtifacts", () => {
  it("returns an empty list for a clean home", () => {
    expect(detectLegacyArtifacts(makeHome())).toEqual([]);
  });
});

describe("migrationNotice", () => {
  it("names the detected files and asks for manual removal", () => {
    const notice = migrationNotice(["/tmp/agent/conductor.md"]);

    expect(notice).toContain("legacy");
    expect(notice).toContain("/tmp/agent/conductor.md");
    expect(notice).toContain("Remove them manually");
  });
});

describe("defaultSourceFile", () => {
  it("points at the packaged agent definition", () => {
    expect(defaultSourceFile().endsWith(join("prompts", "agent", "conductor.md"))).toBe(true);
    expect(existsSync(defaultSourceFile())).toBe(true);
  });
});
