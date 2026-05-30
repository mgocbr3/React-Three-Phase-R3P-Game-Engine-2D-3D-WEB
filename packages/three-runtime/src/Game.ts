// Adapted from tools/vendor/three-game-engine/src/Game.ts
// (MIT, WesUnwin/three-game-engine). The constructor accepts an
// `AssetSourceInput` (string | FileSystemDirectoryHandle | AssetSource)
// from `@pixlland/engine-core` instead of Wes' baseURL/dirHandle pair.

import type { AssetSourceInput } from '@pixlland/engine-core';

import AssetStore from './assets/AssetStore.js';
import type Asset from './assets/Asset.js';
import JSONAsset from './assets/JSONAsset.js';
import InputManager from './input/InputManager.js';
import Renderer from './Renderer.js';
import Scene from './Scene.js';
import type GameObject from './GameObject.js';
import type { GameJSON, GameOptions, RendererPostProcessingOptions, SceneJSON } from './types.js';
import {
  pixlProjectToWesGame,
  type PixlProjectDocument,
} from './adapter/pixlSchemaAdapter.js';

class Game {
  gameOptions: GameOptions;
  initialized: boolean;
  gameJSONAsset: JSONAsset<GameJSON> | null;
  renderer!: Renderer;
  inputManager: InputManager | null;
  scene: Scene | null;
  assetStore: AssetStore;
  loadingScene: boolean;
  gameObjectTypes: Record<string, JSONAsset<Record<string, unknown>>>;
  gameObjectClasses: Record<string, new (...args: never[]) => GameObject>;

  private readonly assetSourceInput: AssetSourceInput;

  constructor(source: AssetSourceInput, gameOptions: GameOptions = {}) {
    this.assetSourceInput = source;
    this.gameOptions = gameOptions;
    this.initialized = false;
    this.gameJSONAsset = null;
    this.scene = null;
    this.inputManager = null;
    this.loadingScene = false;
    this.assetStore = new AssetStore(source, gameOptions.assetOptions);
    this.gameObjectTypes = {};
    this.gameObjectClasses = {};
  }

  async _init(): Promise<void> {
    if (this.initialized) {
      throw new Error('Game: already initialized');
    }

    const gameJsonAsset = await this.assetStore.load('game.json');
    if (!(gameJsonAsset instanceof JSONAsset)) {
      throw new Error('Game: game.json must be a JSONAsset');
    }
    this.gameJSONAsset = gameJsonAsset as JSONAsset<GameJSON>;

    const gameObjectTypes = this.gameJSONAsset?.data?.gameObjectTypes ?? {};
    for (const gameObjectType of Object.keys(gameObjectTypes)) {
      const assetPath = gameObjectTypes[gameObjectType];
      if (!assetPath) continue;
      const asset = await this.assetStore.load(assetPath);
      if (asset instanceof JSONAsset) {
        this.gameObjectTypes[gameObjectType] = asset as JSONAsset<Record<string, unknown>>;
      }
    }

    this.renderer = new Renderer(this, this.gameOptions.rendererOptions);
    this.inputManager = new InputManager(this.renderer.getCanvas(), this.gameOptions.inputOptions);
    this.initialized = true;
  }

  async loadScene(sceneName: string): Promise<void> {
    if (this.loadingScene) {
      throw new Error('Game.loadScene: another scene is currently loading');
    }
    this.loadingScene = true;
    try {
      if (!this.initialized) await this._init();

      if (this.scene) {
        this.scene.beforeUnloaded();
        this.scene.forEachGameObject((g) => g.beforeUnloaded());
        this.scene.active = false;
        this.scene = null;
      }

      const scenePath = this.gameJSONAsset?.data?.scenes?.[sceneName];
      if (!scenePath) {
        throw new Error(`Game.loadScene: no scene "${sceneName}" in game.json`);
      }

      const scene = new Scene(this, scenePath);
      this.scene = scene;
      await scene.load();
      scene.active = true;

      scene.afterLoaded();
      scene.forEachGameObject((g) => g.afterLoaded());
    } finally {
      this.loadingScene = false;
    }
  }

  async loadAsset(assetPath: string): Promise<Asset> {
    if (!this.initialized) await this._init();
    return this.assetStore.load(assetPath);
  }

  async play(): Promise<void> {
    if (!this.initialized) await this._init();
    if (!this.scene) {
      const scenes = this.gameJSONAsset?.data?.scenes ?? {};
      const names = Object.keys(scenes);
      if (names.length === 0) {
        throw new Error('Game.play: game.json has no scenes');
      }
      const initial = this.gameJSONAsset?.data?.initialScene ?? names[0];
      await this.loadScene(initial);
    }
    this.renderer.play();
  }

  pause(): void {
    if (this.renderer) this.renderer.pause();
  }

  dispose(): void {
    this.pause();
    this.scene?.beforeUnloaded();
    this.scene?.gameObjects.forEach((g) => g.destroy());
    this.scene = null;
    this.inputManager?.dispose();
    this.inputManager = null;
    this.assetStore.unloadAll();
    this.renderer?.dispose();
    this.initialized = false;
  }

  registerGameObjectClasses(types: Record<string, new (...args: never[]) => GameObject>): void {
    for (const type of Object.keys(types)) {
      this.gameObjectClasses[type] = types[type];
    }
  }

  getGameObjectTypeJSON(type: string): JSONAsset<Record<string, unknown>> | null {
    return this.gameObjectTypes[type] ?? null;
  }

  getGameObjectClass(type: string): (new (...args: never[]) => GameObject) | null {
    return this.gameObjectClasses[type] ?? null;
  }

  isPlaying(): boolean {
    return this.renderer?.isPlaying() ?? false;
  }

  renderStillFrame(): void {
    this.renderer?.renderStillFrame();
  }

  setPostProcessingOptions(options?: RendererPostProcessingOptions): void {
    this.gameOptions.rendererOptions = {
      ...(this.gameOptions.rendererOptions ?? {}),
      postProcessing: options,
    };
    this.renderer?.setPostProcessingOptions(options);
  }

  getAssetSourceInput(): AssetSourceInput {
    return this.assetSourceInput;
  }

  /**
   * GDD §6.6 / Phase 6B bridge.
   *
   * Loads a scene directly from a Pixl-format project document. Converts to
   * Wes' GameJSON/SceneJSON shape via the adapter, primes the asset cache
   * with the converted JSON, and runs the normal Scene.load() path — so
   * meshes, lights, sounds, and physics flow through the same code path as
   * disk-loaded Wes projects.
   *
   * Use this when the studio (or any agent) already has the project doc in
   * memory and you want to skip the disk fetch of `game.json` /
   * `scene.json`. The AssetSource still resolves binary assets (GLB,
   * textures, audio) from `assetSourceInput` as usual.
   *
   * @param project   Loaded PixlProjectDocument (parsed `project.pixlproject.json`).
   * @param sceneName Optional scene NAME (not id) to load. Defaults to the
   *                  scene matching `project.activeSceneId`.
   */
  async loadFromPixlProject(
    project: PixlProjectDocument,
    sceneName?: string,
  ): Promise<void> {
    if (this.loadingScene) {
      throw new Error('Game.loadFromPixlProject: another scene is currently loading');
    }
    this.loadingScene = true;
    try {
      const { game: gameJson, scenesByPath, initialScene } = pixlProjectToWesGame(project);

      // Phase init — populate gameJSON without disk fetch.
      if (!this.initialized) {
        const stubGameAsset = new JSONAsset<GameJSON>(
          this.assetStore.source,
          'game.json',
          this.assetStore,
        );
        stubGameAsset.setData(gameJson);
        this.gameJSONAsset = stubGameAsset;
        this.assetStore.loadedAssets.set('game.json', stubGameAsset);

        this.renderer = new Renderer(this, this.gameOptions.rendererOptions);
        this.inputManager = new InputManager(
          this.renderer.getCanvas(),
          this.gameOptions.inputOptions,
        );
        this.initialized = true;
      } else {
        this.gameJSONAsset?.setData(gameJson);
      }

      // Prime the asset cache with every converted scene JSON. Scene.load()
      // → game.loadAsset() → AssetStore.load() hits the cache and never
      // touches disk for these paths.
      for (const [scenePath, sceneJson] of Object.entries(scenesByPath)) {
        const stubSceneAsset = new JSONAsset<SceneJSON>(
          this.assetStore.source,
          scenePath,
          this.assetStore,
        );
        stubSceneAsset.setData(sceneJson);
        this.assetStore.loadedAssets.set(scenePath, stubSceneAsset);
      }

      // Tear down previous scene if any (mirrors loadScene's behavior).
      if (this.scene) {
        this.scene.beforeUnloaded();
        this.scene.forEachGameObject((g) => g.beforeUnloaded());
        this.scene.active = false;
        this.scene = null;
      }

      const targetName = sceneName ?? initialScene;
      const scenePath = gameJson.scenes?.[targetName];
      if (!scenePath) {
        const available = Object.keys(gameJson.scenes ?? {}).join(', ');
        throw new Error(
          `Game.loadFromPixlProject: scene "${targetName}" not found (available: ${available})`,
        );
      }

      const scene = new Scene(this, scenePath);
      this.scene = scene;
      await scene.load();
      scene.active = true;

      scene.afterLoaded();
      scene.forEachGameObject((g) => g.afterLoaded());
    } finally {
      this.loadingScene = false;
    }
  }
}

export default Game;
