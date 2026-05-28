# Game Studio Skill Export

The Game Studio Codex plugin has been exported into this engine workspace at:

```text
.codex/plugins/game-studio/
```

It is a self-contained copy of the local OpenAI curated Game Studio plugin, exported on 2026-05-28 from plugin version `0.1.0`.

## What Is Included

- `.codex-plugin/plugin.json` with the plugin manifest and metadata.
- `skills/` with the Game Studio routing skill plus specialist skills:
  - `game-studio`
  - `game-playtest`
  - `game-ui-frontend`
  - `phaser-2d-game`
  - `react-three-fiber-game`
  - `sprite-pipeline`
  - `three-webgl-game`
  - `web-3d-asset-pipeline`
  - `web-game-foundations`
- `references/` with engine selection, Phaser, Three.js, React Three Fiber, WebGL, sprite, GLB/glTF, Rapier, HUD, and playtest guidance.
- `scripts/` with sprite-strip helper utilities.
- `assets/` with the plugin icon assets.

## Keep The Bundle Together

The skill files reference shared material using paths like `../../references/...`, so keep the exported folder structure intact if it is moved, copied, or customized.

If the engine later needs a PixlPlayground-specific skill, create a thin wrapper skill that points at this exported bundle and the engine docs instead of editing the exported copy directly.

## Portable Archive

A zip export was also created outside the repo:

```text
/Users/marciocastro/Desktop/game-studio-codex-plugin-2026-05-28.zip
```
