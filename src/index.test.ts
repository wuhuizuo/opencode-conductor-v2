import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import conductorPlugin from "./index.js";

interface RegisteredCommand {
  name: string;
  description?: string;
  execute: (input: unknown) => Promise<void>;
}

function makeProject(): string {
  return mkdtempSync(join(tmpdir(), "conductor-project-"));
}

function makeHome(): string {
  return mkdtempSync(join(tmpdir(), "conductor-home-"));
}

function createHarness(options: { project: string; home: string; pluginOptions?: Record<string, unknown> }) {
  const commands: RegisteredCommand[] = [];
  const prompts: Record<string, unknown>[] = [];
  let disposed = 0;

  const ctx = {
    options: { home: options.home, ...options.pluginOptions },
    location: { directory: options.project },
    command: {
      transform: async (callback: (editor: { add: (definition: RegisteredCommand) => void }) => void) => {
        callback({ add: (definition) => commands.push(definition) });
        return { dispose: async () => void disposed++ };
      },
    },
    session: {
      prompt: async (input: Record<string, unknown>) => {
        prompts.push(input);
      },
    },
    agent: {
      list: async () => ({
        data: [
          { id: "conductor", mode: "primary" },
          { id: "helper", mode: "subagent" },
        ],
      }),
    },
  };

  return { ctx, commands, prompts, disposed: () => disposed };
}

async function setup(home: string, project: string, pluginOptions?: Record<string, unknown>) {
  const harness = createHarness({ home, project, pluginOptions });
  const cleanup = await conductorPlugin.setup(harness.ctx as never);
  return { ...harness, cleanup };
}

function commandNamed(commands: RegisteredCommand[], name: string): RegisteredCommand {
  const found = commands.find((command) => command.name === name);
  if (!found) throw new Error(`command not registered: ${name}`);
  return found;
}

function writeConductorFile(project: string, relativePath: string): void {
  const fullPath = join(project, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, "content");
}

describe("conductor plugin entrypoint", () => {
  it("declares the conductor id and a setup function", () => {
    expect(conductorPlugin.id).toBe("conductor");
    expect(typeof conductorPlugin.setup).toBe("function");
  });

  it("registers the six namespaced commands with descriptions", async () => {
    const { commands } = await setup(makeHome(), makeProject());

    expect(commands.map((command) => command.name).sort()).toEqual([
      "conductor:implement",
      "conductor:newTrack",
      "conductor:revert",
      "conductor:review",
      "conductor:setup",
      "conductor:status",
    ]);
    expect(commands.every((command) => Boolean(command.description))).toBe(true);
  });

  it("keeps exactly one registration set per load", async () => {
    const { commands } = await setup(makeHome(), makeProject());

    expect(commands.filter((command) => command.name === "conductor:implement")).toHaveLength(1);
  });

  it("disposes its registration through the returned cleanup", async () => {
    const { cleanup, disposed } = await setup(makeHome(), makeProject());

    await cleanup?.();

    expect(disposed()).toBe(1);
  });

  it("warns about legacy v1 artifacts without deleting them", async () => {
    const home = makeHome();
    const legacyDir = join(home, ".config", "opencode", "agent");
    mkdirSync(legacyDir, { recursive: true });
    const legacyFile = join(legacyDir, "conductor.md");
    writeFileSync(legacyFile, "old agent");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    let messages = "";
    try {
      await setup(home, makeProject());
      messages = warn.mock.calls.map((call) => String(call[0])).join("\n");
    } finally {
      warn.mockRestore();
    }
    expect(messages).toContain("legacy");
    expect(messages).toContain(legacyFile);
    expect(existsSync(legacyFile)).toBe(true);
  });

  it("provisions the conductor agent into an isolated home", async () => {
    const home = makeHome();
    const source = readFileSync(join(import.meta.dirname, "prompts", "agent", "conductor.md"), "utf-8");

    await setup(home, makeProject());

    const target = join(home, ".config", "opencode", "agents", "conductor.md");
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, "utf-8")).toBe(source);
    expect(existsSync(join(home, ".config", "opencode", "agent"))).toBe(false);
  });
});

describe("command execution", () => {
  it("dispatches the packaged status template with execution-time context", async () => {
    const project = makeProject();
    writeConductorFile(project, "conductor/index.md");
    const { commands, prompts } = await setup(makeHome(), project);

    await commandNamed(commands, "conductor:status").execute({
      sessionID: "session-1",
      prompt: { text: "" },
      delivery: "queue",
    });

    expect(prompts).toHaveLength(1);
    const input = prompts[0] as { sessionID: string; delivery: string; text: string };
    expect(input.sessionID).toBe("session-1");
    expect(input.delivery).toBe("queue");
    expect(input.text).toContain("STATUS OVERVIEW PROTOCOL");
    expect(input.text).toContain(`Directory: ${project}`);
    expect(input.text).toContain("conductor/index.md");
  });

  it("recomputes the file tree on every execution", async () => {
    const project = makeProject();
    const { commands, prompts } = await setup(makeHome(), project);

    await commandNamed(commands, "conductor:status").execute({
      sessionID: "session-1",
      prompt: { text: "" },
      delivery: "queue",
    });
    writeConductorFile(project, "conductor/tracks/new/plan.md");
    await commandNamed(commands, "conductor:status").execute({
      sessionID: "session-1",
      prompt: { text: "" },
      delivery: "queue",
    });

    const first = (prompts[0] as { text: string }).text;
    const second = (prompts[1] as { text: string }).text;
    expect(first).not.toContain("conductor/tracks/new/plan.md");
    expect(second).toContain("conductor/tracks/new/plan.md");
  });

  it("still dispatches when the project is not initialized", async () => {
    const project = makeProject();
    const { commands, prompts } = await setup(makeHome(), project);

    await commandNamed(commands, "conductor:revert").execute({
      sessionID: "session-2",
      prompt: { text: "" },
      delivery: "steer",
    });

    const text = (prompts[0] as { text: string }).text;
    expect(text).toContain("Conductor Setup: false");
    expect(text).toContain("(none)");
  });

  it("forwards typed arguments into the dispatched prompt", async () => {
    const project = makeProject();
    const { commands, prompts } = await setup(makeHome(), project);

    await commandNamed(commands, "conductor:newTrack").execute({
      sessionID: "session-3",
      prompt: { text: 'add login page' },
      delivery: "queue",
    });

    const text = (prompts[0] as { text: string }).text;
    expect(text).toContain("## User Arguments");
    expect(text).toContain("add login page");
  });

  it("uses the manual strategy by default and the delegated strategy when configured", async () => {
    const manualProject = makeProject();
    const manual = await setup(makeHome(), manualProject);
    await commandNamed(manual.commands, "conductor:implement").execute({
      sessionID: "s",
      prompt: { text: "" },
      delivery: "queue",
    });

    const delegatedProject = makeProject();
    const delegated = await setup(makeHome(), delegatedProject, { delegation: "delegate" });
    await commandNamed(delegated.commands, "conductor:implement").execute({
      sessionID: "s",
      prompt: { text: "" },
      delivery: "queue",
    });

    expect((manual.prompts[0] as { text: string }).text).toContain("Manual Implementation");
    expect((delegated.prompts[0] as { text: string }).text).toContain("DELEGATED");
  });

  it("only add strategy guidance to implement", async () => {
    const project = makeProject();
    const { commands, prompts } = await setup(makeHome(), project);

    await commandNamed(commands, "conductor:setup").execute({
      sessionID: "s",
      prompt: { text: "" },
      delivery: "queue",
    });

    expect((prompts[0] as { text: string }).text).not.toContain("Execution Strategy");
  });
});
