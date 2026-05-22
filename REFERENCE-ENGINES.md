# PixlPlayground Engine Reference Engines

This document defines external engine patterns to check before changing editor or runtime behavior.

## Primary 3D Editor Reference

### MavonEngine/Core

- Repo: https://github.com/MavonEngine/Core.git
- License: MIT
- Use in PixlPlayground: reference architecture for 3D selection, raycast, transform gizmo, fly camera and scene hierarchy behavior.

Patterns to follow:

- Select the real `Object3D` in the rendered scene, not a detached proxy.
- Raycast directly against the Three.js scene graph with `Raycaster.setFromCamera(...)` and `intersectObjects(...)`.
- When the raycast hits a child mesh, walk up the object tree until the editable object is found.
- Selection state, outline/helper and transform control should point to the same `Object3D`.
- Transform controls should attach to the active object, equivalent to `TransformControls.attach(activeObject)`.
- Avoid 2D bounding-box heuristics or cloned visual approximations when the real mesh exists in the scene.

Mavon files to consult:

- `packages/core/src/InputManager.ts` - world raycast and cursor handling.
- `packages/editor/src/Editor.ts` - canvas click, `selectObject`, `deselect`, and `TransformControls`.
- `packages/editor/src/Editor/UI/CanvasToolbar.tsx` - transform mode controls.
- `packages/editor/src/Editor/UI/SceneExplorer.tsx` - hierarchy selection.

## Primary 2D Editor Reference

### Phaser Editor

- Product/docs: https://phaser.io/editor and https://docs.phaser.io/phaser-editor/
- Current product reference: Phaser Editor v5.
- Current runtime target: Phaser 4.
- Open-source client reference: https://github.com/PhaserEditor2D/PhaserEditor2D-v3
- Open-source client license: MIT.
- Use in PixlPlayground: reference architecture for Phaser scene editing, asset packs, scene hierarchy, object selection, 2D transform tools, tilemaps, sprites, prefabs, user components and Phaser code/export behavior.

Patterns to follow:

- Treat Phaser Editor v5 behavior and docs as the canonical product reference for Phaser 4 scene editing.
- Copy or port source only from license-compatible code, such as the MIT PhaserEditor2D v3 client, preserving required copyright and license notices.
- Do not copy closed-source Phaser Editor Desktop/Core server code.
- Select and transform the real Phaser game object represented in the editor scene, not a detached visual proxy when a real Phaser object exists.
- Keep asset-pack, scene, prefab/component and generated-code concepts aligned with Phaser Editor's workflow.
- Use Phaser 4 APIs for runtime/export code; Phaser 3 and Enable3D-era paths are historical migration notes only.

Phaser Editor files to consult:

- `source/editor/plugins/phasereditor2d.scene/src/ui/editor/SceneEditor.ts` - scene editor lifecycle, tools and selection entrypoints.
- `source/editor/plugins/phasereditor2d.scene/src/ui/editor/SelectionManager.ts` - hit testing and scene-object selection behavior.
- `source/editor/plugins/phasereditor2d.scene/src/ui/editor/CameraManager.ts` - 2D canvas pan/zoom camera behavior.
- `source/editor/plugins/phasereditor2d.scene/src/ui/editor/DropManager.ts` - asset/object drop behavior.
- `source/editor/plugins/phasereditor2d.scene/src/ui/sceneobjects/object/tools/` - translate, rotate, scale, origin and region tools.
- `source/editor/plugins/phasereditor2d.pack/src/` - asset pack editor model and Phaser asset-pack workflow.

## Primary 3D Runtime Reference

### WesUnwin/three-game-engine

- Repo: https://github.com/WesUnwin/three-game-engine
- License: MIT (verified in `LICENSE` at the repo root)
- Vendored locally at `tools/vendor/three-game-engine/` (gitignored — offline study only).
- Use in PixlPlayground: reference architecture for the in-iframe **Play in Editor** runtime, asset loading from either URL or `FileSystemDirectoryHandle`, JSON-driven scene format, GameObject/Component pattern, and the lifecycle the `.pixl` runtime needs.

Patterns to port (each line maps a Wes file to a Pixl target):

- **Asset source duality (URL vs FileSystemDirectoryHandle):** `src/assets/AssetStore.ts` and `src/assets/Asset.ts:getFullURL()` — the constructor accepts `string | FileSystemDirectoryHandle`, and `getFullURL()` returns either `baseURL/path` or `URL.createObjectURL(file)` minted from `getFileAtPath(dirHandle, path)`. This is exactly what we need so the runtime preview can run either against a dev server URL or against a `.pixl` unpacked into OPFS. Port into `engine/packages/core/src/assetSource.ts` as `createAssetSource(input: string | FileSystemDirectoryHandle)`.
- **Recursive directory path walking:** `Asset.getFileAtPath(dirHandle, path)` (static) walks `'/'`-separated segments via `getDirectoryHandle` then `getFileHandle`. Reuse verbatim in `@pixlland/engine-core` for OPFS reads.
- **Object URL caching + unload:** `Asset.objectURL` is cached on first read and revoked on `unload()`. Mirror that lifetime in our preview's Blob URL pool — leak-free.
- **`game.json` root manifest:** lists `scenes: { [name]: path }`, `gameObjectTypes: { [type]: path }`, `initialScene`. Wes's whole runtime boots from one JSON. Our `project.pixlproject.json` already has `scenes[]` and `game.source.runtimeFile` — we map 1:1 in the runtime layer.
- **Game lifecycle:** `Game.ts:_init()` → `loadScene()` → `play()` / `pause()`. `loadScene` unloads the previous scene's GameObjects (`beforeUnloaded()`), instantiates the new one, then calls `afterLoaded()` on the scene and every GameObject. Use the same call order for the runtime preview hot-reload.
- **`_createGameObject` recursion:** `src/Scene.ts:141` — walks `gameObjectJSON.children` and applies `indices` for stable referencing. Same shape as our `PixlSceneObject` tree; port the recursion into the runtime loader.

Wes files to consult before touching the runtime preview:

- `src/Game.ts` — top-level lifecycle. **Already verified.**
- `src/Scene.ts` — scene JSON → Three.js scene + Rapier world.
- `src/assets/AssetStore.ts` and `src/assets/Asset.ts` — dual-source asset loading.
- `src/assets/JSONAsset.ts`, `GLTFAsset.ts`, `TextureAsset.ts`, `SoundAsset.ts` — per-extension loaders.
- `src/GameObject.ts`, `src/Component.ts` — entity/component split (M3 work; not Phase 1).
- `examples/first_person_kinematic_character_controller/` — a real `game.json` to crib the JSON shape from.

## Asset Pack & Drag-Drop Reference (2D)

### PhaserEditor2D-v3 — pack core and DropManager

- Vendored locally at `tools/vendor/PhaserEditor2D-v3/` (gitignored — offline study only).
- Use in PixlPlayground: reference for the **Content Browser asset taxonomy**, the **.pack JSON file format**, and the **viewport drag-drop flow** when M2 lands the real 2D viewport.

Patterns to port:

- **Asset-type taxonomy:** `source/editor/plugins/phasereditor2d.pack/src/core/AssetPack.ts` declares 28 constants (`IMAGE_TYPE`, `ATLAS_TYPE`, `AUDIO_TYPE`, `SCRIPT_TYPE`, `SCENE_FILE_TYPE`, `BITMAP_FONT_TYPE`, `TILEMAP_TILED_JSON_TYPE`, …). Don't reinvent — these are the same kinds Phaser 4 accepts at runtime. Mirror them in `engine/packages/core/src/assetKinds.ts` plus our 3D-only kinds (`gltf`, `hdr`, `cubeTexture`).
- **Pack JSON shape:** `AssetPack.toJSON()` writes `{ section1: { files: [...] }, meta: { app, contentType, url, version, showAllFilesInBlocks } }`. We reuse this shape verbatim for `Assets/AssetPack/*.pack.json` inside a `.pixl` — `meta.app = "PixlPlayground"`, `meta.version` from our schema.
- **DropManager flow:** `phasereditor2d.scene/src/ui/editor/DropManager.ts` — `dragover` → `acceptDropDataArray` → `dropData` → undo step `CreateObjectWithAssetOperation`. Two things to port:
  1. Use the **application-level drag data clipboard** (not just `DataTransfer`) — Phaser's `controls.Controls.getApplicationDragData()`. Lets us drag from the Content Browser into the viewport with rich payloads (FilePath objects, asset descriptors), not just plaintext URIs. Our equivalent: `useAssetDragStore` already exists in the studio.
  2. Every successful drop becomes a **single undo step**, not N inserts. Port the operation idea into our undo stack (`editorStore.history`).
- **Scene-object extension model:** `ScenePlugin.getInstance().getGameObjectExtensions()` — extensions register `acceptsDropData(data)` and `createSceneObjectWithAsset({ x, y, asset, scene })`. Use as the pattern for our component-creation registry when M3 (component registry) lands. Don't hand-code if/else by file extension; register handlers.

PhaserEditor2D-v3 files to consult:

- `source/editor/plugins/phasereditor2d.pack/src/core/AssetPack.ts` — pack format.
- `source/editor/plugins/phasereditor2d.pack/src/core/*AssetPackItem.ts` — per-kind item parsing.
- `source/editor/plugins/phasereditor2d.scene/src/ui/editor/DropManager.ts` — drag-drop. **Already verified.**
- `source/editor/plugins/phasereditor2d.scene/src/ui/editor/SelectionManager.ts` — pick logic (M2 work).
- `source/editor/plugins/phasereditor2d.scene/src/ui/editor/CameraManager.ts` — 2D pan/zoom (M2 work).
- `source/editor/plugins/phasereditor2d.files/src/ui/` — content browser tree, file thumbnails.

## Rule For Phase 1 (`.pixl` pack/unpack, runtime preview from OPFS)

Before adding pack/unpack code in `engine/packages/core/` or extending `runtimePreview.ts`:

1. Check the corresponding Wes pattern in `tools/vendor/three-game-engine/src/assets/`. The `baseURL | dirHandle` duality and Object URL pool are already solved there.
2. Port the **shape** of the API (constructor, `getFullURL`, `getFileAtPath`, `unload`). Adapt for our codebase: TS strict, no `any`, no React imports in `engine-core`.
3. Document each port in a top-of-file comment: `// Adapted from tools/vendor/three-game-engine/src/assets/Asset.ts (MIT, WesUnwin/three-game-engine).`
4. Create a Pixl-specific approach only when Wes does not cover the case (example: content hashing for `.pixl` manifest — Wes doesn't pack into a single file).

## Rule For 3D Viewport Changes

Before changing selection, gizmo, highlight, camera, or object interaction in `EditorCanvas`:

1. Check whether Mavon has an equivalent pattern.
2. Port the pattern directly into our React/R3F/Zustand architecture.
3. Create a Pixl-specific approach only when Mavon does not cover the case.
4. Document why any adaptation differs from Mavon.

## Rule For 2D Viewport Changes

Before changing selection, transform tools, camera, object creation, asset packs, tilemaps, sprites, prefabs, user components or Phaser export behavior:

1. Check whether Phaser Editor v5 has an equivalent behavior.
2. Check whether the MIT PhaserEditor2D v3 client has source that can be copied or ported.
3. Port the reference behavior into our React/Zustand/Phaser 4 architecture without inventing a different editor interaction.
4. Create a Pixl-specific approach only when Phaser Editor does not cover the case.
5. Document why any adaptation differs from Phaser Editor.
