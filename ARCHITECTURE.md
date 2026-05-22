# PixlPlayground Studio Architecture

## Goal

Build a Pixlland-native editor that feels like a small Godot-style workspace while keeping exported games on the Pixlland browser stack.

## Runtime Split

- `3D mode`: Three.js + React Three Fiber for visual composition, Rapier for physics previews, GLB/glTF as the asset format.
- `2D mode`: Phaser 4 for sprite, tilemap, camera and arcade-style scene editing.
- `Shared editor shell`: React panels, hierarchy, inspector, content browser, timeline, scripts and publish flows.

Each exported game uses one runtime stack. A 3D game ships the Three.js/Rapier runtime; a 2D game ships the Phaser runtime. Do not mix the two stacks in the player bundle.

## Scene Document

The editor should converge on a versioned scene document:

```ts
type PixlScene = {
  version: string;
  mode: '2d' | '3d';
  entities: PixlEntity[];
  assets: PixlAsset[];
  settings: PixlSceneSettings;
};
```

Every viewport is just a projection of this document:

- 3D maps transforms to `[x, y, z]`.
- 2D maps transforms to `[x, y]` with optional depth/layer metadata.
- Inspector edits components on entities, not renderer-specific objects.
- Exporters generate Phaser, Three.js or Pixlland package output from the same scene data.

## 3D Interaction Reference

Selection, raycast, highlight, fly camera and transform gizmo behavior follows the MavonEngine/Core pattern in [REFERENCE-ENGINES.md](./REFERENCE-ENGINES.md): click the real `Object3D`, select that same object, and attach transform controls to it. Avoid proxy selection when the rendered object exists in the Three.js scene.

## Vibe Coding Integration

The engine should expose automation surfaces in this order:

- CLI: deterministic commands for validate, export, import, snapshot and repair.
- MCP: structured tools for agents to inspect scenes, move assets, create prefabs and run validations.
- VS Code extension: human-facing scene links, diagnostics and quick actions.
- Codex/Claude Code workflows: use the CLI and MCP rather than editing scene JSON blindly.

## Safety Boundaries

- Keep editor credentials in environment variables.
- Treat imported assets as untrusted input.
- Validate scene documents before save/export.
- Keep generated game output separate from authoring data.
