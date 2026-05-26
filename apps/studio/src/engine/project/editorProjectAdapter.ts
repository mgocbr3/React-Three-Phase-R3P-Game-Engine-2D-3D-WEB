import type { ObjectType, SceneObject } from '@/stores/editorStore';
import {
  AnyPixlProjectDocument,
  DEFAULT_PROJECT_FOLDERS,
  PIXL_PROJECT_FORMAT,
  PIXL_PROJECT_VERSION,
  PixlAssetEntry,
  PixlComponentInstance,
  PixlProjectDocument,
  PixlSceneDocument,
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
]);

export interface EditorProjectSnapshot {
  gameScript: string;
  transformSpace: string;
  snapEnabled: boolean;
  snapTranslate: number;
  snapRotate: number;
  snapScale: number;
  objects: SceneObject[];
  projectAssets: Array<{
    id: string;
    name: string;
    type: 'model' | 'texture' | 'audio' | 'script';
    url: string;
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

export const editorObjectToSceneObject = (object: SceneObject): PixlSceneObject => {
  const components = [
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
  ].filter(Boolean) as PixlComponentInstance[];

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
    data: editorMetadataFromObject(object),
  };
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

const collectAssetEntries = (objects: SceneObject[]): PixlAssetEntry[] => {
  const entries = new Map<string, PixlAssetEntry>();

  objects.forEach((object) => {
    const modelUrl = object.animationSettings?.modelUrl;
    if (!modelUrl || entries.has(modelUrl)) return;

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
  });

  return [...entries.values()];
};

export const createProjectDocumentFromEditorState = (
  state: Omit<EditorProjectSnapshot, 'projectAssets'>,
  options: CreateProjectFromEditorOptions = {},
): PixlProjectDocument => {
  const now = options.savedAt ?? Date.now();
  const sceneId = 'main';
  const name = options.name?.trim() || 'Untitled Project';

  const scene: PixlSceneDocument = {
    id: sceneId,
    name: 'Main',
    kind: '3d',
    units: 'meters',
    rootObjects: state.objects.map(editorObjectToSceneObject),
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
      engine: 'rapier',
      gravity: [0, -9.81, 0],
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
      primary: 'three-3d',
      renderers: ['three'],
      physics: ['rapier'],
    },
    activeSceneId: sceneId,
    scenes: [scene],
    assets: {
      root: 'Assets',
      folders: [...DEFAULT_PROJECT_FOLDERS],
      entries: collectAssetEntries(state.objects),
    },
    editor: {
      mode: '3d',
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

export const normalizeProjectDocument = (document: AnyPixlProjectDocument): PixlProjectDocument => {
  if (isPixlProjectDocument(document)) return document;

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

  const projectAssets = project.assets.entries
    .filter((asset) => ['model', 'texture', 'audio', 'script'].includes(asset.kind))
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      type: asset.kind as 'model' | 'texture' | 'audio' | 'script',
      url: asset.url || asset.path,
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
    gameScript: project.game.script || '// Game Script\n',
    transformSpace: project.editor.transformSpace || 'world',
    snapEnabled: project.editor.snapEnabled ?? false,
    snapTranslate: project.editor.snapTranslate ?? 1,
    snapRotate: project.editor.snapRotate ?? 15,
    snapScale: project.editor.snapScale ?? 0.25,
    objects: scene.rootObjects.map(sceneObjectToEditorObject),
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
    gameScript: snapshot.gameScript,
    transformSpace: snapshot.transformSpace,
    snapEnabled: snapshot.snapEnabled,
    snapTranslate: snapshot.snapTranslate,
    snapRotate: snapshot.snapRotate,
    snapScale: snapshot.snapScale,
    objects: cloneJson(snapshot.objects),
  };
};
