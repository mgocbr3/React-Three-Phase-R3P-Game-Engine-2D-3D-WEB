import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const studioRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(studioRoot, '../../..');
const gameRoot = path.join(repoRoot, 'apps/portal/games-src/harvest-rush-3d');
const levelPath = path.join(gameRoot, 'public/levels/harvest-rush.level3d.json');
const runtimePath = path.join(gameRoot, 'src/main.js');
const studioProjectPath = path.join(studioRoot, 'public/sample-projects/harvest-rush-3d/project.pixlproject.json');
const gameProjectPath = path.join(gameRoot, 'pixlplayground/project.pixlproject.json');

const DEFAULT_PROJECT_FOLDERS = [
  'Assets/3D_Models',
  'Assets/Sprites',
  'Assets/Textures',
  'Assets/Audio',
  'Assets/VFX',
  'Assets/Materials',
  'Assets/Prefabs',
  'Scenes',
  'Scripts',
  'ProjectSettings',
  'Builds',
  'Dev',
];

const FIELD_COLS = 60;
const FIELD_ROWS = 40;
const TILE_SIZE = 0.86;
const FIELD_HEADLAND_ROWS = 3;
const FIELD_HALF_W = (FIELD_COLS * TILE_SIZE) / 2;
const FIELD_HALF_H = (FIELD_ROWS * TILE_SIZE) / 2;
const START_POSITION_Z = FIELD_HALF_H - 3;
const FARM_SCENE_BASE_SCALE = 0.42;
const FARM_SCENE_SCALE = FARM_SCENE_BASE_SCALE * 1.1;
const VEHICLE_MODEL_LIFT = 0.035;

const MACHINES = [
  {
    id: 'harvester-01',
    name: 'Starter Harvester',
    role: 'All-round starter',
    file: 'harvester_001.glb',
    trailerFile: 'trailer_001.glb',
    scale: 0.24,
    trailerScale: 0.27,
    z: -0.22,
    unlockField: 1,
  },
  {
    id: 'tractor-01',
    name: 'Field Tractor',
    role: 'Fast row tractor',
    file: 'tractor_001.glb',
    trailerFile: 'trailer_001.glb',
    scale: 0.31,
    trailerScale: 0.27,
    z: -0.2,
    unlockField: 2,
  },
  {
    id: 'harvester-02',
    name: 'Wide Harvester',
    role: 'Wide cutter',
    file: 'harvester_002.glb',
    trailerFile: 'trailer_003.glb',
    scale: 0.24,
    trailerScale: 0.28,
    z: -0.22,
    unlockField: 4,
  },
  {
    id: 'heavy-tractor',
    name: 'Heavy Tractor',
    role: 'Heavy hauler',
    file: 'tractor_002.glb',
    trailerFile: 'trailer_004.glb',
    scale: 0.32,
    trailerScale: 0.3,
    z: -0.2,
    unlockField: 6,
  },
  {
    id: 'titan-harvester',
    name: 'Titan Harvester',
    role: 'Premium combine',
    file: 'harvester_004.glb',
    trailerFile: 'trailer_004.glb',
    scale: 0.25,
    trailerScale: 0.3,
    z: -0.24,
    unlockField: 9,
  },
  {
    id: 'orchard-tractor',
    name: 'Orchard Tractor',
    role: 'Precision sprinter',
    file: 'tractor_004.glb',
    trailerFile: 'trailer_003.glb',
    scale: 0.31,
    trailerScale: 0.28,
    z: -0.2,
    unlockField: 11,
  },
];

const FIELD_ANCHORS = [
  { x: 74, z: -24, name: 'Sunflower East Field', cropId: 'sunflower', cols: 42, rows: 22, serviceStationId: 'oil-press', objective: 'Press sunflower loads at the oil press', growthTime: 90, valueMultiplier: 1 },
  { x: -72, z: -58, name: 'Mill Wheat Strip', cropId: 'wheat', cols: 33, rows: 34, serviceStationId: 'grain-mill', objective: 'Bring wheat crates to the grain mill', growthTime: 65, valueMultiplier: 0.92 },
  { x: -47, z: -58, name: 'Soybean Trial Bed', cropId: 'soybean', cols: 21, rows: 28, serviceStationId: 'greenhouse-dock', objective: 'Carry soybean sacks to the greenhouse dock', growthTime: 95, valueMultiplier: 1.02 },
  { x: 58, z: -13, name: 'Tomato Packing Rows', cropId: 'tomato', cols: 37, rows: 17, serviceStationId: 'packing-shed', objective: 'Deliver tomato crates to the packing shed', growthTime: 105, valueMultiplier: 1.08 },
  { x: -77, z: 20, name: 'Lavender West Bed', cropId: 'lavender', cols: 18, rows: 18, serviceStationId: 'flower-stall', objective: 'Drop lavender bunches at the flower stall', growthTime: 130, valueMultiplier: 1.12 },
  { x: -55, z: 20, name: 'Lettuce East Bed', cropId: 'lettuce', cols: 18, rows: 18, serviceStationId: 'market-stand', objective: 'Take lettuce baskets to the market stand', growthTime: 50, valueMultiplier: 0.95 },
  { x: -77, z: 42, name: 'Carrot West Bed', cropId: 'carrot', cols: 18, rows: 18, serviceStationId: 'root-cellar', objective: 'Unload carrot boxes at the root cellar', growthTime: 110, valueMultiplier: 1.04 },
  { x: -55, z: 42, name: 'Potato East Bed', cropId: 'potato', cols: 18, rows: 18, serviceStationId: 'root-cellar', objective: 'Stack potato sacks inside the root cellar', growthTime: 125, valueMultiplier: 1.1 },
  { x: -77, z: 78, name: 'Pumpkin South West Field', cropId: 'pumpkin', cols: 24, rows: 48, serviceStationId: 'dairy-yard', objective: 'Carry pumpkins to the kitchen dock', growthTime: 220, valueMultiplier: 1.18 },
  { x: -52, z: 78, name: 'Corn South East Field', cropId: 'corn', cols: 24, rows: 48, serviceStationId: 'feed-barn', objective: 'Feed tall corn into the feed barn dryer', growthTime: 140, valueMultiplier: 1 },
  { x: 92, z: 18, name: 'Cotton Orchard Block', cropId: 'cotton', cols: 52, rows: 28, serviceStationId: 'textile-shed', objective: 'Deliver cotton bales to the textile shed', growthTime: 180, valueMultiplier: 1.14 },
  { x: 105, z: 58, name: 'Rice South Market Rows', cropId: 'rice', cols: 42, rows: 16, serviceStationId: 'south-market', objective: 'Haul rice bags to the south market scale', growthTime: 160, valueMultiplier: 1.16 },
];

const UNLOAD_STATIONS = [
  { id: 'oil-press', name: 'Oil Press', x: 69.6, z: 17.6, visualX: 69.6, visualZ: 17.6, radius: 3 },
  { id: 'grain-mill', name: 'Grain Mill', x: -27.3, z: 62.2, visualX: -27.3, visualZ: 62.2, radius: 3.1 },
  { id: 'greenhouse-dock', name: 'Greenhouse Dock', x: 44.9, z: -65.6, visualX: 44.9, visualZ: -65.6, radius: 2.9 },
  { id: 'packing-shed', name: 'Packing Shed', x: -12.3, z: 16.4, visualX: -12.3, visualZ: 23.2, radius: 2.9 },
  { id: 'flower-stall', name: 'Flower Stall', x: 11.3, z: 44.7, visualX: 11.3, visualZ: 44.7, radius: 2.8 },
  { id: 'market-stand', name: 'Market Stand', x: 15, z: -52.5, visualX: 15, visualZ: -52.5, radius: 2.8 },
  { id: 'root-cellar', name: 'Root Cellar', x: -54.2, z: -46.2, visualX: -54.2, visualZ: -46.2, radius: 2.9 },
  { id: 'dairy-yard', name: 'Kitchen Dock', x: -8.4, z: 30.9, visualX: -8.4, visualZ: 30.9, radius: 3 },
  { id: 'feed-barn', name: 'Feed Barn', x: 57.1, z: 60.2, visualX: 57.1, visualZ: 60.2, radius: 3.1 },
  { id: 'textile-shed', name: 'Textile Shed', x: 1.6, z: -27.3, visualX: 1.6, visualZ: -27.3, radius: 2.8 },
  { id: 'south-market', name: 'South Market', x: 58.8, z: -53.3, visualX: 58.8, visualZ: -53.3, radius: 2.9 },
];

const CROP_MODEL_ASSETS = {
  sunflower: { file: 'plant_001.glb', scale: 0.34 },
  wheat: { file: 'hay_001.glb', scale: 0.34 },
  carrot: { file: 'plant_007.glb', scale: 0.28 },
  cotton: { file: 'plant_004.glb', scale: 0.3 },
  pumpkin: { file: 'plant_011.glb', scale: 0.32 },
};

const CROP_COLORS = {
  sunflower: '#d8bd3e',
  wheat: '#caa15a',
  soybean: '#5da76c',
  tomato: '#b9473e',
  lavender: '#7660aa',
  lettuce: '#6fbf62',
  carrot: '#d88a36',
  potato: '#9a7c50',
  pumpkin: '#c86f32',
  corn: '#cbb532',
  cotton: '#dedfd3',
  rice: '#98b979',
};

const toFsUrl = (absolutePath) => `/@fs/${absolutePath.replace(/\\/g, '/')}`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const farmPackAssetPath = (file) => path.join(gameRoot, 'public/assets/vendor/farm-pack', file);
const farmPackAssetUrl = (file) => toFsUrl(farmPackAssetPath(file));

const componentFromSettings = (objectId, type, data) => {
  if (!data) return null;
  return {
    id: `${objectId}-${type.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
    type,
    enabled: true,
    data: clone(data),
  };
};

const editorObjectToSceneObject = (object) => ({
  id: object.id,
  name: object.name,
  type: object.type,
  parentId: object.parentId ?? null,
  transform: {
    position: clone(object.position),
    rotation: clone(object.rotation),
    scale: clone(object.scale),
  },
  visible: object.visible !== false,
  locked: Boolean(object.locked),
  tags: object.logicSettings?.tags ? [...object.logicSettings.tags] : [],
  components: [
    componentFromSettings(object.id, 'pixl.visual', object.visualSettings),
    componentFromSettings(object.id, 'pixl.physics', object.physicsSettings),
    componentFromSettings(object.id, 'pixl.logic', object.logicSettings),
    componentFromSettings(object.id, 'pixl.entity', object.entitySettings),
    componentFromSettings(object.id, 'pixl.animation', object.animationSettings),
    componentFromSettings(object.id, 'pixl.audio', object.audioSettings),
    componentFromSettings(object.id, 'pixl.particles', object.particleSettings),
    componentFromSettings(object.id, 'pixl.terrain', object.terrainSettings),
  ].filter(Boolean),
  data: {
    editorObject: clone(object),
  },
});

const animationSettings = (modelUrl) => ({
  modelUrl,
  availableAnimations: [],
  autoPlay: false,
  loop: true,
  speed: 1,
  crossFadeDuration: 0.3,
  paused: false,
  currentTime: 0,
});

const physicsSettings = ({
  bodyType = 'fixed',
  colliderShape = 'auto',
  isSensor = false,
  mass = 1,
  friction = 0.75,
  restitution = 0.05,
} = {}) => ({
  bodyType,
  colliderShape,
  mass,
  friction,
  restitution,
  linearDamping: 0,
  angularDamping: 0,
  isSensor,
});

const visualSettings = ({
  opacity = 1,
  metalness = 0,
  roughness = 0.8,
  emissiveIntensity = 0,
  wireframe = false,
  castShadow = true,
  receiveShadow = true,
} = {}) => ({
  textureUrl: '',
  opacity,
  metalness,
  roughness,
  emissiveIntensity,
  wireframe,
  castShadow,
  receiveShadow,
});

const logicSettings = (tags, customData) => ({
  tags,
  behavior: 'none',
  behaviorSpeed: 0,
  patrolDistance: 0,
  customData,
});

const groupObject = (id, name, parentId = null) => ({
  id,
  name,
  type: 'group',
  parentId,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: '#6f737a',
  visible: false,
  locked: true,
  logicSettings: logicSettings(['harvest-rush', 'folder'], {
    role: 'hierarchy-folder',
  }),
});

const modelObject = ({
  id,
  name,
  file,
  parentId = 'world-root',
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  color = '#8a8f98',
  tags = [],
  customData = {},
  locked = false,
  castShadow = true,
  receiveShadow = true,
}) => ({
  id,
  name,
  type: 'box',
  parentId,
  position,
  rotation,
  scale,
  color,
  visible: true,
  locked,
  isStatic: true,
  animationSettings: animationSettings(farmPackAssetUrl(file)),
  physicsSettings: physicsSettings({ bodyType: 'fixed', colliderShape: 'auto' }),
  visualSettings: visualSettings({ castShadow, receiveShadow }),
  logicSettings: logicSettings(['harvest-rush', 'runtime-model', ...tags], {
    source: 'apps/portal/games-src/harvest-rush-3d/src/main.js',
    sourceAsset: `public/assets/vendor/farm-pack/${file}`,
    ...customData,
  }),
});

const getFieldDimensions = (layout) => ({
  width: layout.cols * TILE_SIZE,
  depth: layout.rows * TILE_SIZE,
  halfWidth: (layout.cols * TILE_SIZE) / 2,
  halfDepth: (layout.rows * TILE_SIZE) / 2,
});

const findFieldStartPose = (layout) => {
  const { halfDepth } = getFieldDimensions(layout);
  const inset = Math.max(1.65, FIELD_HEADLAND_ROWS * TILE_SIZE * 0.72);
  return {
    x: layout.spawnX ?? layout.x,
    z: layout.spawnZ ?? (layout.z + halfDepth - inset),
    angle: layout.spawnAngle ?? Math.PI,
  };
};

const createCoreObjects = (farmManifest) => {
  const activeField = FIELD_ANCHORS[0];
  const startPose = findFieldStartPose(activeField);
  const starterMachine = MACHINES[0];

  return [
    groupObject('world-root', 'World'),
    groupObject('gameplay-root', 'Gameplay'),
    groupObject('vehicles-root', 'Vehicles', 'gameplay-root'),
    groupObject('fields-root', 'Fields', 'gameplay-root'),
    groupObject('stations-root', 'Unload Stations', 'gameplay-root'),
    {
      id: 'farm-scene-glb',
      name: 'Farm.glb',
      type: 'box',
      parentId: 'world-root',
      position: [0, -0.04, 0],
      rotation: [0, 0, 0],
      scale: [FARM_SCENE_SCALE, FARM_SCENE_SCALE, FARM_SCENE_SCALE],
      color: '#7b8d6d',
      visible: true,
      locked: false,
      isStatic: true,
      animationSettings: animationSettings(farmPackAssetUrl('Farm.glb')),
      physicsSettings: physicsSettings({ bodyType: 'fixed', colliderShape: 'trimesh' }),
      visualSettings: visualSettings({ castShadow: false, receiveShadow: true }),
      logicSettings: logicSettings(['harvest-rush', 'farm-map', 'runtime-map', 'farm-glb'], {
        runtimeConstant: 'FARM_SCENE_FILE',
        runtimeLoader: 'loadFarmScene',
        sourceAsset: 'public/assets/vendor/farm-pack/Farm.glb',
        sourceScale: FARM_SCENE_SCALE,
        glbManifest: farmManifest,
        terrainRuntime: {
          raycastMeshes: 'terrainRaycastMeshes',
          staticColliders: 'buildStaticCollidersFromFarmScene',
          roadNavigation: 'buildRoadNavigationFromFarmScene',
        },
      }),
    },
    {
      id: 'main-camera',
      name: 'Main Camera',
      type: 'camera',
      parentId: 'world-root',
      position: [0, 175, 54],
      rotation: [-1.22, 0, 0],
      scale: [1, 1, 1],
      color: '#8f969f',
      visible: true,
      locked: false,
      cameraSettings: {
        mode: 'third-person',
        distance: 7.2,
        height: 3.45,
        fov: 45,
        followPlayer: true,
        targetId: 'player-harvester',
        lockedZ: false,
        lockedY: false,
        smoothing: 0.1,
      },
      logicSettings: logicSettings(['harvest-rush', 'camera'], {
        runtimeFunction: 'updateCamera',
        modes: ['chase', 'top-down', 'overview'],
      }),
    },
    {
      id: 'sun-light',
      name: 'Sun Light',
      type: 'sunlight',
      parentId: 'world-root',
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
      logicSettings: logicSettings(['harvest-rush', 'lighting'], {
        source: 'runtime directional/ambient setup',
      }),
    },
    modelObject({
      id: 'player-harvester',
      name: 'Player Harvester',
      file: starterMachine.file,
      parentId: 'vehicles-root',
      position: [startPose.x, VEHICLE_MODEL_LIFT, startPose.z + starterMachine.z],
      rotation: [0, startPose.angle, 0],
      scale: [starterMachine.scale, starterMachine.scale, starterMachine.scale],
      color: '#4caf50',
      tags: ['player', 'vehicle', 'machine'],
      customData: {
        machineId: starterMachine.id,
        runtimeObject: 'vehicleGroup.machineMount',
        runtimeFunctions: ['placeVehicleAtFieldStart', 'refreshMachineModel', 'updateVehicleStats'],
        activeFieldId: slug(activeField.name),
      },
    }),
    modelObject({
      id: 'player-trailer',
      name: 'Player Trailer',
      file: starterMachine.trailerFile,
      parentId: 'vehicles-root',
      position: [
        startPose.x - Math.sin(startPose.angle) * 1.8,
        VEHICLE_MODEL_LIFT,
        startPose.z - Math.cos(startPose.angle) * 1.8,
      ],
      rotation: [0, startPose.angle, 0],
      scale: [starterMachine.trailerScale, starterMachine.trailerScale, starterMachine.trailerScale],
      color: '#8ba66f',
      tags: ['vehicle', 'trailer', 'capacity'],
      customData: {
        machineId: starterMachine.id,
        runtimeObject: 'vehicleGroup.trailerMount',
        runtimeFunctions: ['refreshMachineModel', 'updateHarvestProgress'],
      },
    }),
    {
      id: 'runtime-script-links',
      name: 'Runtime Script Links',
      type: 'group',
      parentId: 'gameplay-root',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#6f737a',
      visible: false,
      locked: true,
      logicSettings: logicSettings(['harvest-rush', 'script-links'], {
        runtimeFile: 'src/main.js',
        styleFile: 'src/styles.css',
        entryFunctions: [
          'loadFarmScene',
          'loadEditorLevel',
          'startGame',
          'buildField',
          'initializeWorldLife',
          'refreshMachineModel',
          'updateHud',
        ],
        hudRoots: [
          'hud',
          'contractCard',
          'objectiveBoard',
          'shopPanel',
          'titlePanel',
          'pausePanel',
        ],
      }),
    },
  ];
};

const createFieldObjects = () => FIELD_ANCHORS.map((field, index) => {
  const { width, depth } = getFieldDimensions(field);
  const id = `field-${String(index + 1).padStart(2, '0')}-${slug(field.name)}`;
  return {
    id,
    name: field.name,
    type: 'box',
    parentId: 'fields-root',
    position: [field.x, 0.08, field.z],
    rotation: [0, 0, 0],
    scale: [width, 0.12, depth],
    color: CROP_COLORS[field.cropId] || '#8a9f62',
    visible: true,
    locked: false,
    isStatic: true,
    physicsSettings: physicsSettings({ bodyType: 'fixed', colliderShape: 'cuboid', isSensor: true }),
    visualSettings: visualSettings({
      opacity: 0.28,
      wireframe: true,
      castShadow: false,
      receiveShadow: false,
      roughness: 0.9,
    }),
    logicSettings: logicSettings(['harvest-rush', 'field', field.cropId], {
      runtimeArray: 'FIELD_ANCHORS',
      runtimeIndex: index,
      cropId: field.cropId,
      serviceStationId: field.serviceStationId,
      cols: field.cols,
      rows: field.rows,
      tileSize: TILE_SIZE,
      objective: field.objective,
      growthTime: field.growthTime,
      valueMultiplier: field.valueMultiplier,
      cropModel: CROP_MODEL_ASSETS[field.cropId] ?? null,
    }),
  };
});

const createUnloadStationObjects = () => UNLOAD_STATIONS.map((station, index) => ({
  id: `station-${String(index + 1).padStart(2, '0')}-${station.id}`,
  name: station.name,
  type: 'ring',
  parentId: 'stations-root',
  position: [station.visualX, 0.12, station.visualZ],
  rotation: [Math.PI / 2, 0, 0],
  scale: [station.radius, station.radius, station.radius],
  color: '#d2a64f',
  visible: true,
  locked: false,
  isStatic: true,
  physicsSettings: physicsSettings({ bodyType: 'fixed', colliderShape: 'ball', isSensor: true }),
  visualSettings: visualSettings({
    opacity: 0.72,
    emissiveIntensity: 0.35,
    castShadow: false,
    receiveShadow: false,
  }),
  logicSettings: logicSettings(['harvest-rush', 'unload-station', station.id], {
    runtimeArray: 'UNLOAD_STATIONS',
    runtimeIndex: index,
    stationId: station.id,
    radius: station.radius,
    triggerPosition: [station.x, 0, station.z],
    visualPosition: [station.visualX, 0, station.visualZ],
  }),
}));

const createMachineAssetEntries = () => {
  const files = new Map();
  for (const machine of MACHINES) {
    files.set(machine.file, {
      name: machine.name,
      tags: ['harvest-rush', 'machine', machine.id],
      metadata: {
        machineId: machine.id,
        role: machine.role,
        unlockField: machine.unlockField,
        runtimeArray: 'MACHINES',
      },
    });
    files.set(machine.trailerFile, {
      name: `${machine.name} Trailer`,
      tags: ['harvest-rush', 'trailer', machine.id],
      metadata: {
        machineId: machine.id,
        role: 'Trailer',
        unlockField: machine.unlockField,
        runtimeArray: 'MACHINES',
      },
    });
  }

  for (const [cropId, asset] of Object.entries(CROP_MODEL_ASSETS)) {
    files.set(asset.file, {
      name: `${cropId} crop model`,
      tags: ['harvest-rush', 'crop', cropId],
      metadata: {
        cropId,
        runtimeArray: 'CROP_MODEL_ASSETS',
        runtimeScale: asset.scale,
      },
    });
  }

  return [...files.entries()].map(([file, entry], index) => ({
    id: `farm-pack-${index + 1}-${slug(file)}`,
    name: entry.name,
    kind: 'model',
    path: `Assets/3D_Models/farm-pack/${file}`,
    url: farmPackAssetUrl(file),
    tags: entry.tags,
    metadata: {
      sourceAsset: `public/assets/vendor/farm-pack/${file}`,
      ...entry.metadata,
    },
  }));
};

const collectSceneAssetEntries = (editorObjects) => {
  const entries = new Map();

  for (const object of editorObjects) {
    const modelUrl = object.animationSettings?.modelUrl;
    if (!modelUrl || entries.has(modelUrl)) continue;

    entries.set(modelUrl, {
      id: `scene-model-${entries.size + 1}-${slug(object.name)}`,
      name: object.name,
      kind: 'model',
      path: `Assets/3D_Models/${object.name.replace(/[^a-z0-9_. -]/gi, '').trim() || object.id}`,
      url: modelUrl,
      tags: ['harvest-rush', 'scene-model'],
      metadata: {
        sourceObjectId: object.id,
        sourceTags: object.logicSettings?.tags ?? [],
      },
    });
  }

  return [...entries.values()];
};

const uniqueAssets = (...assetLists) => {
  const byUrl = new Map();
  for (const asset of assetLists.flat()) {
    const key = asset.url || asset.path;
    if (!byUrl.has(key)) {
      byUrl.set(key, asset);
    }
  }
  return [...byUrl.values()];
};

const readOptionalJson = async (filePath) => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const readRuntimeInfo = async () => {
  try {
    const runtimeSource = await fs.readFile(runtimePath, 'utf8');
    return {
      file: 'src/main.js',
      bytes: Buffer.byteLength(runtimeSource),
      lines: runtimeSource.split(/\r?\n/).length,
      constants: {
        FIELD_COLS,
        FIELD_ROWS,
        TILE_SIZE,
        FARM_SCENE_SCALE,
        START_POSITION_Z,
      },
    };
  } catch {
    return {
      file: 'src/main.js',
      bytes: 0,
      lines: 0,
      constants: {
        FIELD_COLS,
        FIELD_ROWS,
        TILE_SIZE,
        FARM_SCENE_SCALE,
        START_POSITION_Z,
      },
    };
  }
};

const readFarmGlbManifest = async () => {
  try {
    const data = await fs.readFile(farmPackAssetPath('Farm.glb'));
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const length = view.getUint32(8, true);
    let offset = 12;
    let gltfJson = null;

    while (offset < length) {
      const chunkLength = view.getUint32(offset, true);
      const chunkType = view.getUint32(offset + 4, true);
      offset += 8;

      if (chunkType === 0x4e4f534a) {
        gltfJson = JSON.parse(new TextDecoder().decode(data.subarray(offset, offset + chunkLength)));
        break;
      }

      offset += chunkLength;
    }

    const meshNodes = (gltfJson?.nodes ?? [])
      .map((node, index) => ({
        index,
        name: node.name || `node_${index}`,
        mesh: node.mesh,
      }))
      .filter((node) => node.mesh !== undefined);

    const prefixCounts = new Map();
    for (const node of meshNodes) {
      const prefix = node.name.match(/^[a-zA-Z-]+/)?.[0] || 'mesh';
      prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
    }

    return {
      nodeCount: gltfJson?.nodes?.length ?? 0,
      meshCount: gltfJson?.meshes?.length ?? 0,
      meshNodeCount: meshNodes.length,
      topNamePrefixes: [...prefixCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 16)
        .map(([prefix, count]) => ({ prefix, count })),
      sampleNodes: meshNodes.slice(0, 32),
    };
  } catch (error) {
    return {
      nodeCount: 0,
      meshCount: 0,
      meshNodeCount: 0,
      topNamePrefixes: [],
      sampleNodes: [],
      error: error.message,
    };
  }
};

const buildProject = async () => {
  const legacyLevel = await readOptionalJson(levelPath);
  const runtimeInfo = await readRuntimeInfo();
  const farmManifest = await readFarmGlbManifest();
  const sceneId = 'harvest-rush-main';
  const editorObjects = [
    ...createCoreObjects(farmManifest),
    ...createFieldObjects(),
    ...createUnloadStationObjects(),
  ];
  const now = Date.now();

  return {
    format: 'pixlplayground-project',
    version: 2,
    id: 'pixl-harvest-rush-3d',
    slug: 'harvest-rush-3d',
    name: 'Harvest Rush 3D',
    createdAt: now,
    savedAt: now,
    engine: {
      name: 'PixlPlayground',
      version: '0.1.0',
      schemaVersion: 2,
    },
    runtime: {
      primary: 'three-3d',
      renderers: ['three', 'phaser'],
      physics: ['rapier', 'enable3d'],
    },
    activeSceneId: sceneId,
    scenes: [
      {
        id: sceneId,
        name: 'Farm Runtime Scene',
        kind: '3d',
        units: 'meters',
        rootObjects: editorObjects.map(editorObjectToSceneObject),
        camera: {
          id: 'main-camera',
          name: 'Main Camera',
          position: [0, 175, 54],
          target: [0, 0, 12],
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
          source: 'harvest-rush-runtime',
          runtimeInfo,
          farmManifest,
          originalEditorLevel: legacyLevel ? {
            schema: legacyLevel.schema,
            game: legacyLevel.game,
            engineTarget: legacyLevel.engineTarget,
            sourceScene: legacyLevel.sourceScene,
            objectCount: Array.isArray(legacyLevel.objects) ? legacyLevel.objects.length : 0,
            notes: legacyLevel.notes,
          } : null,
          generatedFrom: [
            'public/assets/vendor/farm-pack/Farm.glb',
            'src/main.js',
            'public/levels/harvest-rush.level3d.json',
          ],
        },
      },
    ],
    assets: {
      root: 'Assets',
      folders: DEFAULT_PROJECT_FOLDERS,
      entries: uniqueAssets(
        collectSceneAssetEntries(editorObjects),
        createMachineAssetEntries(),
        [
          {
            id: 'harvest-rush-runtime-main-js',
            name: 'Harvest Rush runtime',
            kind: 'script',
            path: 'Scripts/harvest-rush-runtime-main.js',
            url: toFsUrl(runtimePath),
            tags: ['harvest-rush', 'runtime', 'script'],
            metadata: runtimeInfo,
          },
        ],
      ),
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
      script: [
        '// Harvest Rush 3D',
        '// This project opens the real Farm.glb runtime map plus editable gameplay proxies.',
        '// Runtime source: apps/portal/games-src/harvest-rush-3d/src/main.js',
        '',
      ].join('\n'),
      source: {
        game: 'harvest-rush-3d',
        runtimeFile: 'src/main.js',
        sceneAsset: 'public/assets/vendor/farm-pack/Farm.glb',
        legacyLevelFile: 'public/levels/harvest-rush.level3d.json',
        farmSceneScale: FARM_SCENE_SCALE,
        systems: {
          world: ['loadFarmScene', 'buildRoadNavigationFromFarmScene', 'buildStaticCollidersFromFarmScene'],
          gameplay: ['buildField', 'ensureContractForField', 'updateHarvestProgress'],
          vehicle: ['placeVehicleAtFieldStart', 'refreshMachineModel', 'updateVehicleStats'],
          ui: ['updateHud', 'renderShop', 'updateDailyCard'],
        },
      },
    },
    integrations: {
      pixlland: {
        gameSlug: 'harvest-rush-3d',
        publishTarget: '/upload',
      },
    },
  };
};

const project = await buildProject();
const json = `${JSON.stringify(project, null, 2)}\n`;

await fs.mkdir(path.dirname(studioProjectPath), { recursive: true });
await fs.mkdir(path.dirname(gameProjectPath), { recursive: true });
await fs.writeFile(studioProjectPath, json);
await fs.writeFile(gameProjectPath, json);

console.log(`Wrote ${studioProjectPath}`);
console.log(`Wrote ${gameProjectPath}`);
