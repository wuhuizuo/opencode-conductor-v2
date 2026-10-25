import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * How `conductor:implement` delegates work.
 *
 * - `manual`: the executing agent implements every plan task itself.
 * - `delegate`: work is handed to the built-in OpenCode v2 `subagent` tool.
 * - `auto`: delegate only when the runtime exposes a subagent-capable agent.
 */
export type DelegationMode = "manual" | "delegate" | "auto";

export type ResolvedStrategy = "manual" | "delegate";

interface AgentLike {
  readonly mode?: string;
}

/** Normalize the plugin option; anything unknown falls back to `manual`. */
export function parseDelegationMode(value: unknown): DelegationMode {
  return value === "delegate" || value === "auto" ? value : "manual";
}

/** Resolve the effective strategy for one `conductor:implement` execution. */
export function resolveStrategy(mode: DelegationMode, hasSubagent: boolean): ResolvedStrategy {
  if (mode === "delegate") return "delegate";
  if (mode === "auto") return hasSubagent ? "delegate" : "manual";
  return "manual";
}

function toAgentList(value: unknown): AgentLike[] {
  if (Array.isArray(value)) return value as AgentLike[];
  if (value && typeof value === "object") {
    const data = (value as { data?: unknown }).data;
    if (Array.isArray(data)) return data as AgentLike[];
  }
  return [];
}

/** True when the runtime lists at least one agent usable as a subagent target. */
export function hasSubagentAgent(agents: unknown): boolean {
  return toAgentList(agents).some((agent) => agent.mode === "subagent" || agent.mode === "all");
}

/** Root directory that holds packaged prompts (works from `src/` and `dist/`). */
export function promptsRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "prompts");
}

/** Read a packaged strategy markdown file. */
export function loadStrategyText(strategy: ResolvedStrategy, root: string = promptsRoot()): string {
  return readFileSync(join(root, "strategies", `${strategy}.md`), "utf-8");
}
