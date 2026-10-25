# Conductor Plugin for OpenCode v2

> **Measure twice, code once.**

Conductor is an [OpenCode](https://opencode.ai) plugin that enforces a rigorous, **Context-Driven Development** lifecycle. It turns OpenCode from a reactive coding tool into a proactive project architect that specifies, plans, and implements software features and bug fixes against persistent project context.

> **Fork note**
> This repository ports [`derekbar90/opencode-conductor`](https://github.com/derekbar90/opencode-conductor) to the **OpenCode v2 plugin API**.
> The upstream package (`opencode-conductor-plugin`) targets OpenCode v1 and does not load under v2.
> This fork publishes `@wuhuizuo/opencode-conductor-plugin` and requires **OpenCode v2.1.4+**.

---

## 🚀 Key Features

- **Native v2 plugin**: one plugin entrypoint that registers everything through OpenCode v2's command transform.
- **Six slash commands**: `/conductor:setup`, `/conductor:newTrack`, `/conductor:implement`, `/conductor:review`, `/conductor:status`, `/conductor:revert`.
- **Specialized `conductor` agent**: a dedicated planning/architecture agent installed into the global OpenCode v2 agents directory.
- **Protocol-driven workflow**: Context → Spec → Plan → Implement, enforced by the packaged prompts.
- **Execution-time context**: every command injects the project directory, setup state, and the current `conductor/` file tree — recomputed on each execution.
- **Delegation without extra tooling**: delegated implementation uses OpenCode v2's built-in `subagent` tool and session APIs (no plugin-owned delegate/background tools).
- **19+ style templates** bundled for many languages (Rust, Go, Zig, Julia, Kotlin, Swift, …).
- **Zero-config provisioning**: the `conductor` agent is installed on `npm install` and refreshed on first load.

---

## 📦 Installation

**Requirements:** OpenCode **v2.1.4 or newer**.

### Recommended: `opencode plugin add`

```bash
opencode plugin add @wuhuizuo/opencode-conductor-plugin
```

### Or edit the global config

**File:** `~/.config/opencode/opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["@wuhuizuo/opencode-conductor-plugin"]
}
```

On first load the plugin installs the `conductor` agent to `~/.config/opencode/agents/conductor.md`.
**Restart OpenCode** after the first load so the agent and slash commands are wired into the session.

---

## ⚙️ Configuration

### Agent model

`conductor` inherits your session model by default. Pinning a fast model for planning is recommended:

```json
{
  "agents": {
    "conductor": {
      "model": "google/gemini-3-flash"
    }
  }
}
```

### Delegation strategy

`conductor:implement` can either implement tasks itself or delegate them through OpenCode v2's built-in `subagent` tool:

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
| `manual` (default) | The executing agent implements every plan task itself. |
| `delegate` | Each task is dispatched to a subagent-capable agent via the built-in `subagent` tool. |
| `auto` | Delegates only when OpenCode v2 exposes a subagent-capable agent; otherwise manual. |

---

## 🛠️ The Conductor Lifecycle

Conductor organizes work into **Tracks** (features or bug fixes). Every track follows three phases:

### 1. Project initialization (`/conductor:setup`)

Run once per project. The agent interviews you to define product vision, tech stack, and workflow rules, then writes the `conductor/` directory (including `conductor/setup_state.json`).

### 2. Track planning (`/conductor:newTrack "…"`)

Describe the task. Conductor asks targeted questions, writes the track specification (`spec.md`), and generates a step-by-step implementation plan (`plan.md`).

### 3. Implementation (`/conductor:implement`)

The agent works through `plan.md`, following the project's workflow rules (e.g. TDD and commit conventions). Use `/conductor:status` for progress and `/conductor:revert` to undo a task, phase, or track.

---

## 📋 Commands Reference

| Command | Description |
| :--- | :--- |
| `/conductor:setup` | Initialize the `conductor/` directory and the project constitution. |
| `/conductor:newTrack "desc"` | Start a feature/bug track with spec and plan generation. |
| `/conductor:implement` | Implement the next pending task in the current track. |
| `/conductor:review` | Review completed track work against the plan and guidelines. |
| `/conductor:status` | High-level overview of project progress and active tracks. |
| `/conductor:revert` | Interactively undo a task, phase, or track via Git. |

---

## 🤝 Delegation in OpenCode v2

Delegated work is handed to subagents through the **built-in `subagent` tool** and runs in child sessions that stay inspectable via the session APIs. The plugin deliberately ships **no** `conductor_delegate` / background tools: OpenCode v2 already provides delegation and session management, and duplicating them only adds failure modes.

---

## 🔁 Migrating from the v1 plugin

The v1 package (`opencode-conductor-plugin`) is **not** compatible with OpenCode v2. Migration steps:

1. Upgrade to OpenCode v2.
2. In `~/.config/opencode/opencode.json`, replace the v1 key and package:
   ```json
   {
     "plugins": ["@wuhuizuo/opencode-conductor-plugin"]
   }
   ```
3. Remove the legacy v1 artifacts (they are ignored by v2 and can shadow the new agent):
   ```bash
   rm -f ~/.config/opencode/agent/conductor.md
   rm -f ~/.config/opencode/command/conductor*
   ```
4. Restart OpenCode. The plugin reports any leftover legacy files in the log.

**Rollback:** reinstall `opencode-conductor-plugin@1.32.0` and run OpenCode v1; the installed agent file is additive and can stay.

---

## 🧑‍💻 Development

```bash
npm install                   # installs dev deps
npm run build                 # tsc + copy packaged prompts to dist/
npm test                      # vitest unit suite
npm run probe                 # integration probe: local build + real OpenCode v2
npm run probe -- --tarball    # pack, install and probe the published artifact
npm run probe -- --broken     # verify the probe rejects a broken entrypoint
```

The probe builds an isolated project with temporary `HOME`/`XDG` directories, loads the plugin through the real `opencode` binary, and asserts that the six commands register and the agent is provisioned.

---

## 🚀 Releasing

Releases are **tag-driven**; CI never bumps versions.

1. Bump `version` in `package.json` and add the matching `# [x.y.z]` section to `CHANGELOG.md` (release notes reuse it).
2. Commit, then create and push the tag:
   ```bash
   git tag v2.0.1
   git push origin v2.0.1
   ```
3. `.github/workflows/publish.yml` runs on the tag: typecheck + tests + build, publishes to npm with provenance via **OIDC trusted publishing**, and creates/updates the GitHub release with npm install instructions plus a `conductor-v2-release.tar.gz` asset.

Prerequisite: configure the npm package's **Trusted Publisher** (npmjs.com → package settings → Trusted Publishing → GitHub Actions, repo `wuhuizuo/opencode-conductor-v2`, workflow `publish.yml`). No `NPM_TOKEN` secret is used or stored.

Re-running a release: `gh workflow run publish.yml -f tag_name=v2.0.1` — already published versions are skipped and the release is updated in place.

This fork starts the OpenCode v2 line at `2.0.0`.

---

## 📜 License

Apache License 2.0 — see [LICENSE](LICENSE). Original work by Derek Barrera.
