import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProjectContext, collectConductorFiles, renderEnvironment } from "./context.js";

function makeProject(): string {
  return mkdtempSync(join(tmpdir(), "conductor-context-"));
}

function writeFile(root: string, relativePath: string, content = "x"): void {
  const fullPath = join(root, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content);
}

describe("collectConductorFiles", () => {
  it("returns no files when the conductor directory is missing", () => {
    const project = makeProject();
    expect(collectConductorFiles(project)).toEqual([]);
  });

  it("collects markdown and json files recursively and ignores others", () => {
    const project = makeProject();
    writeFile(project, "conductor/index.md");
    writeFile(project, "conductor/tracks/demo/plan.md");
    writeFile(project, "conductor/tracks/demo/metadata.json");
    writeFile(project, "conductor/tracks/demo/notes.txt");
    writeFile(project, "conductor/tracks/demo/asset.png");

    const files = collectConductorFiles(project);

    expect(files).toHaveLength(3);
    expect(files.every((file) => file.endsWith(".md") || file.endsWith(".json"))).toBe(true);
    expect(files).toContain(join(project, "conductor/tracks/demo/plan.md"));
  });

  it("sorts results for stable prompts", () => {
    const project = makeProject();
    writeFile(project, "conductor/zeta.md");
    writeFile(project, "conductor/alpha.md");

    const files = collectConductorFiles(project);

    expect(files.map((file) => file.split("/").pop())).toEqual(["alpha.md", "zeta.md"]);
  });
});

describe("buildProjectContext", () => {
  it("reports setup as incomplete without a setup state file", () => {
    const project = makeProject();
    writeFile(project, "conductor/index.md");

    const context = buildProjectContext(project);

    expect(context.setupCompleted).toBe(false);
    expect(context.files).toHaveLength(1);
    expect(context.directory).toBe(project);
  });

  it("reports setup as complete once setup_state.json exists", () => {
    const project = makeProject();
    writeFile(project, "conductor/setup_state.json", JSON.stringify({ last_successful_step: "done" }));

    expect(buildProjectContext(project).setupCompleted).toBe(true);
  });

  it("recomputes the file tree for every call", () => {
    const project = makeProject();
    writeFile(project, "conductor/index.md");
    const first = buildProjectContext(project);
    writeFile(project, "conductor/tracks/new/plan.md");
    const second = buildProjectContext(project);

    expect(first.files).toHaveLength(1);
    expect(second.files).toHaveLength(2);
  });
});

describe("renderEnvironment", () => {
  it("renders directory, setup state and the file tree", () => {
    const project = makeProject();
    writeFile(project, "conductor/index.md");

    const rendered = renderEnvironment(buildProjectContext(project));

    expect(rendered).toContain(`Directory: ${project}`);
    expect(rendered).toContain("Conductor Setup: false");
    expect(rendered).toContain("conductor/index.md");
  });

  it("renders an explicit empty tree", () => {
    const project = makeProject();

    const rendered = renderEnvironment(buildProjectContext(project));

    expect(rendered).toContain("(none)");
    expect(rendered).toContain(`${join(project, "conductor")}`);
  });
});
