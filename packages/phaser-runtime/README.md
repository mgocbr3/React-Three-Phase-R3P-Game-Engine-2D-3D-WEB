# @pixlland/phaser-runtime

> GDD §6.5 — Phase 5. 2D mirror of `@pixlland/three-runtime`. Provides
> Game / Scene / GameObject / Component + 2D-specific components on top
> of Phaser 4.

## Public API

```ts
import {
  Game, Scene, GameObject, Component,
  SpriteComponent, Physics2DComponent, TilemapComponent, Animation2DComponent,
  pixlSceneToPhaserScene, pixlProjectToPhaserGame,
} from '@pixlland/phaser-runtime';
```

The shape matches `@pixlland/three-runtime` so the studio's mount logic
(Phase 6) can stay symmetric across 2D and 3D.

## Phaser as peer dep

Phaser is declared as a `peerDependency`. Consumers can still pass their own
Phaser namespace via `new Game(..., { phaserModule })`, but the runtime now
also supports standalone boot:

```ts
const game = Game.fromPixlProject(project, {
  parent: 'game',
  width: window.innerWidth,
  height: window.innerHeight,
  assetBaseUrl: '.',
});

await game.play();
```

That path is what `pixl-engine export-phaser` uses for static 2D builds.

## Schema adapter (`pixlSchemaAdapter.ts`)

Pure functions — no Phaser, no DOM. Converts our
`PixlSceneDocument` (`kind: '2d'`) into a `PhaserSceneJSON` shape that
the runtime mount can hand to `Phaser.Scene.create()`. Mirrors
`pixlSceneToWesScene` from `@pixlland/three-runtime`.

```ts
const phaserSceneJson = pixlSceneToPhaserScene(pixlSceneDocument);
// → { id, name, background, gravity, rootObjects: [...] }
```

## Tests

Phaser needs a DOM. Tests in this package focus on:
- Pure adapter functions (no Phaser instance required)
- Class shape / contract (no runtime instantiation)
- JSON serialization of components
- PixlProjectDocument bootstrap metadata (`runtimeScript`, active 2D scene)

Runtime integration is exercised by the studio's `PhaserRuntimeMount`
component and by the CLI's exported Phaser smoke path (browser context,
where Phaser can boot normally).

## Attribution

Phaser 4 — MIT (https://github.com/phaserjs/phaser)
PhaserEditor2D-v3 — MIT (https://github.com/PhaserEditor2D/PhaserEditor2D-v3)
— referenced in `src/` headers when patterns or types are adopted.
