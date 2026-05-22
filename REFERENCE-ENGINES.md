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
