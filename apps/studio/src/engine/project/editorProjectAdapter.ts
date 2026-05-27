import type { TemplateId } from '@/stores/gameStore';
import type { ObjectType, SceneObject } from '@/stores/editorStore';
import {
  AnyPixlProjectDocument,
  DEFAULT_PROJECT_FOLDERS,
  PIXL_PROJECT_FORMAT,
  PIXL_PROJECT_VERSION,
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

export interface EditorProjectSnapshot {
  currentTemplateId: TemplateId | null;
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

const buildComponentsFromEditorObject = (object: SceneObject): PixlComponentInstance[] => (
  [
    componentFromSettings('pixl.visual', object.visualSettings),
    componentFromSettings('pixl.physics', object.physicsSettings),
    componentFromSettings('pixl.logic', object.logicSettings),
    componentFromSettings('pixl.entity', object.entitySettings),
    componentFromSettings('pixl.light3d', object.lightSettings),
    componentFromSettings('pixl.camera3d', object.cameraSettings),
    componentFromSettings('pixl.player', object.playerSettings),
    scriptComponentFromInstances(object.scriptInstances),
    componentFromSettings('pixl.animation', object.animationSettings),
    componentFromSettings('pixl.audio', object.audioSettings),
    componentFromSettings('pixl.particles', object.particleSettings),
    componentFromSettings('pixl.terrain', object.terrainSettings),
  ].filter(Boolean) as PixlComponentInstance[]
);

const mergeEditorComponents = (object: SceneObject): PixlComponentInstance[] => {
  const byType = new Map<string, PixlComponentInstance>();

  for (const component of object.components ?? []) {
    byType.set(component.type, cloneJson(component));
  }

  for (const component of buildComponentsFromEditorObject(object)) {
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

export const editorObjectToSceneObject = (object: SceneObject): PixlSceneObject => {
  const components = mergeEditorComponents(object);

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

const buildSceneObjectTree = (objects: SceneObject[]): PixlSceneObject[] => {
  const editorObjectsById = new Map(objects.map((object) => [object.id, object]));
  const sceneObjectsById = new Map(objects.map((object) => [object.id, editorObjectToSceneObject(object)]));
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

const collectAssetEntries = (objects: SceneObject[]): PixlAssetEntry[] => {
  const entries = new Map<string, PixlAssetEntry>();

  objects.forEach((object) => {
    const modelUrl = object.animationSettings?.modelUrl;
    if (modelUrl && !entries.has(modelUrl)) {
      entries.set(modelUrl, {
        id: `asset-${entries.size + 1}`,
        name: object.name,
        kind: 'model',
        path: modelUrl,
        url: modelUrl,
        tags: ['scene'],
        metadata: {
          sourceObjectId: object.id,
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
        name: object.name,
        kind: isSpritesheet ? 'spritesheet' : 'image',
        path: imageUrl,
        url: imageUrl,
        tags: [...(object.logicSettings?.tags ?? [])],
        metadata: {
          sourceObjectId: object.id,
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
    rootObjects: buildSceneObjectTree(state.objects),
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
      templateId: state.currentTemplateId,
      script: state.gameScript || '// Game Script\n',
    },
  };
};

export const normalizeProjectDocument = (document: AnyPixlProjectDocument): PixlProjectDocument => {
  if (isPixlProjectDocument(document)) return document;

  if (!isLegacyPixlProjectDocument(document)) {
    throw new Error('Arquivo de projeto PixlPlayground invalido.');
  }

  return createProjectDocumentFromEditorState({
    currentTemplateId: document.currentTemplateId as TemplateId | null,
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

  const projectAssets = project.assets.entries
    .filter((asset) => Boolean(ASSET_KIND_TO_PROJECT_TYPE[asset.kind]))
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
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
      metadata: asset.metadata,
    }));

  return {
    currentTemplateId: project.game.templateId as TemplateId | null,
    gameScript: project.game.script || '// Game Script\n',
    transformSpace: project.editor.transformSpace || 'world',
    snapEnabled: project.editor.snapEnabled ?? false,
    snapTranslate: project.editor.snapTranslate ?? 1,
    snapRotate: project.editor.snapRotate ?? 15,
    snapScale: project.editor.snapScale ?? 0.25,
    activeSceneKind: scene.kind,
    objects: flattenSceneObjectsForEditor(scene.rootObjects),
    projectAssets,
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
    currentTemplateId: snapshot.currentTemplateId,
    gameScript: snapshot.gameScript,
    transformSpace: snapshot.transformSpace,
    snapEnabled: snapshot.snapEnabled,
    snapTranslate: snapshot.snapTranslate,
    snapRotate: snapshot.snapRotate,
    snapScale: snapshot.snapScale,
    objects: cloneJson(snapshot.objects),
  };
};
