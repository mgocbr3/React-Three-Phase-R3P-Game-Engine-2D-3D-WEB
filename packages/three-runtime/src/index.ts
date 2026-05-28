// Public API of @pixlland/three-runtime. Adapted from
// WesUnwin/three-game-engine (MIT) — see ADR-003.

export { default as Game } from './Game.js';
export { default as Scene } from './Scene.js';
export { default as GameObject } from './GameObject.js';
export { default as Renderer } from './Renderer.js';
export { default as Logger } from './Logger.js';
export { default as Util } from './Util.js';

export { default as Component } from './Component.js';
export type { ComponentJSON, ComponentTickContext } from './Component.js';

export { default as EventEmitter } from './util/EventEmitter.js';
export type { EventCallback } from './util/EventEmitter.js';

export { setObject3DProps, createLight, createAudio } from './util/ThreeJSHelpers.js';

export { default as AssetStore } from './assets/AssetStore.js';
export { default as Asset } from './assets/Asset.js';
export { default as JSONAsset } from './assets/JSONAsset.js';
export { default as GLTFAsset } from './assets/GLTFAsset.js';
export { default as SoundAsset } from './assets/SoundAsset.js';
export { default as TextureAsset } from './assets/TextureAsset.js';

export { default as ModelComponent } from './components/ModelComponent.js';
export type { ModelComponentJSON } from './components/ModelComponent.js';
export { default as LightComponent } from './components/LightComponent.js';
export type { LightComponentJSON } from './components/LightComponent.js';
export { default as SoundComponent } from './components/SoundComponent.js';
export type { SoundComponentJSON } from './components/SoundComponent.js';
export { default as RigidBodyComponent } from './components/RigidBodyComponent.js';
export type { RigidBodyComponentJSON, ColliderData } from './components/RigidBodyComponent.js';
export { default as PrimitiveComponent } from './components/PrimitiveComponent.js';
export type { PrimitiveComponentJSON } from './components/PrimitiveComponent.js';
export { default as GltfNodeComponent } from './components/GltfNodeComponent.js';
export type { GltfNodeComponentJSON } from './components/GltfNodeComponent.js';

export { default as InputManager } from './input/InputManager.js';
export { default as KeyboardHandler } from './input/KeyboardHandler.js';
export { default as MouseHandler } from './input/MouseHandler.js';
export { default as GamepadHandler, BUTTON_NAMES } from './input/GamepadHandler.js';

export { default as CharacterController } from './util/CharacterController.js';
export { default as KinematicCharacterController } from './util/KinematicCharacterController.js';
export type { KinematicCharacterControllerOptions } from './util/KinematicCharacterController.js';
export { default as DynamicCharacterController } from './util/DynamicCharacterController.js';

export {
  pixlSceneToWesScene,
  pixlProjectToWesGame,
  wesSceneToPixlScene,
} from './adapter/pixlSchemaAdapter.js';
export type {
  PixlProjectDocument,
  PixlSceneDocument,
  PixlSceneObject,
  PixlComponentInstance,
  PixlTransform,
  PixlSceneCamera,
  PixlSceneEnvironment,
  PixlScenePhysics,
} from './adapter/pixlSchemaAdapter.js';

export * from './types.js';
