// Scene: holds the root list of GameObjects plus camera/environment/physics
// metadata. Bridges to a Phaser.Scene at runtime — the consumer instantiates
// Phaser, this wrapper only carries the data.

import GameObject from './GameObject.js';
import type {
  SceneCameraJSON,
  SceneEnvironmentJSON,
  SceneJSON,
  ScenePhysicsJSON,
} from './types.js';

export default class Scene {
  readonly id: string;
  readonly name: string;
  readonly kind: '2d' | 'hybrid';
  rootObjects: GameObject[];
  camera?: SceneCameraJSON;
  environment?: SceneEnvironmentJSON;
  physics?: ScenePhysicsJSON;

  constructor(json: SceneJSON) {
    if (!json.id) throw new Error('Scene: id required');
    if (json.kind !== '2d' && json.kind !== 'hybrid') {
      throw new Error(`Scene: unexpected kind "${json.kind}" (phaser-runtime accepts 2d|hybrid)`);
    }
    this.id = json.id;
    this.name = json.name || json.id;
    this.kind = json.kind;
    this.rootObjects = (json.rootObjects ?? []).map((g) => new GameObject(g));
    this.camera = json.camera;
    this.environment = json.environment;
    this.physics = json.physics;
  }

  findObject(id: string): GameObject | undefined {
    for (const root of this.rootObjects) {
      const found = root.findChild(id);
      if (found) return found;
    }
    return undefined;
  }

  addRootObject(go: GameObject): void {
    go.parent = null;
    this.rootObjects.push(go);
  }

  removeRootObject(id: string): boolean {
    const idx = this.rootObjects.findIndex((g) => g.id === id);
    if (idx < 0) return false;
    this.rootObjects.splice(idx, 1);
    return true;
  }

  totalObjectCount(): number {
    const visit = (go: GameObject): number =>
      1 + go.children.reduce((n, c) => n + visit(c), 0);
    return this.rootObjects.reduce((n, root) => n + visit(root), 0);
  }

  toJSON(): SceneJSON {
    return {
      id: this.id,
      name: this.name,
      kind: this.kind,
      rootObjects: this.rootObjects.map((g) => g.toJSON()),
      camera: this.camera,
      environment: this.environment,
      physics: this.physics,
    };
  }
}
