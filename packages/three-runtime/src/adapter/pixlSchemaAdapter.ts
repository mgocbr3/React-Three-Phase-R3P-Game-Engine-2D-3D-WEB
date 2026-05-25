// Pixlland-specific. Bridges PixlPlayground's PixlProjectDocument /
// PixlSceneDocument schema (engine/apps/studio/src/engine/project/schema.ts)
// to Wes' GameJSON / SceneJSON / GameObjectJSON shape. Pure functions —
// no React, no Three, no Phaser, no side effects.

import type { ComponentJSON } from '../Component.js';
import type {
  GameJSON,
  GameObjectJSON,
  SceneJSON,
  Vector3Data,
} from '../types.js';

// Loose mirrors of the PixlPlayground schema. We can't import directly
// from engine/apps/studio because that's a separate package; instead we
// declare exactly the shape we read. Stay in sync with
// engine/apps/studio/src/engine/project/schema.ts.

export interface PixlVector3 {
  0: number; 1: number; 2: number;
  length: 3;
}

export interface PixlTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
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
  transform: PixlTransform;
  visible?: boolean;
  locked?: boolean;
  tags?: string[];
  components?: PixlComponentInstance[];
  data?: Record<string, unknown>;
}

export interface PixlSceneCamera {
  id?: string;
  name?: string;
  position?: [number, number, number];
  target?: [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
}

export interface PixlSceneEnvironment {
  background?: string;
  ambientLight?: string;
  ambientIntensity?: number;
  sunColor?: string;
  sunIntensity?: number;
}

export interface PixlScenePhysics {
  engine?: string;
  gravity?: [number, number, number];
}

export interface PixlSceneDocument {
  id: string;
  name: string;
  kind: '2d' | '3d' | 'hybrid';
  units?: string;
  rootObjects: PixlSceneObject[];
  camera?: PixlSceneCamera;
  environment?: PixlSceneEnvironment;
  physics?: PixlScenePhysics;
}

export interface PixlProjectDocument {
  id: string;
  slug: string;
  name: string;
  activeSceneId: string;
  scenes: PixlSceneDocument[];
  assets?: { entries?: Array<{ id: string; path: string; url?: string }> };
  game?: { source?: Record<string, unknown> };
}

// Conversion --------------------------------------------------------------

const triplet = (axis: [number, number, number] | undefined): Vector3Data | undefined => {
  if (!axis) return undefined;
  return { x: axis[0], y: axis[1], z: axis[2] };
};

// Pixl components that have no rendering footprint — gameplay scripts,
// metadata, entities consumed by user code. Stripping them at the adapter
// stage avoids "unknown component type" warnings spamming the console
// when loading projects authored against the full Pixl schema.
const RENDERLESS_PIXL_TYPES = new Set<string>([
  'pixl.logic',
  'pixl.entity',
  'pixl.player',
  'pixl.animation',
  'pixl.particles',
  'pixl.terrain',
  'pixl.transform3d', // baked into GameObject.transform already
  'pixl.camera3d',    // scene-level camera handled separately
  'pixl.tag',
  'pixl.script',
  'pixl.ui',
]);

const mapComponent = (instance: PixlComponentInstance): ComponentJSON | null => {
  if (instance.enabled === false) return null;
  if (RENDERLESS_PIXL_TYPES.has(instance.type)) return null;
  const data = instance.data ?? {};

  switch (instance.type) {
    // Pixl 3D component families -> Wes' built-in components.
    case 'pixl.mesh':
    case 'pixl.visual': {
      // `pixl.visual` in Pixl is a MATERIAL-config component (textureUrl,
      // opacity, metalness, roughness, …), NOT a mesh source. Only treat it
      // as a model when it carries an explicit assetPath/modelUrl — most
      // Harvest Rush-style projects don't. The mesh comes from a synthesized
      // gltfNode (see synthesizeGltfNodeComponents).
      const assetPath = (data.modelUrl ?? data.assetPath ?? data.url) as string | undefined;
      if (!assetPath) return null;
      return { type: 'model', name: instance.id, assetPath: normalizeAssetPath(assetPath) };
    }
    case 'pixl.primitive': {
      // Built-in geometry (box/sphere/cone/...). Lets a project describe a
      // scene with simple shapes without authoring GLB assets. Handled by
      // PrimitiveComponent in the runtime.
      return { type: 'primitive', name: instance.id, ...data };
    }
    case 'pixl.light3d':
    case 'pixl.light': {
      const lightType = (data.lightType ?? data.kind ?? 'PointLight') as string;
      return { type: 'light', name: instance.id, lightType, ...data };
    }
    case 'pixl.audio': {
      const assetPath = (data.url ?? data.assetPath) as string | undefined;
      if (!assetPath) return null;
      return {
        type: 'sound',
        name: instance.id,
        assetPath: normalizeAssetPath(assetPath),
        ...data,
      };
    }
    case 'pixl.physics': {
      return {
        type: 'rigidBody',
        name: instance.id,
        rigidBodyType: (data.bodyType ?? 'fixed') as string,
        colliders: (data.colliders ?? []) as unknown,
        ...data,
      } as ComponentJSON;
    }
    default:
      // Pass-through for unknown types — userland or future components can
      // be registered via GameObject.registerClassForComponentType.
      return { type: instance.type, name: instance.id, ...data };
  }
};

const getEditorColor = (object: PixlSceneObject): string | undefined => {
  const editor = object.data?.editor as { color?: unknown } | undefined;
  return typeof editor?.color === 'string' ? editor.color : undefined;
};

const getVisualData = (object: PixlSceneObject): Record<string, unknown> => {
  const visual = object.components?.find((component) => component.type === 'pixl.visual');
  return visual?.data ?? {};
};

const synthesizePrimitiveComponent = (
  object: PixlSceneObject,
  renderComponents: ComponentJSON[],
): ComponentJSON[] => {
  if (object.visible === false) return [];
  if (renderComponents.some((component) => (
    component.type === 'model' ||
    component.type === 'gltfNode' ||
    component.type === 'primitive' ||
    component.type === 'light'
  ))) {
    return [];
  }

  const visual = getVisualData(object);
  const base = {
    type: 'primitive',
    name: `${object.id}-primitive`,
    color: getEditorColor(object) ?? '#cccccc',
    opacity: visual.opacity,
    metalness: visual.metalness,
    roughness: visual.roughness,
    emissive: typeof visual.emissiveColor === 'string'
      ? visual.emissiveColor
      : undefined,
    emissiveIntensity: visual.emissiveIntensity,
    castShadow: visual.castShadow,
    receiveShadow: visual.receiveShadow,
  };

  switch (object.type) {
    case 'box':
    case 'mesh':
      return [{ ...base, shape: 'box', size: { x: 1, y: 1, z: 1 } }];
    case 'sphere':
      return [{ ...base, shape: 'sphere', radius: 0.5 }];
    case 'cylinder':
      return [{ ...base, shape: 'cylinder', radius: 0.5, height: 1 }];
    case 'ring':
      return [{ ...base, shape: 'torus', radius: 1, tube: 0.08, radialSegments: 32 }];
    case 'plane':
    case 'platform':
      return [{ ...base, shape: 'plane', size: { x: 1, y: 1 } }];
    default:
      return [];
  }
};

// Strip leading "public/" — Pixl projects sometimes carry the dev-time
// folder prefix in modelUrl/assetPath, but the studio's published path
// (e.g. /sample-projects/<slug>/assets/...) drops it. Leading slashes
// (absolute paths) are preserved so already-resolved URLs keep their shape.
const normalizeAssetPath = (value: string): string =>
  value.replace(/^public\//, '');

// Pixl-format Harvest Rush-style projects encode "this object is a node
// in a shared GLB" via two parallel components: `pixl.animation` carries
// the modelUrl, and `pixl.logic.customData` carries sourceNodeName/
// sourceAsset. Three-runtime's ModelComponent clones the WHOLE scene of
// the GLB, which is wrong (would duplicate Farm.glb 11k+ times). Detect
// the pattern here and synthesize a `gltfNode` component instead.
const synthesizeGltfNodeComponents = (
  object: PixlSceneObject,
): ComponentJSON[] => {
  const components = object.components ?? [];
  const logic = components.find((c) => c.type === 'pixl.logic');
  const animation = components.find((c) => c.type === 'pixl.animation');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customData = (logic?.data as any)?.customData as
    | { sourceAsset?: string; sourceNodeName?: string; nodeName?: string }
    | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const animData = animation?.data as any;
  const assetPath = (customData?.sourceAsset
    ?? animData?.modelUrl) as string | undefined;
  const nodeName = (customData?.sourceNodeName
    ?? customData?.nodeName
    ?? animData?.nodeName) as string | undefined;
  if (!assetPath || !nodeName) return [];
  return [
    {
      type: 'gltfNode',
      name: `${object.id}-gltfNode`,
      assetPath: normalizeAssetPath(assetPath),
      nodeName,
    },
  ];
};

const buildGameObjectJSON = (object: PixlSceneObject, children: PixlSceneObject[]): GameObjectJSON => {
  const mapped = (object.components ?? [])
    .map(mapComponent)
    .filter((c): c is ComponentJSON => c !== null);
  const synthesized = synthesizeGltfNodeComponents(object);
  const primitive = synthesizePrimitiveComponent(object, [...synthesized, ...mapped]);
  const components = [...synthesized, ...primitive, ...mapped];

  return {
    type: object.type,
    name: object.name,
    tags: object.tags,
    position: triplet(object.transform.position),
    rotation: triplet(object.transform.rotation),
    scale: triplet(object.transform.scale),
    userData: {
      pixlObjectId: object.id,
      pixlLocked: object.locked ?? false,
      pixlVisible: object.visible !== false,
    },
    components,
    children: children.map((child) => buildGameObjectJSON(child, getChildren(child.id, allSceneObjects))),
  };
};

// Tree reconstruction from a flat list with parentId. The flat list is the
// shape the editor store keeps; the tree shape is what Wes' SceneJSON wants.

let allSceneObjects: PixlSceneObject[] = [];

const getChildren = (parentId: string, list: PixlSceneObject[]): PixlSceneObject[] => (
  list.filter((o) => (o.parentId ?? null) === parentId)
);

const getRoots = (list: PixlSceneObject[]): PixlSceneObject[] => (
  list.filter((o) => !o.parentId)
);

// Pixl's scene.environment packs ambient + sun + ambient intensity into one
// flat block. Wes' Scene expects SceneLightJSON[] with `type` + props. Map them.
const synthesizeEnvironmentLights = (
  env: PixlSceneEnvironment | undefined,
): import('../types.js').SceneLightJSON[] => {
  if (!env) return [];
  const lights: import('../types.js').SceneLightJSON[] = [];
  if (env.ambientLight || typeof env.ambientIntensity === 'number') {
    lights.push({
      type: 'AmbientLight',
      color: env.ambientLight ?? '#ffffff',
      intensity: typeof env.ambientIntensity === 'number' ? env.ambientIntensity : 0.7,
    });
  }
  if (env.sunColor || typeof env.sunIntensity === 'number') {
    lights.push({
      type: 'DirectionalLight',
      color: env.sunColor ?? '#fffaf0',
      intensity: typeof env.sunIntensity === 'number' ? env.sunIntensity : 0.85,
      position: { x: 100, y: 200, z: 100 },
    });
  }
  return lights;
};

export const pixlSceneToWesScene = (scene: PixlSceneDocument): SceneJSON => {
  allSceneObjects = scene.rootObjects;
  const roots = getRoots(scene.rootObjects);
  const gameObjects = roots.map((root) => (
    buildGameObjectJSON(root, getChildren(root.id, scene.rootObjects))
  ));

  return {
    background: scene.environment?.background,
    gravity: triplet(scene.physics?.gravity),
    gameObjects,
    lights: synthesizeEnvironmentLights(scene.environment),
    camera: scene.camera ? {
      position: triplet(scene.camera.position),
      target: triplet(scene.camera.target),
      fov: scene.camera.fov,
      near: scene.camera.near,
      far: scene.camera.far,
    } : undefined,
  };
};

export const pixlProjectToWesGame = (project: PixlProjectDocument): {
  game: GameJSON;
  scenesByPath: Record<string, SceneJSON>;
  initialScene: string;
} => {
  const scenes: Record<string, string> = {};
  const scenesByPath: Record<string, SceneJSON> = {};
  let initialSceneName = '';

  for (const scene of project.scenes) {
    const path = `Scenes/${scene.id}.pixlscene.json`;
    scenes[scene.name || scene.id] = path;
    scenesByPath[path] = pixlSceneToWesScene(scene);
    if (scene.id === project.activeSceneId || !initialSceneName) {
      initialSceneName = scene.name || scene.id;
    }
  }

  return {
    game: { initialScene: initialSceneName, scenes, gameObjectTypes: {} },
    scenesByPath,
    initialScene: initialSceneName,
  };
};

// Reverse direction: take a live Game's active Scene and produce a
// PixlSceneDocument snapshot. Used by Save / Export / commit flows.

// Lazy import shapes for the reverse adapter — we type against Wes' actual
// runtime classes by structural duck-typing so this module stays free of
// circular dependencies.
interface RuntimeGameObjectShape {
  threeJSGroup: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number }; userData: Record<string, unknown> };
  name: string;
  type: string | null;
  tags: string[];
  gameObjects: RuntimeGameObjectShape[];
  options: { components?: ComponentJSON[] };
}

interface RuntimeSceneShape {
  gameObjects: RuntimeGameObjectShape[];
}

const flattenRuntimeObjects = (
  list: RuntimeGameObjectShape[],
  out: PixlSceneObject[],
  parentId: string | null,
): void => {
  for (const node of list) {
    const id = (node.threeJSGroup.userData.pixlObjectId as string | undefined)
      ?? `runtime_${Math.random().toString(36).slice(2)}`;
    out.push({
      id,
      name: node.name,
      type: node.type ?? 'group',
      parentId,
      transform: {
        position: [node.threeJSGroup.position.x, node.threeJSGroup.position.y, node.threeJSGroup.position.z],
        rotation: [node.threeJSGroup.rotation.x, node.threeJSGroup.rotation.y, node.threeJSGroup.rotation.z],
        scale: [node.threeJSGroup.scale.x, node.threeJSGroup.scale.y, node.threeJSGroup.scale.z],
      },
      visible: (node.threeJSGroup.userData.pixlVisible as boolean | undefined) ?? true,
      locked: (node.threeJSGroup.userData.pixlLocked as boolean | undefined) ?? false,
      tags: node.tags,
    });
    flattenRuntimeObjects(node.gameObjects, out, id);
  }
};

export const wesSceneToPixlScene = (
  scene: RuntimeSceneShape,
  template: Pick<PixlSceneDocument, 'id' | 'name' | 'kind'>,
): PixlSceneDocument => {
  const rootObjects: PixlSceneObject[] = [];
  flattenRuntimeObjects(scene.gameObjects, rootObjects, null);
  return {
    id: template.id,
    name: template.name,
    kind: template.kind,
    rootObjects,
  };
};
