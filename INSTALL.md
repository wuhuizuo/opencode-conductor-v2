# Installation Guide

Install the Conductor plugin for **OpenCode v2** (v2.1.4+).

> The legacy `opencode-conductor-plugin` package targets OpenCode v1 and does not load under v2.
> Use `@wuhuizuo/opencode-conductor-plugin` instead.

---

## 🚀 Simple Installation (Recommended)

```bash
opencode plugin add @wuhuizuo/opencode-conductor-plugin
```

`opencode plugin add` installs the package and writes it to the **global** OpenCode configuration
(`~/.config/opencode/opencode.json`).

### Or edit the config manually

**File:** `~/.config/opencode/opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["@wuhuizuo/opencode-conductor-plugin"]
}
```

### ⚡ First-Run Provisioning

The first time the plugin loads (and on every `npm install`), it installs the `conductor` agent definition to:

```
~/.config/opencode/agents/conductor.md
```

- The install is idempotent and refreshes a stale definition after upgrades.
- It never writes to the legacy `~/.config/opencode/agent/` or `~/.config/opencode/command/` directories.
- If legacy v1 conductor files are detected, the plugin logs a one-line migration notice (files are not deleted).

**Restart OpenCode** after the first load so the `conductor` agent and the six slash commands are available.

---

## ⚙️ Configuration

### Agent Model

By default the `conductor` agent uses your session's default model. Pinning a fast model is recommended for planning phases.

**File:** `~/.config/opencode/opencode.json`

```json
{
  "agents": {
    "conductor": {
      "model": "google/gemini-3-flash"
    }
  }
}
```

### Delegation Strategy

```json
{
  "plugins": [
    {
      "package": "@wuhuizuo/opencode-conductor-plugin",
      "options": { "delegation": "auto" }
    }
  ]
}
```

| Value | Behaviour |
| :--- | :--- |
| `manual` | Implement every task in the current session (default). |
| `delegate` | Dispatch tasks through OpenCode v2's built-in `subagent` tool. |
| `auto` | Delegate when a subagent-capable agent is available, otherwise manual. |

---

## 🧹 Migrating From v1

1. Remove the v1 plugin entry (`"plugin": ["opencode-conductor-plugin"]`) and add the v2 entry under `plugins` (see above).
2. Delete the legacy installed artifacts so they cannot shadow the new agent:
   ```bash
   rm -f ~/.config/opencode/agent/conductor.md
   rm -f ~/.config/opencode/command/conductor*
   ```
3. Restart OpenCode.

**Rollback:** reinstall `opencode-conductor-plugin@1.32.0` and run OpenCode v1.

---

## 🏗️ Development & Manual Install

```bash
git clone git@github.com:wuhuizuo/opencode-conductor-v2.git
cd opencode-conductor-v2
npm install
npm run build
```

Point OpenCode at the local build through a local plugin directory:

```json
{
  "plugins": ["/absolute/path/to/opencode-conductor-v2/.opencode/plugins/conductor"]
}
```

where `.opencode/plugins/conductor/index.ts` re-exports the built entrypoint:

```ts
export { default } from "../../../dist/index.js";
```

Run the automated equivalent with `npm run probe`.

---

## ✅ Verifying the Installation

```bash
opencode plugin list        # the package should be listed
```

Inside a session, all six commands are available:

- `/conductor:setup`
- `/conductor:newTrack`
- `/conductor:implement`
- `/conductor:review`
- `/conductor:status`
- `/conductor:revert`

If commands do not appear, restart OpenCode and check the log for plugin load errors.
