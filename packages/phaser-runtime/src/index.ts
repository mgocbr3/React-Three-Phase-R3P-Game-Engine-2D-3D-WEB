// Public API of @pixlland/phaser-runtime. Mirrors @pixlland/three-runtime
// so the studio's mount logic can be symmetric (Phase 6).

export { default as Game } from './Game.js';
export { default as Scene } from './Scene.js';
export { default as GameObject } from './GameObject.js';

export { default as Component } from './Component.js';
export type { ComponentTickContext } from './Component.js';

export { default as SpriteComponent } from './components/SpriteComponent.js';
export type { SpriteComponentJSON } from './components/SpriteComponent.js';
export { default as Physics2DComponent } from './components/Physics2DComponent.js';
export type {
  Physics2DBodyKind,
  Physics2DComponentJSON,
  Physics2DShape,
} from './components/Physics2DComponent.js';
export { default as TilemapComponent } from './components/TilemapComponent.js';
export type { TilemapComponentJSON } from './components/TilemapComponent.js';
export { default as Animation2DComponent } from './components/Animation2DComponent.js';
export type {
  Animation2DComponentJSON,
  Animation2DFrame,
} from './components/Animation2DComponent.js';

export {
  pixlProjectToPhaserGame,
  pixlSceneToPhaserScene,
  phaserSceneToPixlScene,
} from './adapter/pixlSchemaAdapter.js';
export type {
  PixlComponentInstance,
  PixlProjectDocument,
  PixlSceneCamera,
  PixlSceneDocument,
  PixlSceneEnvironment,
  PixlScenePhysics,
  PixlSceneObject,
  PixlTransform,
} from './adapter/pixlSchemaAdapter.js';

export * from './types.js';
