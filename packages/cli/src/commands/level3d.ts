import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  PIXL_PROJECT_FORMAT,
  PIXL_PROJECT_VERSION,
  type PixlProjectShape,
  type PixlSceneObjectShape,
  type PixlSceneShape,
} from '../schema.js';
import { shortId } from '../lib/ids.js';

export interface Level3DAsset {
  key: string;
  label: string;
  kind: string;
  url: string;
}

export interface Level3DObject {
  id: string;
  name: string;
  assetKey: string;
  layer?: string;
  collider?: string;
  editable?: boolean;
  source?: {
    assetUrl?: string;
    nodeName?: string;
    nodeIndex?: number;
    meshIndex?: number;
    prefix?: string;
    runtimeConstant?: string;
  };
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
}

export interface Level3DDocument {
  schema: 'pixlland.level3d.v1';
  game: string;
  engineTarget?: string;
  sourceScene?: string;
  notes?: string;
  editorMap?: Record<string, unknown>;
  world?: Record<string, unknown>;
  camera?: {
    position?: [number, number, number];
    target?: [number, number, number];
  };
  assetLibrary: Level3DAsset[];
  objects: Level3DObject[];
}

const LEVEL3D_SCHEMA = 'pixlland.level3d.v1';

export interface ImportLevel3DOptions {
  name?: string;
  slug?: string;
  assetBaseUrl?: string;
  now?: number;
  projectId?: string;
}

const joinUrl = (base: string | undefined, url: string): string => {
  if (!base) return url;
  return `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
};

const buildSceneObject = (
  object: Level3DObject,
  asset: Level3DAsset | undefined,
  assetBaseUrl?: string,
): PixlSceneObjectShape => {
  const modelUrl = asset ? joinUrl(assetBaseUrl, asset.url) : '';
  const layer = object.layer ?? 'scene';
  const collider = object.collider ?? 'auto';

  return {
    id: object.id,
    name: object.name,
    type: 'mesh',
    parentId: null,
    transform: {
      position: object.transform.position,
      rotation: object.transform.rotation,
      scale: object.transform.scale,
    },
    visible: object.editable !== false,
    locked: false,
    tags: ['level3d', layer, asset?.kind ?? 'unknown'],
    components: [
      {
        id: shortId('mesh'),
        type: 'pixl.mesh',
        enabled: true,
        data: { modelUrl, assetKey: object.assetKey },
      },
      {
        id: shortId('physics'),
        type: 'pixl.physics',
        enabled: true,
        data: {
          bodyType: 'fixed',
          colliderShape: collider === 'none' ? 'cuboid' : 'auto',
          isSensor: collider === 'none',
        },
      },
      {
        id: shortId('logic'),
        type: 'pixl.logic',
        enabled: true,
        data: {
          tags: ['level3d', layer],
          customData: {
            assetKey: object.assetKey,
            sourceLayer: layer,
            sourceCollider: object.collider,
            sourceEditable: object.editable,
            sourceAsset: object.source?.assetUrl,
            sourceNodeName: object.source?.nodeName,
            sourceNodeIndex: object.source?.nodeIndex,
            sourceMeshIndex: object.source?.meshIndex,
            sourcePrefix: object.source?.prefix,
            runtimeConstant: object.source?.runtimeConstant,
            editableGlbPart: Boolean(object.source?.nodeName),
          },
        },
      },
    ],
  };
};

export const importLevel3DToProject = (
  level: Level3DDocument,
  options: ImportLevel3DOptions = {},
): PixlProjectShape => {
  if (level.schema !== LEVEL3D_SCHEMA) {
    throw new Error(`Schema desconhecido: "${level.schema}". Esperado "${LEVEL3D_SCHEMA}".`);
  }
  const projectId = options.projectId ?? `project_${randomUUID()}`;
  const name = options.name ?? level.game;
  const slug = options.slug ?? level.game;
  const sceneId = `${level.game}-main`;
  const assetByKey = new Map(level.assetLibrary.map((asset) => [asset.key, asset]));

  const rootObjects = level.objects.map((object) =>
    buildSceneObject(object, assetByKey.get(object.assetKey), options.assetBaseUrl),
  );

  const scene: PixlSceneShape = {
    id: sceneId,
    name: 'Main',
    kind: '3d',
    rootObjects,
    camera: {
      id: 'main-camera',
      name: 'Main Camera',
      position: level.camera?.position ?? [10, 10, 10],
      target: level.camera?.target ?? [0, 0, 0],
    },
    environment: { background: '#9fd5df', ambientLight: '#ffffff', sunColor: '#fffaf0' },
    physics: { engine: 'rapier', gravity: [0, -9.81, 0] },
    metadata: {
      originalSchema: level.schema,
      originalGame: level.game,
      originalEngineTarget: level.engineTarget,
      originalSourceScene: level.sourceScene,
      originalNotes: level.notes,
      originalEditorMap: level.editorMap,
      originalWorld: level.world,
    },
  };

  return {
    format: PIXL_PROJECT_FORMAT,
    version: PIXL_PROJECT_VERSION,
    id: projectId,
    slug,
    name,
    activeSceneId: sceneId,
    scenes: [scene],
    assets: {
      root: 'Assets',
      folders: ['Assets/3D_Models'],
      entries: level.assetLibrary.map((asset) => ({
        id: asset.key,
        name: asset.label,
        kind: asset.kind === 'model' ? 'model' : 'texture',
        path: asset.url,
      })),
    },
    engine: { name: 'PixlPlayground', schemaVersion: 2 },
    runtime: { primary: 'three-3d' },
    game: {
      templateId: null,
      script: `// ${level.game}\n// Importado de level3d (${level.schema}).\n`,
    },
  };
};

const getComponentData = (object: PixlSceneObjectShape, type: string): Record<string, unknown> | undefined => {
  const component = object.components?.find((item) => item.type === type);
  return component?.data;
};

const getString = (value: unknown): string | undefined => (
  typeof value === 'string' && value.length > 0 ? value : undefined
);

const getNumber = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const normalizeAssetUrl = (value: unknown): string | undefined => {
  const url = getString(value);
  if (!url) return undefined;
  return url.replace(/^\/+/, '').replace(/^public\//, '');
};

const getModelUrl = (object: PixlSceneObjectShape): string | undefined => (
  getString(getComponentData(object, 'pixl.mesh')?.modelUrl) ??
  getString(getComponentData(object, 'pixl.animation')?.modelUrl)
);

export const exportProjectToLevel3D = (
  project: PixlProjectShape,
  sceneId?: string,
): Level3DDocument => {
  const targetSceneId = sceneId ?? project.activeSceneId;
  const scene = project.scenes.find((item) => item.id === targetSceneId);
  if (!scene) {
    throw new Error(`Cena "${targetSceneId}" nao encontrada no projeto.`);
  }
  if (scene.kind !== '3d') {
    throw new Error(`Cena "${targetSceneId}" nao e 3D (kind="${scene.kind}").`);
  }

  const metadata = scene.metadata ?? {};
  const assetEntries = (project.assets?.entries ?? [])
    .filter((entry) => entry.kind === 'model');
  const assetLibrary: Level3DAsset[] = assetEntries
    .map((entry) => ({
      key: entry.id,
      label: entry.name,
      kind: entry.kind,
      url: entry.url ?? entry.path,
    }));
  const assetKeyByUrl = new Map<string, string>();
  for (const entry of assetEntries) {
    for (const candidate of [
      entry.path,
      entry.url,
      entry.metadata?.sourceAsset,
    ]) {
      const normalized = normalizeAssetUrl(candidate);
      if (normalized) assetKeyByUrl.set(normalized, entry.id);
    }
  }

  const objects: Level3DObject[] = scene.rootObjects.flatMap((object) => {
    const customData = getComponentData(object, 'pixl.logic')?.customData as Record<string, unknown> | undefined;
    const modelUrl = getModelUrl(object);
    const normalizedModelUrl = normalizeAssetUrl(modelUrl);
    const assetKey = getString(customData?.assetKey) ??
      (normalizedModelUrl ? assetKeyByUrl.get(normalizedModelUrl) : undefined);
    if (!assetKey) return [];

    const tx = object.transform ?? {};
    return [{
      id: object.id,
      name: object.name,
      assetKey,
      layer: getString(customData?.sourceLayer) ?? getString(customData?.sourcePrefix),
      collider: getString(customData?.sourceCollider),
      editable: typeof customData?.sourceEditable === 'boolean' ? customData.sourceEditable : object.visible,
      source: {
        assetUrl: getString(customData?.sourceAsset) ?? modelUrl,
        nodeName: getString(customData?.sourceNodeName),
        nodeIndex: getNumber(customData?.sourceNodeIndex),
        meshIndex: getNumber(customData?.sourceMeshIndex),
        prefix: getString(customData?.sourcePrefix),
        runtimeConstant: getString(customData?.runtimeConstant),
      },
      transform: {
        position: (tx.position as [number, number, number]) ?? [0, 0, 0],
        rotation: (tx.rotation as [number, number, number]) ?? [0, 0, 0],
        scale: (tx.scale as [number, number, number]) ?? [1, 1, 1],
      },
    }];
  });

  return {
    schema: LEVEL3D_SCHEMA,
    game: String(metadata.originalGame ?? project.slug ?? project.id),
    engineTarget: typeof metadata.originalEngineTarget === 'string' ? metadata.originalEngineTarget : undefined,
    sourceScene: typeof metadata.originalSourceScene === 'string' ? metadata.originalSourceScene : undefined,
    notes: typeof metadata.originalNotes === 'string' ? metadata.originalNotes : undefined,
    editorMap: metadata.originalEditorMap as Record<string, unknown> | undefined,
    world: metadata.originalWorld as Record<string, unknown> | undefined,
    camera: scene.camera ? { position: scene.camera.position, target: scene.camera.target } : undefined,
    assetLibrary,
    objects,
  };
};

export const runImportLevel3D = async (
  sourcePath: string,
  outPath: string,
): Promise<{ outPath: string; objectCount: number; assetCount: number }> => {
  const absoluteSource = resolve(process.cwd(), sourcePath);
  const absoluteOut = resolve(process.cwd(), outPath);
  const raw = await readFile(absoluteSource, 'utf8');
  const level = JSON.parse(raw) as Level3DDocument;
  const project = importLevel3DToProject(level, { name: level.game });
  await writeFile(absoluteOut, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  return {
    outPath: absoluteOut,
    objectCount: project.scenes[0].rootObjects.length,
    assetCount: project.assets?.entries?.length ?? 0,
  };
};

export const runExportLevel3D = async (
  projectPath: string,
  outPath: string,
): Promise<{ outPath: string; objectCount: number; assetCount: number }> => {
  const absoluteProject = resolve(process.cwd(), projectPath);
  const absoluteOut = resolve(process.cwd(), outPath);
  const raw = await readFile(absoluteProject, 'utf8');
  const project = JSON.parse(raw) as PixlProjectShape;
  const level = exportProjectToLevel3D(project);
  await writeFile(absoluteOut, `${JSON.stringify(level, null, 2)}\n`, 'utf8');
  return {
    outPath: absoluteOut,
    objectCount: level.objects.length,
    assetCount: level.assetLibrary.length,
  };
};
