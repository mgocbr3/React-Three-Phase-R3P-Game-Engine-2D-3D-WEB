# PixlPlayground Studio Engine

PixlPlayground Studio lives in this `engine/` workspace so the visual editor can evolve without being mixed into the Pixlland platform app.

Start here when continuing engine work:

- [Mac handoff](./HANDOFF-MAC.md) - current state, setup, commands, open tasks and Harvest Rush 3D workflow.
- [Architecture](./ARCHITECTURE.md) - renderer split, scene document direction and automation boundary.
- [Reference engines](./REFERENCE-ENGINES.md) - external engine patterns to check before changing viewport behavior.
- [Security notes](./SECURITY.md) - current and next guardrails.

## Workspace Layout

```text
engine/
  apps/
    studio/                 # PixlPlayground desktop-style visual editor
  packages/                 # reserved for shared engine packages

apps/portal/games-src/
  harvest-rush-3d/
    pixlplayground/         # project document consumed by the engine
    phaser/                 # official Phaser Editor Desktop project bridge
    public/levels/          # level3d documents consumed by the runtime
    src/                    # Three.js runtime source

tools/vendor/               # optional third-party source mirrors for reference only
```

## Commands

Run from the Pixlland monorepo root:

```bash
pnpm install
pnpm engine:dev
pnpm engine:typecheck
pnpm engine:test
pnpm engine:build
```

Open the Harvest Rush 3D sample directly:

```text
http://127.0.0.1:8082/editor?sampleProject=harvest-rush-3d
```

## Current Engine Stack

- Editor shell: React, Vite, Zustand, Radix/shadcn base components.
- 3D viewport: Three.js, React Three Fiber, Drei and Rapier.
- 2D direction: Phaser 4.
- Project model: versioned `project.pixlproject.json` documents.
- Local projects: File System Access API first; JSON export fallback when folder access is not available.

## Direction

The editor should become a Pixlland-native mini engine:

- one local project folder per game;
- one shared scene document for 2D and 3D;
- visual editing in the engine, runtime code in game folders;
- CLI and MCP surfaces for Codex, Claude Code, VS Code and future agents;
- exporters that generate Pixlland, Three.js and Phaser runtime output from the same source of truth.
