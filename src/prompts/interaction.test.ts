import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMMAND_TEMPLATES } from "../plugin/prompts.js";

/**
 * Guardrails for the conductor prompt UX.
 *
 * The host `question` tool renders as a plain-text modal with a small reading
 * area. These tests prevent the prompts from regressing to the old behaviour
 * (embedding drafts/diffs in `question`, or using the Gemini CLI `ask_user`
 * schema).
 */
const FORBIDDEN_PATTERNS: Array<[string, RegExp]> = [
  ["legacy ask_user tool", /ask_user/i],
  ["legacy multiSelect field", /multiSelect/i],
  ["legacy placeholder field", /placeholder/i],
  ["legacy question type field", /\*\*type:\*\*\s*"(?:choice|text|yesno)"/i],
  ["content embedded in question", /embed[^\n]*question/i],
  ["unfilled content placeholder", /<Insert\b/i],
  ["duplicate-in-chat instruction", /do not repeat/i],
];

describe("conductor prompt interaction rules", () => {
  for (const [id, template] of Object.entries(COMMAND_TEMPLATES)) {
    it(`${id} uses the OpenCode question schema`, () => {
      for (const [label, pattern] of FORBIDDEN_PATTERNS) {
        expect(template.prompt, `${id}: ${label}`).not.toMatch(pattern);
      }
    });
  }

  it("keeps question examples short and free of document separators", () => {
    for (const [id, template] of Object.entries(COMMAND_TEMPLATES)) {
      const lines = template.prompt.split("\n");
      lines.forEach((line, index) => {
        if (!line.includes("**question:**")) return;
        const inline = line.split("**question:**")[1]?.trim() ?? "";
        const tested = inline || (lines[index + 1] ?? "");
        expect(tested.length, `${id}:${index + 1}`).toBeLessThanOrEqual(200);
        expect(tested, `${id}:${index + 1}`).not.toContain("---");
        expect(tested, `${id}:${index + 1}`).not.toMatch(/```/);
      });
    }
  });

  it("documents the interaction contract in the conductor agent", () => {
    const agent = readFileSync(new URL("./agent/conductor.md", import.meta.url), "utf8");

    expect(agent).toContain("## Interaction Contract");
    expect(agent).toContain("one or two sentences");
    expect(agent).toContain("Reply `approve`");
  });
});
