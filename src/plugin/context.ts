import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/** Directory (relative to the project root) that conductor owns. */
export const CONDUCTOR_DIR = "conductor";

const CONDUCTOR_FILE_EXTENSIONS = [".md", ".json"];

/** State file written by `/conductor:setup` once the project is initialized. */
export const SETUP_STATE_FILE = "setup_state.json";

/** OpenCode v2 project context injected into conductor prompts. */
export interface ProjectContext {
  readonly directory: string;
  readonly conductorPath: string;
  readonly setupCompleted: boolean;
  readonly files: readonly string[];
}

function isConductorFile(name: string): boolean {
  return CONDUCTOR_FILE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function walkConductorDirectory(directory: string, results: string[]): void {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      walkConductorDirectory(fullPath, results);
    } else if (entry.isFile() && isConductorFile(entry.name)) {
      results.push(fullPath);
    }
  }
}

/** Collect `conductor/**` markdown and JSON files, sorted for stable prompts. */
export function collectConductorFiles(projectDirectory: string): string[] {
  const results: string[] = [];
  walkConductorDirectory(join(projectDirectory, CONDUCTOR_DIR), results);
  return results.sort();
}

/**
 * Compute the project context at execution time.
 *
 * The file tree is intentionally rebuilt for every command execution: tracks are
 * created and updated while OpenCode keeps running, so a load-time snapshot goes
 * stale immediately.
 */
export function buildProjectContext(projectDirectory: string): ProjectContext {
  const conductorPath = join(projectDirectory, CONDUCTOR_DIR);
  return {
    directory: projectDirectory,
    conductorPath,
    setupCompleted: existsSync(join(conductorPath, SETUP_STATE_FILE)),
    files: collectConductorFiles(projectDirectory),
  };
}

/** Render the environment block appended to every conductor command prompt. */
export function renderEnvironment(context: ProjectContext): string {
  const relativeFiles = context.files.map((file) => relative(context.directory, file));
  const tree = relativeFiles.length > 0 ? relativeFiles.join("\n        ") : "(none)";

  return [
    "Environment Details:",
    `  - Directory: ${context.directory}`,
    `  - Conductor Setup: ${context.setupCompleted}`,
    `  - Current Conductor Files (Location: ${context.conductorPath})`,
    "      File Tree:",
    `        ${tree}`,
  ].join("\n");
}
