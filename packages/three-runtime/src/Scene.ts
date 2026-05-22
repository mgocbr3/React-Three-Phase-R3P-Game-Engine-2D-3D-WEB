// Adapted from tools/vendor/three-game-engine/src/Scene.ts
// (MIT, WesUnwin/three-game-engine). Pruned of features we'll re-introduce
// later (fog/lights/sounds scene-level config, physics debug rendering) to
// keep Phase A focused on the core loadScene path.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import type Game from './Game.js';
import GameObject from './GameObject.js';
import JSONAsset from './assets/JSONAsset.js';
import { createLight, createAudio } from './util/ThreeJSHelpers.js';
import SoundAsset from './assets/SoundAsset.js';
import type {
  FogJSON,
  GameObjectJSON,
  SceneJSON,
  SceneLightJSON,
  SceneSoundJSON,
} from './types.js';

let rapierInitialized = false;
const initRapier = async (): Promise<void> => {
  if (rapierInitialized) return;
  await RAPIER.init();
  rapierInitialized = true;
};

class Scene {
  name: string;
  threeJSScene: THREE.Scene;
  gameObjects: GameObject[];
  game: Game;
  active: boolean;
  jsonAssetPath: string | null;
  sceneJSONAsset: JSONAsset<SceneJSON> | null;
  initialGravity: { x: number; y: number; z: number };
  rapierWorld: RAPIER.World | null;

  constructor(game: Game, jsonAssetPath?: string) {
    this.game = game;
    this.jsonAssetPath = jsonAssetPath ?? null;
    this.sceneJSONAsset = null;
    this.name = 'unnamed-scene';
    this.gameObjects = [];
    this.threeJSScene = new THREE.Scene();
    this.active = false;
    this.initialGravity = { x: 0, y: -9.8, z: 0 };
    this.rapierWorld = null;
  }

  async load(): Promise<void> {
    if (this.jsonAssetPath) {
      const asset = await this.game.loadAsset(this.jsonAssetPath);
      if (!(asset instanceof JSONAsset)) {
        throw new Error(`Scene.load: asset at ${this.jsonAssetPath} must be a JSONAsset`);
      }
      this.sceneJSONAsset = asset as JSONAsset<SceneJSON>;
    }

    const data: SceneJSON = this.sceneJSONAsset?.data ?? {};

    this.threeJSScene.background = data.background
      ? new THREE.Color(data.background)
      : new THREE.Color('lightblue');

    this.setFog(data.fog ?? null);
    this.setLights(data.lights ?? []);
    await this.loadSounds(data.sounds ?? []);

    if (!this.game.gameOptions.disablePhysics) {
      await initRapier();
      this.initialGravity = {
        x: data.gravity?.x ?? 0,
        y: data.gravity?.y ?? -9.8,
        z: data.gravity?.z ?? 0,
      };
      this.rapierWorld = new RAPIER.World(this.initialGravity);
    }

    this.gameObjects = [];
    (data.gameObjects ?? []).forEach((gameObjectJSON) => {
      this._createGameObject(this, gameObjectJSON);
    });

    for (const gameObject of this.gameObjects) {
      await gameObject.load();
    }

    this.applyCamera(data.camera);
  }

  applyCamera(camera: SceneJSON['camera']): void {
    if (!camera) return;
    const cam = this.game.renderer?.threeJSCamera;
    if (!cam) return;
    if (camera.position) {
      cam.position.set(camera.position.x ?? 0, camera.position.y ?? 0, camera.position.z ?? 0);
    }
    if (camera.target) {
      cam.lookAt(camera.target.x ?? 0, camera.target.y ?? 0, camera.target.z ?? 0);
    }
    if (typeof camera.fov === 'number') cam.fov = camera.fov;
    if (typeof camera.near === 'number') cam.near = camera.near;
    if (typeof camera.far === 'number') cam.far = camera.far;
    cam.updateProjectionMatrix();
  }

  setFog(fog: FogJSON | THREE.Fog | null): void {
    if (fog instanceof THREE.Fog) {
      this.threeJSScene.fog = fog;
    } else if (fog) {
      this.threeJSScene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
    } else {
      this.threeJSScene.fog = null;
    }
  }

  setLights(lights: SceneLightJSON[]): void {
    const existing = this.threeJSScene.children.filter((c) => c instanceof THREE.Light);
    existing.forEach((light) => this.threeJSScene.remove(light));
    lights.forEach((data) => this.threeJSScene.add(createLight(data)));
  }

  async loadSounds(sounds: SceneSoundJSON[]): Promise<void> {
    const existing = this.threeJSScene.children.filter((c) => c instanceof THREE.Audio);
    existing.forEach((audio) => this.threeJSScene.remove(audio));
    for (let i = 0; i < sounds.length; i += 1) {
      const data = sounds[i];
      const asset = await this.game.loadAsset(data.assetPath);
      if (!(asset instanceof SoundAsset) || !asset.data) continue;
      const listener = this.game.renderer.getCameraAudioListener();
      const audio = createAudio(data, asset.data, listener, data.name ?? `sound_${i}`);
      this.threeJSScene.add(audio);
    }
  }

  _createGameObject(parent: Scene | GameObject, json: GameObjectJSON): GameObject {
    const { children, ...options } = json;
    const gameObject = new GameObject(parent, options);
    (children ?? []).forEach((childJson) => this._createGameObject(gameObject, childJson));
    return gameObject;
  }

  isActive(): boolean {
    return this.active;
  }

  addGameObject(gameObject: GameObject): void {
    if (this.gameObjects.includes(gameObject)) return;
    gameObject.parent = this;
    this.gameObjects.push(gameObject);
    this.threeJSScene.add(gameObject.threeJSGroup);
    if (this.isActive()) {
      gameObject.load().then(() => gameObject.afterLoaded()).catch((err) => console.error(err));
    }
  }

  removeGameObject(gameObject: GameObject): void {
    if (!this.gameObjects.includes(gameObject)) return;
    this.gameObjects = this.gameObjects.filter((g) => g !== gameObject);
    gameObject.parent = null;
    this.threeJSScene.remove(gameObject.threeJSGroup);
  }

  advancePhysics(): void {
    if (!this.rapierWorld) return;
    this.rapierWorld.step();
    this.forEachGameObject((g) => g.syncWithRigidBody());
  }

  forEachGameObject(fn: (gameObject: GameObject) => void): void {
    this.gameObjects.forEach((g) => g.forEachGameObject(fn));
  }

  getGameObject(fn: (gameObject: GameObject) => boolean): GameObject | null {
    for (const obj of this.gameObjects) {
      if (fn(obj)) return obj;
      const child = obj.getGameObject(fn);
      if (child) return child;
    }
    return null;
  }

  getGameObjects(fn: (gameObject: GameObject) => boolean): GameObject[] {
    const results: GameObject[] = [];
    for (const obj of this.gameObjects) {
      if (fn(obj)) results.push(obj);
      results.push(...obj.getGameObjects(fn));
    }
    return results;
  }

  getGameObjectWithName(name: string): GameObject | null {
    return this.getGameObject((g) => g.name === name);
  }

  getGameObjectsWithTag(tag: string): GameObject[] {
    return this.getGameObjects((g) => g.hasTag(tag));
  }

  getGameObjectWithID(id: string): GameObject | null {
    return this.getGameObject((g) => g.id === id);
  }

  getGameObjectWithThreeJSObject(object3D: THREE.Object3D | null): GameObject | null {
    let current = object3D;
    while (current) {
      const gameObjectID = current.userData?.gameObjectID;
      if (typeof gameObjectID === 'string') {
        return this.getGameObjectWithID(gameObjectID);
      }
      current = current.parent;
    }
    return null;
  }

  // Lifecycle hooks ---------------------------------------------------------

  afterLoaded(): void {}
  beforeUnloaded(): void {}
  beforeRender(_ctx: { deltaTimeInSec: number }): void {}
}

export default Scene;
