#!/usr/bin/env node
/**
 * End-to-end probe for the conductor plugin against a real OpenCode v2 binary.
 *
 * The probe creates a throwaway project that loads the plugin through OpenCode's
 * `plugins` config, then checks that setup ran and the six conductor commands are
 * registered. Everything is isolated: temporary HOME/XDG directories, a private
 * service port, and a temp project directory.
 *
 * Usage:
 *   node scripts/integration-probe.mjs            # probe the local build (dist)
 *   node scripts/integration-probe.mjs --tarball  # pack + install + probe the tarball
 *   node scripts/integration-probe.mjs --broken   # assert the probe detects a broken entrypoint
 *   node scripts/integration-probe.mjs --keep     # keep the temp directories for inspection
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const PACKAGE_NAME = "@wuhuizuo/opencode-conductor-plugin";
const EXPECTED_COMMANDS = [
  "conductor:implement",
  "conductor:newTrack",
  "conductor:revert",
  "conductor:review",
  "conductor:setup",
  "conductor:status",
];

const flags = new Set(process.argv.slice(2));
const BROKEN = flags.has("--broken");
const TARBALL = flags.has("--tarball");
const KEEP = flags.has("--keep");

function step(message) {
  console.log(`• ${message}`);
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: "utf-8",
    timeout: options.timeout ?? 300_000,
  });
  if (result.error) fail(`failed to run ${command}: ${result.error.message}`);
  if (result.status !== 0 && !options.allowFailure) {
    console.error(result.stdout);
    console.error(result.stderr);
    fail(`${command} ${args.join(" ")} exited with ${result.status}`);
  }
  return result;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(200);
  }
  fail(`timed out waiting for ${label}`);
}

function freePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.unref();
    server.on("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function wrapperSource(importSpecifier) {
  return `import { writeFileSync } from "node:fs";
import conductor from ${JSON.stringify(importSpecifier)};

export default {
  id: "conductor",
  async setup(ctx) {
    const cleanup = await conductor.setup(ctx);
    const listed = await ctx.command.list();
    const commands = Array.isArray(listed) ? listed : (listed && listed.data) || [];
    writeFileSync(process.env.PROBE_OUT, JSON.stringify(commands.map((command) => command.name)));
    return cleanup;
  },
};
`;
}

function readProbeOutput(outFile) {
  if (!existsSync(outFile)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(outFile, "utf-8"));
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  if (!TARBALL) {
    step("building the plugin");
    run("npm", ["run", "build"], { cwd: REPO_ROOT });
  }

  const workspace = mkdtempSync(join(tmpdir(), "conductor-probe-"));
  const project = join(workspace, "project");
  const home = join(workspace, "home");
  const outFile = join(workspace, "commands.json");
  const pluginDir = join(project, ".opencode", "plugins", "probe");

  mkdirSync(pluginDir, { recursive: true });
  mkdirSync(home, { recursive: true });

  let importSpecifier = join(REPO_ROOT, "dist", "index.js");
  if (TARBALL) {
    step("packing the plugin tarball");
    const packDir = join(workspace, "pack");
    mkdirSync(packDir);
    run("npm", ["pack", "--silent", "--pack-destination", packDir], { cwd: REPO_ROOT });
    const tarballName = readdirSync(packDir).find((name) => name.endsWith(".tgz"));
    if (!tarballName) fail("npm pack produced no tarball");

    writeFileSync(
      join(project, "package.json"),
      JSON.stringify({ name: "conductor-probe", private: true, type: "module" }, null, 2),
    );
    step("installing the tarball into the probe project");
    // Isolate HOME so the package postinstall writes into the probe home, not the
    // developer's real ~/.config/opencode.
    run("npm", ["install", "--no-audit", "--no-fund", "--no-save", join(packDir, tarballName)], {
      cwd: project,
      env: { ...process.env, HOME: home },
    });

    const packageDir = join(project, "node_modules", ...PACKAGE_NAME.split("/"));
    if (!existsSync(join(packageDir, "dist", "index.js"))) fail("tarball is missing dist/index.js");
    if (!existsSync(join(packageDir, "dist", "prompts", "conductor", "setup.json"))) {
      fail("tarball is missing packaged prompts");
    }
    if (existsSync(join(packageDir, "node_modules", "@opencode", "plugin"))) {
      fail("tarball bundles @opencode/plugin; the host module must stay external");
    }
    importSpecifier = PACKAGE_NAME;
  } else if (!existsSync(importSpecifier)) {
    fail("dist/index.js is missing (run npm run build or omit --source)");
  }

  writeFileSync(join(pluginDir, "index.ts"), BROKEN ? "export default {};\n" : wrapperSource(importSpecifier));
  writeFileSync(
    join(project, "opencode.json"),
    JSON.stringify({ $schema: "https://opencode.ai/config.json", plugins: ["./.opencode/plugins/probe"] }, null, 2),
  );

  const port = await freePort();
  const env = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_DATA_HOME: join(home, ".local", "share"),
    XDG_STATE_HOME: join(home, ".local", "state"),
    XDG_CACHE_HOME: join(home, ".cache"),
    PROBE_OUT: outFile,
  };

  run("opencode", ["service", "set", "port", String(port)], { cwd: project, env, allowFailure: true });

  step(`running opencode v2 (${TARBALL ? "tarball" : "local build"}${BROKEN ? ", broken entrypoint" : ""})`);
  const result = run("opencode", ["debug", "config"], { cwd: project, env, allowFailure: true, timeout: 180_000 });

  const logFile = join(home, ".local", "share", "opencode", "log", "opencode.log");
  const readLog = () => (existsSync(logFile) ? readFileSync(logFile, "utf-8") : "");

  // `opencode debug config` returns before the background service finishes loading
  // plugins, so wait for the observable outcome instead of assuming it is done.
  await waitFor(
    () => (BROKEN ? /Plugin must export a default definition|LoadError/.test(readLog()) : existsSync(outFile)),
    45_000,
    BROKEN ? "OpenCode to reject the broken entrypoint" : "plugin setup to run",
  );

  const log = readLog();
  const registered = readProbeOutput(outFile);

  try {
    if (BROKEN) {
      const detected =
        result.status !== 0 || registered === undefined || !EXPECTED_COMMANDS.every((name) => registered.includes(name));
      if (!detected) fail("probe reported success for a broken plugin entrypoint");
      if (!/Plugin must export a default definition|LoadError/.test(log)) {
        fail("broken entrypoint failed but OpenCode did not log a plugin load error");
      }
      step("broken entrypoint correctly rejected by OpenCode");
      return;
    }

    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
      fail("opencode exited non-zero while loading the plugin");
    }
    if (!registered) fail("plugin setup never ran (probe output missing)");

    const missing = EXPECTED_COMMANDS.filter((name) => !registered.includes(name));
    if (missing.length > 0) fail(`missing conductor commands: ${missing.join(", ")}`);

    const agentFile = join(home, ".config", "opencode", "agents", "conductor.md");
    if (!existsSync(agentFile)) fail("conductor agent was not provisioned into the v2 agents directory");
    if (existsSync(join(home, ".config", "opencode", "agent"))) fail("legacy v1 agent/ directory was written");

    if (/PluginModule\.LoadError|Plugin must export a default definition/.test(log)) {
      fail("plugin load error found in the OpenCode log");
    }

    step(`registered: ${EXPECTED_COMMANDS.join(", ")}`);
    step("conductor agent provisioned into ~/.config/opencode/agents/conductor.md");
    step("probe passed");
  } finally {
    run("opencode", ["service", "stop"], { cwd: project, env, allowFailure: true });
    if (KEEP) {
      console.log(`• kept probe workspace: ${workspace}`);
    } else {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
