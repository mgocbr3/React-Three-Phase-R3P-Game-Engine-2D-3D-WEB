// Adapted from tools/vendor/three-game-engine/src/types.d.ts
// (MIT, WesUnwin/three-game-engine). Converted from `.d.ts` to a regular
// `.ts` file so it ships in the package's runtime module graph and can
// be referenced from JS-emitted dist code.

import type { ComponentJSON } from './Component.js';

// JSON file shapes ---------------------------------------------------------

export interface GameJSON {
  initialScene?: string;
  scenes?: Record<string, string>;
  gameObjectTypes?: Record<string, string>;
}

export interface SceneJSON {
  background?: string | null;
  fog?: FogJSON | null;
  lights?: SceneLightJSON[];
  sounds?: SceneSoundJSON[];
  gameObjects?: GameObjectJSON[];
  gravity?: Vector3Data;
  /** Optional camera config — Pixlland addition. Applied to the renderer
   *  camera at Scene.load() time. Wes' original Game.json doesn't carry
   *  this; scene-authored cameras are a Pixl-only convention. */
  camera?: SceneCameraJSON;
}

export interface SceneCameraJSON {
  position?: Vector3Data;
  target?: Vector3Data;
  fov?: number;
  near?: number;
  far?: number;
}

export interface FogJSON {
  color: string;
  near: number;
  far: number;
}

export interface SceneLightJSON {
  type?: string;
  position?: Vector3Data;
  [key: string]: unknown;
}

export interface SceneSoundJSON {
  assetPath: string;
  name: string;
  loop?: boolean;
  autoplay?: boolean;
  volume?: number;
  playbackRate?: number;
}

export interface GameObjectJSON extends GameObjectOptions {
  type?: string;
  children?: GameObjectJSON[];
}

// Options structures -------------------------------------------------------

export interface GameOptions {
  rendererOptions?: RendererOptions;
  assetOptions?: AssetOptions;
  inputOptions?: InputOptions;
  disablePhysics?: boolean;
}

export interface RendererOptions {
  width?: number;
  height?: number;
  enableVR?: boolean;
  pixelRatio?: number;
  cameraOptions?: CameraOptions;
  setupFullScreenCanvas?: boolean;
  canvas?: HTMLCanvasElement;
  beforeRender?: (args: { deltaTimeInSec: number; time: number }) => void;
}

export interface CameraOptions {
  fov?: number;
  aspect?: number;
  near?: number;
  far?: number;
}

export interface AssetOptions {
  baseURL?: string;
  dracoLoaderOptions?: DracoLoaderOptions;
}

export interface DracoLoaderOptions {
  path: string;
  decoderConfig: Record<string, unknown>;
  workerLimit?: number;
}

export interface InputOptions {
  wsadMovement?: boolean;
  mouseOptions?: MouseOptions;
}

export interface MouseOptions {
  usePointerLock?: boolean;
}

export interface GameObjectOptions {
  type?: string;
  name?: string;
  tags?: string[];
  userData?: Record<string, unknown>;
  components?: ComponentJSON[];
  position?: Vector3Data;
  scale?: Vector3Data;
  rotation?: EulerValues;
}

export interface EulerValues {
  x?: number;
  y?: number;
  z?: number;
  order?: string;
}

export interface Vector3Data {
  x?: number;
  y?: number;
  z?: number;
}

export interface CharacterControllerOptions {
  walkingSpeed?: number;
  runningSpeed?: number;
  jumpCooldown?: number;
  capsule?: ColliderData;
}

export interface ColliderData {
  radius?: number;
  halfHeight?: number;
  density?: number;
  friction?: number;
  restitution?: number;
}
