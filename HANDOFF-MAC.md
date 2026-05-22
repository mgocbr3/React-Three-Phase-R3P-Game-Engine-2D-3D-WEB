# PixlPlayground Engine Handoff - Mac

Date: 2026-05-20  
Branch used on Windows: `fix/admin-auth-and-metrics`  
Remote: `origin` -> `https://github.com/mgocbr3/pixlland-poki.git`

This handoff is for continuing PixlPlayground Studio engine work on a Mac without needing the full Codex conversation.

Update 2026-05-22: Enable3D is legacy context only. The current engine direction is Three.js for 3D runtime/editor work and Phaser 4 for 2D runtime/editor work.

## What This Branch Contains

- A separated engine workspace at `engine/`.
- PixlPlayground Studio app at `engine/apps/studio`.
- Root workspace wiring for `pnpm engine:*` scripts.
- Local-first project open/save flow using the browser File System Access API.
- Pixlland publish button routed to the platform submit page instead of cloud sync.
- Godot/Unreal-inspired editor chrome pass:
  - dark grey menu and toolbar contrast;
  - compact top menu;
  - `2D` / `3D` mode switch moved beside viewport gizmos;
  - dock panels with darker outlines;
  - sober icons and no emoji in the editor chrome;
  - bottom dock tabs grouped left and reorderable by drag.
- Harvest Rush 3D bridge:
  - game source stays under `apps/portal/games-src/harvest-rush-3d`;
  - PixlPlayground project document at `apps/portal/games-src/harvest-rush-3d/pixlplayground/project.pixlproject.json`;
  - bundled sample copy at `engine/apps/studio/public/sample-projects/harvest-rush-3d/project.pixlproject.json`;
  - runtime level document at `apps/portal/games-src/harvest-rush-3d/public/levels/harvest-rush.level3d.json`;
  - full `Farm.glb` visible in the engine sample, not only 2D proxy boxes.
- Runtime target update:
  - Three.js owns the 3D editor/runtime path.
  - Phaser 4 owns the 2D editor/runtime path.
  - Enable3D-era notes are historical reference only.

## Mac Setup

Use Node 22+ or the repo's preferred toolchain. Then:

```bash
git fetch origin
git checkout fix/admin-auth-and-metrics
git pull --ff-only origin fix/admin-auth-and-metrics
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install
```

Run the engine:

```bash
pnpm engine:dev -- --host 127.0.0.1 --port 8082
```

Open:

```text
http://127.0.0.1:8082/editor?sampleProject=harvest-rush-3d
```

Validate:

```bash
pnpm engine:typecheck
pnpm engine:test
```

Optional build:

```bash
pnpm engine:build
```

## Where Things Live

```text
engine/
  README.md
  ARCHITECTURE.md
  SECURITY.md
  HANDOFF-MAC.md
  apps/studio/
    src/pages/EditorPage.tsx
    src/components/editor/
      EditorHeader.tsx
      EditorToolbar.tsx
      SceneGraphPanel.tsx
      InspectorPanel.tsx
      BottomPanel.tsx
      EditorStatusBar.tsx
    src/components/ui/resizable.tsx
    src/engine/project/
      schema.ts
      editorProjectAdapter.ts
      level3dImporter.ts
      editorProjectAdapter.test.ts
    src/services/
      localProjectFiles.ts
      sampleProjects.ts
    scripts/
      import-harvest-rush-project.mjs
    public/sample-projects/harvest-rush-3d/
      project.pixlproject.json

apps/portal/games-src/harvest-rush-3d/
  src/main.js
  public/levels/harvest-rush.level3d.json
  pixlplayground/project.pixlproject.json
  phaser/

tools/vendor/
  # historical third-party references only
```

## Current Architecture Decisions

1. PixlPlayground is the visual editor, not a new copy of Phaser Editor.
2. Three.js 3D and Phaser 4 2D are runtime/export targets.
3. The editor source of truth is a local `project.pixlproject.json`.
4. Runtime bundles should stay stack-specific: Three.js for 3D scenes, Phaser 4 for 2D scenes.
5. Harvest Rush 3D currently edits a visual representation of the game scene and asset layout; gameplay systems remain in the game runtime.
6. The full game scene, scripts, UI and logic are not yet round-tripped as editable engine components. That is the next big milestone.
7. Cloud/Supabase code from the original Studio exists as legacy code, but engine local mode is the default and the visible editor chrome no longer presents cloud sync as the main workflow.

## Harvest Rush 3D Workflow

Generate or refresh the PixlPlayground sample:

```bash
pnpm --filter pixlplaygroundstudio import:harvest-rush
```

Open the sample in the engine:

```text
http://127.0.0.1:8082/editor?sampleProject=harvest-rush-3d
```

Runtime game source:

```bash
cd apps/portal/games-src/harvest-rush-3d
npm install
npm run dev
```

Build and sync the game bundle through the portal script:

```bash
pnpm --filter @pixlland/portal build:harvest-rush
```

Phaser Editor Desktop bridge:

```bash
cd apps/portal/games-src/harvest-rush-3d
npm run phaser:open
npm run phaser:export-level
```

Important distinction:

- `Farm.glb` is the visual world asset.
- `harvest-rush.level3d.json` is the editable placement/metadata bridge.
- `project.pixlproject.json` is the PixlPlayground engine project file.
- `src/main.js` still owns game rules, controls, HUD and runtime simulation.

## What Works Now

- Engine opens from the monorepo with `pnpm engine:dev`.
- Harvest Rush 3D sample opens directly in the editor.
- The full farm GLB renders in the 3D viewport.
- Hierarchy shows `Farm.glb`, camera, sun and gameplay groups.
- Content Browser lists Harvest Rush assets.
- Inspector, scene graph and bottom browser are resizable docks.
- Bottom panel tabs can be reordered by dragging.
- `Open` and `Save` operate on local project folders where browser support exists.
- `Publish` opens Pixlland submission flow.
- TypeScript typecheck passes.
- Vitest passes.

## What Is Not Finished Yet

- Full Godot-style arbitrary drag-and-dock layout for every panel.
- Persistent multi-monitor/window layouts.
- Full game round-trip editing:
  - scripts as components;
  - HUD as editable UI scene;
  - gameplay state/components;
  - runtime collision volumes;
  - prefab variants.
- Proper 2D Phaser viewport editor.
- Phaser 4 exporter from `project.pixlproject.json`.
- CLI commands for validate/import/export/snapshot.
- MCP server for agents.
- VS Code extension / scene diagnostics.
- Complete removal or isolation of old Supabase/cloud source files.
- Packaged desktop app build.

## Recommended Next Milestones

1. Define the project folder contract:
   - `project.pixlproject.json`;
   - `Assets/`;
   - `Scenes/`;
   - `Scripts/`;
   - `ProjectSettings/`;
   - generated `Builds/`.
2. Build engine CLI:
   - `pixl engine validate <project>`;
   - `pixl engine import-harvest-rush`;
   - `pixl engine export-three`;
   - `pixl engine export-phaser`.
3. Implement real dock manager:
   - draggable panels;
   - split panes;
   - saved layouts;
   - reset/preset layouts from the `Window` menu.
4. Promote scene schema:
   - components registry;
   - JSON schema validation;
   - migrations between project versions.
5. Add first MCP surface:
   - inspect hierarchy;
   - move object;
   - create object;
   - validate project;
   - export diff.
6. Make Harvest Rush the test game:
   - edit tree/building/field objects in engine;
   - save project file;
   - regenerate runtime level;
   - launch runtime and verify the change.

## Validation Run On Windows

Commands run successfully:

```bash
pnpm --reporter=silent --filter pixlplaygroundstudio typecheck
pnpm --reporter=silent --filter pixlplaygroundstudio test
```

Playwright/Chrome visual check opened:

```text
http://127.0.0.1:8082/editor?sampleProject=harvest-rush-3d
```

The in-app Browser plugin failed locally because its Node runtime could not load the browser skill module, so Playwright with Chrome was used for visual QA.

## Notes For Codex / Claude Code / VS Code

Use the project document instead of editing runtime code blindly:

- scene data: `project.pixlproject.json`;
- importer/exporter code: `engine/apps/studio/src/engine/project`;
- local file IO: `engine/apps/studio/src/services/localProjectFiles.ts`;
- Harvest Rush generator: `engine/apps/studio/scripts/import-harvest-rush-project.mjs`.

Future agent-safe workflow:

1. Load project document.
2. Validate schema.
3. Make structured scene edits.
4. Emit diff.
5. Run engine validation.
6. Export runtime artifacts.
7. Run game smoke test.

## Keep Out Of Git

Do not commit:

- `node_modules/`;
- `dist/`;
- `.env.local`;
- OS/editor files;
- raw downloaded assets unless license and size are reviewed.

The repo already ignores these, including `engine/apps/studio/node_modules` and `engine/apps/studio/dist`.
