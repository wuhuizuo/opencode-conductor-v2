import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AGENT_FILE = "conductor.md";

/** OpenCode v2 global agent directory (relative to the global config root). */
export const GLOBAL_AGENTS_DIR = join(".config", "opencode", "agents");

/** Legacy OpenCode v1 directories that must not be written anymore. */
const LEGACY_AGENT_DIR = join(".config", "opencode", "agent");
const LEGACY_COMMAND_DIRS = [join(".config", "opencode", "command"), join(".config", "opencode", "commands")];

export interface ProvisionOptions {
  /** Override for tests; defaults to the current user's home directory. */
  readonly home?: string;
  /** Override for tests; defaults to the packaged agent definition. */
  readonly sourceFile?: string;
}

export interface ProvisionResult {
  readonly target: string;
  /** True when the packaged definition differed from what was installed. */
  readonly updated: boolean;
  readonly legacyArtifacts: readonly string[];
}

/** Path of the packaged `conductor` agent definition (valid from `src/` and `dist/`). */
export function defaultSourceFile(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "prompts", "agent", AGENT_FILE);
}

/**
 * Install the `conductor` agent into OpenCode v2's global agents directory.
 *
 * Idempotent by design: the file is only written when the packaged content differs,
 * and nothing outside the conductor-owned file is touched.
 */
export function provisionConductorAgent(options: ProvisionOptions = {}): ProvisionResult {
  const home = options.home ?? homedir();
  const sourceFile = options.sourceFile ?? defaultSourceFile();

  if (!existsSync(sourceFile)) {
    throw new Error(`conductor agent definition is missing from the package: ${sourceFile}`);
  }

  const content = readFileSync(sourceFile, "utf-8");
  const target = join(home, GLOBAL_AGENTS_DIR, AGENT_FILE);
  const current = existsSync(target) ? readFileSync(target, "utf-8") : undefined;
  const updated = current !== content;

  if (updated) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, "utf-8");
  }

  return { target, updated, legacyArtifacts: detectLegacyArtifacts(home) };
}

/** Locate OpenCode v1 conductor artifacts that are no longer used by this plugin. */
export function detectLegacyArtifacts(home: string = homedir()): string[] {
  const found: string[] = [];

  const legacyAgent = join(home, LEGACY_AGENT_DIR, AGENT_FILE);
  if (existsSync(legacyAgent)) found.push(legacyAgent);

  for (const commandDir of LEGACY_COMMAND_DIRS) {
    const directory = join(home, commandDir);
    if (!existsSync(directory)) continue;
    for (const name of readdirSync(directory)) {
      if (name.startsWith("conductor")) found.push(join(directory, name));
    }
  }

  return found;
}

/** One-line migration notice for stale v1 artifacts (never deletes them). */
export function migrationNotice(legacyArtifacts: readonly string[]): string {
  return (
    `[conductor] Detected ${legacyArtifacts.length} legacy OpenCode v1 file(s) that this plugin no longer uses: ` +
    `${legacyArtifacts.join(", ")}. Remove them manually to avoid duplicate conductor agents/commands.`
  );
}
