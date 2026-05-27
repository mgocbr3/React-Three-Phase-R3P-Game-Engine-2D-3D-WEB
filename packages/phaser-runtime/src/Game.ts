// Game: lifecycle wrapper that mirrors @pixlland/three-runtime/Game.
// It can still act as a typed data shell, but now also owns a Phaser.Game
// when used by standalone exports.

import Scene from './Scene.js';
import type { GameJSON, GameOptions, SceneJSON } from './types.js';
import {
  loadRuntimeScript,
  queueSceneAssetLoads,
  renderSceneObjects,
  sceneBackgroundColor,
} from './runtimeRenderer.js';
import {
  pixlProjectToPhaserGame,
  type PixlProjectDocument,
} from './adapter/pixlSchemaAdapter.js';

type PhaserModule = typeof import('phaser');
type PhaserGame = import('phaser').Game;

export default class Game {
  readonly options: GameOptions;
  scenes: Map<string, Scene>;
  initialScene: string;
  activeScene: Scene | null = null;
  phaserGame: PhaserGame | null = null;
  project: PixlProjectDocument | null = null;

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

  static fromPixlProject(project: PixlProjectDocument, options: GameOptions = {}): Game {
    const { game, scenes } = pixlProjectToPhaserGame(project);
    const runtime = new Game(game, scenes, options);
    runtime.project = project;
    if (!runtime.activeScene) {
      throw new Error(`Game.fromPixlProject: activeSceneId "${game.initialScene}" is not a 2D scene`);
    }
    return runtime;
  }

  loadFromPixlProject(project: PixlProjectDocument, sceneId?: string): Scene {
    const { game, scenes } = pixlProjectToPhaserGame(project);
    this.project = project;
    this.initialScene = sceneId ?? game.initialScene;
    this.scenes = new Map();
    for (const scene of scenes) {
      this.scenes.set(scene.id, new Scene(scene));
    }
    return this.setActiveScene(this.initialScene);
  }

  setActiveScene(id: string): Scene {
    const scene = this.scenes.get(id);
    if (!scene) throw new Error(`Game: scene "${id}" not found`);
    this.activeScene = scene;
    return scene;
  }

  private async loadPhaserModule(): Promise<PhaserModule> {
    if (this.options.phaserModule) {
      return this.options.phaserModule as PhaserModule;
    }
    return import('phaser');
  }

  async play(sceneId?: string): Promise<PhaserGame> {
    if (sceneId) this.setActiveScene(sceneId);
    const activeScene = this.activeScene;
    if (!activeScene) {
      throw new Error('Game.play: no active 2D scene loaded');
    }
    if (this.phaserGame) return this.phaserGame;

    const Phaser = await this.loadPhaserModule();
    const sceneJson = activeScene.toJSON();
    const assetBaseUrl = this.options.assetBaseUrl ?? '.';
    const pixelArt = this.options.pixelArt ?? (sceneJson.environment?.pixelArt !== false);
    const runtimeGame = this;
    const gravity = Array.isArray(sceneJson.physics?.gravity)
      ? {
          x: sceneJson.physics?.gravity[0] ?? 0,
          y: sceneJson.physics?.gravity[1] ?? 0,
        }
      : sceneJson.physics?.gravity ?? { x: 0, y: 980 };
    const runtimeState: {
      tick: ((deltaMs: number, timeMs: number) => void) | null;
    } = { tick: null };

    this.phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.options.parent ?? 'game',
      width: this.options.width ?? 800,
      height: this.options.height ?? 600,
      backgroundColor: sceneBackgroundColor(sceneJson),
      pixelArt,
      roundPixels: pixelArt,
      physics: { default: 'arcade', arcade: { gravity } },
      scene: {
        key: sceneJson.id,
        preload(this: import('phaser').Scene) {
          queueSceneAssetLoads(this, sceneJson.rootObjects, assetBaseUrl);
        },
        create(this: import('phaser').Scene) {
          const phaserScene = this;
          const gameObjects = renderSceneObjects(phaserScene, sceneJson.rootObjects);
          const camera = sceneJson.camera;
          if (camera?.position) {
            phaserScene.cameras.main.scrollX = camera.position.x;
            phaserScene.cameras.main.scrollY = camera.position.y;
          }
          if (typeof camera?.zoom === 'number') {
            phaserScene.cameras.main.setZoom(camera.zoom);
          }
          void loadRuntimeScript(phaserScene, gameObjects, {
            project: runtimeGame.project,
            phaserScene: sceneJson,
            phaserModule: Phaser,
            assetBaseUrl,
          }).then((tick) => {
            runtimeState.tick = tick;
          }).catch((error: unknown) => {
            // eslint-disable-next-line no-console
            console.error('[pixl-phaser-runtime] runtimeScript failed:', error);
          });
        },
        update(_time: number, delta: number) {
          runtimeState.tick?.(delta, _time);
        },
      },
    });

    return this.phaserGame;
  }

  pause(): void {
    if (!this.phaserGame || !this.activeScene) return;
    this.phaserGame.scene.pause(this.activeScene.id);
  }

  destroy(): void {
    if (!this.phaserGame) return;
    this.phaserGame.destroy(true);
    this.phaserGame = null;
  }

  toJSON(): { initialScene: string; scenes: SceneJSON[] } {
    return {
      initialScene: this.initialScene,
      scenes: [...this.scenes.values()].map((s) => s.toJSON()),
    };
  }
}
