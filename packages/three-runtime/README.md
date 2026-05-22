# @pixlland/three-runtime

PixlPlayground 3D runtime. **Adapted from
[WesUnwin/three-game-engine](https://github.com/WesUnwin/three-game-engine)
(MIT)** — see [`engine/docs/ADR-003-adopt-three-game-engine.md`](../../docs/ADR-003-adopt-three-game-engine.md)
for rationale and mapping.

## Architecture

```
Game
├── Renderer          → THREE.WebGLRenderer, THREE.PerspectiveCamera
├── Scene
│   ├── threeJSScene  → THREE.Scene
│   ├── rapierWorld   → RAPIER.World
│   └── gameObjects[]
│       └── GameObject
│           ├── parent          → Scene | GameObject
│           ├── threeJSGroup    → THREE.Group  (gizmos attach here)
│           ├── rapierRigidBody → RAPIER.RigidBody (optional)
│           ├── components[]    → Component (model, rigidBody, light, sound, script)
│           └── gameObjects[]   (children)
└── AssetStore        → @pixlland/engine-core AssetSource (URL or DirHandle)
```

## Commands

```bash
pnpm --filter @pixlland/three-runtime build
pnpm --filter @pixlland/three-runtime test
pnpm --filter @pixlland/three-runtime typecheck
```

## License

UNLICENSED (private workspace package). Code adapted from
WesUnwin/three-game-engine preserves the MIT notice in each source file
header. Original engine: https://github.com/WesUnwin/three-game-engine
