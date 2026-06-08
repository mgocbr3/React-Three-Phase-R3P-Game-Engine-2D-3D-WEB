// Pixlland-specific. Bridges PixlPlayground's PixlProjectDocument /
// PixlSceneDocument schema (engine/apps/studio/src/engine/project/schema.ts)
// to Wes' GameJSON / SceneJSON / GameObjectJSON shape. Pure functions —
// no React, no Three, no Phaser, no side effects.

import type { ComponentJSON } from '../Component.js';
import type {
  CharacterControllerOptions,
  GameJSON,
  GameObjectJSON,
  SceneCameraJSON,
  SceneJSON,
  SceneSunJSON,
  Vector3Data,
} from '../types.js';

export const DEFAULT_THREE_SKYBOX_TEXTURE_URL = '/skybox/kloppenheim_05_puresky_4k.jpg';

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
  children?: PixlSceneObject[];
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
      const lightType = typeof data.lightType === 'string'
        ? data.lightType
        : typeof data.kind === 'string'
          ? data.kind
          : undefined;
      return { type: 'light', name: instance.id, ...(lightType ? { lightType } : {}), ...data };
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
    case 'pixl.animation': {
      const assetPath = (data.modelUrl ?? data.assetPath ?? data.url) as string | undefined;
      if (!assetPath) return null;
      return {
        type: 'animation',
        name: instance.id,
        assetPath: normalizeAssetPath(assetPath),
        clip: (data.currentAnimation ?? data.animationName ?? data.clip) as string | undefined,
        movementClips: data.movementClips,
        driveByController: data.driveByController,
        crossFadeDuration: data.crossFadeDuration,
        autoPlay: data.autoPlay ?? true,
        loop: data.loop ?? true,
        speed: data.speed ?? 1,
        paused: data.paused ?? false,
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

const getComponentData = (object: PixlSceneObject, type: string): Record<string, unknown> => (
  object.components?.find((component) => component.type === type && component.enabled !== false)?.data ?? {}
);

const numberOrUndefined = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const numberOr = (value: unknown, fallback: number): number => numberOrUndefined(value) ?? fallback;

const vec3FromUnknown = (value: unknown): Vector3Data | undefined => {
  if (!Array.isArray(value) || value.length < 3) return undefined;
  const [x, y, z] = value;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return undefined;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return undefined;
  return { x, y, z };
};

const isZeroVec3 = (value: Vector3Data | undefined): boolean => (
  Boolean(value)
  && Math.abs(value?.x ?? 0) < 0.0001
  && Math.abs(value?.y ?? 0) < 0.0001
  && Math.abs(value?.z ?? 0) < 0.0001
);

const isPixllandMixamoModel = (assetPath: unknown): boolean => (
  typeof assetPath === 'string' && assetPath.includes('/models/manequin/mixamo/')
);

const getLightTypeForObject = (
  object: PixlSceneObject,
  data: Record<string, unknown>,
): string => {
  if (typeof data.lightType === 'string') return data.lightType;
  if (typeof data.kind === 'string') return data.kind;
  if (object.type === 'sunlight') return 'DirectionalLight';
  if (object.type === 'spotlight') return 'SpotLight';
  return 'PointLight';
};

const getSunLightPosition = (data: Record<string, unknown>): Vector3Data => {
  const elevation = (numberOr(data.sunElevation, 45) * Math.PI) / 180;
  const azimuth = (numberOr(data.sunAzimuth, 180) * Math.PI) / 180;
  const distance = 50;
  return {
    x: Math.cos(azimuth) * Math.cos(elevation) * distance,
    y: Math.sin(elevation) * distance,
    z: Math.sin(azimuth) * Math.cos(elevation) * distance,
  };
};

const applyLightPresentation = (
  object: PixlSceneObject,
  components: ComponentJSON[],
): ComponentJSON[] => components.map((component) => {
  if (component.type !== 'light') return component;

  const data = { ...component } as Record<string, unknown>;
  const lightType = getLightTypeForObject(object, data);
  const editorColor = getEditorColor(object);
  const light = {
    ...component,
    lightType,
    ...(editorColor ? { color: editorColor } : {}),
  } as ComponentJSON;

  if (object.type === 'sunlight' || lightType === 'DirectionalLight') {
    return {
      ...light,
      position: getSunLightPosition(data),
    } as ComponentJSON;
  }

  return light;
});

const getPlayerControllerOptions = (object: PixlSceneObject): CharacterControllerOptions | null => {
  if (object.type !== 'player') return null;
  const player = getComponentData(object, 'pixl.player');
  const physics = getComponentData(object, 'pixl.physics');
  const colliders = Array.isArray(physics.colliders) ? physics.colliders : [];
  const capsule = colliders.find((collider): collider is Record<string, unknown> => (
    collider !== null
    && typeof collider === 'object'
    && (collider as { type?: unknown }).type === 'capsule'
  ));

  return {
    walkingSpeed: numberOrUndefined(player.speed),
    runningSpeed: numberOrUndefined(player.sprintSpeed),
    crouchSpeed: numberOrUndefined(player.crouchSpeed),
    jumpForce: numberOrUndefined(player.jumpForce),
    mouseSensitivity: numberOrUndefined(player.mouseSensitivity),
    gamepadLookSpeed: numberOrUndefined(player.gamepadLookSpeed),
    minPitch: numberOrUndefined(player.minPitch),
    maxPitch: numberOrUndefined(player.maxPitch),
    capsule: capsule ? {
      halfHeight: numberOrUndefined(capsule.halfHeight),
      radius: numberOrUndefined(capsule.radius),
      density: numberOrUndefined(capsule.density),
      friction: numberOrUndefined(capsule.friction),
      restitution: numberOrUndefined(capsule.restitution),
    } : undefined,
  };
};

const applyModelPresentationTransforms = (
  object: PixlSceneObject,
  components: ComponentJSON[],
): ComponentJSON[] => {
  const entity = getComponentData(object, 'pixl.entity');
  const position = vec3FromUnknown(entity.modelOffset);
  const configuredRotation = vec3FromUnknown(entity.modelRotationOffset);
  const modelScale = numberOrUndefined(entity.modelScale);

  return components.map((component) => {
    if (component.type !== 'model') return component;

    const rotation = isPixllandMixamoModel(component.assetPath) && (!configuredRotation || isZeroVec3(configuredRotation))
      ? { x: 0, y: Math.PI, z: 0 }
      : configuredRotation;

    return {
      ...component,
      ...(position && !isZeroVec3(position) ? { position } : {}),
      ...(rotation ? { rotation } : {}),
      ...(typeof modelScale === 'number' && modelScale !== 1 ? {
        scale: { x: modelScale, y: modelScale, z: modelScale },
      } : {}),
    };
  });
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

const buildGameObjectJSON = (
  object: PixlSceneObject,
  children: PixlSceneObject[],
  sceneObjects: PixlSceneObject[],
): GameObjectJSON => {
  const rawMapped = (object.components ?? [])
    .map(mapComponent)
    .filter((c): c is ComponentJSON => c !== null);
  const synthesized = synthesizeGltfNodeComponents(object);
  const mappedWithAnimationFilter = synthesized.length
    ? rawMapped.filter((component) => component.type !== 'animation')
    : rawMapped;
  const mapped = object.type === 'player'
    ? mappedWithAnimationFilter.filter((component) => component.type !== 'rigidBody')
    : mappedWithAnimationFilter;
  const lightMapped = applyLightPresentation(object, mapped);
  const primitive = synthesizePrimitiveComponent(object, [...synthesized, ...lightMapped]);
  const components = applyModelPresentationTransforms(object, [...synthesized, ...primitive, ...lightMapped]);
  const controllerOptions = getPlayerControllerOptions(object);

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
      ...(controllerOptions ? {
        pixlControllerOptions: controllerOptions,
        pixlKinematicControllerOptions: {
          autoStep: { maxHeight: 0.35, minWidth: 0.2, includeDynamicBodies: false },
          snapToGroundDistance: 0.25,
        },
      } : {}),
    },
    components,
    children: children.map((child) => buildGameObjectJSON(
      child,
      getChildren(child.id, sceneObjects),
      sceneObjects,
    )),
  };
};

// Tree reconstruction from a flat list with parentId. The flat list is the
// shape the editor store keeps; the tree shape is what Wes' SceneJSON wants.

const flattenPixlSceneObjects = (
  objects: PixlSceneObject[],
  parentId: string | null = null,
): PixlSceneObject[] => {
  const flattened: PixlSceneObject[] = [];

  for (const object of objects) {
    const normalized = parentId && !object.parentId
      ? { ...object, parentId }
      : object;
    flattened.push(normalized);

    if (object.children?.length) {
      flattened.push(...flattenPixlSceneObjects(object.children, normalized.id));
    }
  }

  return flattened;
};

const getChildren = (parentId: string, list: PixlSceneObject[]): PixlSceneObject[] => (
  list.filter((o) => (o.parentId ?? null) === parentId)
);

const getRoots = (list: PixlSceneObject[]): PixlSceneObject[] => (
  list.filter((o) => !o.parentId)
);

const getRuntimeCamera = (
  scene: PixlSceneDocument,
  objects: PixlSceneObject[],
): SceneCameraJSON | undefined => {
  const cameraObject = objects.find((object) => object.type === 'camera' || object.tags?.includes('camera'));
  const cameraSettings = cameraObject ? getComponentData(cameraObject, 'pixl.camera3d') : {};
  const fallback = scene.camera;
  if (!cameraObject && !fallback) return undefined;

  return {
    position: triplet(cameraObject?.transform.position ?? fallback?.position),
    target: triplet(fallback?.target),
    fov: numberOrUndefined(cameraSettings.fov) ?? fallback?.fov,
    near: fallback?.near,
    far: fallback?.far,
    mode: typeof cameraSettings.mode === 'string' ? cameraSettings.mode : undefined,
    followPlayer: typeof cameraSettings.followPlayer === 'boolean' ? cameraSettings.followPlayer : undefined,
    targetId: typeof cameraSettings.targetId === 'string' ? cameraSettings.targetId : undefined,
    distance: numberOrUndefined(cameraSettings.distance),
    height: numberOrUndefined(cameraSettings.height),
    smoothing: numberOrUndefined(cameraSettings.smoothing),
    pitchMin: numberOrUndefined(cameraSettings.pitchMin),
    pitchMax: numberOrUndefined(cameraSettings.pitchMax),
  };
};

const hasAuthoredDirectionalLight = (objects: PixlSceneObject[]): boolean => objects.some((object) => {
  if (object.visible === false) return false;
  if (object.type === 'sunlight') return true;
  return (object.components ?? []).some((component) => {
    if (component.enabled === false || component.type !== 'pixl.light3d') return false;
    const lightType = getLightTypeForObject(object, component.data ?? {});
    return lightType === 'DirectionalLight';
  });
});

const getAuthoredSkySun = (objects: PixlSceneObject[]): SceneSunJSON | null => {
  for (const object of objects) {
    if (object.visible === false) continue;
    const lightComponent = (object.components ?? []).find((component) => (
      component.enabled !== false &&
      (component.type === 'pixl.light3d' || component.type === 'pixl.light')
    ));
    if (object.type !== 'sunlight' && !lightComponent) continue;

    const data = lightComponent?.data ?? {};
    if (getLightTypeForObject(object, data) !== 'DirectionalLight') continue;

    return {
      enabled: true,
      color: getEditorColor(object) ?? (typeof data.color === 'string' ? data.color : '#fff7cf'),
      intensity: numberOr(data.intensity, 1),
      position: getSunLightPosition(data),
      size: numberOr(data.sunDiskSize, 44),
      distance: 760,
      opacity: 0.96,
    };
  }

  return null;
};

// Pixl's scene.environment packs ambient + sun + ambient intensity into one
// flat block. Wes' Scene expects SceneLightJSON[] with `type` + props. Map them.
const synthesizeEnvironmentLights = (
  env: PixlSceneEnvironment | undefined,
  options: { includeDirectional: boolean } = { includeDirectional: true },
): import('../types.js').SceneLightJSON[] => {
  if (!env) return [];
  const lights: import('../types.js').SceneLightJSON[] = [];
  const ambient = typeof env.ambientIntensity === 'number' ? env.ambientIntensity : 0.7;
  if (env.ambientLight || typeof env.ambientIntensity === 'number') {
    lights.push({
      type: 'HemisphereLight',
      color: env.background ?? env.ambientLight ?? '#9fd5df',
      groundColor: '#3d4637',
      intensity: Math.max(0.2, ambient * 0.65),
    });
    lights.push({
      type: 'AmbientLight',
      color: env.ambientLight ?? '#ffffff',
      intensity: Math.min(0.22, ambient * 0.18),
    });
  }
  if (options.includeDirectional && (env.sunColor || typeof env.sunIntensity === 'number')) {
    lights.push({
      type: 'DirectionalLight',
      color: env.sunColor ?? '#fffaf0',
      intensity: typeof env.sunIntensity === 'number' ? env.sunIntensity : 0.85,
      position: { x: -80, y: 160, z: 90 },
      castShadow: true,
      shadowMapSize: 2048,
      shadowBias: -0.00015,
      shadowNormalBias: 0.025,
      shadowRadius: 2,
      shadowCameraSize: 120,
    });
  }
  return lights;
};

export const pixlSceneToWesScene = (scene: PixlSceneDocument): SceneJSON => {
  const sceneObjects = flattenPixlSceneObjects(scene.rootObjects);
  const roots = getRoots(sceneObjects);
  const authoredDirectionalLight = hasAuthoredDirectionalLight(sceneObjects);
  const authoredSkySun = getAuthoredSkySun(sceneObjects);
  const gameObjects = roots.map((root) => (
    buildGameObjectJSON(root, getChildren(root.id, sceneObjects), sceneObjects)
  ));

  return {
    background: scene.environment?.background,
    sky: scene.kind === '3d' ? {
      enabled: true,
      textureUrl: DEFAULT_THREE_SKYBOX_TEXTURE_URL,
      horizonColor: scene.environment?.background ?? '#bfe0f4',
      zenithColor: '#6ea8dc',
      groundColor: '#6f855d',
      sun: authoredSkySun,
    } : { enabled: false },
    gravity: triplet(scene.physics?.gravity),
    gameObjects,
    lights: synthesizeEnvironmentLights(scene.environment, { includeDirectional: !authoredDirectionalLight }),
    camera: getRuntimeCamera(scene, sceneObjects),
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
