// Pixlland-specific. Bridges the PixlPlayground schema (the same one
// engine-ops/engine-cli/three-runtime share) to phaser-runtime's
// GameObjectJSON / SceneJSON / GameJSON shapes. Pure functions — no
// Phaser, no DOM, no side effects.
//
// Mirror of @pixlland/three-runtime/src/adapter/pixlSchemaAdapter.ts.

import type {
  GameJSON,
  GameObjectJSON,
  SceneJSON,
  Transform2DData,
  Vector2Data,
} from '../types.js';

// Loose mirrors of PixlPlayground's schema. Kept declaration-only to avoid
// taking a runtime dep on engine-ops/engine-cli.

export interface PixlVec3 {
  0: number; 1: number; 2: number;
  length: 3;
}

export interface PixlTransform {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export interface PixlComponentInstance {
  id: string;
  type: string;
  enabled?: boolean;
  data?: Record<string, unknown>;
}

export interface PixlSceneObject {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  transform?: PixlTransform;
  visible?: boolean;
  locked?: boolean;
  tags?: string[];
  components?: PixlComponentInstance[];
  children?: PixlSceneObject[];
  data?: Record<string, unknown>;
}

export interface PixlSceneCamera {
  id?: string;
  name?: string;
  position?: [number, number, number];
  target?: [number, number, number];
  zoom?: number;
}

export interface PixlSceneEnvironment {
  background?: string;
  pixelArt?: boolean;
}

export interface PixlScenePhysics {
  engine?: string;
  gravity?: number[];
}

export interface PixlSceneDocument {
  id: string;
  name: string;
  kind: '2d' | '3d' | 'hybrid';
  rootObjects: PixlSceneObject[];
  camera?: PixlSceneCamera;
  environment?: PixlSceneEnvironment;
  physics?: PixlScenePhysics;
  runtimeScript?: string;
}

export interface PixlProjectDocument {
  id: string;
  name: string;
  activeSceneId: string;
  scenes: PixlSceneDocument[];
}

// Conversion --------------------------------------------------------------

const vec2 = (axis: [number, number, number] | undefined, fallback: Vector2Data = { x: 0, y: 0 }): Vector2Data => {
  if (!axis) return fallback;
  // Pixl 3D position uses x/y/z. For 2D scenes we map (x, y) → (x, y).
  // Pixl 2D scenes write [x, y, 0] so this still works.
  return { x: axis[0] ?? fallback.x, y: axis[1] ?? fallback.y };
};

const radians = (rot: [number, number, number] | undefined): number => {
  if (!rot) return 0;
  // In 2D, z-axis rotation is the only meaningful axis.
  return rot[2] ?? 0;
};

const transform2d = (pixl: PixlTransform | undefined): Transform2DData => ({
  position: vec2(pixl?.position),
  rotation: radians(pixl?.rotation),
  scale: vec2(pixl?.scale, { x: 1, y: 1 }),
});

const objectToJSON = (pixl: PixlSceneObject): GameObjectJSON => {
  const children = pixl.children?.length
    ? pixl.children.map(objectToJSON)
    : undefined;
  return {
    id: pixl.id,
    name: pixl.name,
    type: pixl.type,
    transform: transform2d(pixl.transform),
    visible: pixl.visible !== false,
    locked: pixl.locked === true,
    tags: pixl.tags ? [...pixl.tags] : [],
    components: (pixl.components ?? []).map((c) => ({
      type: c.type,
      enabled: c.enabled !== false,
      ...(c.data ?? {}),
    })),
    children,
    data: { ...(pixl.data ?? {}) },
  };
};

const gravityToTuple = (gravity: number[] | undefined): [number, number] | undefined => {
  if (!gravity || gravity.length < 2) return undefined;
  return [gravity[0] ?? 0, gravity[1] ?? 0];
};

export const pixlSceneToPhaserScene = (pixl: PixlSceneDocument): SceneJSON => {
  if (pixl.kind === '3d') {
    throw new Error(`pixlSceneToPhaserScene: scene "${pixl.id}" has kind="3d". Use @pixlland/three-runtime.`);
  }
  return {
    id: pixl.id,
    name: pixl.name,
    kind: pixl.kind === '2d' ? '2d' : 'hybrid',
    rootObjects: pixl.rootObjects.map(objectToJSON),
    camera: pixl.camera
      ? {
          id: pixl.camera.id,
          name: pixl.camera.name,
          position: vec2(pixl.camera.position),
          zoom: pixl.camera.zoom,
        }
      : undefined,
    environment: pixl.environment
      ? { background: pixl.environment.background, pixelArt: pixl.environment.pixelArt }
      : undefined,
    physics: pixl.physics
      ? { engine: pixl.physics.engine, gravity: gravityToTuple(pixl.physics.gravity) }
      : undefined,
    runtimeScript: pixl.runtimeScript,
  };
};

export const pixlProjectToPhaserGame = (
  pixl: PixlProjectDocument,
): { game: GameJSON; scenes: SceneJSON[] } => {
  const sceneList = pixl.scenes
    .filter((s) => s.kind === '2d' || s.kind === 'hybrid')
    .map(pixlSceneToPhaserScene);
  const scenes: Record<string, string> = {};
  for (const s of sceneList) scenes[s.id] = s.id;
  return {
    game: {
      initialScene: pixl.activeSceneId,
      scenes,
    },
    scenes: sceneList,
  };
};

/** Reverse conversion. Used by export tools when round-tripping. */
export const phaserSceneToPixlScene = (json: SceneJSON): PixlSceneDocument => {
  const objToPixl = (o: GameObjectJSON): PixlSceneObject => ({
    id: o.id,
    name: o.name,
    type: o.type,
    transform: {
      position: [o.transform.position.x, o.transform.position.y, 0],
      rotation: [0, 0, o.transform.rotation],
      scale: [o.transform.scale.x, o.transform.scale.y, 1],
    },
    visible: o.visible,
    locked: o.locked,
    tags: o.tags,
    components: (o.components ?? []).map((c) => {
      const { type, enabled, ...rest } = c;
      return {
        id: `${o.id}_${type}`,
        type,
        enabled: enabled !== false,
        data: rest,
      } as PixlComponentInstance;
    }),
    children: o.children?.length ? o.children.map(objToPixl) : undefined,
    data: o.data,
  });
  return {
    id: json.id,
    name: json.name,
    kind: json.kind,
    rootObjects: json.rootObjects.map(objToPixl),
    camera: json.camera
      ? {
          id: json.camera.id,
          name: json.camera.name,
          position: json.camera.position
            ? [json.camera.position.x, json.camera.position.y, 0]
            : undefined,
          zoom: json.camera.zoom,
        }
      : undefined,
    environment: json.environment
      ? { background: json.environment.background, pixelArt: json.environment.pixelArt }
      : undefined,
    physics: json.physics
      ? {
          engine: json.physics.engine,
          gravity:
            json.physics.gravity && Array.isArray(json.physics.gravity)
              ? [json.physics.gravity[0], json.physics.gravity[1], 0]
              : undefined,
        }
      : undefined,
    runtimeScript: json.runtimeScript,
  };
};
