import type { ObjectType, SceneObject } from '@/stores/editorStore';
import {
  AnyPixlProjectDocument,
  DEFAULT_PROJECT_FOLDERS,
  PIXL_PROJECT_FORMAT,
  PIXL_PROJECT_VERSION,
  PIXL_2D_COMPONENT_TYPES,
  PIXL_3D_COMPONENT_TYPES,
  PIXL_SHARED_COMPONENT_TYPES,
  PixlAssetEntry,
  PixlAssetKind,
  PixlComponentInstance,
  PixlProjectDocument,
  PixlSceneDocument,
  PixlSceneKind,
  PixlSceneObject,
  PixlTransform,
  cloneJson,
  createPixlId,
  isLegacyPixlProjectDocument,
  isPixlProjectDocument,
} from './schema';

const VALID_OBJECT_TYPES = new Set<ObjectType>([
  'box',
  'sphere',
  'cylinder',
  'plane',
  'platform',
  'light',
  'sunlight',
  'spotlight',
  'npc',
  'ring',
  'group',
  'camera',
  'player',
  'terrain',
  'image',
  'sprite',
  'rectangle',
  'circle',
  'text',
]);

const PIXL_2D_COMPONENT_SET = new Set<string>(PIXL_2D_COMPONENT_TYPES);
const PIXL_3D_COMPONENT_SET = new Set<string>(PIXL_3D_COMPONENT_TYPES);
const PIXL_SHARED_COMPONENT_SET = new Set<string>(PIXL_SHARED_COMPONENT_TYPES);

const isSceneCompatibleComponent = (type: string, sceneKind: PixlSceneKind): boolean => {
  if (PIXL_SHARED_COMPONENT_SET.has(type)) return true;
  if (sceneKind === '2d') return !PIXL_3D_COMPONENT_SET.has(type);
  return !PIXL_2D_COMPONENT_SET.has(type);
};

export interface EditorProjectSnapshot {
  gameScript: string;
  transformSpace: string;
  snapEnabled: boolean;
  snapTranslate: number;
  snapRotate: number;
  snapScale: number;
  activeSceneKind?: PixlSceneKind;
  objects: SceneObject[];
  projectAssets: Array<{
    id: string;
    name: string;
    type: 'model' | 'texture' | 'image' | 'sprite' | 'spritesheet' | 'tilemap' | 'audio' | 'script';
    url: string;
    path?: string;
    thumbnail?: string;
    folder: string;
    createdAt: number;
    metadata?: Record<string, unknown>;
  }>;
}

interface CreateProjectFromEditorOptions {
  id?: string;
  name?: string;
  slug?: string;
  createdAt?: number;
  savedAt?: number;
  layoutPreset?: string;
}

const toVec3 = (value: unknown, fallback: [number, number, number]): [number, number, number] => {
  if (!Array.isArray(value)) return fallback;
  const x = Number(value[0]);
  const y = Number(value[1]);
  const z = Number(value[2]);
  return [
    Number.isFinite(x) ? x : fallback[0],
    Number.isFinite(y) ? y : fallback[1],
    Number.isFinite(z) ? z : fallback[2],
  ];
};

const safeObjectType = (type: unknown): ObjectType => (
  typeof type === 'string' && VALID_OBJECT_TYPES.has(type as ObjectType) ? type as ObjectType : 'box'
);

const objectTransform = (object: Partial<SceneObject>): PixlTransform => ({
  position: toVec3(object.position, [0, 0, 0]),
  rotation: toVec3(object.rotation, [0, 0, 0]),
  scale: toVec3(object.scale, [1, 1, 1]),
});

const componentFromSettings = (
  type: string,
  settings: unknown,
): PixlComponentInstance | null => {
  if (!settings) return null;
  return {
    id: createPixlId(type.replace(/[^a-z0-9]/gi, '-').toLowerCase()),
    type,
    enabled: true,
    data: cloneJson(settings as Record<string, unknown>),
  };
};

const buildComponentsFromEditorObject = (
  object: SceneObject,
  sceneKind: PixlSceneKind,
): PixlComponentInstance[] => {
  const common = [
    scriptComponentFromInstances(object.scriptInstances),
    componentFromSettings('pixl.audio', object.audioSettings),
  ];

  if (sceneKind === '2d') {
    return common.filter(Boolean) as PixlComponentInstance[];
  }

  return [
    componentFromSettings('pixl.visual', object.visualSettings),
    componentFromSettings('pixl.physics', object.physicsSettings),
    componentFromSettings('pixl.logic', object.logicSettings),
    componentFromSettings('pixl.entity', object.entitySettings),
    componentFromSettings('pixl.light3d', object.lightSettings),
    componentFromSettings('pixl.camera3d', object.cameraSettings),
    componentFromSettings('pixl.player', object.playerSettings),
    ...common,
    componentFromSettings('pixl.animation', object.animationSettings),
    componentFromSettings('pixl.particles', object.particleSettings),
    componentFromSettings('pixl.terrain', object.terrainSettings),
  ].filter(Boolean) as PixlComponentInstance[];
};

const mergeEditorComponents = (
  object: SceneObject,
  sceneKind: PixlSceneKind,
): PixlComponentInstance[] => {
  const byType = new Map<string, PixlComponentInstance>();

  for (const component of object.components ?? []) {
    if (!isSceneCompatibleComponent(component.type, sceneKind)) continue;
    byType.set(component.type, cloneJson(component));
  }

  for (const component of buildComponentsFromEditorObject(object, sceneKind)) {
    byType.set(component.type, component);
  }

  return [...byType.values()];
};

const scriptComponentFromInstances = (
  scriptInstances: SceneObject['scriptInstances'],
): PixlComponentInstance | null => {
  if (!scriptInstances?.length) return null;

  return {
    id: createPixlId('pixl-script'),
    type: 'pixl.script',
    enabled: true,
    data: {
      instances: cloneJson(scriptInstances),
    },
  };
};

const editorMetadataFromObject = (object: SceneObject): Record<string, unknown> | undefined => {
  const metadata: Record<string, unknown> = {};

  if (object.color) metadata.color = object.color;
  if (typeof object.isStatic === 'boolean') metadata.isStatic = object.isStatic;
  if (typeof object.emissive === 'boolean') metadata.emissive = object.emissive;

  return Object.keys(metadata).length ? { editor: metadata } : undefined;
};

const sceneDataFromEditorObject = (object: SceneObject): Record<string, unknown> | undefined => {
  const data = object.data ? cloneJson(object.data) : {};
  delete data.editorObject;
  delete data.editor;

  const metadata = editorMetadataFromObject(object);
  const merged = {
    ...data,
    ...(metadata ?? {}),
  };

  return Object.keys(merged).length ? merged : undefined;
};

const editorDataFromSceneObject = (object: PixlSceneObject): Record<string, unknown> | undefined => {
  const data = object.data ? cloneJson(object.data) : {};
  delete data.editorObject;
  delete data.editor;
  return Object.keys(data).length ? data : undefined;
};

export const editorObjectToSceneObject = (
  object: SceneObject,
  sceneKind: PixlSceneKind,
): PixlSceneObject => {
  const components = mergeEditorComponents(object, sceneKind);

  return {
    id: object.id,
    name: object.name,
    type: object.type,
    parentId: object.parentId ?? null,
    transform: objectTransform(object),
    visible: object.visible !== false,
    locked: Boolean(object.locked),
    tags: object.logicSettings?.tags ? [...object.logicSettings.tags] : [],
    components,
    data: sceneDataFromEditorObject(object),
  };
};

const wouldCreateParentCycle = (
  objectId: string,
  parentId: string,
  objectsById: Map<string, SceneObject>,
): boolean => {
  let current = objectsById.get(parentId);
  let guard = 0;

  while (current && guard <= objectsById.size) {
    if (current.id === objectId) return true;
    if (!current.parentId) return false;
    current = objectsById.get(current.parentId);
    guard += 1;
  }

  return false;
};

const buildSceneObjectTree = (
  objects: SceneObject[],
  sceneKind: PixlSceneKind,
): PixlSceneObject[] => {
  const editorObjectsById = new Map(objects.map((object) => [object.id, object]));
  const sceneObjectsById = new Map(objects.map((object) => [object.id, editorObjectToSceneObject(object, sceneKind)]));
  const roots: PixlSceneObject[] = [];

  for (const object of objects) {
    const sceneObject = sceneObjectsById.get(object.id);
    if (!sceneObject) continue;

    const parentId = object.parentId ?? null;
    const parent = parentId ? sceneObjectsById.get(parentId) : undefined;
    const canAttachToParent = Boolean(
      parentId &&
      parent &&
      !wouldCreateParentCycle(object.id, parentId, editorObjectsById),
    );

    if (!canAttachToParent) {
      sceneObject.parentId = null;
      roots.push(sceneObject);
      continue;
    }

    sceneObject.parentId = parentId;
    parent!.children = [...(parent!.children ?? []), sceneObject];
  }

  return roots;
};

const componentData = (
  object: PixlSceneObject,
  type: string,
): Record<string, unknown> | undefined => {
  const component = object.components?.find((item) => item.type === type);
  return component ? cloneJson(component.data) : undefined;
};

const typedComponentData = <T,>(
  object: PixlSceneObject,
  type: string,
): T | undefined => componentData(object, type) as unknown as T | undefined;

const scriptInstancesFromComponent = (
  object: PixlSceneObject,
): SceneObject['scriptInstances'] | undefined => {
  const scriptData = componentData(object, 'pixl.script');
  const instances = scriptData?.instances;

  return Array.isArray(instances) ? cloneJson(instances) as SceneObject['scriptInstances'] : undefined;
};

export const sceneObjectToEditorObject = (object: PixlSceneObject): SceneObject => {
  const editorMetadata = object.data?.editor as Partial<Pick<SceneObject, 'color' | 'isStatic' | 'emissive'>> | undefined;
  const restored: SceneObject = {
    id: object.id,
    name: object.name,
    type: safeObjectType(object.type),
    position: toVec3(object.transform?.position, [0, 0, 0]),
    rotation: toVec3(object.transform?.rotation, [0, 0, 0]),
    scale: toVec3(object.transform?.scale, [1, 1, 1]),
    color: editorMetadata?.color ?? '#ffffff',
    visible: object.visible !== false,
    locked: Boolean(object.locked),
    parentId: object.parentId ?? null,
    components: cloneJson(object.components ?? []),
    data: editorDataFromSceneObject(object),
    isStatic: editorMetadata?.isStatic,
    emissive: editorMetadata?.emissive,
    visualSettings: typedComponentData<SceneObject['visualSettings']>(object, 'pixl.visual'),
    physicsSettings: typedComponentData<SceneObject['physicsSettings']>(object, 'pixl.physics'),
    logicSettings: typedComponentData<SceneObject['logicSettings']>(object, 'pixl.logic'),
    entitySettings: typedComponentData<SceneObject['entitySettings']>(object, 'pixl.entity'),
    lightSettings: typedComponentData<SceneObject['lightSettings']>(object, 'pixl.light3d'),
    cameraSettings: typedComponentData<SceneObject['cameraSettings']>(object, 'pixl.camera3d'),
    playerSettings: typedComponentData<SceneObject['playerSettings']>(object, 'pixl.player'),
    scriptInstances: scriptInstancesFromComponent(object),
    animationSettings: typedComponentData<SceneObject['animationSettings']>(object, 'pixl.animation'),
    audioSettings: typedComponentData<SceneObject['audioSettings']>(object, 'pixl.audio'),
    particleSettings: typedComponentData<SceneObject['particleSettings']>(object, 'pixl.particles'),
    terrainSettings: typedComponentData<SceneObject['terrainSettings']>(object, 'pixl.terrain'),
  };
  restored.isStatic = restored.isStatic ?? restored.physicsSettings?.bodyType === 'fixed';

  return restored;
};

const flattenSceneObjectsForEditor = (objects: PixlSceneObject[]): SceneObject[] => {
  const flattened: SceneObject[] = [];
  const seen = new Set<string>();

  const visit = (object: PixlSceneObject, parentId: string | null) => {
    if (seen.has(object.id)) return;
    seen.add(object.id);

    const effectiveParentId = object.parentId ?? parentId;
    const objectWithoutChildren = { ...object };
    delete objectWithoutChildren.children;
    flattened.push(sceneObjectToEditorObject({
      ...objectWithoutChildren,
      parentId: effectiveParentId,
    }));

    for (const child of object.children ?? []) {
      visit(child, object.id);
    }
  };

  for (const object of objects) {
    visit(object, null);
  }

  return flattened;
};

const ASSET_KIND_TO_PROJECT_TYPE: Partial<Record<PixlAssetKind, EditorProjectSnapshot['projectAssets'][number]['type']>> = {
  model: 'model',
  texture: 'texture',
  image: 'image',
  sprite: 'sprite',
  spritesheet: 'spritesheet',
  tilemap: 'tilemap',
  audio: 'audio',
  script: 'script',
};

const getAssetEntryFileName = (asset: PixlAssetEntry): string => {
  const source = asset.path || asset.url || asset.name;
  const cleanSource = source.split(/[?#]/)[0];
  return cleanSource.split(/[\\/]/).pop() || asset.name;
};

const getAssetEntryDisplayName = (asset: PixlAssetEntry): string => (
  typeof asset.metadata?.sourceObjectId === 'string'
    ? getAssetEntryFileName(asset)
    : asset.name
);

const withUniqueProjectAssetIds = (
  assets: EditorProjectSnapshot['projectAssets'],
): EditorProjectSnapshot['projectAssets'] => {
  const seen = new Map<string, number>();
  return assets.map((asset) => {
    const count = seen.get(asset.id) ?? 0;
    seen.set(asset.id, count + 1);
    if (count === 0) return asset;
    return {
      ...asset,
      id: `${asset.id}-${count + 1}`,
    };
  });
};

const collectAssetEntries = (objects: SceneObject[]): PixlAssetEntry[] => {
  const entries = new Map<string, PixlAssetEntry>();
  const assetNameFromPath = (assetPath: string, fallback: string): string => {
    const cleanPath = assetPath.split(/[?#]/)[0];
    return cleanPath.split(/[\\/]/).pop() || fallback;
  };

  objects.forEach((object) => {
    const modelUrl = object.animationSettings?.modelUrl;
    if (modelUrl && !entries.has(modelUrl)) {
      entries.set(modelUrl, {
        id: `asset-${entries.size + 1}`,
        name: assetNameFromPath(modelUrl, object.name),
        kind: 'model',
        path: modelUrl,
        url: modelUrl,
        tags: ['scene'],
        metadata: {
          sourceObjectId: object.id,
          sourceObjectName: object.name,
        },
      });
    }

    const imageUrl = typeof object.data?.imageUrl === 'string'
      ? object.data.imageUrl
      : typeof object.data?.url === 'string'
        ? object.data.url
        : undefined;
    if (imageUrl && !entries.has(imageUrl)) {
      const isSpritesheet = object.type === 'sprite' && (
        typeof object.data?.frameWidth === 'number' ||
        typeof object.data?.frameHeight === 'number'
      );
      entries.set(imageUrl, {
        id: `asset-${entries.size + 1}`,
        name: assetNameFromPath(imageUrl, object.name),
        kind: isSpritesheet ? 'spritesheet' : 'image',
        path: imageUrl,
        url: imageUrl,
        tags: [...(object.logicSettings?.tags ?? [])],
        metadata: {
          sourceObjectId: object.id,
          sourceObjectName: object.name,
        },
      });
    }
  });

  return [...entries.values()];
};

const runtimeForSceneKind = (kind: PixlSceneKind) => {
  if (kind === '3d') {
    return {
      primary: 'three-3d' as const,
      renderers: ['three' as const],
      physics: ['rapier' as const],
      units: 'meters' as const,
      physicsEngine: 'rapier' as const,
      gravity: [0, -9.81, 0] as [number, number, number],
    };
  }

  return {
    primary: 'phaser-2d' as const,
    renderers: ['phaser' as const],
    physics: ['arcade' as const],
    units: 'pixels' as const,
    physicsEngine: 'arcade' as const,
    gravity: [0, 980, 0] as [number, number, number],
  };
};

export const createProjectDocumentFromEditorState = (
  state: Omit<EditorProjectSnapshot, 'projectAssets'>,
  options: CreateProjectFromEditorOptions = {},
): PixlProjectDocument => {
  const now = options.savedAt ?? Date.now();
  const sceneId = 'main';
  const name = options.name?.trim() || 'Untitled Project';
  const sceneKind = state.activeSceneKind ?? '3d';
  const runtime = runtimeForSceneKind(sceneKind);

  const scene: PixlSceneDocument = {
    id: sceneId,
    name: 'Main',
    kind: sceneKind,
    units: runtime.units,
    rootObjects: buildSceneObjectTree(state.objects, sceneKind),
    camera: {
      id: 'editor-camera',
      name: 'Editor Camera',
      position: [14, 10, 14],
      target: [0, 0, 0],
      fov: 50,
      near: 0.1,
      far: 1000,
    },
    environment: {
      background: '#87ceeb',
      ambientLight: '#ffffff',
      ambientIntensity: 0.7,
      sunColor: '#fffaf0',
      sunIntensity: 0.8,
    },
    physics: {
      engine: runtime.physicsEngine,
      gravity: runtime.gravity,
    },
  };

  return {
    format: PIXL_PROJECT_FORMAT,
    version: PIXL_PROJECT_VERSION,
    id: options.id ?? createPixlId('project'),
    slug: options.slug ?? (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled-project'),
    name,
    createdAt: options.createdAt ?? now,
    savedAt: now,
    engine: {
      name: 'PixlPlayground',
      version: '0.1.0',
      schemaVersion: PIXL_PROJECT_VERSION,
    },
    runtime: {
      primary: runtime.primary,
      renderers: [...runtime.renderers],
      physics: [...runtime.physics],
    },
    activeSceneId: sceneId,
    scenes: [scene],
    assets: {
      root: 'Assets',
      folders: [...DEFAULT_PROJECT_FOLDERS],
      entries: collectAssetEntries(state.objects),
    },
    editor: {
      mode: sceneKind,
      transformSpace: state.transformSpace || 'world',
      snapEnabled: state.snapEnabled ?? false,
      snapTranslate: state.snapTranslate ?? 1,
      snapRotate: state.snapRotate ?? 15,
      snapScale: state.snapScale ?? 0.25,
      selectedSceneId: sceneId,
      layoutPreset: options.layoutPreset ?? 'default',
    },
    game: {
      // templateId is preserved as null on new writes — the field is
      // deprecated and ignored by the editor. Older project files that
      // had a templateId still load (normalizeProjectDocument drops it).
      templateId: null,
      script: state.gameScript || '// Game Script\n',
    },
  };
};

const normalizeSceneObject = (object: Partial<PixlSceneObject>): PixlSceneObject => ({
  id: object.id || createPixlId('object'),
  name: object.name || 'Object',
  type: object.type || 'group',
  parentId: object.parentId ?? null,
  transform: {
    position: toVec3(object.transform?.position, [0, 0, 0]),
    rotation: toVec3(object.transform?.rotation, [0, 0, 0]),
    scale: toVec3(object.transform?.scale, [1, 1, 1]),
  },
  visible: object.visible !== false,
  locked: Boolean(object.locked),
  tags: Array.isArray(object.tags) ? [...object.tags] : [],
  components: (object.components ?? []).map((component) => ({
    id: component.id || createPixlId(component.type || 'component'),
    type: component.type || 'pixl.component',
    enabled: component.enabled !== false,
    data: cloneJson(component.data ?? {}),
  })),
  data: object.data ? cloneJson(object.data) : undefined,
  children: object.children?.map(normalizeSceneObject),
});

const STARTER_TEMPLATE_IDS = new Set(['first-person', 'third-person']);

const isLegacyStarterVec3 = (
  value: [number, number, number],
  expected: [number, number, number],
) => value.every((axis, index) => Math.abs(axis - expected[index]) < 0.0001);

const isPixllandStarterTemplate = (templateId: string | null | undefined) => (
  Boolean(templateId && STARTER_TEMPLATE_IDS.has(templateId))
);

const hasPixllandStarterModel = (object: PixlSceneObject): boolean => (
  object.components?.some((component) => {
    if (component.type !== 'pixl.mesh' && component.type !== 'pixl.animation') return false;
    const modelUrl = component.data?.modelUrl ?? component.data?.assetPath;
    return typeof modelUrl === 'string' && modelUrl.includes('/models/manequin/mixamo/');
  }) ?? false
);

const upgradeStarterSceneObject = (
  object: PixlSceneObject,
  templateId: string | null | undefined,
): PixlSceneObject => {
  const children = object.children?.map((child) => upgradeStarterSceneObject(child, templateId));
  const starterTemplate = isPixllandStarterTemplate(templateId);
  const legacyStarterGround = object.id === 'ground-1' && isLegacyStarterVec3(object.transform.scale, [72, 0.2, 72]);
  const legacyStarterPlayer = object.id === 'main-player' && hasPixllandStarterModel(object);
  if (!starterTemplate && !legacyStarterGround && !legacyStarterPlayer) {
    return children ? { ...object, children } : object;
  }

  if (legacyStarterGround) {
    return {
      ...object,
      transform: {
        ...object.transform,
        scale: [160, 0.2, 160],
      },
      components: object.components?.map((component) => {
        if (component.type !== 'pixl.physics') return component;
        const data = cloneJson(component.data ?? {});
        if (Array.isArray(data.colliders)) {
          data.colliders = data.colliders.map((collider) => {
            if (
              collider
              && typeof collider === 'object'
              && (collider as { type?: unknown }).type === 'cuboid'
              && (collider as { hx?: unknown }).hx === 36
              && (collider as { hz?: unknown }).hz === 36
            ) {
              return { ...collider, hx: 80, hz: 80 };
            }
            return collider;
          });
        }
        return { ...component, data };
      }),
      children,
    };
  }

  if (legacyStarterPlayer) {
    return {
      ...object,
      components: object.components?.map((component) => {
        if (component.type !== 'pixl.entity') return component;
        const data = cloneJson(component.data ?? {});
        const rotation = data.modelRotationOffset;
        if (Array.isArray(rotation) && isLegacyStarterVec3(rotation as [number, number, number], [0, 0, 0])) {
          data.modelRotationOffset = [0, Math.PI, 0];
        }
        return { ...component, data };
      }),
      children,
    };
  }

  return children ? { ...object, children } : object;
};

const normalizeModernProjectDocument = (document: PixlProjectDocument): PixlProjectDocument => {
  const firstSceneKind = document.scenes[0]?.kind === '2d' ? '2d' : '3d';
  const runtime = runtimeForSceneKind(firstSceneKind);
  const activeSceneId = document.activeSceneId || document.scenes[0]?.id || 'main';
  const scenes = (document.scenes.length ? document.scenes : [{
    id: activeSceneId,
    name: 'Main',
    kind: firstSceneKind,
    rootObjects: [],
  } as Partial<PixlSceneDocument>]).map((scene) => {
    const kind = scene.kind === '2d' ? '2d' : '3d';
    const sceneRuntime = runtimeForSceneKind(kind);
    return {
      ...scene,
      id: scene.id || activeSceneId,
      name: scene.name || 'Main',
      kind,
      units: scene.units ?? sceneRuntime.units,
      rootObjects: (scene.rootObjects ?? [])
        .map(normalizeSceneObject)
        .map((object) => upgradeStarterSceneObject(object, document.game?.templateId)),
      camera: {
        ...scene.camera,
        id: scene.camera?.id ?? 'editor-camera',
        name: scene.camera?.name ?? 'Editor Camera',
        position: toVec3(scene.camera?.position, kind === '2d' ? [0, 0, 0] : [14, 10, 14]),
        target: toVec3(scene.camera?.target, [0, 0, 0]),
        fov: scene.camera?.fov ?? 50,
        near: scene.camera?.near ?? 0.1,
        far: scene.camera?.far ?? 1000,
      },
      environment: {
        ...scene.environment,
        background: scene.environment?.background ?? (kind === '2d' ? '#a8a8a8' : '#87ceeb'),
        ambientLight: scene.environment?.ambientLight ?? '#ffffff',
        ambientIntensity: scene.environment?.ambientIntensity ?? 0.7,
        sunColor: scene.environment?.sunColor ?? '#fffaf0',
        sunIntensity: scene.environment?.sunIntensity ?? 0.8,
      },
      physics: {
        ...scene.physics,
        engine: scene.physics?.engine ?? sceneRuntime.physicsEngine,
        gravity: toVec3(scene.physics?.gravity, sceneRuntime.gravity),
      },
    } as PixlSceneDocument;
  });

  return {
    format: PIXL_PROJECT_FORMAT,
    version: PIXL_PROJECT_VERSION,
    id: document.id || createPixlId('project'),
    slug: document.slug || document.id || 'untitled-project',
    name: document.name || 'Untitled Project',
    createdAt: document.createdAt ?? document.savedAt ?? 0,
    savedAt: document.savedAt ?? document.createdAt ?? 0,
    engine: {
      name: 'PixlPlayground',
      version: document.engine?.version ?? '0.2.0',
      schemaVersion: PIXL_PROJECT_VERSION,
      runtimeManifest: document.engine?.runtimeManifest,
    },
    runtime: {
      primary: document.runtime?.primary ?? runtime.primary,
      renderers: document.runtime?.renderers?.length ? [...document.runtime.renderers] : [...runtime.renderers],
      physics: document.runtime?.physics?.length ? [...document.runtime.physics] : [...runtime.physics],
    },
    activeSceneId,
    scenes,
    assets: {
      root: document.assets?.root ?? 'Assets',
      folders: document.assets?.folders?.length ? [...document.assets.folders] : [...DEFAULT_PROJECT_FOLDERS],
      entries: document.assets?.entries?.map((asset) => cloneJson(asset)) ?? [],
    },
    editor: {
      mode: document.editor?.mode ?? firstSceneKind,
      transformSpace: document.editor?.transformSpace ?? 'world',
      snapEnabled: document.editor?.snapEnabled ?? false,
      snapTranslate: document.editor?.snapTranslate ?? 1,
      snapRotate: document.editor?.snapRotate ?? 15,
      snapScale: document.editor?.snapScale ?? 0.25,
      selectedSceneId: document.editor?.selectedSceneId ?? activeSceneId,
      layoutPreset: document.editor?.layoutPreset ?? 'default',
    },
    game: {
      templateId: document.game?.templateId ?? null,
      script: document.game?.script ?? '// Game Script\n',
      source: document.game?.source,
    },
    integrations: document.integrations ? cloneJson(document.integrations) : undefined,
  };
};

export const normalizeProjectDocument = (document: AnyPixlProjectDocument): PixlProjectDocument => {
  if (isPixlProjectDocument(document)) return normalizeModernProjectDocument(document);

  if (!isLegacyPixlProjectDocument(document)) {
    throw new Error('Arquivo de projeto PixlPlayground invalido.');
  }

  return createProjectDocumentFromEditorState({
    gameScript: document.gameScript || '// Game Script\n',
    transformSpace: document.transformSpace || 'world',
    snapEnabled: document.snapEnabled ?? false,
    snapTranslate: document.snapTranslate ?? 1,
    snapRotate: document.snapRotate ?? 15,
    snapScale: document.snapScale ?? 0.25,
    objects: document.objects as SceneObject[],
  }, {
    id: document.id,
    name: document.name,
    createdAt: document.savedAt,
    savedAt: document.savedAt,
  });
};

export const createEditorSnapshotFromProjectDocument = (
  document: AnyPixlProjectDocument,
): EditorProjectSnapshot => {
  const project = normalizeProjectDocument(document);
  const scene = project.scenes.find((item) => item.id === project.activeSceneId) ?? project.scenes[0];

  if (!scene) {
    throw new Error('Projeto PixlPlayground sem cena ativa.');
  }

  const objects = flattenSceneObjectsForEditor(scene.rootObjects);
  const objectNameById = new Map(objects.map((object) => [object.id, object.name]));
  const projectAssets = project.assets.entries
    .filter((asset) => Boolean(ASSET_KIND_TO_PROJECT_TYPE[asset.kind]))
    .map((asset) => {
      const sourceObjectId = typeof asset.metadata?.sourceObjectId === 'string'
        ? asset.metadata.sourceObjectId
        : null;
      const sourceObjectName = sourceObjectId ? objectNameById.get(sourceObjectId) : undefined;
      return {
        id: asset.id,
        name: getAssetEntryDisplayName(asset),
        type: ASSET_KIND_TO_PROJECT_TYPE[asset.kind]!,
        url: asset.url || asset.path,
        path: asset.path,
        thumbnail: typeof asset.metadata?.thumbnail === 'string'
          ? asset.metadata.thumbnail
          : typeof asset.metadata?.thumbnailUrl === 'string'
            ? asset.metadata.thumbnailUrl
            : undefined,
        folder: asset.path.includes('/') ? asset.path.split('/').slice(0, -1).join('/') : project.assets.root,
        createdAt: project.createdAt,
        metadata: {
          ...(asset.metadata ?? {}),
          ...(sourceObjectName && typeof asset.metadata?.sourceObjectName !== 'string'
            ? { sourceObjectName }
            : {}),
        },
      };
    });

  return {
    gameScript: project.game.script || '// Game Script\n',
    transformSpace: project.editor.transformSpace || 'world',
    snapEnabled: project.editor.snapEnabled ?? false,
    snapTranslate: project.editor.snapTranslate ?? 1,
    snapRotate: project.editor.snapRotate ?? 15,
    snapScale: project.editor.snapScale ?? 0.25,
    activeSceneKind: scene.kind,
    objects,
    projectAssets: withUniqueProjectAssetIds(projectAssets),
  };
};

export const createLegacyEditorSave = (
  document: AnyPixlProjectDocument,
) => {
  const project = normalizeProjectDocument(document);
  const snapshot = createEditorSnapshotFromProjectDocument(project);

  return {
    version: 1,
    savedAt: project.savedAt,
    gameScript: snapshot.gameScript,
    transformSpace: snapshot.transformSpace,
    snapEnabled: snapshot.snapEnabled,
    snapTranslate: snapshot.snapTranslate,
    snapRotate: snapshot.snapRotate,
    snapScale: snapshot.snapScale,
    objects: cloneJson(snapshot.objects),
  };
};
