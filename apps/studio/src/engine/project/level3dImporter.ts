import type { SceneObject } from '@/stores/editorStore';
import {
  DEFAULT_PROJECT_FOLDERS,
  PIXL_PROJECT_FORMAT,
  PIXL_PROJECT_VERSION,
  PixlAssetEntry,
  PixlProjectDocument,
  PixlSceneDocument,
  cloneJson,
} from './schema';
import { editorObjectToSceneObject } from './editorProjectAdapter';

interface Level3DAsset {
  key: string;
  label: string;
  kind: string;
  url: string;
}

interface Level3DObject {
  id: string;
  name: string;
  assetKey: string;
  layer?: string;
  collider?: string;
  editable?: boolean;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
}

export interface PixllandLevel3DDocument {
  schema: 'pixlland.level3d.v1';
  game: string;
  engineTarget?: string;
  sourceScene?: string;
  notes?: string;
  world?: Record<string, unknown>;
  camera?: {
    position?: [number, number, number];
    target?: [number, number, number];
  };
  assetLibrary: Level3DAsset[];
  objects: Level3DObject[];
}

export interface ImportLevel3DOptions {
  id: string;
  slug: string;
  name: string;
  assetBaseUrl?: string;
  assetBasePath?: string;
  createdAt?: number;
  savedAt?: number;
}

const layerColors: Record<string, string> = {
  'tree-line': '#88a878',
  'field-edge': '#9f9475',
  roads: '#a88664',
  market: '#b58f6b',
  animals: '#9da7b1',
  'crop-dressing': '#b6a256',
};

const animationSettings = (modelUrl: string) => ({
  modelUrl,
  availableAnimations: [],
  autoPlay: false,
  loop: true,
  speed: 1,
  crossFadeDuration: 0.3,
  paused: false,
  currentTime: 0,
});

const physicsSettings = (collider?: string) => ({
  bodyType: 'fixed' as const,
  colliderShape: collider === 'none' ? 'cuboid' as const : 'auto' as const,
  mass: 1,
  friction: 0.75,
  restitution: 0.05,
  linearDamping: 0,
  angularDamping: 0,
  isSensor: collider === 'none',
});

const visualSettings = (castShadow = true, receiveShadow = true) => ({
  textureUrl: '',
  opacity: 1,
  metalness: 0,
  roughness: 0.8,
  emissiveIntensity: 0,
  wireframe: false,
  castShadow,
  receiveShadow,
});

const logicSettings = (tags: string[], customData: Record<string, unknown>) => ({
  tags,
  behavior: 'none' as const,
  behaviorSpeed: 0,
  patrolDistance: 0,
  customData,
});

const joinAssetUrl = (assetBaseUrl: string | undefined, url: string) => {
  if (!assetBaseUrl) return url;
  return `${assetBaseUrl.replace(/\/$/, '')}/${url.replace(/^\/+/, '')}`;
};

const joinAssetPath = (assetBasePath: string | undefined, url: string) => {
  if (!assetBasePath) return url;
  return `${assetBasePath.replace(/[\\/]+$/, '')}/${url.replace(/^\/+/, '')}`;
};

const createCoreObjects = (level: PixllandLevel3DDocument): SceneObject[] => ([
  {
    id: 'main-camera',
    name: 'Main Camera',
    type: 'camera',
    position: level.camera?.position ?? [64, 58, 82],
    rotation: [-0.62, 0.67, 0],
    scale: [1, 1, 1],
    color: '#8fa6b8',
    visible: true,
    locked: false,
    cameraSettings: {
      mode: 'third-person',
      distance: 12,
      height: 6,
      fov: 45,
      followPlayer: false,
      targetId: 'harvest-field-ground',
      lockedZ: false,
      lockedY: false,
      smoothing: 0.1,
    },
  },
  {
    id: 'sun-light',
    name: 'Sun Light',
    type: 'sunlight',
    position: [0, 10, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#fffaf0',
    visible: true,
    locked: false,
    lightSettings: {
      intensity: 0.8,
      distance: 0,
      decay: 2,
      temperature: 5600,
      useTemperature: true,
      angle: Math.PI / 6,
      penumbra: 0.2,
      sunElevation: 45,
      sunAzimuth: 180,
      castShadow: true,
      shadowMapSize: 2048,
      shadowBias: -0.001,
      shadowNormalBias: 0.02,
      shadowRadius: 1,
      shadowCameraSize: 90,
      volumetric: false,
      volumetricIntensity: 0,
      helperVisible: true,
    },
  },
  {
    id: 'harvest-field-ground',
    name: 'Field Ground',
    type: 'plane',
    position: [0, -0.03, 0],
    rotation: [0, 0, 0],
    scale: [95, 1, 75],
    color: '#4f6f3a',
    visible: true,
    locked: false,
    isStatic: true,
    physicsSettings: physicsSettings('static'),
    visualSettings: {
      ...visualSettings(false, true),
      roughness: 0.95,
    },
    logicSettings: logicSettings(['ground', 'harvest-rush'], {
      source: 'level3d',
      game: level.game,
    }),
  },
]);

export const importLevel3DProject = (
  level: PixllandLevel3DDocument,
  options: ImportLevel3DOptions,
): PixlProjectDocument => {
  const now = options.savedAt ?? Date.now();
  const assetsByKey = new Map(level.assetLibrary.map((asset) => [asset.key, asset]));

  const importedObjects: SceneObject[] = level.objects.map((item) => {
    const asset = assetsByKey.get(item.assetKey);
    const modelUrl = joinAssetUrl(options.assetBaseUrl, asset?.url ?? item.assetKey);
    const layer = item.layer || 'scene';

    return {
      id: item.id,
      name: item.name,
      type: 'box',
      position: cloneJson(item.transform.position),
      rotation: cloneJson(item.transform.rotation),
      scale: cloneJson(item.transform.scale),
      color: layerColors[layer] || '#9aa0a6',
      visible: item.editable !== false,
      locked: false,
      isStatic: true,
      animationSettings: animationSettings(modelUrl),
      physicsSettings: physicsSettings(item.collider),
      visualSettings: visualSettings(true, item.collider !== 'none'),
      logicSettings: logicSettings(['harvest-rush', layer, asset?.kind || 'model'], {
        assetKey: item.assetKey,
        sourceLayer: layer,
        sourceScene: level.sourceScene,
        sourceModelUrl: asset?.url,
      }),
    };
  });

  const editorObjects = [...createCoreObjects(level), ...importedObjects];
  const sceneId = 'harvest-rush-main';

  const assetEntries: PixlAssetEntry[] = level.assetLibrary.map((asset) => ({
    id: asset.key,
    name: asset.label,
    kind: asset.kind === 'model' ? 'model' : 'folder',
    path: joinAssetPath(options.assetBasePath, asset.url),
    url: joinAssetUrl(options.assetBaseUrl, asset.url),
    tags: ['harvest-rush', asset.kind],
    metadata: {
      sourceKey: asset.key,
      sourceUrl: asset.url,
    },
  }));

  const scene: PixlSceneDocument = {
    id: sceneId,
    name: 'Farm Level',
    kind: '3d',
    units: 'meters',
    rootObjects: editorObjects.map(editorObjectToSceneObject),
    camera: {
      id: 'main-camera',
      name: 'Main Camera',
      position: level.camera?.position ?? [64, 58, 82],
      target: level.camera?.target ?? [0, 0, 0],
      fov: 45,
      near: 0.1,
      far: 1000,
    },
    environment: {
      background: '#9fd5df',
      ambientLight: '#ffffff',
      ambientIntensity: 0.75,
      sunColor: '#fffaf0',
      sunIntensity: 0.8,
    },
    physics: {
      engine: 'rapier',
      gravity: [0, -9.81, 0],
    },
    metadata: {
      originalSchema: level.schema,
      originalGame: level.game,
      originalWorld: level.world,
      originalNotes: level.notes,
    },
  };

  return {
    format: PIXL_PROJECT_FORMAT,
    version: PIXL_PROJECT_VERSION,
    id: options.id,
    slug: options.slug,
    name: options.name,
    createdAt: options.createdAt ?? now,
    savedAt: now,
    engine: {
      name: 'PixlPlayground',
      version: '0.1.0',
      schemaVersion: PIXL_PROJECT_VERSION,
    },
    runtime: {
      primary: 'three-3d',
      renderers: ['three', 'phaser'],
      physics: ['rapier'],
    },
    activeSceneId: sceneId,
    scenes: [scene],
    assets: {
      root: 'Assets',
      folders: [...DEFAULT_PROJECT_FOLDERS],
      entries: assetEntries,
    },
    editor: {
      mode: '3d',
      transformSpace: 'world',
      snapEnabled: true,
      snapTranslate: 0.5,
      snapRotate: 15,
      snapScale: 0.1,
      selectedSceneId: sceneId,
      layoutPreset: 'default',
    },
    game: {
      templateId: null,
      script: '// Harvest Rush 3D\n// Visual placement is authored in PixlPlayground.\n',
      source: {
        game: level.game,
        levelFile: 'public/levels/harvest-rush.level3d.json',
        sourceScene: level.sourceScene,
      },
    },
    integrations: {
      pixlland: {
        gameSlug: level.game,
      },
    },
  };
};
