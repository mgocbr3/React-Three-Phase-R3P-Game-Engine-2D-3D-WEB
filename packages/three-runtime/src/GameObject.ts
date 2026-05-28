// Adapted from tools/vendor/three-game-engine/src/GameObject.ts
// (MIT, WesUnwin/three-game-engine). Tightened typing for our TS-strict
// build; ComponentClass registry is opt-in extensible via
// GameObject.registerClassForComponentType.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';

import Component, { type ComponentJSON, type ComponentTickContext } from './Component.js';
import AnimationComponent from './components/AnimationComponent.js';
import GltfNodeComponent from './components/GltfNodeComponent.js';
import LightComponent from './components/LightComponent.js';
import ModelComponent from './components/ModelComponent.js';
import PrimitiveComponent from './components/PrimitiveComponent.js';
import RigidBodyComponent from './components/RigidBodyComponent.js';
import SoundComponent from './components/SoundComponent.js';
import type Scene from './Scene.js';
import type { GameObjectOptions } from './types.js';
import Util from './Util.js';

type ComponentClass = new (gameObject: GameObject, jsonData: ComponentJSON) => Component;

class GameObject {
  id: string;
  type: string | null;
  name: string;
  tags: string[];
  threeJSGroup: THREE.Group;
  parent: Scene | GameObject | null;

  loaded: boolean;
  loadPromise: Promise<void>;

  options: GameObjectOptions;
  components: Component[];
  gameObjects: GameObject[];

  static componentClassForType: Record<string, ComponentClass> = {
    animation: AnimationComponent,
    model: ModelComponent,
    gltfNode: GltfNodeComponent,
    rigidBody: RigidBodyComponent,
    light: LightComponent,
    sound: SoundComponent,
    primitive: PrimitiveComponent,
  };

  static registerClassForComponentType(type: string, klass: ComponentClass): void {
    GameObject.componentClassForType[type] = klass;
  }

  constructor(parent: Scene | GameObject, options: GameObjectOptions = {}) {
    this.id = Util.getUUID();
    this.parent = parent;
    this.loadPromise = Promise.resolve();
    this.type = null;
    this.name = '';
    this.tags = [];
    this.threeJSGroup = new THREE.Group();
    this.components = [];
    this.gameObjects = [];
    this.loaded = false;
    this.options = options;

    this.reset(options);
  }

  getScene(): Scene {
    let current: Scene | GameObject | null = this.parent;
    while (current && (current as GameObject).threeJSGroup) {
      current = (current as GameObject).parent;
    }
    if (!current) {
      throw new Error('GameObject.getScene(): unable to locate scene for game object');
    }
    return current as Scene;
  }

  reset(json: GameObjectOptions | null = null): void {
    if (json) {
      this.options = json;
    }
    this.components = [];

    const allOptions: GameObjectOptions = { ...this.options };
    this.type = allOptions.type ?? null;
    this.name = allOptions.name ?? this.type ?? '';
    this.tags = allOptions.tags ?? [];

    this.threeJSGroup.clear();
    Object.assign(this.threeJSGroup.userData, {
      ...(allOptions.userData ?? {}),
      gameObjectID: this.id,
    });
    this.threeJSGroup.name = `gameObject-${this.name}`;

    const pos = allOptions.position ?? {};
    this.setPosition(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);

    const scale = allOptions.scale ?? {};
    this.setScale(scale.x ?? 1, scale.y ?? 1, scale.z ?? 1);

    const rot = allOptions.rotation ?? {};
    this.setRotation(rot.x ?? 0, rot.y ?? 0, rot.z ?? 0, rot.order);

    (allOptions.components ?? []).forEach((cjson) => {
      const ComponentClass = GameObject.componentClassForType[cjson.type];
      if (!ComponentClass) {
        console.warn(`GameObject: unknown component type "${cjson.type}" — skipping`);
        return;
      }
      this.components.push(new ComponentClass(this, cjson));
    });

    if (this.parent) {
      this.parent.addGameObject(this);
    }
  }

  setName(name: string): void {
    this.name = name;
    this.threeJSGroup.name = `gameObject-${name}`;
  }

  async load(): Promise<void> {
    this.loadPromise = this.loadPromise.then(() => this._load());
    await this.loadPromise;
  }

  private async _load(): Promise<void> {
    for (const c of this.components) {
      await c.load();
    }
    for (const child of this.gameObjects) {
      await child.load();
    }
    this.loaded = true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  hasTag(tag: string): boolean {
    return this.tags.includes(tag);
  }

  getComponent<T extends Component>(componentClass: new (...args: never[]) => T): T | undefined {
    return this.components.find((c): c is T => c instanceof componentClass);
  }

  addGameObject(gameObject: GameObject): void {
    if (this.gameObjects.includes(gameObject)) return;
    gameObject.parent = this;
    this.gameObjects.push(gameObject);
    this.threeJSGroup.add(gameObject.threeJSGroup);

    const scene = this.getScene();
    if (scene.isActive()) {
      // Fire-and-forget; caller is expected to await load() at scene level.
      gameObject.load().catch((error) => console.error(error));
    }
  }

  removeGameObject(gameObject: GameObject): void {
    if (!this.gameObjects.includes(gameObject)) return;
    this.gameObjects = this.gameObjects.filter((g) => g !== gameObject);
    gameObject.parent = null;
    this.threeJSGroup.remove(gameObject.threeJSGroup);
  }

  getRootGameObjects(): GameObject[] {
    return this.gameObjects;
  }

  forEachGameObject(fn: (gameObject: GameObject) => void): void {
    fn(this);
    this.gameObjects.forEach((child) => child.forEachGameObject(fn));
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

  destroy(): void {
    this.components.forEach((c) => c.unload());
    this.gameObjects.forEach((child) => child.destroy());
    if (this.parent) {
      this.parent.removeGameObject(this);
    }
    this.parent = null;
  }

  // Optional lifecycle hooks — override in subclass.
  afterLoaded(): void {}
  beforeUnloaded(): void {}
  beforeRender(ctx: ComponentTickContext): void {
    this.components.forEach((c) => c.beforeRender(ctx));
  }

  // Transform helpers ------------------------------------------------------

  setPosition(x: number, y: number, z: number): void {
    this.threeJSGroup.position.set(x, y, z);
  }

  setScale(x: number, y: number, z: number): void {
    this.threeJSGroup.scale.set(x, y, z);
  }

  setRotation(x: number, y: number, z: number, order?: string): void {
    const validOrders = ['XYZ', 'YZX', 'ZXY', 'XZY', 'YXZ', 'ZYX'] as const;
    const rotOrder = (validOrders as readonly string[]).includes(order ?? '')
      ? (order as THREE.EulerOrder)
      : undefined;
    this.threeJSGroup.rotation.set(x, y, z, rotOrder);
  }

  traverse(callback: (obj: THREE.Object3D) => void): void {
    this.threeJSGroup.traverse(callback);
  }

  // Rapier convenience -----------------------------------------------------

  getRapierRigidBody(): RAPIER.RigidBody | null {
    const component = this.getComponent(RigidBodyComponent);
    return component?.getRapierRigidBody() ?? null;
  }

  syncWithRigidBody(): void {
    const body = this.getRapierRigidBody();
    if (!body) return;
    const translation = body.translation();
    const rotation = body.rotation();
    this.threeJSGroup.position.set(translation.x, translation.y, translation.z);
    this.threeJSGroup.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  playSound(name: string, delayInSec = 0, detune: number | null = null): void {
    const component = this.components.find(
      (c) => c instanceof SoundComponent && (c.jsonData as { name?: string }).name === name,
    ) as SoundComponent | undefined;
    if (!component) {
      throw new Error(`gameObject.playSound(): no sound named "${name}" on ${this.name || this.id}`);
    }
    component.playSound(delayInSec, detune);
  }
}

export default GameObject;
