#!/usr/bin/env node
/**
 * Install the conductor agent definition into the OpenCode v2 global config.
 *
 * OpenCode v2 reads agent definitions from `~/.config/opencode/agents/` (plural).
 * The legacy v1 `agent/` and `command/` directories are never written here; stale
 * copies found there are reported so the user can remove them.
 *
 * The install is best-effort: a failure must never fail `npm install`.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const AGENT_FILE = 'conductor.md';

function main() {
  const home = os.homedir();
  const configDir = path.join(home, '.config', 'opencode');
  const sourceFile = path.join(__dirname, '..', 'dist', 'prompts', 'agent', AGENT_FILE);

  if (!fs.existsSync(sourceFile)) {
    // Installed from a git checkout without a build; runtime provisioning covers it later.
    return;
  }

  const content = fs.readFileSync(sourceFile, 'utf-8');
  const targetDir = path.join(configDir, 'agents');
  const targetFile = path.join(targetDir, AGENT_FILE);
  const current = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf-8') : undefined;

  if (current !== content) {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(targetFile, content, 'utf-8');
    console.log('[conductor] Installed agent definition for OpenCode v2.');
  }

  const legacy = findLegacyArtifacts(configDir);
  if (legacy.length > 0) {
    console.log(
      `[conductor] Found ${legacy.length} legacy OpenCode v1 file(s) that are no longer used: ${legacy.join(', ')}. ` +
        'Remove them manually to avoid duplicate conductor agents/commands.',
    );
  }
}

function findLegacyArtifacts(configDir) {
  const found = [];

  const legacyAgent = path.join(configDir, 'agent', AGENT_FILE);
  if (fs.existsSync(legacyAgent)) found.push(legacyAgent);

  for (const dirName of ['command', 'commands']) {
    const directory = path.join(configDir, dirName);
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory)) {
      if (name.startsWith('conductor')) found.push(path.join(directory, name));
    }
  }

  return found;
}

try {
  main();
} catch (error) {
  console.warn('[conductor] postinstall skipped:', error && error.message ? error.message : error);
}
