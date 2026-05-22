// JSON shapes used internally by the 2D runtime. Mirror of
// three-runtime/src/types.ts but adapted for 2D (x/y instead of x/y/z,
// flat hierarchy support for Phaser's Container-based scene graph).

export interface Vector2Data {
  x: number;
  y: number;
}

export interface Transform2DData {
  position: Vector2Data;
  /** Rotation in radians. */
  rotation: number;
  scale: Vector2Data;
}

export type ComponentJSON = {
  type: string;
  enabled?: boolean;
} & Record<string, unknown>;

export interface GameObjectJSON {
  id: string;
  name: string;
  /** Phaser game-object kind: 'sprite' | 'container' | 'image' | 'text' | 'tilemap' | 'group'. */
  type: string;
  transform: Transform2DData;
  visible?: boolean;
  locked?: boolean;
  tags?: string[];
  components?: ComponentJSON[];
  children?: GameObjectJSON[];
  data?: Record<string, unknown>;
}

export interface SceneCameraJSON {
  id?: string;
  name?: string;
  position?: Vector2Data;
  zoom?: number;
  rotation?: number;
}

export interface ScenePhysicsJSON {
  engine?: string;
  gravity?: [number, number] | { x: number; y: number };
}

export interface SceneEnvironmentJSON {
  background?: string;
}

export interface SceneJSON {
  id: string;
  name: string;
  kind: '2d' | 'hybrid';
  rootObjects: GameObjectJSON[];
  camera?: SceneCameraJSON;
  environment?: SceneEnvironmentJSON;
  physics?: ScenePhysicsJSON;
}

export interface GameJSON {
  initialScene: string;
  scenes: Record<string, string>;
  /** Optional default size for the Phaser game config. */
  size?: { width: number; height: number };
}

export interface GameOptions {
  width?: number;
  height?: number;
  parent?: string | HTMLElement;
  pixelArt?: boolean;
  /** Provided by the consumer; phaser-runtime never instantiates Phaser itself. */
  phaserModule?: unknown;
}
