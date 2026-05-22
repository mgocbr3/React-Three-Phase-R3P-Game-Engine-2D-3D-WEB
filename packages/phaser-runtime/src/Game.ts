// Game: lifecycle wrapper that mirrors @pixlland/three-runtime/Game. The
// Phaser.Game instance is owned by the consumer; this class is the typed
// shell the studio's PhaserRuntimeMount uses to bridge events.

import Scene from './Scene.js';
import type { GameJSON, GameOptions, SceneJSON } from './types.js';

export default class Game {
  readonly options: GameOptions;
  scenes: Map<string, Scene>;
  initialScene: string;
  activeScene: Scene | null = null;

  constructor(json: GameJSON, sceneJsons: SceneJSON[], options: GameOptions = {}) {
    this.options = options;
    this.scenes = new Map();
    this.initialScene = json.initialScene;
    for (const scene of sceneJsons) {
      this.scenes.set(scene.id, new Scene(scene));
    }
    const initial = this.scenes.get(this.initialScene);
    if (initial) this.activeScene = initial;
  }

  setActiveScene(id: string): Scene {
    const scene = this.scenes.get(id);
    if (!scene) throw new Error(`Game: scene "${id}" not found`);
    this.activeScene = scene;
    return scene;
  }

  toJSON(): { initialScene: string; scenes: SceneJSON[] } {
    return {
      initialScene: this.initialScene,
      scenes: [...this.scenes.values()].map((s) => s.toJSON()),
    };
  }
}
