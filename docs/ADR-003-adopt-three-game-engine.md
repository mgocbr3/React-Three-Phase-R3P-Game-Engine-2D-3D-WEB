# ADR-003: Adopt `WesUnwin/three-game-engine` as the 3D Runtime — Replace the in-house 3D Layer

**Status:** Accepted (2026-05-22 — owner approved Option B, Phaser-2D mirror rule, and template deletion)
**Date:** 2026-05-22
**Deciders:** Owner (Márcio), engine working agent
**Branch context:** `claude/review-codex-engine-I1E8y` (post-Phase 1 of ADR-002)

---

## Context

Today's PixlPlayground 3D layer is broken in repeated, structural ways — the latest one is the gizmo on Harvest Rush picking up the wrong sub-mesh of `Farm.glb` because we route everything through a bespoke "shared GLB scene optimizer" (`StaticGltfScene.tsx` + `getStaticGltfObjectByEditorId`). Each fix bolts onto more code: `EditableObject.tsx` alone is **1,914 lines**, `editorStore.ts` is **1,528 lines**, `TransformGizmo.tsx` is **421 lines** that re-implement what `three/examples/jsm/controls/TransformControls.js` already does in 50.

The owner has decided we stop inventing this layer. We have a **complete, MIT-licensed, documented Three.js game engine** vendored in `tools/vendor/three-game-engine/` ([repo](https://github.com/WesUnwin/three-game-engine), [docs](https://wesunwin.github.io/three-game-engine/#/)). Wes' diagram (provided by the owner):

```
Game
├── Renderer        → THREE.WebGLRenderer, THREE.Camera
├── Scene
│   ├── threeJSScene   → THREE.Scene
│   ├── rapierWorld    → RAPIER.World
│   └── gameObjects[]
│       └── GameObject
│           ├── parent
│           ├── threeJSGroup  → THREE.Group  (this is what gizmos attach to)
│           ├── rapierRigidBody
│           └── gameObjects[] (children)
└── AssetStore
    ├── baseURL OR dirHandle
    └── loadedAssets[]   (GLTFAsset, SoundAsset, JSONAsset, TextureAsset, …)
```

This is the same shape we are flailing toward — but it has been polished by Wes plus contributors over years.

### Inventory snapshot (today, this branch)

| Area | Our lines | Wes' equivalent | Wes' lines |
|---|---:|---|---:|
| **Whole Three.js runtime + editor scene code** (`src/components/canvas/`) | **19,231** | `src/` (Game, Scene, GameObject, Component, AssetStore, Renderer, InputManager, Rapier, VR, character controller) | **3,579** |
| `EditableObject.tsx` (the catch-all mesh wrapper) | 1,914 | `GameObject.ts` | 427 |
| `EditorCanvas.tsx` | 836 | `Scene.ts` + `MainArea.jsx` | 384 + ~350 |
| `editorStore.ts` (in-memory scene model) | 1,528 | Wes uses Redux slices (`FileDataSlice`, `SelectedItemSlice`, `SettingsSlice`) | ~250 |
| `TransformGizmo.tsx` (re-implements TransformControls + bespoke "interaction lock") | 421 | inline ~50 lines in `MainArea.jsx` using stock `TransformControls` | ~50 |
| `StaticGltfScene.tsx` (shared GLB sub-mesh hack — this is what broke the gizmo today) | 431 | — (doesn't exist; Wes' GameObject pattern scales without this) | 0 |
| `FPSController.tsx`, `ThirdPersonController.tsx`, `PlatformerController.tsx`, `VehicleController.tsx`, `IsometricController.tsx` | 815 + 791 + 423 + 459 + 219 = **2,707** | `CharacterController.ts` + `DynamicCharacterController.ts` + `KinematicCharacterController.ts` | 94 + 90 + 180 = **364** |
| `EmissiveLights.tsx`, `VolumetricLighting.tsx`, `RTXPostProcessing.tsx`, `RTXWater.tsx`, `RTXDemoScene.tsx`, `ManualPostProcessing.tsx`, `PostProcessingEffects.tsx` | ~1,700 | — (post-FX kept user-side, optional) | 0 |
| Game templates hardcoded in editor (`GTA6Template.tsx`, `FPSHorrorTemplate.tsx`, `PlatformerTemplate.tsx`, `RPGTemplate.tsx`, `SocialHubTemplate.tsx`, `HyperRealisticTemplate.tsx`, `RacingTemplate.tsx`, `MinecraftPlayer.tsx`, `MinecraftAnimals.tsx`, `MinecraftCharacter.tsx`, `MinecraftNPCs.tsx`, `EditorTemplateScene.tsx`) | ~5,800 | — (templates are *projects*, not editor code) | 0 |

**The math is unambiguous:** the editor's 3D code is ~5× the size of a fully-featured competing engine for less than a third of the functionality.

### Specific bugs the in-house path keeps producing

1. **Gizmo attaches to wrong mesh** (today's report): `getStaticGltfObjectByEditorId` returns one of many meshes inside the shared Farm.glb scene; the picked mesh's `matrixWorld` decomposes to a position 50+ units away from where the user clicked. Verified via in-browser probe: target was `Mesh "ground_011002"` at world `[23,-0.12,-27.75]` when the user expected `[74, 0, -16.6]`.
2. **GizmoInteractionLock** (a 150-line global state in `TransformGizmo.tsx`) re-implements behavior that `TransformControls`' own `dragging-changed` event already covers, and is a frequent source of "editor stuck in dragging state" UX issues.
3. **`EditableObject.tsx` 1,914 lines** is a hot-path React component that re-renders on every store touch — guaranteed perf and correctness issues.
4. **`PhaserViewport2D.tsx` (268 lines)** is a placeholder living in the 3D folder. The 2D path is supposed to be **owned by Phaser Editor 5 / PhaserEditor2D-v3**, not by us.

### What must NOT change

The owner explicitly preserved:

1. **Editor UI/UX** (chrome, panels, header, inspector, content browser, toolbar, gizmo button row, theme, Radix/shadcn components, Tailwind classes). This was iterated heavily and is locked in. The new 3D layer plugs *underneath* the existing chrome.
2. **`.pixl` package format and Phase 1 work** (ADR-002 Phase 1) — `@pixlland/engine-core`, the CLI pack/unpack, the File menu IO, the file-picker lock. All untouched.

### Symmetric rule for 2D (owner decision, 2026-05-22)

The same approach applies to the 2D path — **same shell, only the tools swap on the 2D/3D toggle, exactly like Godot.**

- The viewport switches between Three.js (3D) and Phaser 4 (2D) based on the active scene's `kind: '2d' | '3d'` (already in `engine.versions.json` schema).
- The header's `2D / 3D` toggle and the toolbar's tool row stay where they are — only the **icons/handlers** rebind to the active mode. Translate/rotate/scale gizmos in 3D ↔ Select/Move/Rotate/Scale + Tilemap tools in 2D.
- 2D runtime + editor patterns come from `PhaserEditor2D-v3` (MIT, vendored at `tools/vendor/PhaserEditor2D-v3/`). Same porting discipline as 3D: copy file by file, preserve MIT headers, adapt only the boundaries.
- A new workspace package **`@pixlland/phaser-runtime`** mirrors `@pixlland/three-runtime` — `Game` / `Scene` / `GameObject` (with `phaserGameObject` instead of `threeJSGroup`) / `Component` / `AssetStore`. Public API identical so editor selectors (`useGameScene`, Inspector, SceneGraph) don't fork.
- The old `PhaserViewport2D.tsx` (placeholder, 268 lines) is still deleted. The new 2D viewport is a thin React shell on top of `@pixlland/phaser-runtime` — same shape as the 3D one.

### What MUST change

Everything inside `engine/apps/studio/src/components/canvas/` that pretends to be the "3D runtime" — and the scene-model parts of `editorStore.ts` that wrap a hand-rolled object graph.

---

## Decision

**Adopt `WesUnwin/three-game-engine` as the 3D runtime and editor scene model.** Vendor it into a new workspace package `@pixlland/three-runtime` (MIT, attribution preserved in source headers), adapt it to:

- Read `PixlSceneDocument` from our schema (shape-mapping, not rewriting).
- Use `@pixlland/engine-core` `AssetSource` for the URL-vs-DirHandle duality.
- Emit changes through the existing editor stores (so the existing Inspector/SceneGraph panels keep working unchanged).

Then **replace the contents** of `engine/apps/studio/src/components/canvas/` with thin React/R3F wrappers that mount the new runtime, draw the canvas, render the editor's overlays (`OutlineHelper`, `TransformControls`, hover labels), and forward keyboard/mouse to Wes' `InputManager`.

**Hard rules for the porting agent:**

- Copy patterns **file by file** from `tools/vendor/three-game-engine/src/`, preserving the MIT header. No new public APIs invented; if Wes' API doesn't cover a case, document the gap in `engine/REFERENCE-ENGINES.md` before writing the adapter.
- One `THREE.Group` per editable object (`GameObject.threeJSGroup`). The gizmo attaches to that group, full stop. No more "shared GLB sub-mesh resolver."
- A GLB file becomes an **asset**, not a scene — its meshes are referenced by `ModelComponent` on each `GameObject`. Two `GameObject`s using the same GLB share the loaded asset but each has its own world transform.
- Tests are mandatory for the runtime package (vitest, no DOM). Replicate Wes' test patterns from `tools/vendor/three-game-engine/tests/`.

---

## Options Considered

### Option A — Patch the broken path (status quo)

Port the gizmo to Wes' minimal pattern, fix `getStaticGltfObjectByEditorId` with a Group proxy, keep everything else.

| Dimension | Assessment |
|---|---|
| Complexity | Medium per fix, high cumulative |
| Cost | Medium per round, every round |
| Scalability | Low — same shape stays broken |
| Team familiarity | High |

**Pros:** Smallest immediate diff. Doesn't disrupt anything else.
**Cons:** Every gizmo/selection/perf issue costs another week. The owner explicitly said "stop inventing." `editorStore.ts` (1,528 lines) keeps growing.

### Option B — **Adopt Wes wholesale, preserve Phaser + UI/UX.** (Recommended)

| Dimension | Assessment |
|---|---|
| Complexity | Medium — structural replacement, well-bounded |
| Cost | ~3 weeks of disciplined porting |
| Scalability | High — Wes' architecture has scaled to dozens of users |
| Team familiarity | Low at start, high after Phase A |

**Pros:** Net **−8,000 to −12,000 lines** of broken/dead code. Single, documented mental model. Gizmo bug class disappears (one Group per GameObject). MIT-clean. Aligns with `engine/PLAN.md` items 1, 2, 5, 6.
**Cons:** ~3-week porting investment; every existing template (FPSHorror, GTA6, Platformer, etc.) needs to move out of the editor or be deleted; some bespoke effects (RTXWater, VolumetricLighting) will be opt-in user code rather than first-class.

### Option C — Fork a heavier engine (Babylon-editor, BitECS + custom shell)

| Dimension | Assessment |
|---|---|
| Complexity | High |
| Cost | High — incompatible runtime |
| Scalability | High |
| Team familiarity | Low |

**Pros:** Even more polished.
**Cons:** Drops Three.js (which the owner mandated). Doesn't fit the goal "engine on Three.js + Phaser 4."

---

## Trade-off Analysis

Only Option B satisfies all of: keep Three.js as runtime, drop the broken in-house path, use a mature/MIT-clean reference, preserve UI/UX and Phaser. The cost is roughly the same as patching for a few more rounds, but B converges instead of accumulating.

---

## Mapping — 1:1 file-level migration plan

### Files to **port directly from Wes** into new package `engine/packages/three-runtime/` (~3,600 lines total, MIT)

| Wes file | New path | Notes |
|---|---|---|
| `src/Game.ts` (171) | `packages/three-runtime/src/Game.ts` | Adapt constructor to accept `AssetSource` (from `@pixlland/engine-core`) instead of raw `baseURL | dirHandle` |
| `src/Scene.ts` (384) | `packages/three-runtime/src/Scene.ts` | Reads `PixlSceneDocument` instead of `scene.json`; `gameObjects` populated from `rootObjects` |
| `src/GameObject.ts` (427) | `packages/three-runtime/src/GameObject.ts` | Renames `options` → `data` to match `PixlSceneObject` |
| `src/Component.ts` (34) | `packages/three-runtime/src/Component.ts` | Verbatim |
| `src/components/ModelComponent.ts` (30) | `packages/three-runtime/src/components/ModelComponent.ts` | Maps to our `pixl.mesh` + GLB asset reference |
| `src/components/RigidBodyComponent.ts` (224) | `packages/three-runtime/src/components/RigidBodyComponent.ts` | Maps to our `pixl.physics` schema |
| `src/components/LightComponent.ts` (41) | `packages/three-runtime/src/components/LightComponent.ts` | Maps to `pixl.light3d` |
| `src/components/SoundComponent.ts` (94) | `packages/three-runtime/src/components/SoundComponent.ts` | Maps to `pixl.audio` |
| `src/Renderer.ts` (269) | `packages/three-runtime/src/Renderer.ts` | Provides the `<canvas>` the React shell renders into |
| `src/input/InputManager.ts` + `KeyboardHandler.ts` + `MouseHandler.ts` + `GamepadHandler.ts` (368) | `packages/three-runtime/src/input/*` | Same surface |
| `src/util/CharacterController.ts` + `KinematicCharacterController.ts` + `DynamicCharacterController.ts` (364) | `packages/three-runtime/src/util/*` | Replaces our 2,707 lines of controllers |
| `src/util/ThreeJSHelpers.ts` (100), `EventEmitter.ts` (38), `Logger.ts` (57) | `packages/three-runtime/src/util/*` | Verbatim |
| `src/assets/*.ts` (~250) | DROP — we use `@pixlland/engine-core`'s `AssetSource` + `fflate` | Already shipped in Phase 1 of ADR-002 |
| `src/Settings.ts` (123) | DROP — we use our editor stores | |
| `src/VR/VRMode.ts` (133) | DEFER — keep file, don't wire | Optional add-on, no cost to defer |
| `src/ui/UIHelpers.ts` (132) | DROP — we have React/Radix UI | |

**Net new code from Wes:** ~2,800 lines of TS in a new isolated package.

### Files to **DELETE** in `engine/apps/studio/src/components/canvas/` (or move out of editor)

Total **~12,500 lines removed**:

| File | Lines | Reason |
|---|---:|---|
| `EditableObject.tsx` | 1,914 | Becomes a 60-line React wrapper that mounts `Game.scene.gameObjects[i]` |
| `EditorCanvas.tsx` | 836 | Becomes a 150-line React shell hosting the Wes `Game` + overlays |
| `TransformGizmo.tsx` | 421 | Replaced by stock `TransformControls` attached to `gameObject.threeJSGroup` (50 lines) |
| `StaticGltfScene.tsx` | 431 | Deleted — GLB sharing is solved by `ModelComponent` referencing an asset |
| `FPSController.tsx` | 815 | Replaced by `KinematicCharacterController.ts` (90 lines) wrapped in a component |
| `ThirdPersonController.tsx` | 791 | Same |
| `PlatformerController.tsx` | 423 | Same |
| `VehicleController.tsx` | 459 | Same |
| `IsometricController.tsx` | 219 | Same |
| `MinecraftPlayer.tsx`, `MinecraftAnimals.tsx`, `MinecraftCharacter.tsx`, `MinecraftNPCs.tsx` | 1,982 | These are **example games**, not engine. Move to `apps/portal/games-src/_examples/` or delete |
| `templates/GTA6Template.tsx`, `templates/FPSHorrorTemplate.tsx`, `templates/PlatformerTemplate.tsx`, `templates/RPGTemplate.tsx`, `templates/SocialHubTemplate.tsx`, `templates/HyperRealisticTemplate.tsx`, `templates/RacingTemplate.tsx`, `templates/AdventureTemplate.tsx`, `templates/EditorTemplateScene.tsx` | ~5,800 | Templates are **projects**, not editor code. The Hub already lists them — the Hub clicks should scaffold a project on disk via `pixl-engine new`, not hardcode a React subtree |
| `effects/EmissiveLights.tsx`, `effects/VolumetricLighting.tsx`, `effects/RTXPostProcessing.tsx`, `effects/RTXWater.tsx`, `effects/RTXDemoScene.tsx`, `ManualPostProcessing.tsx`, `PostProcessingEffects.tsx`, `AtmosphericLighting.tsx`, `AdaptivePerformance.tsx` | ~2,800 | Move to opt-in plugin `engine/packages/three-runtime-fx/` or delete; not core |
| `editorStore.ts` (scene-model portion) | ~700 of 1,528 | Replaced by reading directly from `game.scene.gameObjects`; only UI state stays in the store |
| `PhaserViewport2D.tsx` | 268 | Deleted — 2D editing is owned by Phaser Editor 5 |

### Files to **KEEP** as-is (UI/UX, Phaser path, ADR-002 work)

- `EditorHeader.tsx`, `EditorToolbar.tsx`, `EditorStatusBar.tsx`, `SceneGraphPanel.tsx`, `InspectorPanel.tsx`, `BottomPanel.tsx`, `EngineSettingsModal.tsx`, `ProjectVersionHistory.tsx` — the whole chrome
- `services/pixlPackageIO.ts`, `services/filePickerLock.ts`, `services/localProjectFiles.ts` — Phase 1 IO
- `engine/packages/core/` — `.pixl` format
- `engine/packages/cli/` — `pixl-engine`
- `engine/apps/studio/scripts/import-harvest-rush-project.mjs` — Harvest Rush importer
- `apps/portal/games-src/harvest-rush-3d/phaser/` — Phaser Editor bridge
- All `stores/*` EXCEPT the scene-model fields in `editorStore.ts` (selection, undo, panels, settings stay)

### Estimated net diff after Phase B

- **Added** (from Wes, into `engine/packages/three-runtime/`): ~2,800 lines, in a workspace package with isolated tests.
- **Removed** (canvas folder + editorStore scene model + templates + effects + Phaser placeholder): ~12,500 lines.
- **Editor shell rewrite** (canvas/EditorCanvas + EditableObject + TransformGizmo): ~360 lines of new React glue.
- **Net change: −9,300 lines**, fewer bugs, single mental model.

---

## Phased Plan

### Phase A.2D — Mirror in `@pixlland/phaser-runtime` (parallel, ~1 week)

Same shape as Phase A but the source is `tools/vendor/PhaserEditor2D-v3/` and the runtime is Phaser 4. Public API mirrors `@pixlland/three-runtime` (`Game`/`Scene`/`GameObject`/`Component`/`AssetStore`) so editor code is identical save for the registry of component types. Started after Phase A's adapter shim shape stabilizes (mid-Phase A).

### Phase A — Vendor + adapt Wes into `@pixlland/three-runtime` (~1 week)

1. Create `engine/packages/three-runtime/` (package.json, tsconfig, vitest config).
2. Copy 12 files listed in the mapping table, with `// Adapted from tools/vendor/three-game-engine/<path> (MIT, WesUnwin)` headers.
3. Adapt only the **boundaries**:
   - `AssetStore` → use `@pixlland/engine-core` `AssetSource` (URL or DirHandle, same shape).
   - `Game` / `Scene` constructors accept a `PixlSceneDocument` (mapped from our schema, no logic change).
   - `gameObject.options` reads our `PixlSceneObject` fields (name, type, transform, components, tags).
4. Port Wes' Jest tests to vitest. Goal: 100% of the engine logic green; no DOM, no React.

**Done means**: `pnpm --filter @pixlland/three-runtime test` is green; a Node-side script can load a `project.pixlproject.json`, instantiate `Game` with a fake `AssetSource`, call `loadScene()`, and walk the resulting `gameObject` tree.

### Phase B — Replace `EditorCanvas` + `EditableObject` (~1 week)

1. New `EditorCanvas.tsx` (~150 lines): mounts `<canvas>`, instantiates `Game` from our `AssetSource`, calls `game.loadScene()`, returns the canvas.
2. New `EditableObjectOverlay.tsx` (~60 lines): given a selected `objectId`, finds the corresponding `gameObject` in `game.scene`, attaches `TransformControls` to `gameObject.threeJSGroup`, listens to the `change` event, dispatches to `editorStore`.
3. Delete `StaticGltfScene.tsx` and `getStaticGltfObjectByEditorId` — the `Game.scene.getGameObject*` lookups replace them.
4. The existing `EditorHeader` / `EditorToolbar` / `SceneGraphPanel` / `InspectorPanel` / `BottomPanel` are **untouched**; only the data they read changes (now from `game.scene.gameObjects[]` via a thin `useGameScene()` selector).
5. `TransformGizmo.tsx` shrinks to ~50 lines using stock `TransformControls`, following Wes' `MainArea.jsx` pattern.

**Done means**: opening Harvest Rush in the editor renders the same scene, the gizmo attaches to the selected `gameObject.threeJSGroup`, translate / rotate / scale all work end-to-end on any object (including objects inside the shared `Farm.glb`), and the Inspector reflects edits.

### Phase C — Migrate controllers + delete hardcoded templates (~1 week)

1. Create `KinematicCharacterController` and `DynamicCharacterController` components in `@pixlland/three-runtime/components/` (port from Wes, ~180 lines).
2. Delete `FPSController.tsx`, `ThirdPersonController.tsx`, `PlatformerController.tsx`, `VehicleController.tsx`, `IsometricController.tsx`.
3. Hub button "Adventure" / "FPS Horror" / etc. now calls `pixl-engine new --kind 3d --template adventure` and opens the resulting folder. Templates move from React subtrees to **project scaffolds** (the CLI already supports `new`).
4. Delete `Minecraft*.tsx`, `templates/*.tsx`. Anything still wanted as a real demo moves into `apps/portal/games-src/_examples/<name>/` as a regular project.

**Done means**: the Hub's 8 templates open as actual projects on disk, editable like Harvest Rush. Zero hardcoded scene subtrees in the editor.

### Phase D — Cleanup pass (~3 days)

1. Move opt-in fx (RTX, Volumetric, Emissive, ManualPostProcessing) into a new `engine/packages/three-runtime-fx/` plugin package or delete the unused ones.
2. Trim `editorStore.ts` to UI state only.
3. Delete `PhaserViewport2D.tsx` and document the 2D path: "for 2D scenes, edit in Phaser Editor 5 via the bridge; the studio renders a thumbnail preview only."
4. Update `engine/REFERENCE-ENGINES.md` with the file map of what was ported from Wes.

**Done means**: `find engine/apps/studio/src/components/canvas -name "*.tsx" | xargs wc -l` reports **≤ 2,000 lines total** (down from 19,231). `pnpm engine:typecheck` clean. `pnpm engine:test` green. Harvest Rush still opens, plays, packs.

---

## Consequences

- **Becomes easier:**
  - Gizmos, selection, transform — all use stock Three.js patterns, supported by the entire community.
  - New game types are projects on disk, not new React subtrees in the editor.
  - Future agents (Claude/Codex/Cursor via MCP — ADR-002 Phase 3) operate on a documented model (`Game`/`Scene`/`GameObject`/`Component`) instead of a 1,914-line catch-all.
  - Onboarding a new contributor: read Wes' [docs](https://wesunwin.github.io/three-game-engine/#/) once.
- **Becomes harder:**
  - Phase A–C are a ~3-week investment. Until Phase B lands, the existing path stays broken.
  - Any in-house effect not on Wes' list (RTX water, volumetric lighting) becomes opt-in plugin code, not free.
  - The "11K-object Harvest Rush" path needs an LOD / instancing strategy under Wes' GameObject model — Wes already has `instancing` patterns documented, but we'll verify before Phase B closes.
- **What we'll need to revisit:**
  - Whether the Phaser-side path eventually mirrors Wes' GameObject model for 2D (probably yes after M2 of ADR-002).
  - VR via Wes' `VRMode.ts` (deferred to after Phase D).

---

## Action Items — Owner

1. [ ] Approve **Option B** (adopt Wes' three-game-engine).
2. [ ] Confirm Phaser 4 / PhaserEditor2D-v3 stays the canonical 2D path (no in-house 2D editor in the studio).
3. [ ] Confirm hardcoded templates (`GTA6Template.tsx`, `FPSHorrorTemplate.tsx`, etc.) can be deleted from the editor and re-shipped as scaffolds via `pixl-engine new`.
4. [ ] Authorize **Phase A** to start (~1 week, isolated in a new package — does not touch the running editor).

## Action Items — Engine Agent (Phase A, after sign-off)

1. [ ] Create `engine/packages/three-runtime/` (package.json with `@pixlland/three-runtime`, tsconfig, vitest config, README citing Wes' MIT).
2. [ ] Add deps: `three@0.184.0`, `@dimforge/rapier3d-compat@0.19.3`, `@pixlland/engine-core@workspace:*`.
3. [ ] Port `Game.ts`, `Scene.ts`, `GameObject.ts`, `Component.ts`, `Renderer.ts` with MIT headers.
4. [ ] Port `components/ModelComponent.ts`, `RigidBodyComponent.ts`, `LightComponent.ts`, `SoundComponent.ts`.
5. [ ] Port `input/InputManager.ts` + handlers.
6. [ ] Port `util/CharacterController.ts`, `Kinematic…`, `Dynamic…`, `ThreeJSHelpers.ts`, `EventEmitter.ts`, `Logger.ts`.
7. [ ] Adapter shim: `pixlSchemaToWesScene(document: PixlProjectDocument): SceneJSON` — pure function, no side effects, vitest-covered.
8. [ ] Adapter shim: reverse direction `wesSceneToPixlSchema(scene: Scene): PixlProjectDocument` — for save/export.
9. [ ] Vitest suite mirroring `tools/vendor/three-game-engine/tests/`: loading game.json, scene transitions, GameObject hierarchy, RigidBody attach/detach.
10. [ ] `pnpm --filter @pixlland/three-runtime build && test && typecheck` all green.
11. [ ] Update `engine/REFERENCE-ENGINES.md` with the exact file map and any adaptation notes.
12. [ ] Demo Node script: `node engine/packages/three-runtime/scripts/load-harvest-rush.mjs` loads the Harvest Rush `.pixlproject.json` from the workspace, prints the GameObject tree.

**Phase A explicitly does NOT touch `engine/apps/studio/src/components/canvas/`.** The editor keeps the broken path running until Phase B is ready to swap it.
