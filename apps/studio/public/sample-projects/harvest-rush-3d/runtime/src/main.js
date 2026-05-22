import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './styles.css';

const STORAGE_KEY = 'pixlland:harvest-rush-3d:save:v2';
const FIELD_COLS = 60;
const FIELD_ROWS = 40;
const TILE_SIZE = 0.86;
const CROP_CLUSTER_COUNT = 2;
const CROP_VISUAL_SCALE = 0.52;
const FIELD_HEADLAND_COLS = 3;
const FIELD_HEADLAND_ROWS = 3;
const FIELD_ALLEY_EVERY_COLS = 11;
const FIELD_ALLEY_EVERY_ROWS = 9;
const FIELD_ALLEY_WIDTH = 2;
const FIELD_PLANTING_COLLIDER_RADIUS = 0.58;
const ROUTE_GUIDE_MIN_DISTANCE = 4.5;
const ROUTE_MARKER_MIN_DISTANCE = 24;
const FIELD_HALF_W = (FIELD_COLS * TILE_SIZE) / 2;
const FIELD_HALF_H = (FIELD_ROWS * TILE_SIZE) / 2;
const FARM_EDGE_MARGIN = 520;
const WORLD_BOUNDS = { x: FIELD_HALF_W + FARM_EDGE_MARGIN, z: FIELD_HALF_H + FARM_EDGE_MARGIN };
const GROUND_SIZE = { width: WORLD_BOUNDS.x * 2 + 18, depth: WORLD_BOUNDS.z * 2 + 18 };
const START_POSITION_Z = FIELD_HALF_H - 3.0;
const SEASON_FIELD_TARGET = 12;
const SILO_GUIDE_RATIO = 0.55;
const ALL_IN_ONE_BASE = './assets/vendor/kenney/all-in-one/';
const FARM_PACK_BASE = './assets/vendor/farm-pack/';
const FARM_SCENE_FILE = `${FARM_PACK_BASE}Farm.glb`;
const EDITOR_LEVEL_FILE = './levels/harvest-rush.level3d.json';
const FARM_SCENE_BASE_SCALE = 0.42;
const FARM_SCENE_SCALE = FARM_SCENE_BASE_SCALE * 1.1;
const FARM_WORLD_SCALE = FARM_SCENE_SCALE / FARM_SCENE_BASE_SCALE;
const USE_FARM_SCENE = true;
const FARM_CULL_DISTANCE = 620;
const FARM_CULL_INTERVAL = 0.26;
const STATIC_COLLIDER_CELL_SIZE = 12;
const STATIC_COLLIDER_PADDING = 0.04;
const MOUNTAIN_COLLIDER_CELL_SIZE = 7.5;
const MOUNTAIN_COLLIDER_MIN_HEIGHT = 0.55;
const ROAD_NAV_CELL_SIZE = 2.72;
const ROAD_NAV_PADDING = 0.85;
const PLAYER_COLLIDER_RADIUS = 0.66;
const ACTOR_COLLIDER_PADDING = 0.12;
const TERRAIN_SAMPLE_HEIGHT = 80;
const TERRAIN_HEIGHT_CACHE_CELL = 0.72;
const VEHICLE_GROUND_OFFSET = 0.18;
const VEHICLE_MODEL_LIFT = 0.035;
const TERRAIN_DRIVE_HEIGHT_LIMIT = 2.92;
const TERRAIN_MAX_STEP_UP = 0.46;
const TERRAIN_MAX_STEP_DOWN = 0.9;
const TERRAIN_SLOPE_SAMPLE_RADIUS = 0.9;
const TERRAIN_MAX_LOCAL_DELTA = 1.12;
const TRAFFIC_PLAYER_YIELD_DISTANCE = 5.2;
const TRAFFIC_ACTOR_YIELD_PADDING = 1.15;
const LIVESTOCK_PADDOCK_MARGIN = 0.95;
const LIVESTOCK_PLAYER_BUFFER = 1.8;
const CROP_GROUND_OFFSET = 0.035;
const SPRITES_BASE = './assets/vendor/kenney/';
const TUTORIAL_STEPS = [
  { text: 'WASD, left stick or joystick — drive into the crops.', durationMs: 5200 },
  { text: 'Sweep the field. Trailer fills as you cut.', durationMs: 5200 },
  { text: 'Trailer full? Park on a golden unload ring by a silo or barn.', durationMs: 6200 },
  { text: 'Earn coins → open Shop → buy bigger trailer / cutter / engine.', durationMs: 6800 },
];
const FIELD_BANNER_MS = 2800;
const FIELD_STATES = {
  SEEDED: 'seeded',
  GROWING: 'growing',
  MATURE: 'mature',
  HARVESTED: 'harvested',
};
const FERTILIZER_UNIT_COST = 95;
const FERTILIZER_FIELD_COST_STEP = 9;
const FERTILIZER_BUNDLE_AMOUNT = 3;
const FERTILIZER_BUNDLE_DISCOUNT = 0.82;
const FERTILIZER_GROWTH_BOOST_RATIO = 0.34;
const FERTILIZER_YIELD_BONUS = 0.12;
const MACHINE_LEVEL_MAX = 4;
const MACHINE_LEVEL_SPEED_BONUS = 0.07;
const MACHINE_LEVEL_CUT_BONUS = 0.08;
const MACHINE_LEVEL_CAPACITY_BONUS = 0.1;
const MACHINE_LEVEL_PRICE_BONUS = 0.04;
const GROWTH_STAGE_THRESHOLDS = {
  SEEDED: 0.18,
  TALL: 0.68,
};

const GAMEPAD_DEADZONE = 0.18;
const GAMEPAD_BUTTONS = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  leftShoulder: 4,
  rightShoulder: 5,
  leftTrigger: 6,
  rightTrigger: 7,
  select: 8,
  start: 9,
  leftStick: 10,
  rightStick: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
};

const CROPS = [
  { id: 'sunflower', name: 'Sunflower', color: 0xf2a83a, accent: 0x6b4b22, value: 7, load: 0.22, height: 1.16, unlockField: 1, growthTime: 90 },
  { id: 'wheat', name: 'Wheat', color: 0xf2bd3b, accent: 0xffd96a, value: 5, load: 0.2, height: 0.82, unlockField: 2, growthTime: 70 },
  { id: 'lettuce', name: 'Lettuce', color: 0x7fc85a, accent: 0xd6f2a0, value: 6, load: 0.18, height: 0.48, unlockField: 3, growthTime: 55 },
  { id: 'tomato', name: 'Tomato', color: 0xdd4a34, accent: 0x458e3d, value: 9, load: 0.22, height: 0.68, unlockField: 4, growthTime: 105 },
  { id: 'corn', name: 'Corn', color: 0x6fb84e, accent: 0xf5d14d, value: 8, load: 0.24, height: 1.08, unlockField: 3, growthTime: 140 },
  { id: 'soybean', name: 'Soybean', color: 0x95bd57, accent: 0x446d36, value: 8, load: 0.2, height: 0.62, unlockField: 6, growthTime: 95 },
  { id: 'carrot', name: 'Carrot', color: 0xe97833, accent: 0x4f9b48, value: 10, load: 0.26, height: 0.58, unlockField: 7, growthTime: 110 },
  { id: 'lavender', name: 'Lavender', color: 0x9e70d8, accent: 0x6abf65, value: 11, load: 0.19, height: 0.72, unlockField: 8, growthTime: 130 },
  { id: 'potato', name: 'Potato', color: 0xb9854d, accent: 0x5f9a44, value: 11, load: 0.27, height: 0.5, unlockField: 9, growthTime: 125 },
  { id: 'cotton', name: 'Cotton', color: 0xf2f0dc, accent: 0x9fc98a, value: 12, load: 0.28, height: 0.72, unlockField: 10, growthTime: 180 },
  { id: 'pumpkin', name: 'Pumpkin', color: 0xe77730, accent: 0x6fa144, value: 15, load: 0.34, height: 0.55, unlockField: 11, growthTime: 240 },
  { id: 'rice', name: 'Rice', color: 0xd8d77a, accent: 0x75a75a, value: 13, load: 0.23, height: 0.78, unlockField: 12, growthTime: 160 },
];

const CROP_ASSET_SPRITES = {
  sunflower: [
    { file: './assets/vendor/kenney/crops-trimmed/flower_yellowA_NE.png', width: 0.92, height: 1.02, y: 0.68 },
    { file: './assets/vendor/kenney/crops-trimmed/flower_yellowB_NE.png', width: 1.0, height: 0.92, y: 0.64 },
    { file: './assets/vendor/kenney/crops-trimmed/flower_yellowC_NE.png', width: 0.9, height: 0.9, y: 0.62 },
  ],
  wheat: [
    { file: './assets/vendor/kenney/crops-trimmed/hay_E.png', width: 1.0, height: 0.78, y: 0.46 },
    { file: './assets/vendor/kenney/crops-trimmed/grass_leafsLarge_NE.png', width: 1.04, height: 0.76, y: 0.42 },
  ],
  lettuce: [
    { file: './assets/vendor/kenney/crops-trimmed/grass_large_NE.png', width: 0.95, height: 0.72, y: 0.38 },
    { file: './assets/vendor/kenney/crops-trimmed/plant_bushLarge_NE.png', width: 0.86, height: 0.72, y: 0.38 },
  ],
  tomato: [
    { file: './assets/vendor/kenney/crops-trimmed/flower_redA_NE.png', width: 0.78, height: 0.98, y: 0.54 },
    { file: './assets/vendor/kenney/crops-trimmed/plant_flatTall_NE.png', width: 0.82, height: 0.92, y: 0.5 },
  ],
  corn: [
    { file: './assets/vendor/kenney/crops-trimmed/cornDouble_E.png', width: 1.18, height: 1.22, y: 0.76 },
    { file: './assets/vendor/kenney/crops-trimmed/corn_E.png', width: 1.08, height: 1.18, y: 0.74 },
    { file: './assets/vendor/kenney/crops-trimmed/cornYoungDouble_E.png', width: 1.08, height: 0.7, y: 0.48 },
  ],
  soybean: [
    { file: './assets/vendor/kenney/crops-trimmed/plant_bushLarge_NE.png', width: 0.94, height: 0.78, y: 0.42 },
    { file: './assets/vendor/kenney/crops-trimmed/grass_leafsLarge_NE.png', width: 0.92, height: 0.7, y: 0.38 },
  ],
  carrot: [
    { file: './assets/vendor/kenney/crops-trimmed/plant_flatTall_NE.png', width: 0.86, height: 0.96, y: 0.5 },
    { file: './assets/vendor/kenney/crops-trimmed/grass_large_NE.png', width: 0.95, height: 0.72, y: 0.4 },
  ],
  lavender: [
    { file: './assets/vendor/kenney/crops-trimmed/flower_purpleA_NE.png', width: 0.82, height: 0.98, y: 0.55 },
    { file: './assets/vendor/kenney/crops-trimmed/grass_leafsLarge_NE.png', width: 0.88, height: 0.7, y: 0.38 },
  ],
  potato: [
    { file: './assets/vendor/kenney/crops-trimmed/plant_flatTall_NE.png', width: 0.82, height: 0.8, y: 0.42 },
    { file: './assets/vendor/kenney/crops-trimmed/grass_large_NE.png', width: 0.9, height: 0.66, y: 0.36 },
  ],
  cotton: [
    { file: './assets/vendor/kenney/crops-trimmed/flower_purpleA_NE.png', width: 0.78, height: 0.95, y: 0.54 },
    { file: './assets/vendor/kenney/crops-trimmed/flower_redA_NE.png', width: 0.72, height: 0.98, y: 0.54 },
  ],
  pumpkin: [
    { file: './assets/vendor/kenney/crops-trimmed/plant_bushLarge_NE.png', width: 1.05, height: 0.92, y: 0.5 },
    { file: './assets/vendor/kenney/crops-trimmed/grass_large_NE.png', width: 0.98, height: 0.74, y: 0.4 },
  ],
  rice: [
    { file: './assets/vendor/kenney/crops-trimmed/grass_leafsLarge_NE.png', width: 0.88, height: 0.78, y: 0.42 },
    { file: './assets/vendor/kenney/crops-trimmed/hay_E.png', width: 0.86, height: 0.72, y: 0.4 },
  ],
};

const PAINTS = [
  { id: 'harvest-red', name: 'Harvest Red', body: 0xd95532, trim: 0xd7b24d, unlockField: 1 },
  { id: 'meadow-green', name: 'Meadow Green', body: 0x4f9d55, trim: 0xf0c55a, unlockField: 3 },
  { id: 'sunset-orange', name: 'Sunset Orange', body: 0xe97833, trim: 0xffd36b, unlockField: 5 },
  { id: 'river-blue', name: 'River Blue', body: 0x3f88c5, trim: 0xf0d978, unlockField: 7 },
  { id: 'royal-purple', name: 'Royal Purple', body: 0x7452a6, trim: 0xffda6a, unlockField: 9 },
  { id: 'midnight-black', name: 'Midnight Black', body: 0x252b2d, trim: 0xf2bd3b, unlockField: 12 },
];

const MACHINES = [
  {
    id: 'harvester-01',
    name: 'Starter Harvester',
    role: 'All-round starter',
    specialty: 'Cheap, balanced, best for early sunflower and wheat contracts.',
    file: 'harvester_001.glb',
    trailerFile: 'trailer_001.glb',
    unlockField: 1,
    cost: 0,
    upgradeBaseCost: 120,
    speedMultiplier: 0.96,
    cutMultiplier: 1.08,
    capacityMultiplier: 1.0,
    bestCrops: ['sunflower', 'wheat', 'lettuce'],
    okCrops: ['corn', 'soybean', 'tomato'],
    scale: 0.24,
    trailerScale: 0.27,
    z: -0.22,
  },
  {
    id: 'tractor-01',
    name: 'Field Tractor',
    role: 'Fast row tractor',
    specialty: 'Quick turns and steady speed for wheat, lettuce and carrot rows.',
    file: 'tractor_001.glb',
    trailerFile: 'trailer_001.glb',
    unlockField: 2,
    cost: 320,
    upgradeBaseCost: 165,
    speedMultiplier: 1.06,
    cutMultiplier: 0.98,
    capacityMultiplier: 1.08,
    bestCrops: ['wheat', 'lettuce', 'carrot', 'potato'],
    okCrops: ['sunflower', 'corn', 'soybean', 'tomato'],
    scale: 0.31,
    trailerScale: 0.27,
    z: -0.2,
  },
  {
    id: 'harvester-02',
    name: 'Wide Harvester',
    role: 'Wide cutter',
    specialty: 'Wide header for sunflower, corn, rice and cotton fields.',
    file: 'harvester_002.glb',
    trailerFile: 'trailer_003.glb',
    unlockField: 4,
    cost: 760,
    upgradeBaseCost: 235,
    speedMultiplier: 1.0,
    cutMultiplier: 1.22,
    capacityMultiplier: 1.12,
    bestCrops: ['sunflower', 'corn', 'rice', 'cotton'],
    okCrops: ['wheat', 'soybean', 'lavender'],
    scale: 0.24,
    trailerScale: 0.28,
    z: -0.22,
  },
  {
    id: 'heavy-tractor',
    name: 'Heavy Tractor',
    role: 'Heavy hauler',
    specialty: 'Big trailer power for dense corn and heavy pumpkin loads.',
    file: 'tractor_002.glb',
    trailerFile: 'trailer_004.glb',
    unlockField: 6,
    cost: 1320,
    upgradeBaseCost: 330,
    speedMultiplier: 1.16,
    cutMultiplier: 1.05,
    capacityMultiplier: 1.22,
    bestCrops: ['corn', 'pumpkin', 'potato'],
    okCrops: ['carrot', 'cotton', 'rice', 'soybean'],
    scale: 0.32,
    trailerScale: 0.3,
    z: -0.2,
  },
  {
    id: 'titan-harvester',
    name: 'Titan Harvester',
    role: 'Premium combine',
    specialty: 'Late-game cutter with huge output for cotton, rice and pumpkin.',
    file: 'harvester_004.glb',
    trailerFile: 'trailer_004.glb',
    unlockField: 9,
    cost: 2400,
    upgradeBaseCost: 520,
    speedMultiplier: 1.1,
    cutMultiplier: 1.38,
    capacityMultiplier: 1.28,
    bestCrops: ['cotton', 'pumpkin', 'corn', 'rice'],
    okCrops: ['sunflower', 'lavender', 'tomato'],
    scale: 0.25,
    trailerScale: 0.3,
    z: -0.24,
  },
  {
    id: 'orchard-tractor',
    name: 'Orchard Tractor',
    role: 'Precision sprinter',
    specialty: 'Agile machine for low crops, tight rows and premium contracts.',
    file: 'tractor_004.glb',
    trailerFile: 'trailer_003.glb',
    unlockField: 11,
    cost: 3200,
    upgradeBaseCost: 610,
    speedMultiplier: 1.25,
    cutMultiplier: 1.12,
    capacityMultiplier: 1.18,
    bestCrops: ['carrot', 'pumpkin', 'tomato', 'lavender'],
    okCrops: ['cotton', 'wheat', 'lettuce', 'potato'],
    scale: 0.31,
    trailerScale: 0.28,
    z: -0.2,
  },
];

const FIELD_ANCHORS = [
  { x: 74, z: -24, name: 'Sunflower East Field', cropId: 'sunflower', cols: 42, rows: 22, serviceStationId: 'oil-press', objective: 'Press sunflower loads at the oil press', growthTime: 90, valueMultiplier: 1.0 },
  { x: -72, z: -58, name: 'Mill Wheat Strip', cropId: 'wheat', cols: 33, rows: 34, serviceStationId: 'grain-mill', objective: 'Bring wheat crates to the grain mill', growthTime: 65, valueMultiplier: 0.92 },
  { x: -47, z: -58, name: 'Soybean Trial Bed', cropId: 'soybean', cols: 21, rows: 28, serviceStationId: 'greenhouse-dock', objective: 'Carry soybean sacks to the greenhouse dock', growthTime: 95, valueMultiplier: 1.02 },
  { x: 58, z: -13, name: 'Tomato Packing Rows', cropId: 'tomato', cols: 37, rows: 17, serviceStationId: 'packing-shed', objective: 'Deliver tomato crates to the packing shed', growthTime: 105, valueMultiplier: 1.08 },
  { x: -77, z: 20, name: 'Lavender West Bed', cropId: 'lavender', cols: 18, rows: 18, serviceStationId: 'flower-stall', objective: 'Drop lavender bunches at the flower stall', growthTime: 130, valueMultiplier: 1.12 },
  { x: -55, z: 20, name: 'Lettuce East Bed', cropId: 'lettuce', cols: 18, rows: 18, serviceStationId: 'market-stand', objective: 'Take lettuce baskets to the market stand', growthTime: 50, valueMultiplier: 0.95 },
  { x: -77, z: 42, name: 'Carrot West Bed', cropId: 'carrot', cols: 18, rows: 18, serviceStationId: 'root-cellar', objective: 'Unload carrot boxes at the root cellar', growthTime: 110, valueMultiplier: 1.04 },
  { x: -55, z: 42, name: 'Potato East Bed', cropId: 'potato', cols: 18, rows: 18, serviceStationId: 'root-cellar', objective: 'Stack potato sacks inside the root cellar', growthTime: 125, valueMultiplier: 1.1 },
  { x: -77, z: 78, name: 'Pumpkin South West Field', cropId: 'pumpkin', cols: 24, rows: 48, serviceStationId: 'dairy-yard', objective: 'Carry pumpkins to the kitchen dock', growthTime: 220, valueMultiplier: 1.18 },
  { x: -52, z: 78, name: 'Corn South East Field', cropId: 'corn', cols: 24, rows: 48, serviceStationId: 'feed-barn', objective: 'Feed tall corn into the feed barn dryer', growthTime: 140, valueMultiplier: 1.0 },
  { x: 92, z: 18, name: 'Cotton Orchard Block', cropId: 'cotton', cols: 52, rows: 28, serviceStationId: 'textile-shed', objective: 'Deliver cotton bales to the textile shed', growthTime: 180, valueMultiplier: 1.14 },
  { x: 105, z: 58, name: 'Rice South Market Rows', cropId: 'rice', cols: 42, rows: 16, serviceStationId: 'south-market', objective: 'Haul rice bags to the south market scale', growthTime: 160, valueMultiplier: 1.16 },
];

const UNLOAD_STATIONS = [
  { id: 'oil-press', name: 'Oil Press', x: 69.6, z: 17.6, visualX: 69.6, visualZ: 17.6, radius: 3.0 },
  { id: 'grain-mill', name: 'Grain Mill', x: -27.3, z: 62.2, visualX: -27.3, visualZ: 62.2, radius: 3.1 },
  { id: 'greenhouse-dock', name: 'Greenhouse Dock', x: 44.9, z: -65.6, visualX: 44.9, visualZ: -65.6, radius: 2.9 },
  { id: 'packing-shed', name: 'Packing Shed', x: -12.3, z: 16.4, visualX: -12.3, visualZ: 23.2, radius: 2.9 },
  { id: 'flower-stall', name: 'Flower Stall', x: 11.3, z: 44.7, visualX: 11.3, visualZ: 44.7, radius: 2.8 },
  { id: 'market-stand', name: 'Market Stand', x: 15.0, z: -52.5, visualX: 15.0, visualZ: -52.5, radius: 2.8 },
  { id: 'root-cellar', name: 'Root Cellar', x: -54.2, z: -46.2, visualX: -54.2, visualZ: -46.2, radius: 2.9 },
  { id: 'dairy-yard', name: 'Kitchen Dock', x: -8.4, z: 30.9, visualX: -8.4, visualZ: 30.9, radius: 3.0 },
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

const TRAFFIC_ACTORS = [
  {
    file: 'car_001.glb',
    scale: 0.4,
    speed: 2.9,
    radius: 1.2,
    rest: [22, 42],
    startDelay: 8,
    route: [[85.3, -56], [85.3, 62]],
  },
  {
    file: 'truck_001.glb',
    scale: 0.38,
    speed: 2.35,
    radius: 2.05,
    rest: [38, 68],
    startDelay: 30,
    route: [[48, 73.8], [74, 73.8]],
  },
];

const LIVESTOCK_PADDOCKS = {
  cowWest: { minX: -7.6, maxX: 0.8, minZ: 54.5, maxZ: 62.8 },
  cowEast: { minX: 24.6, maxX: 40.4, minZ: 52.8, maxZ: 58.5 },
  sheepNorth: { minX: 36.6, maxX: 83.4, minZ: 22.9, maxZ: 32.8 },
  goatNorth: { minX: 24.1, maxX: 31.7, minZ: 22.7, maxZ: 49.3 },
  horseYard: { minX: -4.4, maxX: 13.2, minZ: 0.8, maxZ: 17.8 },
  chickenWest: { minX: -61.0, maxX: -58.4, minZ: -45.1, maxZ: -42.3 },
};

const LIVESTOCK_ACTORS = [
  { file: 'cow_001.glb', scale: 0.42, paddock: 'cowWest', speed: 0.72, collider: 0.95 },
  { file: 'cow_001.glb', scale: 0.4, paddock: 'cowEast', speed: 0.68, collider: 0.9 },
  { file: 'sheep_001.glb', scale: 0.4, paddock: 'sheepNorth', speed: 0.95, collider: 0.72 },
  { file: 'goat_001.glb', scale: 0.38, paddock: 'goatNorth', speed: 1.05, collider: 0.7 },
  { file: 'horse_002.glb', scale: 0.42, paddock: 'horseYard', speed: 0.98, collider: 0.95 },
  { file: 'chicken_001.glb', scale: 0.32, paddock: 'chickenWest', speed: 1.25, collider: 0.35 },
];

const WIND_TREE_ACTORS = [
  { file: 'tree_001.glb', position: [-22, 20], scale: 0.52 },
  { file: 'tree_004.glb', position: [24, 16], scale: 0.48 },
  { file: 'tree_006.glb', position: [-46, -18], scale: 0.5 },
  { file: 'fir_tree_001.glb', position: [46, -18], scale: 0.44 },
  { file: 'fir_tree_003.glb', position: [-12, 55], scale: 0.46 },
  { file: 'tree_003.glb', position: [58, 38], scale: 0.5 },
];

function scaleFarmWorldValue(value) {
  return Number.isFinite(value) ? value * FARM_WORLD_SCALE : value;
}

function scaleFarmWorldKeys(target, keys) {
  for (const key of keys) {
    if (Number.isFinite(target[key])) target[key] = scaleFarmWorldValue(target[key]);
  }
}

function applyFarmWorldScaleToLayout() {
  if (Math.abs(FARM_WORLD_SCALE - 1) < 0.001) return;
  for (const station of UNLOAD_STATIONS) {
    scaleFarmWorldKeys(station, ['x', 'z', 'visualX', 'visualZ', 'radius']);
  }
  for (const actor of TRAFFIC_ACTORS) {
    actor.scale *= FARM_WORLD_SCALE;
    actor.radius *= FARM_WORLD_SCALE;
    actor.route = actor.route.map(([x, z]) => [scaleFarmWorldValue(x), scaleFarmWorldValue(z)]);
  }
  for (const paddock of Object.values(LIVESTOCK_PADDOCKS)) {
    scaleFarmWorldKeys(paddock, ['minX', 'maxX', 'minZ', 'maxZ']);
  }
  for (const actor of LIVESTOCK_ACTORS) {
    actor.scale *= FARM_WORLD_SCALE;
    actor.collider *= FARM_WORLD_SCALE;
  }
  for (const actor of WIND_TREE_ACTORS) {
    actor.position = actor.position.map(scaleFarmWorldValue);
    actor.scale *= FARM_WORLD_SCALE;
  }
}

applyFarmWorldScaleToLayout();

const KENNEY_MARKET_ASSETS = [
  { file: 'display-fruit.glb', position: [-FIELD_HALF_W - 4.2, 0, FIELD_HALF_H + 3.4], rotation: Math.PI * 0.5, scale: 0.85 },
  { file: 'display-bread.glb', position: [-FIELD_HALF_W - 4.3, 0, FIELD_HALF_H + 0.9], rotation: Math.PI * 0.5, scale: 0.85 },
  { file: 'shelf-boxes.glb', position: [-FIELD_HALF_W - 7.1, 0, FIELD_HALF_H + 4.1], rotation: Math.PI, scale: 0.82 },
  { file: 'cash-register.glb', position: [-FIELD_HALF_W - 6.7, 0.12, FIELD_HALF_H + 0.4], rotation: Math.PI * 0.25, scale: 0.72 },
  { file: 'shopping-cart.glb', position: [-FIELD_HALF_W - 2.5, 0, FIELD_HALF_H + 5.2], rotation: -Math.PI * 0.1, scale: 0.75 },
  { file: 'shopping-basket.glb', position: [-FIELD_HALF_W - 8.1, 0, FIELD_HALF_H + 2.1], rotation: Math.PI * 0.35, scale: 0.78 },
  { file: 'fence.glb', position: [-FIELD_HALF_W - 1.7, 0, FIELD_HALF_H + 5.9], rotation: 0, scale: 1.1 },
  { file: 'fence.glb', position: [-FIELD_HALF_W - 8.2, 0, FIELD_HALF_H + 5.9], rotation: 0, scale: 1.1 },
];

const KENNEY_SPRITES = [
  { file: 'nature/grass_large_NE.png', position: [-FIELD_HALF_W - 8.5, 0.08, -13], size: [1.5, 1.1] },
  { file: 'nature/plant_bushLarge_NE.png', position: [FIELD_HALF_W + 8.2, 0.1, -11], size: [1.8, 1.3] },
  { file: 'nature/rock_largeA_NE.png', position: [-FIELD_HALF_W - 6.5, 0.1, 10], size: [1.45, 1.1] },
  { file: 'nature/log_stack_NE.png', position: [FIELD_HALF_W + 5.7, 0.1, 17], size: [1.8, 1.2] },
  { file: 'nature/flower_yellowA_NE.png', position: [-FIELD_HALF_W - 4.8, 0.1, -19], size: [1.05, 0.9] },
  { file: 'nature/mushroom_redGroup_NE.png', position: [FIELD_HALF_W + 4.4, 0.1, -20], size: [0.95, 0.78] },
  { file: 'farm/hayBalesStacked_E.png', position: [FIELD_HALF_W + 3.8, 0.1, FIELD_HALF_H - 1.4], size: [2.1, 1.5] },
  { file: 'farm/cornDouble_E.png', position: [-FIELD_HALF_W - 2.0, 0.1, -FIELD_HALF_H + 2.2], size: [1.7, 1.55] },
  { file: 'farm/fenceHigh_E.png', position: [FIELD_HALF_W + 2.2, 0.1, FIELD_HALF_H + 5.6], size: [1.8, 1.0] },
];

const KENNEY_ALL_IN_ONE_MODELS = [
  { file: 'mini-car-kit/carTractor.gltf', position: [FIELD_HALF_W + 13.8, 0, FIELD_HALF_H - 2.5], rotation: -Math.PI * 0.46, scale: 1.65 },
  { file: 'mini-car-kit/carTractorShovel.gltf', position: [-FIELD_HALF_W - 13.4, 0, FIELD_HALF_H + 1.2], rotation: Math.PI * 0.56, scale: 1.75 },
  { file: 'nature-3d/fence_gate.glb', position: [0, 0, FIELD_HALF_H + 1.45], rotation: Math.PI * 0.5, scale: 2.2 },
  { file: 'nature-3d/tree_simple.glb', position: [-FIELD_HALF_W - 13.8, 0, -FIELD_HALF_H - 2.8], rotation: Math.PI * 0.2, scale: 2.6 },
  { file: 'nature-3d/tree_simple.glb', position: [FIELD_HALF_W + 13.2, 0, -FIELD_HALF_H + 4.5], rotation: -Math.PI * 0.1, scale: 2.35 },
  { file: 'nature-3d/rock_largeA.glb', position: [-FIELD_HALF_W - 12.2, 0, FIELD_HALF_H - 5.1], rotation: Math.PI * 0.35, scale: 2.2 },
  { file: 'nature-3d/log_stack.glb', position: [FIELD_HALF_W + 9.2, 0, FIELD_HALF_H - 7.8], rotation: -Math.PI * 0.2, scale: 1.8 },
  { file: 'nature-3d/crops_wheatStageB.glb', position: [-FIELD_HALF_W + 5.0, 0, -FIELD_HALF_H - 6.5], rotation: Math.PI * 0.1, scale: 1.45 },
  { file: 'nature-3d/crops_cornStageD.glb', position: [-FIELD_HALF_W + 9.2, 0, -FIELD_HALF_H - 6.8], rotation: -Math.PI * 0.08, scale: 1.35 },
  { file: 'nature-3d/crop_carrot.glb', position: [-FIELD_HALF_W + 13.0, 0, -FIELD_HALF_H - 6.2], rotation: Math.PI * 0.25, scale: 1.65 },
  { file: 'nature-3d/crop_pumpkin.glb', position: [-FIELD_HALF_W + 16.4, 0, -FIELD_HALF_H - 6.4], rotation: -Math.PI * 0.18, scale: 1.55 },
  { file: 'food-kit/carrot.glb', position: [-FIELD_HALF_W - 1.2, 0.42, FIELD_HALF_H + 4.8], rotation: Math.PI * 0.1, scale: 1.2 },
  { file: 'food-kit/corn.glb', position: [-FIELD_HALF_W - 0.4, 0.38, FIELD_HALF_H + 3.6], rotation: -Math.PI * 0.2, scale: 1.15 },
  { file: 'food-kit/pumpkin.glb', position: [-FIELD_HALF_W - 2.3, 0.26, FIELD_HALF_H + 3.7], rotation: Math.PI * 0.5, scale: 1.35 },
  { file: 'hexagon-kit/building-market.glb', position: [-FIELD_HALF_W - 12.6, 0, FIELD_HALF_H + 9.8], rotation: Math.PI * 0.42, scale: 3.2 },
  { file: 'hexagon-kit/building-sheep.glb', position: [FIELD_HALF_W + 15.0, 0, FIELD_HALF_H - 9.3], rotation: -Math.PI * 0.42, scale: 3.25 },
  { file: 'hexagon-kit/stone-mountain.glb', position: [-WORLD_BOUNDS.x - 8.5, 0, -WORLD_BOUNDS.z - 7.0], rotation: Math.PI * 0.05, scale: 7.6 },
  { file: 'hexagon-kit/stone-mountain.glb', position: [-WORLD_BOUNDS.x * 0.5, 0, -WORLD_BOUNDS.z - 10.5], rotation: -Math.PI * 0.12, scale: 8.4 },
  { file: 'hexagon-kit/stone-mountain.glb', position: [0, 0, -WORLD_BOUNDS.z - 12.2], rotation: Math.PI * 0.2, scale: 9.2 },
  { file: 'hexagon-kit/stone-mountain.glb', position: [WORLD_BOUNDS.x * 0.52, 0, -WORLD_BOUNDS.z - 10.4], rotation: Math.PI * 0.08, scale: 8.1 },
  { file: 'hexagon-kit/stone-mountain.glb', position: [WORLD_BOUNDS.x + 8.6, 0, -WORLD_BOUNDS.z - 7.4], rotation: -Math.PI * 0.18, scale: 7.4 },
  { file: 'hexagon-kit/stone-hill.glb', position: [-WORLD_BOUNDS.x - 7.4, 0, WORLD_BOUNDS.z + 2.8], rotation: Math.PI * 0.28, scale: 6.6 },
  { file: 'hexagon-kit/grass-hill.glb', position: [WORLD_BOUNDS.x + 7.6, 0, WORLD_BOUNDS.z + 2.4], rotation: -Math.PI * 0.22, scale: 6.8 },
  { file: 'hexagon-kit/grass-forest.glb', position: [-WORLD_BOUNDS.x - 6.8, 0, -4.2], rotation: Math.PI * 0.1, scale: 5.4 },
  { file: 'hexagon-kit/grass-forest.glb', position: [WORLD_BOUNDS.x + 6.2, 0, 5.6], rotation: -Math.PI * 0.25, scale: 5.1 },
  { file: 'hexagon-kit/water-island.glb', position: [-WORLD_BOUNDS.x + 4.5, 0, WORLD_BOUNDS.z + 6.4], rotation: Math.PI * 0.15, scale: 4.8 },
  { file: 'hexagon-kit/unit-tree.glb', position: [-FIELD_HALF_W - 12.0, 0, -FIELD_HALF_H + 9.5], rotation: Math.PI * 0.3, scale: 3.1 },
  { file: 'hexagon-kit/unit-tree.glb', position: [FIELD_HALF_W + 11.6, 0, -FIELD_HALF_H + 11.2], rotation: -Math.PI * 0.22, scale: 3.0 },
  { file: 'survival-kit/tree-tall.glb', position: [-FIELD_HALF_W - 18.2, 0, FIELD_HALF_H - 3.3], rotation: Math.PI * 0.12, scale: 2.8 },
  { file: 'survival-kit/tree-autumn-tall.glb', position: [FIELD_HALF_W + 17.4, 0, FIELD_HALF_H + 2.5], rotation: -Math.PI * 0.16, scale: 2.65 },
  { file: 'fantasy-town-kit/tree-high-round.glb', position: [-16.8, 0, FIELD_HALF_H + 14.0], rotation: Math.PI * 0.05, scale: 2.7 },
  { file: 'fantasy-town-kit/tree-high-round.glb', position: [17.6, 0, FIELD_HALF_H + 13.4], rotation: -Math.PI * 0.08, scale: 2.55 },
  { file: 'survival-kit/fence-fortified.glb', position: [-FIELD_HALF_W - 8.5, 0, FIELD_HALF_H + 10.9], rotation: Math.PI * 0.5, scale: 2.6 },
  { file: 'survival-kit/fence-fortified.glb', position: [FIELD_HALF_W + 8.5, 0, FIELD_HALF_H + 10.9], rotation: Math.PI * 0.5, scale: 2.6 },
  { file: 'fantasy-town-kit/fence-gate.glb', position: [0, 0, FIELD_HALF_H + 10.9], rotation: Math.PI * 0.5, scale: 2.45 },
  { file: 'hexagon-kit/path-straight.glb', position: [0, 0.02, FIELD_HALF_H + 8.9], rotation: Math.PI * 0.5, scale: 4.0 },
  { file: 'hexagon-kit/path-crossing.glb', position: [0, 0.02, -FIELD_HALF_H - 3.1], rotation: 0, scale: 3.5 },
  { file: 'hexagon-kit/path-corner.glb', position: [-FIELD_HALF_W - 9.6, 0.02, FIELD_HALF_H + 4.0], rotation: Math.PI * 0.5, scale: 3.4 },
  { file: 'hexagon-kit/path-corner.glb', position: [FIELD_HALF_W + 9.6, 0.02, FIELD_HALF_H + 4.0], rotation: Math.PI, scale: 3.4 },
  { file: 'hexagon-kit/dirt.glb', position: [-FIELD_HALF_W - 14.8, 0.01, -FIELD_HALF_H + 1.2], rotation: Math.PI * 0.18, scale: 4.8 },
  { file: 'hexagon-kit/dirt.glb', position: [FIELD_HALF_W + 13.8, 0.01, FIELD_HALF_H - 3.3], rotation: -Math.PI * 0.12, scale: 4.6 },
];

const MUSIC_NOTES = [196, 247, 294, 330, 294, 247, 220, 247, 262, 330, 392, 330, 294, 247, 220, 196];

const AUDIO_ASSETS = {
  click: `${ALL_IN_ONE_BASE}audio-interface/click_003.ogg`,
  confirm: `${ALL_IN_ONE_BASE}audio-interface/confirmation_001.ogg`,
  error: `${ALL_IN_ONE_BASE}audio-interface/error_004.ogg`,
  select: `${ALL_IN_ONE_BASE}audio-interface/select_005.ogg`,
};

const CONTRACT_PATTERNS = [
  { id: 'clean-start', label: 'Clear the first rows', target: 18, rewardBase: 120 },
  { id: 'market-load', label: 'Fill the market order', target: 28, rewardBase: 170 },
  { id: 'wide-pass', label: 'Cut a clean wide path', target: 38, rewardBase: 230 },
  { id: 'season-push', label: 'Push the season quota', target: 52, rewardBase: 320 },
  { id: 'field-master', label: 'Dominate this field', target: 70, rewardBase: 470 },
];

const CROP_CONTRACTS = {
  wheat: [
    { id: 'bakery-run', label: 'Bakery Wheat Run', brief: 'Clear golden rows for the village ovens.', targetBonus: 0, rewardMultiplier: 1.0 },
    { id: 'mill-order', label: 'Mill Wheat Order', brief: 'Keep long passes clean for the mill carts.', targetBonus: 4, rewardMultiplier: 1.08 },
  ],
  lettuce: [
    { id: 'fresh-basket', label: 'Fresh Lettuce Basket', brief: 'Cut crisp short rows for the morning market.', targetBonus: 1, rewardMultiplier: 1.04 },
    { id: 'salad-run', label: 'Salad Dock Run', brief: 'Fast green beds reward clean little turns.', targetBonus: 3, rewardMultiplier: 1.1 },
  ],
  tomato: [
    { id: 'red-crates', label: 'Tomato Crate Order', brief: 'Harvest ripe tomato lanes before they bruise.', targetBonus: 3, rewardMultiplier: 1.14 },
    { id: 'sauce-load', label: 'Sauce House Load', brief: 'Steady rows keep the packing crew moving.', targetBonus: 6, rewardMultiplier: 1.22 },
  ],
  corn: [
    { id: 'market-corn', label: 'Market Corn Load', brief: 'Cut through tall stalks before the trailer fills.', targetBonus: 3, rewardMultiplier: 1.12 },
    { id: 'feed-silo', label: 'Feed Silo Corn', brief: 'Pack dense corn for the morning feed mix.', targetBonus: 6, rewardMultiplier: 1.18 },
  ],
  soybean: [
    { id: 'protein-sacks', label: 'Soybean Sack Run', brief: 'Small green beds pay for quick, tidy passes.', targetBonus: 2, rewardMultiplier: 1.1 },
    { id: 'greenhouse-feed', label: 'Greenhouse Soy Feed', brief: 'Keep the trial bed clean for the grow house.', targetBonus: 5, rewardMultiplier: 1.18 },
  ],
  sunflower: [
    { id: 'oil-press', label: 'Sunflower Oil Press', brief: 'Sweep bright sunflower lanes for bonus coins.', targetBonus: 5, rewardMultiplier: 1.2 },
    { id: 'festival-blooms', label: 'Festival Blooms', brief: 'Leave a clean path for the harvest fair wagon.', targetBonus: 8, rewardMultiplier: 1.28 },
  ],
  carrot: [
    { id: 'root-crates', label: 'Root Crate Sprint', brief: 'Low crops reward tight, careful turns.', targetBonus: 6, rewardMultiplier: 1.25 },
    { id: 'soup-kitchen', label: 'Soup Kitchen Roots', brief: 'Collect steady carrot rows for the town kitchen.', targetBonus: 9, rewardMultiplier: 1.32 },
  ],
  lavender: [
    { id: 'flower-stall', label: 'Lavender Flower Stall', brief: 'Purple rows pay extra when the route stays clean.', targetBonus: 6, rewardMultiplier: 1.26 },
    { id: 'perfume-batch', label: 'Perfume Batch Load', brief: 'Careful steering protects the premium bunches.', targetBonus: 9, rewardMultiplier: 1.34 },
  ],
  potato: [
    { id: 'cellar-sacks', label: 'Potato Cellar Sacks', brief: 'Heavy root rows reward short, controlled cuts.', targetBonus: 5, rewardMultiplier: 1.2 },
    { id: 'fry-house', label: 'Fry House Order', brief: 'Bring steady potato sacks to the kitchen dock.', targetBonus: 8, rewardMultiplier: 1.3 },
  ],
  cotton: [
    { id: 'textile-bales', label: 'Textile Cotton Bales', brief: 'Soft cotton fields pay extra for clean rows.', targetBonus: 7, rewardMultiplier: 1.35 },
    { id: 'white-field', label: 'White Field Contract', brief: 'High contrast cotton rewards wide cutters.', targetBonus: 10, rewardMultiplier: 1.42 },
  ],
  pumpkin: [
    { id: 'autumn-market', label: 'Autumn Pumpkin Market', brief: 'Heavy pumpkins bring the biggest late-season payout.', targetBonus: 8, rewardMultiplier: 1.48 },
    { id: 'lantern-load', label: 'Lantern Load Rush', brief: 'Finish the orange field before sundown.', targetBonus: 12, rewardMultiplier: 1.58 },
  ],
  rice: [
    { id: 'waterline-bags', label: 'Rice Waterline Bags', brief: 'Long bright rows pay well when the passes stay straight.', targetBonus: 7, rewardMultiplier: 1.36 },
    { id: 'market-scale', label: 'Rice Market Scale', brief: 'Finish the waterline field for the south market scale.', targetBonus: 11, rewardMultiplier: 1.48 },
  ],
};

const UPGRADE_DEFS = {
  speed: {
    name: 'Engine',
    desc: 'More speed across long fields.',
    baseCost: 55,
    max: 6,
  },
  cutWidth: {
    name: 'Cutter',
    desc: 'Harvest a wider path per pass.',
    baseCost: 70,
    max: 6,
  },
  capacity: {
    name: 'Trailer',
    desc: 'Carry more crop before selling.',
    baseCost: 65,
    max: 7,
  },
  price: {
    name: 'Market',
    desc: 'Earn more coins from every load.',
    baseCost: 85,
    max: 6,
  },
};

const DEFAULT_SAVE = {
  coins: 0,
  field: 1,
  cropIndex: 0,
  contract: null,
  totalContracts: 0,
  totalSold: 0,
  bestSeasonCoins: 0,
  bestCombo: 0,
  paintId: 'harvest-red',
  machineId: 'harvester-01',
  upgrades: { speed: 0, cutWidth: 0, capacity: 0, price: 0 },
  achievements: [],
  totalCropsHarvested: 0,
  totalFieldsCleared: 0,
  totalSpent: 0,
  fastestFieldSec: 0,
  totalSeasons: 0,
  totalMagnetUses: 0,
  totalTurboUses: 0,
  totalFertilizerUsed: 0,
  ownedMachines: ['harvester-01'],
  machineLevels: { 'harvester-01': 1 },
  tutorialSeen: false,
  daily: null,
  fields: {},
  inventory: { fertilizer: 2 },
};

const ACHIEVEMENTS = [
  { id: 'first-cut', name: 'First Cut', desc: 'Harvest your first crop.', icon: '🌾', reward: 25, check: (s) => s.totalCropsHarvested >= 1 },
  { id: 'first-sell', name: 'Hauler', desc: 'Sell a load at a silo or barn dock.', icon: '🚚', reward: 40, check: (s) => s.totalSold >= 1 },
  { id: 'combo-150', name: 'Smooth Operator', desc: 'Hit a combo of 150.', icon: '🔥', reward: 60, check: (s) => (s.bestCombo || 0) >= 150 },
  { id: 'combo-1000', name: 'Field Wizard', desc: 'Hit a combo of 1,000.', icon: '⚡', reward: 180, check: (s) => (s.bestCombo || 0) >= 1000 },
  { id: 'first-contract', name: 'Contractor', desc: 'Complete your first contract.', icon: '📜', reward: 60, check: (s) => (s.totalContracts || 0) >= 1 },
  { id: 'contracts-10', name: 'Trusted Supplier', desc: 'Complete 10 contracts.', icon: '🏷️', reward: 200, check: (s) => (s.totalContracts || 0) >= 10 },
  { id: 'field-1', name: 'Farm Hand', desc: 'Clear your first field.', icon: '🌱', reward: 75, check: (s) => (s.totalFieldsCleared || 0) >= 1 },
  { id: 'field-12', name: 'Season Champ', desc: 'Clear 12 fields.', icon: '🏆', reward: 400, check: (s) => (s.totalFieldsCleared || 0) >= 12 },
  { id: 'season-2', name: 'Second Wind', desc: 'Reach Season 2.', icon: '🌄', reward: 300, check: (s) => (s.totalSeasons || 0) >= 1 },
  { id: 'all-crops', name: 'Crop Collector', desc: 'Unlock all 6 crops.', icon: '🎨', reward: 500, check: (s) => s.field >= 10 },
  { id: 'tycoon-1k', name: 'Local Tycoon', desc: 'Accumulate 1,000 coins lifetime.', icon: '💰', reward: 100, check: (s) => (s.totalSold || 0) >= 1000 },
  { id: 'tycoon-10k', name: 'Harvest Baron', desc: 'Accumulate 10,000 coins lifetime.', icon: '👑', reward: 500, check: (s) => (s.totalSold || 0) >= 10000 },
  { id: 'crops-1k', name: 'Thousand Cuts', desc: 'Harvest 1,000 crops.', icon: '✂️', reward: 120, check: (s) => (s.totalCropsHarvested || 0) >= 1000 },
  { id: 'crops-10k', name: 'Field Marshal', desc: 'Harvest 10,000 crops.', icon: '🎖️', reward: 600, check: (s) => (s.totalCropsHarvested || 0) >= 10000 },
  { id: 'max-engine', name: 'Speed Demon', desc: 'Max out the Engine upgrade.', icon: '🏁', reward: 200, check: (s) => (s.upgrades?.speed || 0) >= 6 },
  { id: 'max-trailer', name: 'Big Hauler', desc: 'Max out the Trailer upgrade.', icon: '📦', reward: 200, check: (s) => (s.upgrades?.capacity || 0) >= 7 },
  { id: 'first-machine', name: 'Fleet Owner', desc: 'Buy a second machine.', icon: '🚜', reward: 120, check: (s) => (s.ownedMachines || []).length >= 2 },
  { id: 'machine-level-4', name: 'Workshop Pro', desc: 'Upgrade any machine to level 4.', icon: '🔧', reward: 260, check: (s) => Object.values(s.machineLevels || {}).some((level) => level >= MACHINE_LEVEL_MAX) },
  { id: 'fleet-complete', name: 'Full Garage', desc: 'Own every machine.', icon: '🏭', reward: 650, check: (s) => (s.ownedMachines || []).length >= MACHINES.length },
  { id: 'magnet-1', name: 'Magnetic Personality', desc: 'Use the Magnet for the first time.', icon: '🧲', reward: 50, check: (s) => (s.totalMagnetUses || 0) >= 1 },
  { id: 'fast-field', name: 'Lightning Harvest', desc: 'Clear a field in under 90 seconds.', icon: '⚡', reward: 250, check: (s) => s.fastestFieldSec > 0 && s.fastestFieldSec < 90 },
];

const DAILY_CHALLENGES = [
  { id: 'cargo-rush', label: 'Cargo Rush', desc: 'Sell {target} loads today.', metric: 'sells', baseTarget: 8, reward: 250 },
  { id: 'crop-day', label: 'Crop Day', desc: 'Harvest {target} crops today.', metric: 'crops', baseTarget: 350, reward: 220 },
  { id: 'combo-day', label: 'Combo Day', desc: 'Hit a combo of at least {target}.', metric: 'combo', baseTarget: 60, reward: 180 },
  { id: 'field-day', label: 'Field Day', desc: 'Clear {target} fields today.', metric: 'fields', baseTarget: 3, reward: 300 },
  { id: 'spend-day', label: 'Shop Spree', desc: 'Spend {target} coins on upgrades today.', metric: 'spent', baseTarget: 400, reward: 200 },
];

const app = document.querySelector('#app');

const fallbackSdk = {
  init: async () => ({ gameId: 'local', locale: 'pt-BR', signedIn: false }),
  gameLoadingProgress: () => {},
  gameLoadingFinished: () => {},
  gameplayStart: () => {},
  gameplayStop: () => {},
  commercialBreak: async () => {},
  rewardedBreak: async () => ({ granted: true }),
  requestHapticFeedback: () => {},
  happyTime: () => {},
  captureError: (error) => console.warn(error),
  data: {
    get: async () => null,
    set: async () => {},
  },
};

let sdk = fallbackSdk;
let gameplayStarted = false;
let paused = false;
let lastTime = 0;
let cameraMode = 0;
let save = structuredClone(DEFAULT_SAVE);
let cropTiles = [];
let harvestedCount = 0;
let cropMeshes = [];
let harvestPulse = 0;
let noticeTimer = 0;
let cargo = 0;
let vehicleSpeed = 0;
let dustTimer = 0;
let audioContext = null;
const audioBuffers = new Map();
let lastHarvestSoundAt = 0;
let inMenu = true;
let boostUntil = 0;
let currentSeasonStartCoins = 0;
let comboCount = 0;
let comboTimer = 0;
let bestComboThisField = 0;
let lastComboMilestone = 0;
let rowCleared = [];
let rowTileCounts = [];
let rowHarvestedCounts = [];
let fieldStartTime = 0;
let fieldCompleted = false;
let currentFieldVisualStage = FIELD_STATES.MATURE;
let growthNoticeCooldown = 0;
let musicEnabled = true;
let musicTimer = null;
let musicStep = 0;
let edgeNoticeCooldown = 0;
let magnetUntil = 0;
let magnetCooldownUntil = 0;
let tutorialIndex = 0;
let tutorialUntil = 0;
let fieldBannerUntil = 0;
let dailySnapshot = null;
let farmSceneGroup = null;
let farmSceneCullingItems = [];
let farmCullTimer = 0;
let currentMachineId = null;
let currentFieldAnchor = FIELD_ANCHORS[0];
let staticColliders = [];
let staticColliderGrid = new Map();
let roadCells = new Map();
let terrainRaycastMeshes = [];
let terrainHeightCache = new Map();
let collisionNoticeCooldown = 0;
let trafficActors = [];
let livestockActors = [];
let windTreeActors = [];
let fieldGuideGroup = null;
let activeFieldSurfaceGroup = null;
let routeArrow = null;
let cropAssetParts = new Map();
let worldLifeReady = false;
let rainSystem = null;
let rainActive = false;
let rainTimer = 0;
let rainCooldown = 22;
let windTime = 0;
let windStrength = 0.55;
let activeGamepadIndex = null;
let previousGamepadButtons = new Set();
const animatedProps = [];

const MAGNET_DURATION_MS = 12000;
const MAGNET_COOLDOWN_MS = 38000;
const MAGNET_RADIUS = 7.5;

const input = {
  forward: false,
  back: false,
  left: false,
  right: false,
  joystickX: 0,
  joystickY: 0,
  gamepadX: 0,
  gamepadY: 0,
};

const vehicle = {
  position: new THREE.Vector3(0, 0, START_POSITION_Z),
  angle: Math.PI,
};

const tmpObject = new THREE.Object3D();
const tmpVector = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
const terrainRayOrigin = new THREE.Vector3();
const terrainRaycaster = new THREE.Raycaster();
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const farmAssetCache = new Map();

const shell = document.createElement('section');
shell.className = 'game-shell';

const canvas = document.createElement('canvas');
canvas.className = 'game-canvas';
shell.append(canvas);

const hud = document.createElement('div');
hud.className = 'hud';
hud.innerHTML = `
  <div class="top-bar">
    <div class="hud-chip"><span>Coins</span><strong id="coinsText">0</strong></div>
    <div class="hud-chip"><span>Season</span><strong id="seasonText">1-1</strong></div>
    <div class="hud-chip"><span>Crop</span><strong id="cropText">Wheat</strong></div>
    <div class="hud-chip"><span id="progressLabel">Harvest</span><strong id="progressText">0%</strong></div>
  </div>
  <div class="contract-card" id="contractCard">
    <span id="contractLabel">Contract</span>
    <strong id="contractProgress">0%</strong>
    <small id="contractReward">Reward 0</small>
  </div>
  <div class="objective-board" id="objectiveBoard">
    <strong id="objectiveTitle">Field Plan</strong>
    <span id="objectiveMeta">0 clean rows</span>
    <small id="objectiveBonus">Best combo 0</small>
  </div>
  <div class="combo-badge" id="comboBadge">Combo x0</div>
  <div class="capacity-wrap" aria-label="Trailer capacity">
    <div class="capacity-fill" id="capacityFill"></div>
    <div class="capacity-label" id="capacityText">0%</div>
  </div>
  <div class="button-row">
    <button class="wood-button" id="sellButton" type="button" disabled>Sell</button>
    <button class="wood-button" id="fertilizerButton" type="button">Fertilize</button>
    <button class="wood-button" id="magnetButton" type="button">Magnet</button>
    <button class="wood-button" id="boostButton" type="button">Turbo</button>
    <button class="wood-button" id="musicButton" type="button">Music</button>
    <button class="wood-button" id="cameraButton" type="button">Cam</button>
    <button class="wood-button" id="shopButton" type="button">Shop</button>
  </div>
  <div class="field-banner" id="fieldBanner" aria-live="polite"></div>
  <div class="tutorial-card" id="tutorialCard" aria-live="polite"></div>
  <div class="daily-card" id="dailyCard" aria-live="polite"></div>
  <div class="achievement-toast" id="achievementToast" role="status"></div>
  <div class="season-strip" id="seasonStrip"></div>
  <div class="notice" id="noticeText">Drive through the field to harvest.</div>
  <div class="silo-guide" id="siloGuide">Trailer full - drive to silo or barn</div>
  <div class="route-guide" id="routeGuide" aria-live="polite">
    <div class="route-guide-arrow" id="routeGuideArrow"></div>
    <div><strong id="routeGuideLabel">Field</strong><span id="routeGuideDistance">0m</span></div>
  </div>
  <div class="joystick" id="joystick" aria-label="Virtual joystick"><div class="joystick-knob" id="joystickKnob"></div></div>
  <section class="shop-panel" id="shopPanel" aria-label="Upgrade shop">
    <div class="panel-header">
      <h2 class="panel-title">Barn Upgrades</h2>
      <button class="wood-button" id="closeShopButton" type="button">Close</button>
    </div>
    <p class="shop-summary" id="shopSummary">Upgrade your machine to unlock bigger harvests.</p>
    <div class="shop-ledger" id="shopLedger"></div>
    <div class="crop-roadmap" id="cropRoadmap"></div>
    <h3 class="paint-title">Seeds & Fertilizer</h3>
    <div class="consumable-grid" id="consumableGrid"></div>
    <h3 class="paint-title">Machines</h3>
    <div class="machine-grid" id="machineGrid"></div>
    <div class="upgrade-grid" id="upgradeGrid"></div>
    <h3 class="paint-title">Paint Jobs</h3>
    <div class="paint-grid" id="paintGrid"></div>
    <h3 class="paint-title">Achievements</h3>
    <div class="achievement-grid" id="achievementGrid"></div>
  </section>
  <section class="title-panel open" id="titlePanel" aria-label="Harvest Rush 3D menu">
    <div class="title-badge">Pixlland Studios</div>
    <h1>Harvest Rush 3D</h1>
    <p>A bright farm sprint across twelve fields of golden crops.</p>
    <div class="title-stats" id="titleStats"></div>
    <div class="title-daily" id="titleDaily"></div>
    <button class="wood-button primary" id="playButton" type="button">Play</button>
    <button class="wood-button" id="titleResetButton" type="button">Reset</button>
    <small class="title-hint">WASD / arrows / left stick to drive · E / Y swaps camera · ESC / Start pauses</small>
  </section>
  <section class="season-panel" id="seasonPanel" aria-label="Season complete">
    <h2>Season Complete</h2>
    <p id="seasonResult">Fresh fields are ready.</p>
    <button class="wood-button primary" id="continueSeasonButton" type="button">Next Season</button>
  </section>
  <section class="pause-panel" id="pausePanel" aria-label="Paused">
    <div class="panel-header">
      <h2 class="panel-title">Paused</h2>
      <button class="wood-button" id="resumeButton" type="button">Resume</button>
    </div>
    <p>The farm is waiting in warm afternoon light.</p>
    <button class="wood-button" id="resetButton" type="button">Reset Farm</button>
  </section>
`;
shell.append(hud);
app.append(shell);

const ui = {
  coinsText: document.querySelector('#coinsText'),
  seasonText: document.querySelector('#seasonText'),
  cropText: document.querySelector('#cropText'),
  progressText: document.querySelector('#progressText'),
  progressLabel: document.querySelector('#progressLabel'),
  contractCard: document.querySelector('#contractCard'),
  contractLabel: document.querySelector('#contractLabel'),
  contractProgress: document.querySelector('#contractProgress'),
  contractReward: document.querySelector('#contractReward'),
  objectiveBoard: document.querySelector('#objectiveBoard'),
  objectiveTitle: document.querySelector('#objectiveTitle'),
  objectiveMeta: document.querySelector('#objectiveMeta'),
  objectiveBonus: document.querySelector('#objectiveBonus'),
  comboBadge: document.querySelector('#comboBadge'),
  capacityFill: document.querySelector('#capacityFill'),
  capacityText: document.querySelector('#capacityText'),
  sellButton: document.querySelector('#sellButton'),
  fertilizerButton: document.querySelector('#fertilizerButton'),
  magnetButton: document.querySelector('#magnetButton'),
  boostButton: document.querySelector('#boostButton'),
  musicButton: document.querySelector('#musicButton'),
  cameraButton: document.querySelector('#cameraButton'),
  shopButton: document.querySelector('#shopButton'),
  fieldBanner: document.querySelector('#fieldBanner'),
  tutorialCard: document.querySelector('#tutorialCard'),
  dailyCard: document.querySelector('#dailyCard'),
  achievementToast: document.querySelector('#achievementToast'),
  achievementGrid: document.querySelector('#achievementGrid'),
  titleDaily: document.querySelector('#titleDaily'),
  closeShopButton: document.querySelector('#closeShopButton'),
  shopSummary: document.querySelector('#shopSummary'),
  shopLedger: document.querySelector('#shopLedger'),
  cropRoadmap: document.querySelector('#cropRoadmap'),
  consumableGrid: document.querySelector('#consumableGrid'),
  machineGrid: document.querySelector('#machineGrid'),
  upgradeGrid: document.querySelector('#upgradeGrid'),
  paintGrid: document.querySelector('#paintGrid'),
  shopPanel: document.querySelector('#shopPanel'),
  seasonStrip: document.querySelector('#seasonStrip'),
  siloGuide: document.querySelector('#siloGuide'),
  routeGuide: document.querySelector('#routeGuide'),
  routeGuideArrow: document.querySelector('#routeGuideArrow'),
  routeGuideLabel: document.querySelector('#routeGuideLabel'),
  routeGuideDistance: document.querySelector('#routeGuideDistance'),
  noticeText: document.querySelector('#noticeText'),
  titlePanel: document.querySelector('#titlePanel'),
  titleStats: document.querySelector('#titleStats'),
  playButton: document.querySelector('#playButton'),
  titleResetButton: document.querySelector('#titleResetButton'),
  seasonPanel: document.querySelector('#seasonPanel'),
  seasonResult: document.querySelector('#seasonResult'),
  continueSeasonButton: document.querySelector('#continueSeasonButton'),
  joystick: document.querySelector('#joystick'),
  joystickKnob: document.querySelector('#joystickKnob'),
  pausePanel: document.querySelector('#pausePanel'),
  resumeButton: document.querySelector('#resumeButton'),
  resetButton: document.querySelector('#resetButton'),
};

const popLayer = document.createElement('div');
popLayer.className = 'pop-layer';
hud.append(popLayer);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ed4ef);
scene.fog = new THREE.Fog(0x9ed4ef, 180, 760);

const camera = new THREE.PerspectiveCamera(56, 16 / 9, 0.1, 820);

const sun = new THREE.DirectionalLight(0xfff1c2, 3.1);
sun.position.set(-16, 28, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -36;
sun.shadow.camera.right = 36;
sun.shadow.camera.top = 36;
sun.shadow.camera.bottom = -36;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xd8f4ff, 0x7d5d36, 1.6));

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GROUND_SIZE.width, GROUND_SIZE.depth, 1, 1),
  new THREE.MeshLambertMaterial({ color: 0x7daa52 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const fieldBase = new THREE.Mesh(
  new THREE.BoxGeometry(FIELD_COLS * TILE_SIZE + 1.2, 0.08, FIELD_ROWS * TILE_SIZE + 1.2),
  new THREE.MeshLambertMaterial({ color: 0x8c6638 })
);
fieldBase.position.set(0, 0.02, 0);
fieldBase.receiveShadow = true;
scene.add(fieldBase);

const laneLines = new THREE.Group();
for (let i = 0; i <= FIELD_COLS; i += 4) {
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.02, FIELD_ROWS * TILE_SIZE + 0.5),
    new THREE.MeshBasicMaterial({ color: 0xa9844e, transparent: true, opacity: 0.45 })
  );
  marker.position.set(-FIELD_HALF_W + i * TILE_SIZE, 0.08, 0);
  laneLines.add(marker);
}
scene.add(laneLines);
if (USE_FARM_SCENE) {
  ground.visible = false;
  fieldBase.visible = false;
  laneLines.visible = false;
}

const vehicleGroup = createVehicle();
scene.add(vehicleGroup);

const siloGroup = createSiloStation();
siloGroup.position.set(UNLOAD_STATIONS[0].visualX, 0, UNLOAD_STATIONS[0].visualZ);
siloGroup.visible = !USE_FARM_SCENE;
scene.add(siloGroup);

const barnGroup = createBarn();
barnGroup.position.set(UNLOAD_STATIONS[1].visualX, 0, UNLOAD_STATIONS[1].visualZ);
barnGroup.visible = !USE_FARM_SCENE;
scene.add(barnGroup);

const sellZones = UNLOAD_STATIONS.map((station) => {
  const zone = new THREE.Mesh(
    new THREE.RingGeometry(station.radius - 0.45, station.radius, 64),
    new THREE.MeshBasicMaterial({ color: 0xffd769, side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
  );
  zone.rotation.x = -Math.PI / 2;
  zone.position.set(station.x, 0.11, station.z);
  zone.userData.station = station;
  scene.add(zone);
  return zone;
});
const sellZone = sellZones[0];

fieldGuideGroup = createFieldPlanGuides();
scene.add(fieldGuideGroup);
activeFieldSurfaceGroup = new THREE.Group();
scene.add(activeFieldSurfaceGroup);

const siloArrow = createSiloArrow();
siloArrow.position.set(sellZone.position.x, 5.6, sellZone.position.z);
scene.add(siloArrow);
routeArrow = createRouteArrow();
scene.add(routeArrow);

const dustParticles = createDustPool(36);
rainSystem = createRainSystem(420);
scene.add(rainSystem.points);

const farmSceneReady = USE_FARM_SCENE ? loadFarmScene() : Promise.resolve();
const cropModelsReady = loadCropModelAssets();
if (!USE_FARM_SCENE) {
  createFence();
  createDecor();
}
loadSave().then(startGame).catch((error) => {
  fallbackSdk.captureError(error);
  startGame();
});

async function loadSave() {
  sdk = await waitForSdk();
  sdk.gameLoadingProgress(0.1);
  const localSave = readLocalSave();
  save = { ...structuredClone(DEFAULT_SAVE), ...localSave };
  save.upgrades = { ...DEFAULT_SAVE.upgrades, ...(localSave.upgrades || {}) };

  try {
    const cloudSave = await sdk.data.get(STORAGE_KEY);
    if (cloudSave && typeof cloudSave === 'object') {
      save = { ...save, ...cloudSave, upgrades: { ...save.upgrades, ...(cloudSave.upgrades || {}) } };
    }
  } catch (error) {
    console.warn('Cloud save unavailable', error);
  }
  normalizeSave();
  currentSeasonStartCoins = save.coins;
  sdk.gameLoadingProgress(0.45);
}

async function waitForSdk() {
  const startedAt = performance.now();
  while (!window.PixllandSDK && performance.now() - startedAt < 2500) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const browserSdk = window.PixllandSDK || {};
  const activeSdk = {
    ...fallbackSdk,
    ...browserSdk,
    data: {
      ...fallbackSdk.data,
      ...(browserSdk.data || {}),
    },
  };
  for (const method of ['init', 'gameLoadingProgress', 'gameLoadingFinished', 'gameplayStart', 'gameplayStop', 'commercialBreak', 'rewardedBreak', 'requestHapticFeedback', 'happyTime', 'captureError']) {
    if (typeof activeSdk[method] !== 'function') activeSdk[method] = fallbackSdk[method];
  }
  for (const method of ['get', 'set']) {
    if (typeof activeSdk.data[method] !== 'function') activeSdk.data[method] = fallbackSdk.data[method];
  }
  try {
    await activeSdk.init({
      onPause: () => setPaused(true),
      onResume: () => setPaused(false),
      onError: (error) => activeSdk.captureError(error?.message || String(error)),
    });
  } catch (error) {
    console.warn('Pixlland SDK init fallback', error);
  }
  return activeSdk;
}

function loadFarmScene() {
  return new Promise((resolve) => {
    gltfLoader.load(
      FARM_SCENE_FILE,
      (gltf) => {
        farmSceneGroup = gltf.scene;
        farmSceneCullingItems = [];
        terrainRaycastMeshes = [];
        terrainHeightCache = new Map();
        farmSceneGroup.name = 'FarmScene';
        farmSceneGroup.scale.setScalar(FARM_SCENE_SCALE);
        farmSceneGroup.position.set(0, -0.04, 0);
        farmSceneGroup.rotation.y = 0;
        farmSceneGroup.updateMatrix();
        farmSceneGroup.traverse((object) => {
          object.frustumCulled = true;
          object.matrixAutoUpdate = false;
          if (!object.isMesh) return;
          object.castShadow = false;
          object.receiveShadow = false;
          if (object.material?.map) {
            object.material.map.colorSpace = THREE.SRGBColorSpace;
            object.material.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
            object.material.map.minFilter = THREE.LinearMipmapLinearFilter;
            object.material.map.magFilter = THREE.LinearFilter;
          }
        });
        farmSceneGroup.updateMatrixWorld(true);
        farmSceneGroup.traverse((object) => {
          if (!object.isMesh || !object.geometry) return;
          if (isTerrainSurfaceName((object.name || '').toLowerCase())) terrainRaycastMeshes.push(object);
          if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
          const sphere = object.geometry.boundingSphere.clone().applyMatrix4(object.matrixWorld);
          farmSceneCullingItems.push({
            mesh: object,
            center: sphere.center,
            radius: sphere.radius,
          });
        });
        buildRoadNavigationFromFarmScene();
        buildStaticCollidersFromFarmScene();
        scene.add(farmSceneGroup);
        resolve(farmSceneGroup);
      },
      (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.min(0.74, 0.45 + (event.loaded / event.total) * 0.28);
        sdk.gameLoadingProgress(progress);
      },
      (error) => {
        sdk.captureError(error);
        console.warn('Farm scene failed to load', error);
        resolve(null);
      }
    );
  });
}

async function startGame() {
  sdk.gameLoadingProgress(0.75);
  if (USE_FARM_SCENE) {
    await farmSceneReady;
    sdk.gameLoadingProgress(0.88);
  }
  await loadEditorLevel();
  await cropModelsReady;
  sdk.gameLoadingProgress(0.93);
  ensureContractForField();
  ensureDaily();
  placeVehicleAtFieldStart();
  buildField();
  initializeWorldLife();
  refreshMachineModel();
  applyPaint();
  updateVehicleStats();
  bindInput();
  renderShop();
  updateHud();
  updateDailyCard();
  resize();
  sdk.gameLoadingProgress(1);
  sdk.gameLoadingFinished();
  updateTitleStats();
  sdk.gameplayStop();
  checkAchievements();
  requestAnimationFrame(loop);
}

async function loadEditorLevel() {
  try {
    const response = await fetch(EDITOR_LEVEL_FILE, { cache: 'no-store' });
    if (!response.ok) return null;
    const level = await response.json();
    applyEditorLevelToRuntime(level);
    return level;
  } catch (error) {
    console.warn('Editor level data unavailable', error);
    return null;
  }
}

function getLevelAsset(level, key) {
  return (level.assetLibrary || []).find((asset) => asset.key === key);
}

function toFarmPackFile(url) {
  if (!url || !url.startsWith('assets/vendor/farm-pack/')) return null;
  return url.slice('assets/vendor/farm-pack/'.length);
}

function applyEditorLevelToRuntime(level) {
  const treeActors = (level.objects || [])
    .filter((object) => object.layer === 'tree-line')
    .map((object) => {
      const asset = getLevelAsset(level, object.assetKey);
      const file = toFarmPackFile(asset?.url);
      const position = object.transform?.position;
      const rotation = object.transform?.rotation;
      const scale = object.transform?.scale;
      if (!file || !Array.isArray(position) || !Array.isArray(scale)) return null;
      return {
        file,
        position: [Number(position[0]) || 0, Number(position[2]) || 0],
        rotationY: Array.isArray(rotation) ? Number(rotation[1]) : undefined,
        scale: Number(scale[0]) || 1,
      };
    })
    .filter(Boolean);

  if (treeActors.length > 0) {
    WIND_TREE_ACTORS.splice(0, WIND_TREE_ACTORS.length, ...treeActors);
  }
}

function normalizeSave() {
  save.field = Math.max(1, Number(save.field) || 1);
  save.coins = Math.max(0, Number(save.coins) || 0);
  save.totalContracts = Math.max(0, Number(save.totalContracts) || 0);
  save.totalSold = Math.max(0, Number(save.totalSold) || 0);
  save.bestSeasonCoins = Math.max(0, Number(save.bestSeasonCoins) || 0);
  save.bestCombo = Math.max(0, Number(save.bestCombo) || 0);
  save.totalCropsHarvested = Math.max(0, Number(save.totalCropsHarvested) || 0);
  save.totalFieldsCleared = Math.max(0, Number(save.totalFieldsCleared) || 0);
  save.totalSpent = Math.max(0, Number(save.totalSpent) || 0);
  save.totalSeasons = Math.max(0, Number(save.totalSeasons) || 0);
  save.totalMagnetUses = Math.max(0, Number(save.totalMagnetUses) || 0);
  save.totalTurboUses = Math.max(0, Number(save.totalTurboUses) || 0);
  save.totalFertilizerUsed = Math.max(0, Number(save.totalFertilizerUsed) || 0);
  save.fastestFieldSec = Math.max(0, Number(save.fastestFieldSec) || 0);
  save.achievements = Array.isArray(save.achievements) ? save.achievements.filter((id) => ACHIEVEMENTS.some((a) => a.id === id)) : [];
  save.tutorialSeen = Boolean(save.tutorialSeen);
  save.upgrades = { ...DEFAULT_SAVE.upgrades, ...(save.upgrades || {}) };
  for (const key of Object.keys(save.upgrades)) save.upgrades[key] = Math.max(0, Number(save.upgrades[key]) || 0);
  const previousOwnedMachines = Array.isArray(save.ownedMachines) ? save.ownedMachines : null;
  const ownedMachines = new Set(previousOwnedMachines || MACHINES.filter((machine) => isMachineUnlocked(machine)).map((machine) => machine.id));
  ownedMachines.add(MACHINES[0].id);
  save.ownedMachines = [...ownedMachines].filter((id) => MACHINES.some((machine) => machine.id === id));
  save.machineLevels = save.machineLevels && typeof save.machineLevels === 'object' && !Array.isArray(save.machineLevels)
    ? save.machineLevels
    : {};
  for (const machine of MACHINES) {
    if (!save.ownedMachines.includes(machine.id)) {
      delete save.machineLevels[machine.id];
      continue;
    }
    save.machineLevels[machine.id] = THREE.MathUtils.clamp(Math.floor(Number(save.machineLevels[machine.id]) || 1), 1, MACHINE_LEVEL_MAX);
  }
  save.inventory = { ...DEFAULT_SAVE.inventory, ...(save.inventory || {}) };
  save.inventory.fertilizer = Math.max(0, Math.floor(Number(save.inventory.fertilizer) || 0));
  save.fields = save.fields && typeof save.fields === 'object' && !Array.isArray(save.fields) ? save.fields : {};
  if (!PAINTS.some((paint) => paint.id === save.paintId && isPaintUnlocked(paint))) save.paintId = 'harvest-red';
  if (!MACHINES.some((machine) => machine.id === save.machineId && isMachineOwned(machine.id))) {
    save.machineId = getBestOwnedMachine().id;
  }
  save.cropIndex = Math.min(getUnlockedCropIndexForField(save.field), Math.max(0, Number(save.cropIndex) || 0));
  ensureFieldState(save.field);
  if (save.daily && save.daily.date !== getTodayKey()) save.daily = null;
  ensureContractForField();
}

function readLocalSave() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return JSON.parse(current);
    const legacy = localStorage.getItem('pixlland:harvest-rush-3d:save:v1');
    if (legacy) {
      const migrated = JSON.parse(legacy);
      localStorage.setItem(STORAGE_KEY, legacy);
      return migrated;
    }
    return {};
  } catch {
    return {};
  }
}

function persistSave() {
  normalizeSave();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  sdk.data.set(STORAGE_KEY, save).catch(() => {});
}

function forEachMaterial(material, callback) {
  if (Array.isArray(material)) {
    material.forEach((item) => item && callback(item));
  } else if (material) {
    callback(material);
  }
}

function configureFarmMaterial(material) {
  forEachMaterial(material, (item) => {
    if (!item.map) return;
    item.map.colorSpace = THREE.SRGBColorSpace;
    item.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    item.map.minFilter = THREE.LinearMipmapLinearFilter;
    item.map.magFilter = THREE.LinearFilter;
  });
}

function cloneMaterial(material) {
  if (Array.isArray(material)) return material.map((item) => item.clone());
  return material?.clone ? material.clone() : material;
}

function disposeMaterial(material, disposeTextures = false) {
  forEachMaterial(material, (item) => {
    if (disposeTextures && item.map) item.map.dispose();
    item.dispose();
  });
}

function loadFarmPackScene(file) {
  if (farmAssetCache.has(file)) return farmAssetCache.get(file);
  const promise = new Promise((resolve, reject) => {
    gltfLoader.load(
      `${FARM_PACK_BASE}${file}`,
      (gltf) => {
        gltf.scene.traverse((object) => {
          object.frustumCulled = true;
          if (!object.isMesh) return;
          object.castShadow = true;
          object.receiveShadow = true;
          configureFarmMaterial(object.material);
        });
        resolve(gltf.scene);
      },
      undefined,
      reject
    );
  });
  farmAssetCache.set(file, promise);
  return promise;
}

async function cloneFarmPackScene(file) {
  const source = await loadFarmPackScene(file);
  const clone = source.clone(true);
  clone.traverse((object) => {
    object.frustumCulled = true;
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return clone;
}

async function loadCropModelAssets() {
  const entries = Object.entries(CROP_MODEL_ASSETS);
  await Promise.all(entries.map(async ([cropId, config]) => {
    try {
      const source = await loadFarmPackScene(config.file);
      source.updateMatrixWorld(true);
      const parts = [];
      source.traverse((object) => {
        if (!object.isMesh || !object.geometry) return;
        const geometry = object.geometry.clone();
        geometry.applyMatrix4(object.matrixWorld);
        geometry.computeBoundingBox();
        const material = cloneMaterial(object.material);
        configureFarmMaterial(material);
        parts.push({
          geometry,
          material,
          offsetY: 0,
          scale: config.scale,
          useVisualScale: false,
          cached: true,
        });
      });
      if (parts.length) cropAssetParts.set(cropId, parts);
    } catch (error) {
      console.warn(`Crop model failed: ${config.file}`, error);
    }
  }));
}

function createCropModelParts(crop) {
  return cropAssetParts.get(crop.id) || [];
}

function isTerrainSurfaceName(name) {
  return name.startsWith('ground_')
    || name.startsWith('road_')
    || name.startsWith('field_')
    || name.startsWith('mountain_');
}

function terrainHeightCacheKey(x, z) {
  return `${Math.round(x / TERRAIN_HEIGHT_CACHE_CELL)},${Math.round(z / TERRAIN_HEIGHT_CACHE_CELL)}`;
}

function getTerrainHeightAt(x, z, fallback = 0) {
  if (!terrainRaycastMeshes.length) return fallback;
  const key = terrainHeightCacheKey(x, z);
  if (terrainHeightCache.has(key)) return terrainHeightCache.get(key);
  terrainRayOrigin.set(x, TERRAIN_SAMPLE_HEIGHT, z);
  terrainRaycaster.set(terrainRayOrigin, DOWN);
  const hits = terrainRaycaster.intersectObjects(terrainRaycastMeshes, false);
  const height = hits.length ? hits[0].point.y : fallback;
  terrainHeightCache.set(key, height);
  return height;
}

function snapVehicleToTerrain() {
  vehicle.position.y = getTerrainHeightAt(vehicle.position.x, vehicle.position.z, vehicle.position.y) + VEHICLE_GROUND_OFFSET;
}

function getTerrainSlopeDeltaAt(x, z) {
  const center = getTerrainHeightAt(x, z, 0);
  const radius = TERRAIN_SLOPE_SAMPLE_RADIUS;
  const samples = [
    center,
    getTerrainHeightAt(x + radius, z, center),
    getTerrainHeightAt(x - radius, z, center),
    getTerrainHeightAt(x, z + radius, center),
    getTerrainHeightAt(x, z - radius, center),
  ].filter(Number.isFinite);
  if (!samples.length) return 0;
  return Math.max(...samples) - Math.min(...samples);
}

function isTerrainDriveableAt(x, z, previousTerrainY = 0) {
  const terrainY = getTerrainHeightAt(x, z, previousTerrainY);
  if (!Number.isFinite(terrainY)) return false;
  if (terrainY > TERRAIN_DRIVE_HEIGHT_LIMIT) return false;
  const stepUp = terrainY - previousTerrainY;
  const stepDown = previousTerrainY - terrainY;
  if (stepUp > TERRAIN_MAX_STEP_UP || stepDown > TERRAIN_MAX_STEP_DOWN) return false;
  return getTerrainSlopeDeltaAt(x, z) <= TERRAIN_MAX_LOCAL_DELTA;
}

function blockVehicleOnTerrain(previousPosition) {
  vehicle.position.copy(previousPosition);
  snapVehicleToTerrain();
  vehicleSpeed *= -0.18;
  if (collisionNoticeCooldown <= 0) {
    collisionNoticeCooldown = 2.2;
    showNotice('Steep ground blocks the tractor - use roads and open fields.');
  }
}

function getFieldAnchor(field = save.field) {
  return FIELD_ANCHORS[(Math.max(1, field) - 1) % FIELD_ANCHORS.length];
}

function getFieldDimensions(layout = getFieldAnchor()) {
  const cols = Math.max(12, Math.floor(layout.cols || FIELD_COLS));
  const rows = Math.max(10, Math.floor(layout.rows || FIELD_ROWS));
  return {
    cols,
    rows,
    width: cols * TILE_SIZE,
    depth: rows * TILE_SIZE,
    halfWidth: (cols * TILE_SIZE) / 2,
    halfDepth: (rows * TILE_SIZE) / 2,
  };
}

function getCropById(id) {
  return CROPS.find((crop) => crop.id === id) || null;
}

function getFieldServiceStation(layout = getFieldAnchor()) {
  return UNLOAD_STATIONS.find((station) => station.id === layout.serviceStationId) || UNLOAD_STATIONS[0];
}

function getContractUnloadZone(contract = ensureContractForField()) {
  return sellZones.find((zone) => zone.userData.station.id === contract?.stationId) || sellZone;
}

function isFieldPlantingCell(row, col, layout = getFieldAnchor()) {
  const { cols, rows } = getFieldDimensions(layout);
  const headlandCols = Math.min(FIELD_HEADLAND_COLS, Math.floor(cols / 5));
  const headlandRows = Math.min(FIELD_HEADLAND_ROWS, Math.floor(rows / 5));
  if (col < headlandCols || col >= cols - headlandCols) return false;
  if (row < headlandRows || row >= rows - headlandRows) return false;
  const innerCol = col - headlandCols;
  const innerRow = row - headlandRows;
  if (innerCol > 0 && innerCol % FIELD_ALLEY_EVERY_COLS < FIELD_ALLEY_WIDTH) return false;
  if (innerRow > 0 && innerRow % FIELD_ALLEY_EVERY_ROWS < 1) return false;
  return true;
}

function getFieldTilePosition(layout, row, col, cluster) {
  const { halfWidth, halfDepth } = getFieldDimensions(layout);
  const centerX = layout.x - halfWidth + col * TILE_SIZE + TILE_SIZE / 2;
  const centerZ = layout.z - halfDepth + row * TILE_SIZE + TILE_SIZE / 2;
  const rowOffset = ((row % 2) - 0.5) * TILE_SIZE * 0.06;
  const clusterX = (cluster - 0.5) * TILE_SIZE * 0.16;
  const clusterZ = ((cluster % 2) - 0.5) * TILE_SIZE * 0.08;
  return {
    x: centerX + clusterX + rowOffset,
    z: centerZ + clusterZ,
  };
}

function isFieldTileClearForPlanting(x, z, terrainY = 0, layout = getFieldAnchor()) {
  if (terrainY > TERRAIN_DRIVE_HEIGHT_LIMIT) return false;
  if (circleHitsStaticCollider(x, z, FIELD_PLANTING_COLLIDER_RADIUS, (collider) => isColliderInsideFieldLayout(collider, layout, 0.7))) return false;
  return getTerrainSlopeDeltaAt(x, z) <= TERRAIN_MAX_LOCAL_DELTA;
}

function getActivePlantingRows() {
  return rowTileCounts.filter((count) => count > 0).length || rowCleared.length || FIELD_ROWS;
}

function isPointInsideFieldLayout(x, z, layout = getFieldAnchor(), margin = 0) {
  const { halfWidth, halfDepth } = getFieldDimensions(layout);
  return x >= layout.x - halfWidth - margin
    && x <= layout.x + halfWidth + margin
    && z >= layout.z - halfDepth - margin
    && z <= layout.z + halfDepth + margin;
}

function getColliderCenter(collider) {
  if (Number.isFinite(collider.x) && Number.isFinite(collider.z)) return { x: collider.x, z: collider.z };
  return {
    x: (collider.minX + collider.maxX) * 0.5,
    z: (collider.minZ + collider.maxZ) * 0.5,
  };
}

function isColliderInsideFieldLayout(collider, layout = getFieldAnchor(), margin = 0.8) {
  if (collider.kind === 'mountain') return false;
  const center = getColliderCenter(collider);
  return isPointInsideFieldLayout(center.x, center.z, layout, margin);
}

function isColliderInsideCurrentField(collider, margin = 0.8) {
  return isColliderInsideFieldLayout(collider, currentFieldAnchor || getFieldAnchor(), margin);
}

function findFieldStartPose(layout) {
  const { halfWidth, halfDepth } = getFieldDimensions(layout);
  const inset = Math.max(1.65, FIELD_HEADLAND_ROWS * TILE_SIZE * 0.72);
  const candidates = [
    { x: layout.x, z: layout.z + halfDepth - inset, angle: Math.PI },
    { x: layout.x - halfWidth + inset, z: layout.z, angle: Math.PI * 0.5 },
    { x: layout.x + halfWidth - inset, z: layout.z, angle: -Math.PI * 0.5 },
    { x: layout.x, z: layout.z - halfDepth + inset, angle: 0 },
    { x: layout.x, z: layout.z + halfDepth + 5.8, angle: Math.PI },
  ];
  for (const candidate of candidates) {
    const terrainY = getTerrainHeightAt(candidate.x, candidate.z, 0);
    if (!isPointInsideFieldLayout(candidate.x, candidate.z, layout, 0.1)
      && circleHitsStaticCollider(candidate.x, candidate.z, PLAYER_COLLIDER_RADIUS + 0.8)) continue;
    if (!isTerrainDriveableAt(candidate.x, candidate.z, terrainY)) continue;
    return candidate;
  }
  return candidates[0];
}

function placeVehicleAtFieldStart(field = save.field) {
  const anchor = getFieldAnchor(field);
  const startPose = findFieldStartPose(anchor);
  vehicle.position.set(anchor.spawnX ?? startPose.x, 0, anchor.spawnZ ?? startPose.z);
  snapVehicleToTerrain();
  vehicle.angle = anchor.spawnAngle ?? startPose.angle;
  vehicleSpeed = 0;
}

function updateFieldServiceSpots() {
  if (!siloGroup || !barnGroup || !sellZones.length || !siloArrow) return;
  for (const zone of sellZones) {
    const { station } = zone.userData;
    const y = getTerrainHeightAt(station.x, station.z, 0);
    zone.position.set(station.x, y + 0.11, station.z);
  }
  const siloStation = UNLOAD_STATIONS[0];
  const barnStation = UNLOAD_STATIONS[1];
  siloGroup.position.set(
    siloStation.visualX,
    getTerrainHeightAt(siloStation.visualX, siloStation.visualZ, 0),
    siloStation.visualZ
  );
  barnGroup.position.set(
    barnStation.visualX,
    getTerrainHeightAt(barnStation.visualX, barnStation.visualZ, 0),
    barnStation.visualZ
  );
  const nearest = getNearestUnloadStation();
  const arrowZone = nearest?.zone || sellZone;
  siloArrow.position.set(arrowZone.position.x, arrowZone.position.y + 5.5, arrowZone.position.z);
}

function colliderCellKey(x, z) {
  return `${Math.floor(x / STATIC_COLLIDER_CELL_SIZE)},${Math.floor(z / STATIC_COLLIDER_CELL_SIZE)}`;
}

function roadCellKey(ix, iz) {
  return `${ix},${iz}`;
}

function addRoadCell(ix, iz) {
  const key = roadCellKey(ix, iz);
  if (roadCells.has(key)) return;
  roadCells.set(key, {
    key,
    ix,
    iz,
    x: (ix + 0.5) * ROAD_NAV_CELL_SIZE,
    z: (iz + 0.5) * ROAD_NAV_CELL_SIZE,
  });
}

function addRoadCellsForBox(box) {
  const minX = Math.floor((box.min.x - ROAD_NAV_PADDING) / ROAD_NAV_CELL_SIZE);
  const maxX = Math.floor((box.max.x + ROAD_NAV_PADDING) / ROAD_NAV_CELL_SIZE);
  const minZ = Math.floor((box.min.z - ROAD_NAV_PADDING) / ROAD_NAV_CELL_SIZE);
  const maxZ = Math.floor((box.max.z + ROAD_NAV_PADDING) / ROAD_NAV_CELL_SIZE);
  for (let ix = minX; ix <= maxX; ix += 1) {
    for (let iz = minZ; iz <= maxZ; iz += 1) {
      addRoadCell(ix, iz);
    }
  }
}

function buildRoadNavigationFromFarmScene() {
  roadCells = new Map();
  if (!farmSceneGroup) return;
  const box = new THREE.Box3();
  farmSceneGroup.updateMatrixWorld(true);
  farmSceneGroup.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    const name = (object.name || '').toLowerCase();
    if (!name.startsWith('road_')) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    box.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
    addRoadCellsForBox(box);
  });
}

function findNearestRoadCell(x, z, maxDistance = 20) {
  let nearest = null;
  let nearestDistanceSq = maxDistance * maxDistance;
  for (const cell of roadCells.values()) {
    const dx = cell.x - x;
    const dz = cell.z - z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= nearestDistanceSq) continue;
    nearest = cell;
    nearestDistanceSq = distanceSq;
  }
  return nearest;
}

function getRoadNeighbors(cell) {
  const neighbors = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dz] of dirs) {
    const neighbor = roadCells.get(roadCellKey(cell.ix + dx, cell.iz + dz));
    if (neighbor) neighbors.push(neighbor);
  }
  return neighbors;
}

function chooseTrafficRoadTarget(actor) {
  const current = actor.currentCell || findNearestRoadCell(actor.group.position.x, actor.group.position.z);
  if (!current) return null;
  actor.currentCell = current;
  const neighbors = getRoadNeighbors(current);
  if (!neighbors.length) return current;
  let candidates = neighbors;
  if (actor.previousCell && neighbors.length > 1) {
    const forward = neighbors.filter((cell) => cell.key !== actor.previousCell.key);
    if (forward.length) candidates = forward;
  }
  if (actor.direction && candidates.length > 1) {
    const straight = candidates.filter((cell) => {
      const dx = cell.ix - current.ix;
      const dz = cell.iz - current.iz;
      return dx * actor.direction.x + dz * actor.direction.z > 0;
    });
    if (straight.length && Math.random() > 0.18) candidates = straight;
  }
  if (actor.preferAxis && !actor.direction && candidates.length > 1) {
    const preferred = candidates.filter((cell) => {
      const dx = Math.abs(cell.ix - current.ix);
      const dz = Math.abs(cell.iz - current.iz);
      return actor.preferAxis === 'x' ? dx > dz : dz > dx;
    });
    if (preferred.length) candidates = preferred;
  }
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  actor.previousCell = current;
  actor.currentCell = selected;
  actor.targetCell = selected;
  actor.direction = {
    x: Math.sign(selected.ix - current.ix),
    z: Math.sign(selected.iz - current.iz),
  };
  return selected;
}

function addStaticCollider(collider) {
  const index = staticColliders.length;
  staticColliders.push(collider);
  const minX = Math.floor(collider.minX / STATIC_COLLIDER_CELL_SIZE);
  const maxX = Math.floor(collider.maxX / STATIC_COLLIDER_CELL_SIZE);
  const minZ = Math.floor(collider.minZ / STATIC_COLLIDER_CELL_SIZE);
  const maxZ = Math.floor(collider.maxZ / STATIC_COLLIDER_CELL_SIZE);
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      const key = `${x},${z}`;
      if (!staticColliderGrid.has(key)) staticColliderGrid.set(key, []);
      staticColliderGrid.get(key).push(index);
    }
  }
}

function addStaticCircleCollider(x, z, radius, kind = 'static') {
  addStaticCollider({
    kind,
    x,
    z,
    radius,
    minX: x - radius,
    maxX: x + radius,
    minZ: z - radius,
    maxZ: z + radius,
  });
}

function isFarmTreeName(name) {
  return name.startsWith('tree_') || name.startsWith('fir_tree_');
}

function getBarycentricXZ(x, z, a, b, c) {
  const v0x = b.x - a.x;
  const v0z = b.z - a.z;
  const v1x = c.x - a.x;
  const v1z = c.z - a.z;
  const v2x = x - a.x;
  const v2z = z - a.z;
  const d00 = v0x * v0x + v0z * v0z;
  const d01 = v0x * v1x + v0z * v1z;
  const d11 = v1x * v1x + v1z * v1z;
  const d20 = v2x * v0x + v2z * v0z;
  const d21 = v2x * v1x + v2z * v1z;
  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 0.000001) return null;
  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  const u = 1 - v - w;
  return { u, v, w };
}

function addMountainTriangleColliders(object, occupiedCells) {
  const position = object.geometry?.attributes?.position;
  if (!position) return;
  const index = object.geometry.index;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const readVertex = (vertexIndex, target) => {
    target.fromBufferAttribute(position, vertexIndex);
    target.applyMatrix4(object.matrixWorld);
  };
  const addTriangleCells = () => {
    const maxY = Math.max(a.y, b.y, c.y);
    if (maxY < MOUNTAIN_COLLIDER_MIN_HEIGHT) return;
    const minX = Math.min(a.x, b.x, c.x) - ACTOR_COLLIDER_PADDING;
    const maxX = Math.max(a.x, b.x, c.x) + ACTOR_COLLIDER_PADDING;
    const minZ = Math.min(a.z, b.z, c.z) - ACTOR_COLLIDER_PADDING;
    const maxZ = Math.max(a.z, b.z, c.z) + ACTOR_COLLIDER_PADDING;
    const startX = Math.floor(minX / MOUNTAIN_COLLIDER_CELL_SIZE);
    const endX = Math.floor(maxX / MOUNTAIN_COLLIDER_CELL_SIZE);
    const startZ = Math.floor(minZ / MOUNTAIN_COLLIDER_CELL_SIZE);
    const endZ = Math.floor(maxZ / MOUNTAIN_COLLIDER_CELL_SIZE);
    for (let cellX = startX; cellX <= endX; cellX += 1) {
      for (let cellZ = startZ; cellZ <= endZ; cellZ += 1) {
        const centerX = (cellX + 0.5) * MOUNTAIN_COLLIDER_CELL_SIZE;
        const centerZ = (cellZ + 0.5) * MOUNTAIN_COLLIDER_CELL_SIZE;
        const bary = getBarycentricXZ(centerX, centerZ, a, b, c);
        if (!bary || bary.u < -0.05 || bary.v < -0.05 || bary.w < -0.05) continue;
        const height = a.y * bary.u + b.y * bary.v + c.y * bary.w;
        if (height < MOUNTAIN_COLLIDER_MIN_HEIGHT) continue;
        const key = `${cellX},${cellZ}`;
        if (occupiedCells.has(key)) continue;
        occupiedCells.add(key);
        addStaticCollider({
          kind: 'mountain',
          minX: cellX * MOUNTAIN_COLLIDER_CELL_SIZE - ACTOR_COLLIDER_PADDING,
          maxX: (cellX + 1) * MOUNTAIN_COLLIDER_CELL_SIZE + ACTOR_COLLIDER_PADDING,
          minZ: cellZ * MOUNTAIN_COLLIDER_CELL_SIZE - ACTOR_COLLIDER_PADDING,
          maxZ: (cellZ + 1) * MOUNTAIN_COLLIDER_CELL_SIZE + ACTOR_COLLIDER_PADDING,
        });
      }
    }
  };

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      readVertex(index.getX(i), a);
      readVertex(index.getX(i + 1), b);
      readVertex(index.getX(i + 2), c);
      addTriangleCells();
    }
  } else {
    for (let i = 0; i < position.count; i += 3) {
      readVertex(i, a);
      readVertex(i + 1, b);
      readVertex(i + 2, c);
      addTriangleCells();
    }
  }
}

function isFarmStaticColliderCandidate(object, size) {
  const name = (object.name || '').toLowerCase();
  const passablePrefixes = [
    'ground_',
    'road_',
    'water_',
    'landscape_',
    'field_',
    'garden_bed_',
    'plant_',
    'hay_',
    'bush_',
    'grass_',
    'lawn_',
    'apiary_',
    'barrel_',
    'box_',
    'bus_',
    'car_',
    'cart_',
    'chair_',
    'dray_',
    'fence_',
    'firewood_',
    'harvester_',
    'tractor_',
    'trailer_',
    'table_',
    'toilet_',
    'truck_',
    'cow_',
    'sheep_',
    'goat_',
    'horse_',
    'chicken_',
    'pig_',
  ];
  if (passablePrefixes.some((prefix) => name.startsWith(prefix))) return false;

  const solidPrefixes = [
    'bridge_',
    'coop_',
    'fir_tree_',
    'greenhouse_',
    'hangar_',
    'house_',
    'stall_',
    'tower_',
    'tree_',
  ];
  const footprint = Math.max(size.x, size.z);
  const isNamedSolid = solidPrefixes.some((prefix) => name.startsWith(prefix));
  if (isNamedSolid) return footprint > 0.18 && size.y > 0.22;

  return size.y > 1.55 && footprint > 1.35;
}

function buildStaticCollidersFromFarmScene() {
  staticColliders = [];
  staticColliderGrid = new Map();
  if (!farmSceneGroup) return;
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const mountainCells = new Set();
  farmSceneGroup.updateMatrixWorld(true);
  farmSceneGroup.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    box.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
    box.getSize(size);
    const name = (object.name || '').toLowerCase();
    if (name.startsWith('mountain_')) {
      addMountainTriangleColliders(object, mountainCells);
      return;
    }
    if (isFarmTreeName(name)) {
      const radius = THREE.MathUtils.clamp(Math.max(size.x, size.z) * 0.21, 0.32, 0.88);
      addStaticCircleCollider((box.min.x + box.max.x) * 0.5, (box.min.z + box.max.z) * 0.5, radius, 'tree');
      return;
    }
    if (!isFarmStaticColliderCandidate(object, size)) return;
    const footprint = Math.max(size.x, size.z);
    const narrow = Math.min(size.x, size.z);
    if (size.x > 90 || size.z > 90) return;
    if (footprint < 0.18) return;
    if (narrow < 0.06 && footprint < 0.8) return;
    addStaticCollider({
      minX: box.min.x - STATIC_COLLIDER_PADDING,
      maxX: box.max.x + STATIC_COLLIDER_PADDING,
      minZ: box.min.z - STATIC_COLLIDER_PADDING,
      maxZ: box.max.z + STATIC_COLLIDER_PADDING,
    });
  });
}

function queryStaticColliders(position, radius) {
  const results = [];
  const seen = new Set();
  const minX = Math.floor((position.x - radius) / STATIC_COLLIDER_CELL_SIZE);
  const maxX = Math.floor((position.x + radius) / STATIC_COLLIDER_CELL_SIZE);
  const minZ = Math.floor((position.z - radius) / STATIC_COLLIDER_CELL_SIZE);
  const maxZ = Math.floor((position.z + radius) / STATIC_COLLIDER_CELL_SIZE);
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      const indices = staticColliderGrid.get(`${x},${z}`);
      if (!indices) continue;
      for (const index of indices) {
        if (seen.has(index)) continue;
        seen.add(index);
        results.push(staticColliders[index]);
      }
    }
  }
  return results;
}

function pushCircleOutOfAabb(position, radius, collider) {
  const closestX = THREE.MathUtils.clamp(position.x, collider.minX, collider.maxX);
  const closestZ = THREE.MathUtils.clamp(position.z, collider.minZ, collider.maxZ);
  let dx = position.x - closestX;
  let dz = position.z - closestZ;
  const distanceSq = dx * dx + dz * dz;
  if (distanceSq >= radius * radius) return false;
  if (distanceSq > 0.0001) {
    const distance = Math.sqrt(distanceSq);
    const push = radius - distance;
    position.x += (dx / distance) * push;
    position.z += (dz / distance) * push;
    return true;
  }
  const left = Math.abs(position.x - collider.minX);
  const right = Math.abs(collider.maxX - position.x);
  const bottom = Math.abs(position.z - collider.minZ);
  const top = Math.abs(collider.maxZ - position.z);
  const min = Math.min(left, right, bottom, top);
  if (min === left) position.x = collider.minX - radius;
  else if (min === right) position.x = collider.maxX + radius;
  else if (min === bottom) position.z = collider.minZ - radius;
  else position.z = collider.maxZ + radius;
  return true;
}

function pushCircleOutOfCircle(position, radius, center, otherRadius) {
  const dx = position.x - center.x;
  const dz = position.z - center.z;
  const minDistance = radius + otherRadius;
  const distanceSq = dx * dx + dz * dz;
  if (distanceSq >= minDistance * minDistance) return false;
  const distance = Math.sqrt(distanceSq) || 0.001;
  const push = minDistance - distance;
  position.x += (dx / distance) * push;
  position.z += (dz / distance) * push;
  return true;
}

function circleHitsStaticCollider(x, z, radius, ignoreCollider = null) {
  const position = tmpVector.set(x, 0, z);
  for (const collider of queryStaticColliders(position, radius + 1.2)) {
    if (ignoreCollider?.(collider)) continue;
    if (collider.radius) {
      const dx = x - collider.x;
      const dz = z - collider.z;
      const minDistance = radius + collider.radius;
      if (dx * dx + dz * dz < minDistance * minDistance) return true;
      continue;
    }
    const closestX = THREE.MathUtils.clamp(x, collider.minX, collider.maxX);
    const closestZ = THREE.MathUtils.clamp(z, collider.minZ, collider.maxZ);
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

function resolveVehicleCollisions(previousPosition) {
  let hit = false;
  let hitStatic = false;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const collider of queryStaticColliders(vehicle.position, PLAYER_COLLIDER_RADIUS + 0.8)) {
      if (isPointInsideFieldLayout(vehicle.position.x, vehicle.position.z, currentFieldAnchor || getFieldAnchor(), 0.6)
        && isColliderInsideCurrentField(collider, 1.2)) continue;
      const didHit = collider.radius
        ? pushCircleOutOfCircle(vehicle.position, PLAYER_COLLIDER_RADIUS, collider, collider.radius)
        : pushCircleOutOfAabb(vehicle.position, PLAYER_COLLIDER_RADIUS, collider);
      if (!didHit) continue;
      hit = true;
      hitStatic = true;
    }
  }
  if (!hit) return;
  if (!Number.isFinite(vehicle.position.x) || !Number.isFinite(vehicle.position.z)) {
    vehicle.position.copy(previousPosition);
  }
  vehicleSpeed *= hitStatic ? 0.34 : -0.12;
  if (collisionNoticeCooldown <= 0) {
    collisionNoticeCooldown = 2.2;
    showNotice('Solid buildings and vehicles block the way. Small farm props are passable.');
  }
}

function ensureAudio() {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

async function loadAudioBuffer(id) {
  if (audioBuffers.has(id)) return audioBuffers.get(id);
  const file = AUDIO_ASSETS[id];
  if (!file) return null;
  const context = ensureAudio();
  const response = await fetch(file);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await context.decodeAudioData(arrayBuffer);
  audioBuffers.set(id, buffer);
  return buffer;
}

function playSample(id, volume = 0.32) {
  try {
    const context = ensureAudio();
    const cached = audioBuffers.get(id);
    if (cached) {
      playDecodedBuffer(cached, volume);
      return;
    }
    loadAudioBuffer(id).then((buffer) => {
      if (buffer) playDecodedBuffer(buffer, volume);
    }).catch(() => {});
  } catch {
    // Procedural tones remain the fallback for browsers that block samples.
  }
}

function playDecodedBuffer(buffer, volume) {
  const context = ensureAudio();
  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = volume;
  source.buffer = buffer;
  source.connect(gain).connect(context.destination);
  source.start();
}

function playTone(frequency, duration = 0.08, type = 'triangle', volume = 0.035) {
  try {
    const context = ensureAudio();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration + 0.02);
  } catch {
    // Audio is optional in local previews.
  }
}

function playHarvestSound() {
  const now = performance.now();
  if (now - lastHarvestSoundAt < 90) return;
  lastHarvestSoundAt = now;
  playTone(180 + Math.random() * 28, 0.045, 'sawtooth', 0.014);
}

function playRewardSound() {
  playSample('confirm', 0.34);
  playTone(520, 0.08, 'triangle', 0.035);
  window.setTimeout(() => playTone(740, 0.09, 'triangle', 0.03), 80);
}

function startMusic() {
  if (!musicEnabled || musicTimer) return;
  ensureAudio();
  playMusicStep();
  musicTimer = window.setInterval(playMusicStep, 420);
}

function stopMusic() {
  if (!musicTimer) return;
  window.clearInterval(musicTimer);
  musicTimer = null;
}

function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (musicEnabled && !paused && !inMenu) startMusic();
  if (!musicEnabled) stopMusic();
  updateHud();
}

function playMusicStep() {
  if (!musicEnabled || paused || inMenu || ui.shopPanel.classList.contains('open') || ui.seasonPanel.classList.contains('open')) return;
  const note = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
  const harmony = MUSIC_NOTES[(musicStep + 5) % MUSIC_NOTES.length] * 0.5;
  playTone(note, 0.18, musicStep % 4 === 0 ? 'triangle' : 'sine', 0.012);
  if (musicStep % 4 === 0) playTone(harmony, 0.28, 'sine', 0.009);
  musicStep += 1;
}

function ensureContractForField() {
  const crop = getCropForField(save.field);
  if (save.contract?.field === save.field && save.contract?.cropId === crop.id && save.contract?.version === 4) {
    save.contract.readyToDeliver = Boolean(save.contract.readyToDeliver);
    save.contract.fieldReadyToFinish = Boolean(save.contract.fieldReadyToFinish);
    return save.contract;
  }
  save.contract = createContractForField(save.field);
  return save.contract;
}

function createContractForField(field) {
  const crop = getCropForField(field);
  const layout = getFieldAnchor(field);
  const station = getFieldServiceStation(layout);
  const pattern = CONTRACT_PATTERNS[(field - 1) % CONTRACT_PATTERNS.length];
  const cropContracts = CROP_CONTRACTS[crop.id] || CROP_CONTRACTS.wheat;
  const cropContract = cropContracts[(field - 1) % cropContracts.length];
  const target = Math.min(92, pattern.target + cropContract.targetBonus + Math.floor((field - 1) / CONTRACT_PATTERNS.length) * 3);
  return {
    version: 4,
    field,
    cropId: crop.id,
    id: `${crop.id}-${cropContract.id}-${pattern.id}`,
    label: cropContract.label,
    brief: `${cropContract.brief} ${layout.objective}.`,
    pattern: pattern.label,
    plotName: layout.name,
    stationId: station.id,
    destinationName: station.name,
    target,
    reward: Math.floor((pattern.rewardBase + field * 35 + crop.value * 26) * cropContract.rewardMultiplier),
    readyToDeliver: false,
    fieldReadyToFinish: false,
    completed: false,
  };
}

function getCropForField(field) {
  const layout = getFieldAnchor(field);
  const planned = getCropById(getFieldAnchor(field).cropId);
  if (planned) {
    return {
      ...planned,
      value: Math.max(1, Math.round(planned.value * (layout.valueMultiplier || 1))),
      growthTime: layout.growthTime || planned.growthTime,
      load: layout.load || planned.load,
    };
  }
  return CROPS[getUnlockedCropIndexForField(field)];
}

function getCropGrowthMs(crop) {
  return Math.max(20, Number(crop.growthTime) || 90) * 1000;
}

function createFieldState(field, state = FIELD_STATES.MATURE) {
  const crop = getCropForField(field);
  const growthTimeMs = getCropGrowthMs(crop);
  const mature = state === FIELD_STATES.MATURE;
  return {
    version: 1,
    field,
    cropId: crop.id,
    state: mature ? FIELD_STATES.MATURE : FIELD_STATES.SEEDED,
    plantedAt: Date.now() - (mature ? growthTimeMs : 0),
    growthTimeMs,
    boostedMs: 0,
    yieldMultiplier: 1,
    fertilized: false,
    seedType: 'basic',
  };
}

function ensureFieldState(field = save.field) {
  if (!save.fields || typeof save.fields !== 'object' || Array.isArray(save.fields)) save.fields = {};
  const key = String(field);
  const crop = getCropForField(field);
  let fieldState = save.fields[key];
  if (!fieldState || fieldState.version !== 1 || fieldState.cropId !== crop.id) {
    fieldState = createFieldState(field, FIELD_STATES.MATURE);
    save.fields[key] = fieldState;
  }
  fieldState.field = field;
  fieldState.cropId = crop.id;
  fieldState.growthTimeMs = Math.max(1000, Number(fieldState.growthTimeMs) || getCropGrowthMs(crop));
  fieldState.plantedAt = Number(fieldState.plantedAt) || Date.now() - fieldState.growthTimeMs;
  fieldState.boostedMs = Math.max(0, Number(fieldState.boostedMs) || 0);
  fieldState.yieldMultiplier = Math.max(0.6, Number(fieldState.yieldMultiplier) || 1);
  fieldState.fertilized = Boolean(fieldState.fertilized);
  return fieldState;
}

function plantField(field = save.field) {
  if (!save.fields || typeof save.fields !== 'object' || Array.isArray(save.fields)) save.fields = {};
  const fieldState = createFieldState(field, FIELD_STATES.SEEDED);
  save.fields[String(field)] = fieldState;
  pruneFieldStates();
  return fieldState;
}

function pruneFieldStates() {
  if (!save.fields) return;
  const minField = Math.max(1, save.field - 3);
  for (const key of Object.keys(save.fields)) {
    const field = Number(key);
    if (!Number.isFinite(field) || field < minField || field > save.field + 1) delete save.fields[key];
  }
}

function getFieldGrowthProgress(fieldState = ensureFieldState()) {
  if (fieldState.state === FIELD_STATES.MATURE || fieldState.state === FIELD_STATES.HARVESTED) return 1;
  const elapsed = Math.max(0, Date.now() - fieldState.plantedAt + (fieldState.boostedMs || 0));
  return THREE.MathUtils.clamp(elapsed / fieldState.growthTimeMs, 0, 1);
}

function updateFieldStateFromClock(fieldState) {
  if (fieldState.state === FIELD_STATES.HARVESTED) return fieldState.state;
  const progress = getFieldGrowthProgress(fieldState);
  if (progress >= 1) fieldState.state = FIELD_STATES.MATURE;
  else if (progress < GROWTH_STAGE_THRESHOLDS.SEEDED) fieldState.state = FIELD_STATES.SEEDED;
  else fieldState.state = FIELD_STATES.GROWING;
  return fieldState.state;
}

function getFieldVisualStage(fieldState = ensureFieldState()) {
  if (fieldState.state === FIELD_STATES.MATURE) return FIELD_STATES.MATURE;
  const progress = getFieldGrowthProgress(fieldState);
  if (progress < GROWTH_STAGE_THRESHOLDS.SEEDED) return FIELD_STATES.SEEDED;
  if (progress < GROWTH_STAGE_THRESHOLDS.TALL) return FIELD_STATES.GROWING;
  return 'almost';
}

function getFieldVisualScale(fieldState = ensureFieldState()) {
  if (fieldState.state === FIELD_STATES.MATURE) return 1;
  const progress = getFieldGrowthProgress(fieldState);
  return THREE.MathUtils.clamp(0.18 + progress * 0.82, 0.18, 0.96);
}

function getFieldTimeLeftMs(fieldState = ensureFieldState()) {
  if (fieldState.state === FIELD_STATES.MATURE) return 0;
  const elapsed = Math.max(0, Date.now() - fieldState.plantedAt + (fieldState.boostedMs || 0));
  return Math.max(0, fieldState.growthTimeMs - elapsed);
}

function formatDuration(ms) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function isCurrentFieldMature() {
  const fieldState = ensureFieldState();
  updateFieldStateFromClock(fieldState);
  return fieldState.state === FIELD_STATES.MATURE;
}

function getCurrentFieldYieldMultiplier() {
  const fieldState = ensureFieldState();
  return Math.max(0.6, Number(fieldState.yieldMultiplier) || 1);
}

function getFertilizerUnitCost() {
  return FERTILIZER_UNIT_COST + Math.floor(Math.max(0, save.field - 1) * FERTILIZER_FIELD_COST_STEP);
}

function getFertilizerBundleCost() {
  return Math.floor(getFertilizerUnitCost() * FERTILIZER_BUNDLE_AMOUNT * FERTILIZER_BUNDLE_DISCOUNT);
}

function updateFieldGrowth(dt) {
  growthNoticeCooldown = Math.max(0, growthNoticeCooldown - dt);
  const fieldState = ensureFieldState();
  const previousState = fieldState.state;
  const previousStage = currentFieldVisualStage;
  updateFieldStateFromClock(fieldState);
  const nextStage = getFieldVisualStage(fieldState);
  if (fieldState.state === FIELD_STATES.MATURE && previousState !== FIELD_STATES.MATURE) {
    buildField();
    renderShop();
    persistSave();
    playRewardSound();
    spawnPop('Crop ready', 50, 48);
    showNotice(`${getCrop().name} is mature. Time to harvest.`);
    return;
  }
  if (nextStage !== previousStage && fieldState.state !== FIELD_STATES.MATURE) {
    buildField();
  }
}

function getUnlockedCropIndexForField(field) {
  let index = 0;
  for (let i = 0; i < CROPS.length; i += 1) {
    if (field >= CROPS[i].unlockField) index = i;
  }
  return index;
}

function getSeasonNumber() {
  return Math.floor((save.field - 1) / SEASON_FIELD_TARGET) + 1;
}

function getSeasonFieldNumber() {
  return ((save.field - 1) % SEASON_FIELD_TARGET) + 1;
}

function isPaintUnlocked(paint) {
  return save.field >= paint.unlockField || paint.id === 'harvest-red';
}

function isMachineUnlocked(machine) {
  return save.field >= machine.unlockField || machine.id === MACHINES[0].id;
}

function isMachineOwned(machineOrId) {
  const id = typeof machineOrId === 'string' ? machineOrId : machineOrId?.id;
  return Boolean(id && (save.ownedMachines || []).includes(id));
}

function getMachineLevel(machineOrId) {
  const id = typeof machineOrId === 'string' ? machineOrId : machineOrId?.id;
  if (!isMachineOwned(id)) return 0;
  return THREE.MathUtils.clamp(Math.floor(Number(save.machineLevels?.[id]) || 1), 1, MACHINE_LEVEL_MAX);
}

function getMachineLevelCost(machine) {
  const level = getMachineLevel(machine);
  if (level <= 0 || level >= MACHINE_LEVEL_MAX) return 0;
  return Math.floor((machine.upgradeBaseCost || 160) * Math.pow(1.78, level - 1));
}

function getBestOwnedMachine() {
  return [...MACHINES].reverse().find((machine) => isMachineOwned(machine.id)) || MACHINES[0];
}

function getCurrentMachine() {
  return MACHINES.find((machine) => machine.id === save.machineId && isMachineOwned(machine.id)) || getBestOwnedMachine();
}

function getMachineCropFit(machine = getCurrentMachine(), crop = getCrop()) {
  const best = machine.bestCrops || [];
  const ok = machine.okCrops || [];
  if (best.includes(crop.id)) {
    return {
      tier: 'best',
      label: 'Perfect crop match',
      shortLabel: 'Perfect',
      speed: 1.08,
      cut: 1.12,
      capacity: 1.05,
      price: 1.08,
    };
  }
  if (ok.includes(crop.id)) {
    return {
      tier: 'good',
      label: 'Good crop match',
      shortLabel: 'Good',
      speed: 1.02,
      cut: 1.02,
      capacity: 1,
      price: 1.02,
    };
  }
  return {
    tier: 'rough',
    label: 'Rough crop match',
    shortLabel: 'Rough',
    speed: 0.93,
    cut: 0.88,
    capacity: 0.96,
    price: 0.96,
  };
}

function getMachineLevelMultiplier(stat, machine = getCurrentMachine()) {
  const level = getMachineLevel(machine);
  const bonusByStat = {
    speed: MACHINE_LEVEL_SPEED_BONUS,
    cut: MACHINE_LEVEL_CUT_BONUS,
    capacity: MACHINE_LEVEL_CAPACITY_BONUS,
    price: MACHINE_LEVEL_PRICE_BONUS,
  };
  return 1 + Math.max(0, level - 1) * (bonusByStat[stat] || 0);
}

function applyPaint() {
  const paint = PAINTS.find((item) => item.id === save.paintId) || PAINTS[0];
  vehicleGroup.traverse((object) => {
    if (!object.isMesh || !object.userData.paintRole) return;
    const role = object.userData.paintRole;
    if (role === 'trim') {
      object.material.color.setHex(paint.trim);
    } else if (role === 'body-skin') {
      // GLB uses a shared colormap texture; tinting blends paint over the original colors
      object.material.color.setHex(paint.body);
    } else {
      object.material.color.setHex(paint.body);
    }
  });
}

function createVehicle() {
  const group = new THREE.Group();
  const cropMat = new THREE.MeshLambertMaterial({ color: 0xf2bd3b });

  const machineMount = new THREE.Group();
  machineMount.name = 'machineMount';
  group.add(machineMount);

  const trailerMount = new THREE.Group();
  trailerMount.name = 'trailerMount';
  trailerMount.position.set(0, 0, 2.05);
  group.add(trailerMount);

  const trailerFill = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.1, 0.82), cropMat);
  trailerFill.name = 'trailerFill';
  trailerFill.position.set(0, 0.9, 2.1);
  trailerFill.visible = false;
  group.add(trailerFill);

  // Hitch — small bar connecting tractor to trailer
  const hitch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.74), new THREE.MeshLambertMaterial({ color: 0x2b2b2b }));
  hitch.position.set(0, 0.34, 1.14);
  hitch.castShadow = true;
  group.add(hitch);

  refreshMachineModel(group);

  return group;
}

function clearGroup(group) {
  if (!group) return;
  while (group.children.length) group.remove(group.children[0]);
}

function prepareFarmPackModel(object, { name, scale, positionZ = 0 }) {
  object.name = name;
  object.scale.setScalar(scale);
  object.position.set(0, 0, positionZ);
  object.rotation.y = 0;
  object.updateMatrixWorld(true);
  object.traverse((part) => {
    part.frustumCulled = true;
    if (!part.isMesh) return;
    part.castShadow = true;
    part.receiveShadow = true;
    if (part.material?.map) {
      part.material.map.colorSpace = THREE.SRGBColorSpace;
      part.material.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      part.material.map.minFilter = THREE.LinearMipmapLinearFilter;
      part.material.map.magFilter = THREE.LinearFilter;
    }
  });
  const box = new THREE.Box3().setFromObject(object);
  if (Number.isFinite(box.min.y)) {
    object.position.y += Math.max(0, -box.min.y) + VEHICLE_MODEL_LIFT;
  }
}

function refreshMachineModel(group) {
  const targetGroup = group || vehicleGroup;
  if (!targetGroup) return;
  const machine = getCurrentMachine();
  if (currentMachineId === machine.id) return;
  currentMachineId = machine.id;

  const machineMount = targetGroup.getObjectByName('machineMount');
  const trailerMount = targetGroup.getObjectByName('trailerMount');
  clearGroup(machineMount);
  clearGroup(trailerMount);

  gltfLoader.load(
    `${FARM_PACK_BASE}${machine.file}`,
    (gltf) => {
      if (currentMachineId !== machine.id) return;
      prepareFarmPackModel(gltf.scene, { name: 'tractorMesh', scale: machine.scale, positionZ: machine.z });
      machineMount.add(gltf.scene);
    },
    undefined,
    (error) => {
      console.warn(`Machine GLB failed: ${machine.file}`, error);
      buildFallbackTractor(targetGroup);
    }
  );

  gltfLoader.load(
    `${FARM_PACK_BASE}${machine.trailerFile}`,
    (gltf) => {
      if (currentMachineId !== machine.id) return;
      prepareFarmPackModel(gltf.scene, { name: 'trailerMesh', scale: machine.trailerScale, positionZ: 0 });
      trailerMount.add(gltf.scene);
    },
    undefined,
    (error) => console.warn(`Trailer GLB failed: ${machine.trailerFile}`, error)
  );
}

function buildFallbackTractor(group) {
  if (group.getObjectByName('tractorMesh')) return;
  const fallback = new THREE.Group();
  fallback.name = 'tractorMesh';
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd95532 });
  const cabMat = new THREE.MeshLambertMaterial({ color: 0x8fd2e8 });
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 3.0), bodyMat);
  body.userData.paintRole = 'body-skin';
  body.position.y = 0.92;
  body.castShadow = true;
  fallback.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.0), cabMat);
  cab.position.set(0, 1.55, 0.6);
  cab.castShadow = true;
  fallback.add(cab);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.38, 18);
  for (const x of [-1.18, 1.18]) {
    for (const z of [-0.9, 0.95]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.38, z);
      wheel.castShadow = true;
      fallback.add(wheel);
    }
  }
  group.add(fallback);
}

function createSiloStation() {
  const group = new THREE.Group();
  if (USE_FARM_SCENE) return group;

  // Weighing platform — flat scale pad where the player sells cargo
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.12, 3.2),
    new THREE.MeshLambertMaterial({ color: 0x5a4a38 })
  );
  platform.position.set(0, 0.08, -0.2);
  platform.receiveShadow = true;
  group.add(platform);

  // Real mill/silo (Kenney hexagon-kit, low-poly building)
  gltfLoader.load(
    `${ALL_IN_ONE_BASE}hexagon-kit/building-mill.glb`,
    (gltf) => {
      const mill = gltf.scene;
      mill.scale.setScalar(2.6);
      mill.position.set(0, 0, -1.8);
      mill.rotation.y = Math.PI * 0.18;
      mill.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
      });
      group.add(mill);
    },
    undefined,
    (error) => console.warn('Silo GLB failed', error)
  );

  return group;
}

function createSiloArrow() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffdc5e, transparent: true, opacity: 0.95, depthTest: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.2, 4), mat);
  cone.rotation.x = Math.PI;
  cone.position.y = -0.35;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 8), mat);
  stem.position.y = 0.4;
  group.add(cone, stem);
  group.visible = false;
  return group;
}

function createRouteArrow() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe36e, transparent: true, opacity: 0.96, depthTest: false });
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x5a3b17, transparent: true, opacity: 0.42, depthTest: false });
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.0, 3), mat);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.88;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 1.25), mat);
  shaft.position.z = 0.02;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 24), shadowMat);
  base.position.y = -0.12;
  group.add(base, shaft, head);
  group.visible = false;
  return group;
}

function createFieldPlanGuides() {
  const group = new THREE.Group();
  group.visible = false;
  for (const layout of FIELD_ANCHORS) {
    const crop = getCropById(layout.cropId) || CROPS[0];
    const { width, depth } = getFieldDimensions(layout);
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 1.2, depth + 1.2),
      new THREE.MeshBasicMaterial({
        color: crop.color,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(layout.x, 0.18, layout.z);
    group.add(base);

    const borderMat = new THREE.MeshBasicMaterial({ color: crop.accent, transparent: true, opacity: 0.34, depthWrite: false });
    const borderDepth = 0.18;
    const rails = [
      { x: 0, z: -depth / 2, w: width, d: borderDepth },
      { x: 0, z: depth / 2, w: width, d: borderDepth },
      { x: -width / 2, z: 0, w: borderDepth, d: depth },
      { x: width / 2, z: 0, w: borderDepth, d: depth },
    ];
    for (const rail of rails) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(rail.w, 0.04, rail.d), borderMat);
      line.position.set(layout.x + rail.x, 0.22, layout.z + rail.z);
      group.add(line);
    }

    const rowMat = new THREE.MeshBasicMaterial({ color: crop.accent, transparent: true, opacity: 0.16, depthWrite: false });
    const headlandCols = Math.min(FIELD_HEADLAND_COLS, Math.floor(getFieldDimensions(layout).cols / 5));
    const rowWidth = Math.max(1, width - headlandCols * TILE_SIZE * 2);
    for (let row = FIELD_HEADLAND_ROWS; row < getFieldDimensions(layout).rows - FIELD_HEADLAND_ROWS; row += 2) {
      if (!isFieldPlantingCell(row, headlandCols + 1, layout)) continue;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(rowWidth, 0.025, 0.1), rowMat);
      strip.position.set(layout.x, 0.24, layout.z - depth / 2 + row * TILE_SIZE + TILE_SIZE / 2);
      group.add(strip);
    }
  }
  return group;
}

function clearSceneGroup(group) {
  if (!group) return;
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) disposeMaterial(child.material);
  }
}

function updateActiveFieldSurface(layout, crop) {
  if (!activeFieldSurfaceGroup) return;
  clearSceneGroup(activeFieldSurfaceGroup);
  const { cols, rows, width, depth, halfWidth, halfDepth } = getFieldDimensions(layout);
  const baseY = getTerrainHeightAt(layout.x, layout.z, 0) + 0.14;
  const soil = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.8, depth + 0.8),
    new THREE.MeshBasicMaterial({ color: 0x7b5a34, side: THREE.DoubleSide })
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.set(layout.x, baseY, layout.z);
  activeFieldSurfaceGroup.add(soil);

  const furrowMat = new THREE.MeshBasicMaterial({ color: 0xa17643 });
  const headlandCols = Math.min(FIELD_HEADLAND_COLS, Math.floor(cols / 5));
  const rowWidth = Math.max(TILE_SIZE * 4, width - headlandCols * TILE_SIZE * 2);
  for (let row = 0; row < rows; row += 1) {
    const z = layout.z - halfDepth + row * TILE_SIZE + TILE_SIZE / 2;
    const furrow = new THREE.Mesh(new THREE.BoxGeometry(rowWidth, 0.025, 0.08), furrowMat);
    furrow.position.set(layout.x, baseY + 0.025, z);
    activeFieldSurfaceGroup.add(furrow);
  }

  const rimMat = new THREE.MeshBasicMaterial({ color: crop.accent });
  const rails = [
    { x: 0, z: -halfDepth, w: width, d: 0.18 },
    { x: 0, z: halfDepth, w: width, d: 0.18 },
    { x: -halfWidth, z: 0, w: 0.18, d: depth },
    { x: halfWidth, z: 0, w: 0.18, d: depth },
  ];
  for (const rail of rails) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(rail.w, 0.035, rail.d), rimMat);
    mesh.position.set(layout.x + rail.x, baseY + 0.05, layout.z + rail.z);
    activeFieldSurfaceGroup.add(mesh);
  }
}

function updateFallbackFieldSurface(layout) {
  const { cols, rows, width, depth, halfWidth } = getFieldDimensions(layout);
  fieldBase.geometry.dispose();
  fieldBase.geometry = new THREE.BoxGeometry(width + 1.2, 0.08, depth + 1.2);
  fieldBase.position.set(layout.x, 0.02, layout.z);
  while (laneLines.children.length) {
    const child = laneLines.children[0];
    laneLines.remove(child);
    child.geometry.dispose();
    child.material.dispose();
  }
  for (let col = 0; col <= cols; col += 4) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.02, rows * TILE_SIZE + 0.5),
      new THREE.MeshBasicMaterial({ color: 0xa9844e, transparent: true, opacity: 0.45 })
    );
    marker.position.set(layout.x - halfWidth + col * TILE_SIZE, 0.08, layout.z);
    laneLines.add(marker);
  }
}

function createDustPool(count) {
  const particles = [];
  const geometry = new THREE.SphereGeometry(0.18, 6, 4);
  for (let i = 0; i < count; i += 1) {
    const material = new THREE.MeshBasicMaterial({ color: 0xf0c779, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    scene.add(mesh);
    particles.push({ mesh, life: 0, velocity: new THREE.Vector3() });
  }
  return particles;
}

function createRainSystem(count) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 62;
    positions[i * 3 + 1] = 3 + Math.random() * 22;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 62;
    speeds[i] = 14 + Math.random() * 10;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xbfe9ff,
    size: 0.08,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.visible = false;
  points.frustumCulled = false;
  return { points, positions, speeds };
}

function resetRainDrop(index) {
  rainSystem.positions[index * 3] = (Math.random() - 0.5) * 62;
  rainSystem.positions[index * 3 + 1] = 10 + Math.random() * 18;
  rainSystem.positions[index * 3 + 2] = (Math.random() - 0.5) * 62;
}

function startRain() {
  rainActive = true;
  rainTimer = 10 + Math.random() * 16;
  rainSystem.points.visible = true;
  rainSystem.points.material.opacity = 0.72;
  if (!inMenu) showNotice('A quick rain shower rolls over the farm.');
}

function stopRain() {
  rainActive = false;
  rainCooldown = 42 + Math.random() * 58;
  rainSystem.points.visible = false;
  rainSystem.points.material.opacity = 0;
}

function updateWeather(dt) {
  if (!rainSystem) return;
  if (!rainActive) {
    rainCooldown -= dt;
    if (rainCooldown <= 0) startRain();
  } else {
    rainTimer -= dt;
    rainSystem.points.position.set(camera.position.x, camera.position.y - 4, camera.position.z);
    for (let i = 0; i < rainSystem.speeds.length; i += 1) {
      rainSystem.positions[i * 3 + 1] -= rainSystem.speeds[i] * dt;
      rainSystem.positions[i * 3] -= dt * 1.8;
      if (rainSystem.positions[i * 3 + 1] < -2) resetRainDrop(i);
    }
    rainSystem.points.geometry.attributes.position.needsUpdate = true;
    if (rainTimer <= 0) stopRain();
  }
  const rainMix = rainActive ? 1 : 0;
  scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, rainActive ? 80 : 180, dt * 0.8);
  scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, rainActive ? 360 : 760, dt * 0.8);
  sun.intensity = THREE.MathUtils.lerp(sun.intensity, rainActive ? 2.25 : 3.1, dt * 0.7);
  scene.background.lerp(new THREE.Color(rainMix ? 0x9fbfd0 : 0x9ed4ef), dt * 0.45);
}

function prepareLiveModel(object, scale) {
  object.scale.setScalar(scale);
  object.traverse((part) => {
    part.frustumCulled = true;
    if (!part.isMesh) return;
    part.castShadow = true;
    part.receiveShadow = true;
    configureFarmMaterial(part.material);
  });
}

function initializeWorldLife() {
  if (worldLifeReady) return;
  worldLifeReady = true;
  for (const actor of TRAFFIC_ACTORS) spawnTrafficActor(actor);
  for (const actor of LIVESTOCK_ACTORS) spawnLivestockActor(actor);
  for (const actor of WIND_TREE_ACTORS) spawnWindTreeActor(actor);
}

async function spawnTrafficActor(def) {
  try {
    const group = await cloneFarmPackScene(def.file);
    prepareLiveModel(group, def.scale);
    const route = (def.route || []).map(([x, z]) => snapPointToRoad({ x, z }));
    if (route.length < 2) return;
    const actor = {
      group,
      speed: def.speed,
      collider: def.radius,
      route,
      targetIndex: 1,
      routeDirection: 1,
      restRange: def.rest || [18, 36],
      restTimer: def.startDelay ?? 4 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
      baseY: 0,
    };
    const start = route[0];
    group.position.set(start.x, getTerrainHeightAt(start.x, start.z, 0) + 0.04, start.z);
    faceTrafficRouteTarget(actor);
    scene.add(group);
    trafficActors.push(actor);
  } catch (error) {
    console.warn(`Traffic actor failed: ${def.file}`, error);
  }
}

function getTrafficRestDuration(actor) {
  const [min, max] = actor.restRange;
  return min + Math.random() * Math.max(0, max - min);
}

function faceTrafficRouteTarget(actor) {
  const target = actor.route?.[actor.targetIndex];
  if (!target) return;
  const dx = target.x - actor.group.position.x;
  const dz = target.z - actor.group.position.z;
  if (Math.hypot(dx, dz) > 0.01) actor.group.rotation.y = Math.atan2(dx, dz);
}

function advanceTrafficRouteTarget(actor) {
  if (!actor.route || actor.route.length < 2) return;
  if (actor.targetIndex >= actor.route.length - 1) actor.routeDirection = -1;
  if (actor.targetIndex <= 0) actor.routeDirection = 1;
  actor.targetIndex += actor.routeDirection;
  faceTrafficRouteTarget(actor);
}

function snapPointToRoad(point) {
  const road = findNearestRoadCell(point.x, point.z, ROAD_NAV_CELL_SIZE * 2.4);
  return road ? { x: road.x, z: road.z } : point;
}

function isTrafficStepBlocked(actor, x, z) {
  if (roadCells.size && !findNearestRoadCell(x, z, ROAD_NAV_CELL_SIZE * 2.2)) return true;
  const terrainY = getTerrainHeightAt(x, z, actor.baseY);
  if (!isTerrainDriveableAt(x, z, terrainY)) return true;
  if (circleHitsStaticCollider(x, z, actor.collider + ACTOR_COLLIDER_PADDING)) return true;
  const playerDistance = Math.hypot(x - vehicle.position.x, z - vehicle.position.z);
  if (playerDistance < actor.collider + PLAYER_COLLIDER_RADIUS + TRAFFIC_PLAYER_YIELD_DISTANCE) return true;
  for (const other of trafficActors) {
    if (other === actor || !other.group?.visible) continue;
    const distance = Math.hypot(x - other.group.position.x, z - other.group.position.z);
    if (distance < actor.collider + other.collider + TRAFFIC_ACTOR_YIELD_PADDING) return true;
  }
  return false;
}

function randomPaddockPoint(paddock, margin = 0.8) {
  const safeMargin = getPaddockMargin(paddock, margin);
  return {
    x: THREE.MathUtils.lerp(paddock.minX + safeMargin, paddock.maxX - safeMargin, Math.random()),
    z: THREE.MathUtils.lerp(paddock.minZ + safeMargin, paddock.maxZ - safeMargin, Math.random()),
  };
}

function clampToPaddock(position, paddock, margin = 0.45) {
  const safeMargin = getPaddockMargin(paddock, margin);
  const x = THREE.MathUtils.clamp(position.x, paddock.minX + safeMargin, paddock.maxX - safeMargin);
  const z = THREE.MathUtils.clamp(position.z, paddock.minZ + safeMargin, paddock.maxZ - safeMargin);
  const clamped = x !== position.x || z !== position.z;
  position.x = x;
  position.z = z;
  return clamped;
}

function getPaddockMargin(paddock, requested) {
  const width = Math.max(0.1, paddock.maxX - paddock.minX);
  const depth = Math.max(0.1, paddock.maxZ - paddock.minZ);
  return Math.min(requested, Math.max(0.12, Math.min(width, depth) * 0.42));
}

function chooseLivestockTarget(actor) {
  const point = randomPaddockPoint(actor.paddock, actor.fenceMargin);
  actor.target.x = point.x;
  actor.target.z = point.z;
  actor.pause = 0.6 + Math.random() * 1.6;
}

async function spawnLivestockActor(def) {
  try {
    const group = await cloneFarmPackScene(def.file);
    prepareLiveModel(group, def.scale);
    const paddock = LIVESTOCK_PADDOCKS[def.paddock] || LIVESTOCK_PADDOCKS.cowWest;
    const fenceMargin = Math.max(LIVESTOCK_PADDOCK_MARGIN, def.collider + 0.45);
    const start = randomPaddockPoint(paddock, fenceMargin);
    const actor = {
      group,
      paddock,
      target: { x: start.x, z: start.z },
      speed: def.speed,
      collider: def.collider,
      fenceMargin,
      pause: 0,
      phase: Math.random() * Math.PI * 2,
      baseY: 0,
    };
    chooseLivestockTarget(actor);
    group.position.set(start.x, getTerrainHeightAt(start.x, start.z, 0) + 0.035, start.z);
    scene.add(group);
    livestockActors.push(actor);
  } catch (error) {
    console.warn(`Livestock actor failed: ${def.file}`, error);
  }
}

async function spawnWindTreeActor(def) {
  try {
    const group = await cloneFarmPackScene(def.file);
    prepareLiveModel(group, def.scale);
    group.position.set(def.position[0], 0, def.position[1]);
    group.userData.baseRotationY = Number.isFinite(def.rotationY) ? def.rotationY : Math.random() * Math.PI * 2;
    group.rotation.y = group.userData.baseRotationY;
    scene.add(group);
    windTreeActors.push({ group, phase: Math.random() * Math.PI * 2, sway: 0.018 + Math.random() * 0.026 });
  } catch (error) {
    console.warn(`Wind tree failed: ${def.file}`, error);
  }
}

function updateTrafficActors(dt) {
  for (const actor of trafficActors) {
    const next = actor.route?.[actor.targetIndex];
    if (!next) continue;
    actor.group.position.y = getTerrainHeightAt(actor.group.position.x, actor.group.position.z, actor.baseY) + 0.04 + Math.sin(performance.now() * 0.006 + actor.phase) * 0.018;
    if (actor.restTimer > 0) {
      actor.restTimer -= dt;
      continue;
    }
    const dx = next.x - actor.group.position.x;
    const dz = next.z - actor.group.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.18) {
      actor.group.position.set(next.x, getTerrainHeightAt(next.x, next.z, actor.baseY) + 0.04, next.z);
      actor.restTimer = getTrafficRestDuration(actor);
      advanceTrafficRouteTarget(actor);
      continue;
    }
    const step = Math.min(distance, actor.speed * dt);
    const nextX = actor.group.position.x + (dx / distance) * step;
    const nextZ = actor.group.position.z + (dz / distance) * step;
    if (isTrafficStepBlocked(actor, nextX, nextZ)) {
      actor.restTimer = Math.max(actor.restTimer, 1.1 + Math.random() * 1.6);
      continue;
    }
    actor.group.position.x = nextX;
    actor.group.position.z = nextZ;
    actor.group.rotation.y = Math.atan2(dx, dz);
  }
}

function updateLivestockActors(dt) {
  for (const actor of livestockActors) {
    if (actor.pause > 0) {
      actor.pause -= dt;
    }
    const dx = actor.target.x - actor.group.position.x;
    const dz = actor.target.z - actor.group.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.35) {
      chooseLivestockTarget(actor);
      continue;
    }
    if (actor.pause <= 0) {
      const step = Math.min(distance, actor.speed * dt);
      const nextX = actor.group.position.x + (dx / distance) * step;
      const nextZ = actor.group.position.z + (dz / distance) * step;
      const playerDistance = Math.hypot(nextX - vehicle.position.x, nextZ - vehicle.position.z);
      if (playerDistance < actor.collider + PLAYER_COLLIDER_RADIUS + LIVESTOCK_PLAYER_BUFFER) {
        chooseLivestockTarget(actor);
        actor.pause = 1.2 + Math.random() * 1.2;
      } else {
        actor.group.position.x = nextX;
        actor.group.position.z = nextZ;
      }
      actor.group.rotation.y = Math.atan2(dx, dz);
    }
    if (clampToPaddock(actor.group.position, actor.paddock, actor.fenceMargin)) {
      chooseLivestockTarget(actor);
    }
    const time = performance.now() * 0.006 + actor.phase;
    actor.group.position.y = getTerrainHeightAt(actor.group.position.x, actor.group.position.z, actor.baseY) + 0.035 + Math.sin(time * 1.8) * 0.035;
    actor.group.rotation.z = Math.sin(time * 2.2) * 0.025;
  }
}

function updateWind(dt) {
  windTime += dt;
  windStrength = THREE.MathUtils.lerp(windStrength, rainActive ? 1.0 : 0.55, dt * 0.55);
  for (const tree of windTreeActors) {
    const sway = Math.sin(windTime * 1.8 + tree.phase) * tree.sway * windStrength;
    tree.group.rotation.z = sway;
    tree.group.rotation.x = Math.cos(windTime * 1.35 + tree.phase) * tree.sway * 0.65 * windStrength;
  }
}

function createBarn() {
  const group = new THREE.Group();
  if (USE_FARM_SCENE) return group;
  gltfLoader.load(
    `${ALL_IN_ONE_BASE}hexagon-kit/building-farm.glb`,
    (gltf) => {
      const barn = gltf.scene;
      barn.scale.setScalar(2.8);
      barn.position.set(0, 0, -0.6);
      barn.rotation.y = -Math.PI * 0.18;
      barn.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
      });
      group.add(barn);
    },
    undefined,
    (error) => console.warn('Barn GLB failed', error)
  );
  return group;
}

function createFence() {
  const mat = new THREE.MeshLambertMaterial({ color: 0x8d6038 });
  const rails = [
    { x: 0, z: -FIELD_HALF_H - 1.3, w: FIELD_COLS * TILE_SIZE + 2, d: 0.18 },
    { x: 0, z: FIELD_HALF_H + 1.3, w: FIELD_COLS * TILE_SIZE + 2, d: 0.18 },
    { x: -FIELD_HALF_W - 1.3, z: 0, w: 0.18, d: FIELD_ROWS * TILE_SIZE + 2 },
    { x: FIELD_HALF_W + 1.3, z: 0, w: 0.18, d: FIELD_ROWS * TILE_SIZE + 2 },
  ];
  for (const rail of rails) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(rail.w, 0.4, rail.d), mat);
    mesh.position.set(rail.x, 0.36, rail.z);
    mesh.castShadow = true;
    scene.add(mesh);
  }
}

function createDecor() {
  scene.add(createBoundaryRidge());
  scene.add(createRoad());

  const waterTower = createWaterTower();
  waterTower.position.set(FIELD_HALF_W + 14.5, 0, -FIELD_HALF_H - 5.5);
  scene.add(waterTower);

  const crates = createMarketCrates();
  crates.position.set(siloGroup.position.x + 3.2, 0, siloGroup.position.z + 1.2);
  scene.add(crates);

  const hay = createHayStacks();
  hay.position.set(barnGroup.position.x - 3.8, 0, barnGroup.position.z - 2.8);
  scene.add(hay);

  const sign = createFarmSign();
  sign.position.set(0, 0, FIELD_HALF_H + 8.6);
  scene.add(sign);

  const scarecrow = createScarecrow();
  scarecrow.position.set(FIELD_HALF_W + 4.4, 0, -FIELD_HALF_H + 3.2);
  scarecrow.rotation.y = -0.35;
  scene.add(scarecrow);

  scene.add(createSatellitePlantations());
  createCropPreviewPlots();
  createKenneyMarketDecor();
  createKenneySpriteDecor();
  createKenneyAllInOneDecor();
}

function createBoundaryRidge() {
  const group = new THREE.Group();
  const bermMat = new THREE.MeshLambertMaterial({ color: 0x5f7e42 });
  const railMat = new THREE.MeshLambertMaterial({ color: 0x745135 });
  const edgeSegments = [
    { position: [0, 0.3, -WORLD_BOUNDS.z - 0.7], size: [WORLD_BOUNDS.x * 2 + 3.5, 0.6, 1.4] },
    { position: [0, 0.3, WORLD_BOUNDS.z + 0.7], size: [WORLD_BOUNDS.x * 2 + 3.5, 0.6, 1.4] },
    { position: [-WORLD_BOUNDS.x - 0.7, 0.3, 0], size: [1.4, 0.6, WORLD_BOUNDS.z * 2 + 3.5] },
    { position: [WORLD_BOUNDS.x + 0.7, 0.3, 0], size: [1.4, 0.6, WORLD_BOUNDS.z * 2 + 3.5] },
  ];
  for (const segment of edgeSegments) {
    const berm = new THREE.Mesh(new THREE.BoxGeometry(...segment.size), bermMat);
    berm.position.set(...segment.position);
    berm.castShadow = true;
    berm.receiveShadow = true;
    group.add(berm);
  }

  for (let postIndex = 0; postIndex <= 18; postIndex += 1) {
    const ratio = -1 + postIndex / 9;
    const horizontalX = ratio * WORLD_BOUNDS.x;
    const verticalZ = ratio * WORLD_BOUNDS.z;
    const postPositions = [
      [horizontalX, 0.85, -WORLD_BOUNDS.z - 0.2],
      [horizontalX, 0.85, WORLD_BOUNDS.z + 0.2],
      [-WORLD_BOUNDS.x - 0.2, 0.85, verticalZ],
      [WORLD_BOUNDS.x + 0.2, 0.85, verticalZ],
    ];
    for (const postPosition of postPositions) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.1, 0.24), railMat);
      post.position.set(...postPosition);
      post.castShadow = true;
      group.add(post);
    }
  }
  return group;
}

function createSatellitePlantations() {
  const group = new THREE.Group();
  const patches = [
    { crop: CROPS[1], position: [-FIELD_HALF_W - 12.5, 0, -FIELD_HALF_H + 5.8], rotation: 0.12, cols: 8, rows: 5 },
    { crop: CROPS[2], position: [FIELD_HALF_W + 11.8, 0, -FIELD_HALF_H + 7.5], rotation: -0.15, cols: 7, rows: 5 },
    { crop: CROPS[3], position: [-FIELD_HALF_W - 11.2, 0, FIELD_HALF_H - 9.8], rotation: -0.22, cols: 7, rows: 4 },
    { crop: CROPS[5], position: [FIELD_HALF_W + 11.7, 0, FIELD_HALF_H - 10.5], rotation: 0.18, cols: 6, rows: 4 },
  ];
  for (const patch of patches) {
    const plantation = createDecorativeCropPatch(patch.crop, patch.cols, patch.rows);
    plantation.position.set(...patch.position);
    plantation.rotation.y = patch.rotation;
    group.add(plantation);
  }
  return group;
}

function createDecorativeCropPatch(crop, cols, rows) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(cols * 0.72 + 1.1, 0.1, rows * 0.72 + 1.1),
    new THREE.MeshLambertMaterial({ color: 0x765231 })
  );
  base.position.y = 0.06;
  base.receiveShadow = true;
  group.add(base);

  const cropGeometry = createCropGeometry(crop);
  const cropMat = new THREE.MeshLambertMaterial({ color: crop.color });
  const accentMat = new THREE.MeshLambertMaterial({ color: crop.accent });
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let colIndex = 0; colIndex < cols; colIndex += 1) {
      const mesh = new THREE.Mesh(cropGeometry, (rowIndex + colIndex) % 5 === 0 ? accentMat : cropMat);
      const jitter = Math.sin(rowIndex * 4.7 + colIndex * 2.3) * 0.05;
      mesh.position.set((colIndex - (cols - 1) / 2) * 0.72 + jitter, 0.18 + crop.height * 0.2, (rowIndex - (rows - 1) / 2) * 0.72 - jitter);
      mesh.scale.setScalar(0.36 + ((rowIndex + colIndex) % 3) * 0.04);
      mesh.rotation.y = rowIndex * 0.19 + colIndex * 0.27;
      mesh.castShadow = true;
      group.add(mesh);
    }
  }
  return group;
}

function createKenneyMarketDecor() {
  const basePath = './assets/vendor/kenney/mini-market/';
  for (const asset of KENNEY_MARKET_ASSETS) {
    gltfLoader.load(`${basePath}${asset.file}`, (gltf) => {
      const model = gltf.scene;
      model.position.set(...asset.position);
      model.rotation.y = asset.rotation;
      model.scale.setScalar(asset.scale);
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
      });
      scene.add(model);
    }, undefined, (error) => {
      console.warn(`Kenney asset failed: ${asset.file}`, error);
    });
  }
}

function createKenneyAllInOneDecor() {
  for (const asset of KENNEY_ALL_IN_ONE_MODELS) {
    gltfLoader.load(`${ALL_IN_ONE_BASE}${asset.file}`, (gltf) => {
      const model = gltf.scene;
      model.position.set(...asset.position);
      model.rotation.y = asset.rotation;
      model.scale.setScalar(asset.scale);
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.material?.map) object.material.map.colorSpace = THREE.SRGBColorSpace;
      });
      scene.add(model);
    }, undefined, (error) => {
      console.warn(`Kenney All-in-1 asset failed: ${asset.file}`, error);
    });
  }
}

function createKenneySpriteDecor() {
  for (const sprite of KENNEY_SPRITES) {
    const texturePath = `${SPRITES_BASE}${sprite.file}`;
    const texture = textureLoader.load(texturePath, undefined, undefined, (error) => {
      console.warn(`Kenney sprite failed: ${texturePath}`, error);
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const object = new THREE.Sprite(material);
    object.position.set(...sprite.position);
    object.scale.set(sprite.size[0], sprite.size[1], 1);
    scene.add(object);
  }
}

function createCropPreviewPlots() {
  const startX = -FIELD_HALF_W + 2.5;
  const z = -FIELD_HALF_H - 4.3;
  CROPS.forEach((crop, index) => {
    const plot = createMiniCropPlot(crop, index);
    plot.position.set(startX + index * 7.0, 0, z);
    scene.add(plot);
  });
}

function createMiniCropPlot(crop, index) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4.7, 0.12, 3.4),
    new THREE.MeshLambertMaterial({ color: index % 2 === 0 ? 0x7c5630 : 0x8c6638 })
  );
  base.position.y = 0.08;
  base.receiveShadow = true;
  group.add(base);

  const cropGeometry = createCropGeometry(crop);
  const cropMaterial = new THREE.MeshLambertMaterial({ color: crop.color });
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const mesh = new THREE.Mesh(cropGeometry, cropMaterial);
      mesh.position.set(-1.55 + col * 1.0, 0.18 + crop.height * 0.22, -0.82 + row * 0.82);
      mesh.scale.setScalar(0.44);
      mesh.rotation.y = (row * 0.5 + col * 0.2) % Math.PI;
      mesh.castShadow = true;
      group.add(mesh);
    }
  }

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.92, 0.12), new THREE.MeshLambertMaterial({ color: 0x704621 }));
  post.position.set(-2.0, 0.58, 1.35);
  post.castShadow = true;
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.42, 0.08), new THREE.MeshLambertMaterial({ color: crop.accent }));
  flag.position.set(-1.58, 0.92, 1.35);
  flag.castShadow = true;
  group.add(post, flag);
  return group;
}

function createRoad() {
  const group = new THREE.Group();
  const roadMat = new THREE.MeshLambertMaterial({ color: 0xb78955 });
  const main = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.03, FARM_EDGE_MARGIN + 14), roadMat);
  main.position.set(0, 0.055, FIELD_HALF_H + 6.4);
  main.receiveShadow = true;
  const siloPath = new THREE.Mesh(new THREE.BoxGeometry(FARM_EDGE_MARGIN + 6, 0.03, 4.2), roadMat);
  siloPath.position.set(-FIELD_HALF_W - 5.0, 0.058, FIELD_HALF_H + 2.2);
  siloPath.receiveShadow = true;
  const barnPath = new THREE.Mesh(new THREE.BoxGeometry(FARM_EDGE_MARGIN + 6, 0.03, 4.2), roadMat);
  barnPath.position.set(FIELD_HALF_W + 5.0, 0.058, FIELD_HALF_H + 2.2);
  barnPath.receiveShadow = true;
  const northLane = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.03, 15), roadMat);
  northLane.position.set(0, 0.052, -FIELD_HALF_H - 7.0);
  northLane.receiveShadow = true;
  const loopLane = new THREE.Mesh(new THREE.BoxGeometry(FIELD_COLS * TILE_SIZE + 8, 0.03, 3.2), roadMat);
  loopLane.position.set(0, 0.054, -FIELD_HALF_H - 2.8);
  loopLane.receiveShadow = true;
  group.add(main, siloPath, barnPath, northLane, loopLane);
  return group;
}

function createWaterTower() {
  const group = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: 0x7a4f2a });
  const tankMat = new THREE.MeshLambertMaterial({ color: 0x8fc0cf });
  for (const x of [-0.8, 0.8]) {
    for (const z of [-0.8, 0.8]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), legMat);
      leg.position.set(x, 1.7, z);
      leg.castShadow = true;
      group.add(leg);
    }
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.15, 18), tankMat);
  tank.position.y = 3.75;
  tank.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.22, 0.45, 18), new THREE.MeshLambertMaterial({ color: 0x496f8c }));
  roof.position.y = 4.55;
  roof.castShadow = true;
  group.add(tank, roof);
  return group;
}

function createMarketCrates() {
  const group = new THREE.Group();
  const layout = [
    { file: 'display-fruit.glb', position: [0, 0, 0], rotation: 0, scale: 0.95 },
    { file: 'display-bread.glb', position: [1.6, 0, 0.4], rotation: -Math.PI * 0.18, scale: 0.95 },
    { file: 'shopping-basket.glb', position: [0.3, 0, 1.3], rotation: Math.PI * 0.3, scale: 0.9 },
    { file: 'shopping-cart.glb', position: [-1.4, 0, 1.0], rotation: -Math.PI * 0.1, scale: 0.85 },
    { file: 'shelf-boxes.glb', position: [-1.0, 0, -0.8], rotation: Math.PI * 0.5, scale: 0.9 },
    { file: 'cash-register.glb', position: [2.3, 0.12, -0.6], rotation: Math.PI * 0.25, scale: 0.75 },
  ];
  const basePath = './assets/vendor/kenney/mini-market/';
  for (const item of layout) {
    gltfLoader.load(
      `${basePath}${item.file}`,
      (gltf) => {
        const model = gltf.scene;
        model.position.set(...item.position);
        model.rotation.y = item.rotation;
        model.scale.setScalar(item.scale);
        model.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.castShadow = true;
          obj.receiveShadow = true;
        });
        group.add(model);
      },
      undefined,
      (error) => console.warn(`Market crate ${item.file} failed`, error)
    );
  }
  return group;
}

function createHayStacks() {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xd9a84a });
  for (let i = 0; i < 8; i += 1) {
    const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.82, 12), mat);
    bale.rotation.z = Math.PI / 2;
    bale.position.set((i % 4) * 0.88, 0.42 + Math.floor(i / 4) * 0.75, Math.floor(i / 4) * 0.85);
    bale.castShadow = true;
    group.add(bale);
  }
  return group;
}

function createFarmSign() {
  const group = new THREE.Group();
  const postMat = new THREE.MeshLambertMaterial({ color: 0x704621 });
  const signMat = new THREE.MeshLambertMaterial({ color: 0xe6b15e });
  for (const x of [-1.25, 1.25]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.8, 0.18), postMat);
    post.position.set(x, 0.9, 0);
    post.castShadow = true;
    group.add(post);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 0.18), signMat);
  board.position.y = 1.45;
  board.castShadow = true;
  group.add(board);
  return group;
}

function createScarecrow() {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x704621 });
  const shirtMat = new THREE.MeshLambertMaterial({ color: 0x3f88c5 });
  const strawMat = new THREE.MeshLambertMaterial({ color: 0xd9a84a });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), woodMat);
  post.position.y = 1.3;
  const arms = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), woodMat);
  arms.position.y = 1.78;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.8, 0.28), shirtMat);
  body.position.y = 1.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), strawMat);
  head.position.y = 2.08;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.32, 8), new THREE.MeshLambertMaterial({ color: 0x8d6038 }));
  hat.position.y = 2.38;
  group.add(post, arms, body, head, hat);
  group.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
  return group;
}

function buildField() {
  for (const mesh of cropMeshes) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    disposeMaterial(mesh.material, mesh.userData.disposeTexture);
  }
  cropMeshes = [];

  const crop = getCrop();
  const fieldState = ensureFieldState();
  updateFieldStateFromClock(fieldState);
  const fieldVisualScale = getFieldVisualScale(fieldState);
  currentFieldVisualStage = getFieldVisualStage(fieldState);
  currentFieldAnchor = getFieldAnchor();
  const fieldLayout = currentFieldAnchor;
  const fieldDimensions = getFieldDimensions(fieldLayout);
  updateFallbackFieldSurface(fieldLayout);
  updateActiveFieldSurface(fieldLayout, crop);
  updateFieldServiceSpots();
  ensureContractForField();
  const modelParts = createCropModelParts(crop);
  const cropParts = modelParts.length ? modelParts : createCropParts(crop);
  const spriteParts = modelParts.length ? [] : createCropSpriteParts(crop);
  const instanceCount = fieldDimensions.cols * fieldDimensions.rows * CROP_CLUSTER_COUNT;
  for (const part of cropParts) {
    const material = part.material ? cloneMaterial(part.material) : new THREE.MeshLambertMaterial({ color: part.color });
    configureFarmMaterial(material);
    const geometry = part.cached ? part.geometry.clone() : part.geometry;
    const mesh = new THREE.InstancedMesh(geometry, material, instanceCount);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.partOffsetY = part.offsetY * (part.useVisualScale === false ? 1 : CROP_VISUAL_SCALE);
    mesh.userData.partScale = part.scale * (part.useVisualScale === false ? 1 : CROP_VISUAL_SCALE);
    cropMeshes.push(mesh);
  }
  for (const part of spriteParts) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, instanceCount);
    mesh.userData.partOffsetY = part.offsetY * CROP_VISUAL_SCALE;
    mesh.userData.partScale = part.scale * CROP_VISUAL_SCALE;
    mesh.userData.spriteSlot = part.slot;
    mesh.userData.spriteTotal = spriteParts.length;
    mesh.userData.disposeTexture = true;
    cropMeshes.push(mesh);
  }
  cropTiles = [];
  harvestedCount = 0;
  comboCount = 0;
  comboTimer = 0;
  bestComboThisField = 0;
  lastComboMilestone = 0;
  rowCleared = Array(fieldDimensions.rows).fill(false);
  rowTileCounts = Array(fieldDimensions.rows).fill(0);
  rowHarvestedCounts = Array(fieldDimensions.rows).fill(0);
  fieldStartTime = performance.now();
  fieldCompleted = false;

  let index = 0;
  for (let row = 0; row < fieldDimensions.rows; row += 1) {
    for (let col = 0; col < fieldDimensions.cols; col += 1) {
      if (!isFieldPlantingCell(row, col, fieldLayout)) continue;
      for (let cluster = 0; cluster < CROP_CLUSTER_COUNT; cluster += 1) {
        const { x, z } = getFieldTilePosition(fieldLayout, row, col, cluster);
        const terrainY = getTerrainHeightAt(x, z, 0);
        if (!isFieldTileClearForPlanting(x, z, terrainY, fieldLayout)) continue;
        const scale = 0.88 + ((col * 19 + row * 11 + cluster * 7) % 5) * 0.025;
        for (const mesh of cropMeshes) {
          const isSkippedSprite = Number.isInteger(mesh.userData.spriteSlot) && index % mesh.userData.spriteTotal !== mesh.userData.spriteSlot;
          tmpObject.position.set(x, isSkippedSprite ? -100 : terrainY + CROP_GROUND_OFFSET + mesh.userData.partOffsetY * fieldVisualScale, z);
          tmpObject.rotation.y = Math.PI * 0.92 + Math.sin(row * 0.43 + cluster * 0.31) * 0.045;
          tmpObject.scale.setScalar(isSkippedSprite ? 0.001 : scale * mesh.userData.partScale * fieldVisualScale);
          tmpObject.updateMatrix();
          mesh.setMatrixAt(index, tmpObject.matrix);
        }
        cropTiles.push({ index, row, col, x, z, y: terrainY, harvested: false });
        rowTileCounts[row] += 1;
        index += 1;
      }
    }
  }
  for (const mesh of cropMeshes) {
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  const trailerFill = vehicleGroup.getObjectByName('trailerFill');
  if (trailerFill) trailerFill.material.color.setHex(crop.color);
}

function createCropSpriteParts(crop) {
  const sprites = CROP_ASSET_SPRITES[crop.id] ?? [];
  return sprites.map((sprite, slot) => {
    const texture = textureLoader.load(sprite.file, undefined, undefined, (error) => {
      fallbackSdk.captureError(new Error(`Failed to load crop sprite ${sprite.file}: ${error.message}`));
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    return {
      geometry: new THREE.PlaneGeometry(sprite.width, sprite.height),
      material,
      offsetY: sprite.y,
      scale: 1,
      slot,
    };
  });
}

function createCropParts(crop) {
  const stemColor = crop.id === 'wheat' ? 0xd0a640 : 0x4f9b48;
  if (crop.id === 'pumpkin') {
    const pumpkin = new THREE.SphereGeometry(0.34, 8, 6);
    pumpkin.scale(1.2, 0.62, 1.05);
    return [
      { geometry: pumpkin, color: crop.color, offsetY: 0.34, scale: 1.0 },
      { geometry: new THREE.ConeGeometry(0.12, 0.32, 6), color: crop.accent, offsetY: 0.72, scale: 1.0 },
    ];
  }
  if (crop.id === 'cotton') {
    return [
      { geometry: new THREE.CylinderGeometry(0.035, 0.055, crop.height, 5), color: stemColor, offsetY: crop.height / 2 + 0.06, scale: 1.0 },
      { geometry: new THREE.DodecahedronGeometry(0.28, 0), color: crop.color, offsetY: crop.height + 0.12, scale: 1.0 },
    ];
  }
  if (crop.id === 'sunflower') {
    const head = new THREE.CylinderGeometry(0.17, 0.17, 0.055, 10);
    head.rotateX(Math.PI / 2);
    return [
      { geometry: new THREE.CylinderGeometry(0.025, 0.038, crop.height * 0.84, 5), color: stemColor, offsetY: crop.height * 0.42 + 0.06, scale: 0.92 },
      { geometry: head, color: crop.color, offsetY: crop.height * 0.8 + 0.12, scale: 0.72 },
    ];
  }
  if (crop.id === 'lettuce') {
    const leaf = new THREE.SphereGeometry(0.28, 8, 5);
    leaf.scale(1.18, 0.34, 1.05);
    return [
      { geometry: leaf, color: crop.color, offsetY: 0.24, scale: 1.0 },
      { geometry: new THREE.SphereGeometry(0.18, 7, 4), color: crop.accent, offsetY: 0.32, scale: 0.75 },
    ];
  }
  if (crop.id === 'tomato') {
    return [
      { geometry: new THREE.CylinderGeometry(0.035, 0.055, crop.height, 5), color: crop.accent, offsetY: crop.height / 2 + 0.06, scale: 1.0 },
      { geometry: new THREE.SphereGeometry(0.2, 8, 6), color: crop.color, offsetY: crop.height * 0.62, scale: 1.0 },
      { geometry: new THREE.SphereGeometry(0.16, 8, 5), color: 0xff7358, offsetY: crop.height * 0.86, scale: 0.85 },
    ];
  }
  if (crop.id === 'corn') {
    return [
      { geometry: new THREE.CylinderGeometry(0.06, 0.1, crop.height, 6), color: stemColor, offsetY: crop.height / 2 + 0.06, scale: 1.0 },
      { geometry: new THREE.CylinderGeometry(0.11, 0.13, 0.42, 6), color: crop.accent, offsetY: crop.height * 0.72, scale: 1.0 },
    ];
  }
  if (crop.id === 'soybean') {
    return [
      { geometry: new THREE.CylinderGeometry(0.04, 0.06, crop.height, 5), color: crop.accent, offsetY: crop.height / 2 + 0.05, scale: 1.0 },
      { geometry: new THREE.SphereGeometry(0.22, 7, 5), color: crop.color, offsetY: crop.height * 0.72, scale: 0.82 },
    ];
  }
  if (crop.id === 'carrot') {
    return [
      { geometry: new THREE.ConeGeometry(0.14, crop.height, 7), color: crop.color, offsetY: crop.height / 2 + 0.06, scale: 1.0 },
      { geometry: new THREE.ConeGeometry(0.16, 0.34, 5), color: crop.accent, offsetY: crop.height + 0.08, scale: 0.85 },
    ];
  }
  if (crop.id === 'lavender') {
    return [
      { geometry: new THREE.CylinderGeometry(0.025, 0.04, crop.height, 5), color: crop.accent, offsetY: crop.height / 2 + 0.05, scale: 1.0 },
      { geometry: new THREE.ConeGeometry(0.12, 0.38, 6), color: crop.color, offsetY: crop.height * 0.9, scale: 0.9 },
    ];
  }
  if (crop.id === 'potato') {
    const mound = new THREE.SphereGeometry(0.24, 7, 5);
    mound.scale(1.18, 0.44, 0.95);
    return [
      { geometry: mound, color: crop.color, offsetY: 0.24, scale: 0.95 },
      { geometry: new THREE.ConeGeometry(0.15, 0.3, 5), color: crop.accent, offsetY: 0.5, scale: 0.75 },
    ];
  }
  if (crop.id === 'rice') {
    return [
      { geometry: new THREE.CylinderGeometry(0.025, 0.045, crop.height, 5), color: crop.accent, offsetY: crop.height / 2 + 0.04, scale: 1.0 },
      { geometry: new THREE.ConeGeometry(0.13, 0.34, 6), color: crop.color, offsetY: crop.height * 0.86, scale: 0.78 },
    ];
  }
  return [
    { geometry: new THREE.CylinderGeometry(0.035, 0.055, crop.height * 0.86, 5), color: 0xbfa44a, offsetY: crop.height * 0.43 + 0.06, scale: 1.0 },
    { geometry: new THREE.ConeGeometry(0.16, 0.42, 6), color: crop.color, offsetY: crop.height + 0.04, scale: 1.0 },
  ];
}

function createCropGeometry(crop) {
  if (crop.id === 'corn') return new THREE.CylinderGeometry(0.18, 0.3, crop.height, 6);
  if (crop.id === 'sunflower') return new THREE.ConeGeometry(0.44, crop.height, 8);
  if (crop.id === 'carrot') {
    const geometry = new THREE.ConeGeometry(0.25, crop.height, 7);
    geometry.rotateX(Math.PI);
    return geometry;
  }
  if (crop.id === 'cotton') {
    const geometry = new THREE.DodecahedronGeometry(0.42, 0);
    geometry.scale(1, 0.72, 1);
    return geometry;
  }
  if (crop.id === 'pumpkin') {
    const geometry = new THREE.SphereGeometry(0.48, 8, 6);
    geometry.scale(1, 0.52, 1);
    return geometry;
  }
  return new THREE.ConeGeometry(0.34, crop.height, 6);
}

function getCrop() {
  return getCropForField(save.field);
}

function getStats() {
  const turboMultiplier = isTurboActive() ? 1.35 : 1;
  const magnetActive = isMagnetActive();
  const machine = getCurrentMachine();
  const fit = getMachineCropFit(machine, getCrop());
  return {
    maxSpeed: (11.6 + save.upgrades.speed * 1.25) * turboMultiplier * machine.speedMultiplier * fit.speed * getMachineLevelMultiplier('speed', machine),
    turnSpeed: 3.35 + save.upgrades.speed * 0.1,
    cutRadius: (1.05 + save.upgrades.cutWidth * 0.24) * (magnetActive ? 1.85 : 1) * machine.cutMultiplier * fit.cut * getMachineLevelMultiplier('cut', machine),
    capacity: Math.floor((180 + save.upgrades.capacity * 50) * machine.capacityMultiplier * fit.capacity * getMachineLevelMultiplier('capacity', machine)),
    priceMultiplier: (1 + save.upgrades.price * 0.28) * fit.price * getMachineLevelMultiplier('price', machine),
  };
}

function getHarvestProgress() {
  return cropTiles.length ? (harvestedCount / cropTiles.length) * 100 : 0;
}

function formatPercent(value, digits = 1) {
  return `${Math.max(0, Math.min(100, Number(value) || 0)).toFixed(digits)}%`;
}

function getFieldClearTarget() {
  const contract = ensureContractForField();
  return Math.min(88, Math.max(contract.target + 14, 32 + getSeasonFieldNumber() * 4));
}

function isFieldReadyForDelivery(contract = ensureContractForField()) {
  return Boolean(contract.fieldReadyToFinish) || getHarvestProgress() >= getFieldClearTarget();
}

function markFieldReadyForDelivery() {
  const contract = ensureContractForField();
  if (contract.fieldReadyToFinish) return;
  contract.fieldReadyToFinish = true;
  if (!contract.completed) contract.readyToDeliver = true;
  persistSave();
  showNotice(`Field cleared. Deliver the final load to ${contract.destinationName}.`);
}

function getContractPayout(contract = ensureContractForField()) {
  const machine = getCurrentMachine();
  const fit = getMachineCropFit(machine, getCrop());
  const fitMultiplier = fit.tier === 'best' ? 1.18 : fit.tier === 'good' ? 1.06 : 0.92;
  const levelMultiplier = 1 + Math.max(0, getMachineLevel(machine) - 1) * 0.05;
  return Math.max(1, Math.floor(contract.reward * fitMultiplier * levelMultiplier));
}

function isTurboActive() {
  return performance.now() < boostUntil;
}

function updateVehicleStats() {
  const stats = getStats();
  if (cargo > stats.capacity) cargo = stats.capacity;
}

function bindInput() {
  window.addEventListener('resize', resize);
  window.addEventListener('error', (event) => sdk.captureError(event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => sdk.captureError(event.reason || 'Unhandled rejection'));
  window.addEventListener('gamepadconnected', handleGamepadConnected);
  window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

  window.addEventListener('keydown', (event) => {
    if (inMenu && ['Enter', ' ', 'w', 'W', 'ArrowUp'].includes(event.key)) {
      startRun();
      return;
    }
    if (event.key === 'Escape') {
      setPaused(!paused);
      return;
    }
    if (event.key.toLowerCase() === 'e') toggleCamera();
    setKey(event.key, true);
    markFirstInput();
  });

  window.addEventListener('keyup', (event) => setKey(event.key, false));

  ui.sellButton.addEventListener('click', sellCargo);
  ui.fertilizerButton.addEventListener('click', applyFertilizer);
  ui.magnetButton.addEventListener('click', activateMagnet);
  ui.boostButton.addEventListener('click', activateTurbo);
  ui.musicButton.addEventListener('click', toggleMusic);
  ui.cameraButton.addEventListener('click', toggleCamera);
  ui.shopButton.addEventListener('click', () => setShop(true));
  ui.closeShopButton.addEventListener('click', () => setShop(false));
  ui.playButton.addEventListener('click', startRun);
  ui.titleResetButton.addEventListener('click', resetFarm);
  ui.continueSeasonButton.addEventListener('click', continueSeason);
  ui.resumeButton.addEventListener('click', () => setPaused(false));
  ui.resetButton.addEventListener('click', resetFarm);
  shell.addEventListener('click', (event) => {
    if (event.target.closest('button')) playSample('click', 0.22);
  }, { capture: true });

  setupJoystick();
  setupGamepad();
}

function startRun() {
  if (!inMenu) return;
  inMenu = false;
  ui.titlePanel.classList.remove('open');
  currentSeasonStartCoins = save.coins;
  startMusic();
  showNotice(isCurrentFieldMature()
    ? 'Drive through crops. Sell full loads at a silo or barn.'
    : `${getCrop().name} is growing. Fertilize it or wait until mature.`);
  showFieldBanner(true);
  startTutorial();
  ensureDaily();
  updateDailyCard();
}

async function activateTurbo() {
  markFirstInput();
  ui.boostButton.disabled = true;
  try {
    const result = await sdk.rewardedBreak();
    const granted = result?.granted !== false;
    if (!granted) {
      playSample('error', 0.26);
      showNotice('Turbo was not granted.');
      return;
    }
    boostUntil = performance.now() + 18000;
    save.totalTurboUses = (save.totalTurboUses || 0) + 1;
    persistSave();
    playRewardSound();
    showNotice('Turbo active for 18 seconds.');
  } catch {
    boostUntil = performance.now() + 12000;
    save.totalTurboUses = (save.totalTurboUses || 0) + 1;
    persistSave();
    showNotice('Local turbo active.');
  } finally {
    updateHud();
  }
}

function setKey(key, value) {
  const normalized = key.toLowerCase();
  if (normalized === 'w' || key === 'ArrowUp') input.forward = value;
  if (normalized === 's' || key === 'ArrowDown') input.back = value;
  if (normalized === 'a' || key === 'ArrowLeft') input.left = value;
  if (normalized === 'd' || key === 'ArrowRight') input.right = value;
}

function setupJoystick() {
  let activePointer = null;

  const update = (event) => {
    const rect = ui.joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const max = rect.width * 0.38;
    const length = Math.min(max, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * length;
    const knobY = Math.sin(angle) * length;
    ui.joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
    input.joystickX = Math.max(-1, Math.min(1, dx / max));
    input.joystickY = Math.max(-1, Math.min(1, -dy / max));
  };

  ui.joystick.addEventListener('pointerdown', (event) => {
    activePointer = event.pointerId;
    ui.joystick.setPointerCapture(activePointer);
    markFirstInput();
    update(event);
  });

  ui.joystick.addEventListener('pointermove', (event) => {
    if (event.pointerId === activePointer) update(event);
  });

  const release = (event) => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    input.joystickX = 0;
    input.joystickY = 0;
    ui.joystickKnob.style.transform = 'translate(-50%, -50%)';
  };
  ui.joystick.addEventListener('pointerup', release);
  ui.joystick.addEventListener('pointercancel', release);
}

function setupGamepad() {
  const gamepad = getActiveGamepad();
  if (gamepad) activeGamepadIndex = gamepad.index;
}

function handleGamepadConnected(event) {
  activeGamepadIndex = event.gamepad.index;
  previousGamepadButtons = new Set();
  if (!inMenu) showNotice('Gamepad connected. Left stick drives, A sells, Y changes camera.');
}

function handleGamepadDisconnected(event) {
  if (activeGamepadIndex !== event.gamepad.index) return;
  activeGamepadIndex = null;
  previousGamepadButtons = new Set();
  input.gamepadX = 0;
  input.gamepadY = 0;
  if (!inMenu) showNotice('Gamepad disconnected.');
}

function getActiveGamepad() {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
  const gamepads = navigator.getGamepads();
  if (activeGamepadIndex !== null && gamepads[activeGamepadIndex]?.connected) return gamepads[activeGamepadIndex];
  const gamepad = Array.from(gamepads).find((item) => item?.connected) || null;
  activeGamepadIndex = gamepad?.index ?? null;
  return gamepad;
}

function getGamepadButtonValue(gamepad, index) {
  const button = gamepad.buttons[index];
  if (!button) return 0;
  return typeof button === 'number' ? button : button.value;
}

function isGamepadButtonDown(gamepad, index) {
  const button = gamepad.buttons[index];
  return Boolean(button?.pressed || getGamepadButtonValue(gamepad, index) > 0.55);
}

function getPressedGamepadButtons(gamepad) {
  const buttons = new Set();
  for (let i = 0; i < gamepad.buttons.length; i += 1) {
    if (isGamepadButtonDown(gamepad, i)) buttons.add(i);
  }
  return buttons;
}

function wasGamepadButtonPressed(buttons, index) {
  return buttons.has(index) && !previousGamepadButtons.has(index);
}

function applyGamepadDeadzone(value) {
  const abs = Math.abs(value);
  if (abs < GAMEPAD_DEADZONE) return 0;
  return Math.sign(value) * ((abs - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE));
}

function updateGamepadInput() {
  const gamepad = getActiveGamepad();
  if (!gamepad) {
    input.gamepadX = 0;
    input.gamepadY = 0;
    previousGamepadButtons = new Set();
    return;
  }

  const buttons = getPressedGamepadButtons(gamepad);
  const dpadX = (buttons.has(GAMEPAD_BUTTONS.dpadRight) ? 1 : 0) - (buttons.has(GAMEPAD_BUTTONS.dpadLeft) ? 1 : 0);
  const dpadY = (buttons.has(GAMEPAD_BUTTONS.dpadUp) ? 1 : 0) - (buttons.has(GAMEPAD_BUTTONS.dpadDown) ? 1 : 0);
  const triggerY = getGamepadButtonValue(gamepad, GAMEPAD_BUTTONS.rightTrigger) - getGamepadButtonValue(gamepad, GAMEPAD_BUTTONS.leftTrigger);
  const stickX = applyGamepadDeadzone(gamepad.axes[0] || 0);
  const stickY = applyGamepadDeadzone(-(gamepad.axes[1] || 0));
  input.gamepadX = dpadX || stickX;
  input.gamepadY = dpadY || triggerY || stickY;

  const hasDirectionalIntent = Math.abs(input.gamepadX) > 0.25 || Math.abs(input.gamepadY) > 0.25;
  const wantsStart = wasGamepadButtonPressed(buttons, GAMEPAD_BUTTONS.south) || wasGamepadButtonPressed(buttons, GAMEPAD_BUTTONS.start);
  if (inMenu && (hasDirectionalIntent || wantsStart)) {
    startRun();
    markFirstInput();
    previousGamepadButtons = buttons;
    return;
  }

  if (!inMenu && hasDirectionalIntent) markFirstInput();
  handleGamepadActions(buttons);
  previousGamepadButtons = buttons;
}

function handleGamepadActions(buttons) {
  const pressed = (button) => wasGamepadButtonPressed(buttons, button);
  if (ui.seasonPanel.classList.contains('open')) {
    if (pressed(GAMEPAD_BUTTONS.south) || pressed(GAMEPAD_BUTTONS.start)) continueSeason();
    return;
  }
  if (inMenu) return;
  if (pressed(GAMEPAD_BUTTONS.start) || pressed(GAMEPAD_BUTTONS.select)) {
    setPaused(!paused);
    return;
  }
  if (paused) {
    if (pressed(GAMEPAD_BUTTONS.south)) setPaused(false);
    return;
  }

  const shopOpen = ui.shopPanel.classList.contains('open');
  if (pressed(GAMEPAD_BUTTONS.west)) {
    setShop(!shopOpen);
    return;
  }
  if (shopOpen) {
    if (pressed(GAMEPAD_BUTTONS.east)) setShop(false);
    return;
  }

  if (pressed(GAMEPAD_BUTTONS.south)) sellCargo();
  if (pressed(GAMEPAD_BUTTONS.east)) activateTurbo();
  if (pressed(GAMEPAD_BUTTONS.north) || pressed(GAMEPAD_BUTTONS.rightStick)) toggleCamera();
  if (pressed(GAMEPAD_BUTTONS.leftShoulder)) applyFertilizer();
  if (pressed(GAMEPAD_BUTTONS.rightShoulder)) activateMagnet();
}

function markFirstInput() {
  if (gameplayStarted) return;
  ensureAudio();
  gameplayStarted = true;
  sdk.gameplayStart();
}

function setPaused(value) {
  if (inMenu) return;
  paused = value;
  ui.pausePanel.classList.toggle('open', paused);
  if (paused) {
    stopMusic();
    sdk.gameplayStop();
  } else {
    if (gameplayStarted) sdk.gameplayStart();
    startMusic();
  }
}

function setShop(open) {
  if (inMenu) return;
  ui.shopPanel.classList.toggle('open', open);
  if (open) {
    renderShop();
    stopMusic();
    sdk.gameplayStop();
  } else if (gameplayStarted && !paused) {
    sdk.gameplayStart();
    startMusic();
  }
}

function loop(time) {
  const dt = Math.min(0.04, (time - lastTime) / 1000 || 0.016);
  lastTime = time;
  updateGamepadInput();
  shell.classList.toggle('playing', !inMenu);
  shell.classList.toggle('overview-camera', cameraMode === 2);

  if (!inMenu && !paused && !ui.shopPanel.classList.contains('open') && !ui.seasonPanel.classList.contains('open')) {
    update(dt);
  } else {
    updateCamera(dt);
    updateWorldEffects(dt);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function update(dt) {
  updateVehicle(dt);
  updateFieldGrowth(dt);
  harvestCrops(dt);
  applyMagnetPull(dt);
  updateCamera(dt);
  updateWorldEffects(dt);
  updateFieldBanner();
  updateTutorial();
  updateHud();
}

function updateVehicle(dt) {
  const stats = getStats();
  const driveInput = (input.forward ? 1 : 0) - (input.back ? 1 : 0) + input.joystickY + input.gamepadY;
  const turnInput = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joystickX + input.gamepadX;
  const targetSpeed = THREE.MathUtils.clamp(driveInput, -1, 1) * stats.maxSpeed;
  vehicleSpeed = THREE.MathUtils.lerp(vehicleSpeed, targetSpeed, dt * 4.2);
  const turnPower = THREE.MathUtils.clamp(turnInput, -1, 1) * stats.turnSpeed * dt;
  const speedFactor = 0.35 + Math.min(1, Math.abs(vehicleSpeed) / stats.maxSpeed) * 0.75;
  vehicle.angle -= turnPower * speedFactor * Math.sign(vehicleSpeed || 1);

  const moveX = Math.sin(vehicle.angle) * vehicleSpeed * dt;
  const moveZ = Math.cos(vehicle.angle) * vehicleSpeed * dt;
  const moveDistance = Math.hypot(moveX, moveZ);
  const moveSteps = Math.max(1, Math.ceil(moveDistance / 0.18));
  let hitFarmEdge = false;
  for (let step = 0; step < moveSteps; step += 1) {
    const stepPreviousPosition = vehicle.position.clone();
    const previousTerrainY = getTerrainHeightAt(stepPreviousPosition.x, stepPreviousPosition.z, stepPreviousPosition.y - VEHICLE_GROUND_OFFSET);
    vehicle.position.x += moveX / moveSteps;
    vehicle.position.z += moveZ / moveSteps;
    const clampedX = THREE.MathUtils.clamp(vehicle.position.x, -WORLD_BOUNDS.x, WORLD_BOUNDS.x);
    const clampedZ = THREE.MathUtils.clamp(vehicle.position.z, -WORLD_BOUNDS.z, WORLD_BOUNDS.z);
    hitFarmEdge = hitFarmEdge || clampedX !== vehicle.position.x || clampedZ !== vehicle.position.z;
    vehicle.position.x = clampedX;
    vehicle.position.z = clampedZ;
    if (!isTerrainDriveableAt(vehicle.position.x, vehicle.position.z, previousTerrainY)) {
      blockVehicleOnTerrain(stepPreviousPosition);
      continue;
    }
    resolveVehicleCollisions(stepPreviousPosition);
    snapVehicleToTerrain();
  }
  if (hitFarmEdge) {
    vehicleSpeed *= -0.12;
    if (edgeNoticeCooldown <= 0) {
      edgeNoticeCooldown = 4;
      showNotice('Fence line holds the tractor inside the farm.');
    }
  }

  vehicleGroup.position.copy(vehicle.position);
  vehicleGroup.rotation.y = vehicle.angle;
  dustTimer -= dt;
  if (Math.abs(vehicleSpeed) > 1.2 && dustTimer <= 0) {
    dustTimer = 0.08;
    const backX = vehicle.position.x - Math.sin(vehicle.angle) * 1.8;
    const backZ = vehicle.position.z - Math.cos(vehicle.angle) * 1.8;
    spawnDust(backX, backZ, 2, 0xd9b36b);
  }
  const trailerFill = vehicleGroup.getObjectByName('trailerFill');
  if (trailerFill) {
    const fillRatio = cargo / getStats().capacity;
    trailerFill.visible = fillRatio > 0.02;
    trailerFill.scale.y = Math.max(0.15, fillRatio * 2.7);
    trailerFill.position.y = 0.84 + fillRatio * 0.12;
  }
}

function harvestCrops(dt) {
  const stats = getStats();
  if (cargo >= stats.capacity) return;
  if (!isCurrentFieldMature()) {
    if (Math.abs(vehicleSpeed) > 1.2 && growthNoticeCooldown <= 0) {
      growthNoticeCooldown = 4;
      showNotice(`${getCrop().name} is still growing. Use Fertilize to speed it up.`);
    }
    return;
  }

  const crop = getCrop();
  const headerX = vehicle.position.x + Math.sin(vehicle.angle) * 1.25;
  const headerZ = vehicle.position.z + Math.cos(vehicle.angle) * 1.25;
  const forwardX = Math.sin(vehicle.angle);
  const forwardZ = Math.cos(vehicle.angle);
  const sideX = Math.cos(vehicle.angle);
  const sideZ = -Math.sin(vehicle.angle);
  const headerDepth = 1.85;
  let harvestedThisFrame = 0;
  const touchedRows = new Set();

  for (const tile of cropTiles) {
    if (tile.harvested) continue;
    const dx = tile.x - headerX;
    const dz = tile.z - headerZ;
    const forwardDistance = dx * forwardX + dz * forwardZ;
    const sideDistance = dx * sideX + dz * sideZ;
    if (forwardDistance > -0.35 && forwardDistance < headerDepth && Math.abs(sideDistance) <= stats.cutRadius) {
      tile.harvested = true;
      harvestedCount += 1;
      harvestedThisFrame += 1;
      touchedRows.add(tile.row);
      rowHarvestedCounts[tile.row] = (rowHarvestedCounts[tile.row] || 0) + 1;
      cargo = Math.min(stats.capacity, cargo + crop.load);
      hideCropInstance(tile.index);
      if (cargo >= stats.capacity) break;
    }
  }

  if (harvestedThisFrame > 0) {
    updateCombo(harvestedThisFrame);
    for (const row of touchedRows) maybeRewardCleanRow(row);
    save.totalCropsHarvested = (save.totalCropsHarvested || 0) + harvestedThisFrame;
    trackDailyProgress('crops', harvestedThisFrame);
    harvestPulse = 1;
    playHarvestSound();
    spawnDust(headerX, headerZ, Math.min(9, harvestedThisFrame + 2), crop.accent);
    sdk.requestHapticFeedback('light');
    maybeCompleteContract();
    checkAchievements();
  }

  if (!fieldCompleted && getHarvestProgress() >= getFieldClearTarget()) markFieldReadyForDelivery();
  harvestPulse = Math.max(0, harvestPulse - dt * 2.8);
}

function updateCombo(amount) {
  comboCount = comboTimer > 0 ? comboCount + amount : amount;
  comboTimer = 2.4;
  bestComboThisField = Math.max(bestComboThisField, comboCount);
  save.bestCombo = Math.max(save.bestCombo || 0, bestComboThisField);
  trackDailyProgress('combo', save.bestCombo);
  const milestone = Math.floor(comboCount / 100) * 100;
  if (milestone >= 100 && milestone > lastComboMilestone) {
    lastComboMilestone = milestone;
    const reward = Math.floor(5 + milestone * 0.03 + save.field * 0.5);
    save.coins += reward;
    spawnPop(`Combo ${milestone} +${reward}`, 50, 46);
    playTone(360 + Math.min(360, milestone * 2), 0.07, 'triangle', 0.024);
  }
}

function maybeRewardCleanRow(row) {
  if (rowCleared[row]) return;
  if (!rowTileCounts[row] || rowHarvestedCounts[row] < rowTileCounts[row]) return;
  rowCleared[row] = true;
  const reward = 8 + Math.floor(save.field * 1.6);
  save.coins += reward;
  spawnPop(`Row +${reward}`, 31 + (row % 5) * 5, 68);
  playTone(460, 0.055, 'square', 0.018);
}

function hideCropInstance(index) {
  tmpObject.position.set(0, -100, 0);
  tmpObject.scale.set(0.001, 0.001, 0.001);
  tmpObject.updateMatrix();
  for (const mesh of cropMeshes) {
    mesh.setMatrixAt(index, tmpObject.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }
}

function updateCamera(dt) {
  const forward = tmpVector.set(Math.sin(vehicle.angle), 0, Math.cos(vehicle.angle));
  const target = new THREE.Vector3().copy(vehicle.position);
  let desired;
  if (cameraMode === 0) {
    desired = target.clone().addScaledVector(forward, -7.2).add(new THREE.Vector3(0, 3.45, 0));
  } else if (cameraMode === 1) {
    desired = target.clone().add(new THREE.Vector3(0, 19, 0.2));
  } else {
    desired = new THREE.Vector3(0, 175, 54);
  }
  camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
  if (cameraMode === 0) {
    camera.lookAt(target.x + forward.x * 4.2, target.y + 1.05, target.z + forward.z * 4.2);
  } else if (cameraMode === 1) {
    camera.lookAt(target.x, target.y + 0.9, target.z);
  } else {
    camera.lookAt(0, 0, 12);
  }
}

function updateFarmSceneCulling(dt) {
  if (!farmSceneCullingItems.length) return;
  farmCullTimer -= dt;
  if (farmCullTimer > 0) return;
  farmCullTimer = FARM_CULL_INTERVAL;
  const cameraX = camera.position.x;
  const cameraZ = camera.position.z;
  for (const item of farmSceneCullingItems) {
    const cullDistance = FARM_CULL_DISTANCE + item.radius;
    const dx = item.center.x - cameraX;
    const dz = item.center.z - cameraZ;
    item.mesh.visible = dx * dx + dz * dz <= cullDistance * cullDistance;
  }
}

function updateWorldEffects(dt) {
  const stats = getStats();
  edgeNoticeCooldown = Math.max(0, edgeNoticeCooldown - dt);
  collisionNoticeCooldown = Math.max(0, collisionNoticeCooldown - dt);
  for (const prop of animatedProps) prop.object.rotation[prop.axis] += dt * prop.speed;
  updateFarmSceneCulling(dt);
  updateTrafficActors(dt);
  updateLivestockActors(dt);
  updateWind(dt);
  updateWeather(dt);
  if (fieldGuideGroup) fieldGuideGroup.visible = cameraMode === 2;
  const nearestUnload = getNearestUnloadStation();
  const nearUnload = Boolean(nearestUnload?.inside);
  const targetUnloadZone = getContractUnloadZone();
  for (const zone of sellZones) {
    zone.rotation.z += dt * 0.8;
    const isNearest = zone === nearestUnload?.zone;
    const isTarget = zone === targetUnloadZone;
    zone.material.opacity = nearUnload && isNearest ? 0.98 : isTarget ? 0.78 : isNearest ? 0.64 : 0.38;
    zone.material.color.setHex(isTarget ? 0xffe36e : 0xffd769);
  }
  updateRouteGuides(dt, stats);
  fieldBase.material.color.lerp(new THREE.Color(harvestPulse > 0 ? 0xa0793f : 0x8c6638), dt * 4);
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      comboCount = 0;
      lastComboMilestone = 0;
    }
  }
  updateDust(dt);
  if (noticeTimer > 0) {
    noticeTimer -= dt;
    if (noticeTimer <= 0) ui.noticeText.classList.remove('visible');
  }
}

function spawnDust(x, z, count, color = 0xf0c779) {
  for (let i = 0; i < count; i += 1) {
    const particle = dustParticles.find((item) => item.life <= 0);
    if (!particle) return;
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 1.6;
    particle.life = 0.45 + Math.random() * 0.25;
    particle.mesh.visible = true;
    particle.mesh.material.color.setHex(color);
    particle.mesh.material.opacity = 0.38;
    particle.mesh.scale.setScalar(0.55 + Math.random() * 0.55);
    particle.mesh.position.set(x + Math.cos(angle) * 0.45, 0.42 + Math.random() * 0.2, z + Math.sin(angle) * 0.45);
    particle.velocity.set(Math.cos(angle) * speed, 0.85 + Math.random() * 0.8, Math.sin(angle) * speed);
  }
}

function updateDust(dt) {
  for (const particle of dustParticles) {
    if (particle.life <= 0) continue;
    particle.life -= dt;
    particle.mesh.position.addScaledVector(particle.velocity, dt);
    particle.velocity.y -= dt * 1.4;
    particle.mesh.material.opacity = Math.max(0, particle.life * 0.65);
    particle.mesh.scale.multiplyScalar(1 + dt * 1.8);
    if (particle.life <= 0) particle.mesh.visible = false;
  }
}

function updateHud() {
  const stats = getStats();
  const progress = getHarvestProgress();
  const fieldState = ensureFieldState();
  updateFieldStateFromClock(fieldState);
  const fieldMature = fieldState.state === FIELD_STATES.MATURE;
  const growthProgress = getFieldGrowthProgress(fieldState) * 100;
  const capacity = Math.floor((cargo / stats.capacity) * 100);
  const contract = ensureContractForField();
  const destinationName = contract.destinationName || getFieldServiceStation().name;
  const contractDeliveryReady = contract.readyToDeliver && !contract.completed;
  const fieldDeliveryReady = isFieldReadyForDelivery(contract);
  const cleanRows = rowCleared.filter(Boolean).length;
  const activeRows = getActivePlantingRows();
  const turboSeconds = Math.max(0, Math.ceil((boostUntil - performance.now()) / 1000));
  const machine = getCurrentMachine();
  const machineLevel = getMachineLevel(machine);
  const machineFit = getMachineCropFit(machine, getCrop());
  ui.coinsText.textContent = Math.floor(save.coins).toLocaleString('en-US');
  ui.seasonText.textContent = `${getSeasonNumber()}-${getSeasonFieldNumber()}`;
  ui.cropText.textContent = getCrop().name;
  ui.progressLabel.textContent = fieldMature ? 'Harvest' : 'Growth';
  ui.progressText.textContent = fieldMature ? formatPercent(progress) : formatPercent(growthProgress, 0);
  if (fieldMature) {
    const payout = getContractPayout(contract);
    if (fieldDeliveryReady) {
      ui.contractLabel.textContent = 'Final delivery';
      ui.contractProgress.textContent = `Unload at ${destinationName}`;
      ui.contractReward.textContent = `Field clear target ${formatPercent(getFieldClearTarget(), 0)} reached`;
      ui.contractCard.classList.add('complete');
    } else if (contractDeliveryReady) {
      ui.contractLabel.textContent = 'Delivery ready';
      ui.contractProgress.textContent = `Drive to ${destinationName}`;
      ui.contractReward.textContent = `Contract reward ${payout}`;
      ui.contractCard.classList.add('complete');
    } else {
      ui.contractLabel.textContent = contract.completed ? 'Contract complete' : contract.label;
      ui.contractProgress.textContent = contract.completed
        ? `Field target ${formatPercent(getFieldClearTarget(), 0)}`
        : `${formatPercent(Math.min(progress, contract.target))} / ${formatPercent(contract.target, 0)}`;
      ui.contractReward.textContent = contract.completed ? `${payout} coins earned` : `${destinationName} · reward ${payout}`;
      ui.contractCard.classList.toggle('complete', contract.completed);
    }
    ui.objectiveTitle.textContent = contract.brief || `${getCrop().name} field order`;
    ui.objectiveMeta.textContent = `${contract.plotName} | ${harvestedCount}/${cropTiles.length} clumps | ${cleanRows}/${activeRows} rows | ${machine.name} Lv ${machineLevel}`;
    ui.objectiveBonus.textContent = `${machineFit.shortLabel} match | ${getCrop().value} coins per crate | ${contract.destinationName} bonus | ${getNextUnlockText()}`;
  } else {
    ui.contractLabel.textContent = 'Growing Crop';
    ui.contractProgress.textContent = `${formatPercent(growthProgress, 0)} grown`;
    ui.contractReward.textContent = `${formatDuration(getFieldTimeLeftMs(fieldState))} until mature`;
    ui.contractCard.classList.remove('complete');
    ui.objectiveTitle.textContent = `${getCrop().name} field is growing`;
    ui.objectiveMeta.textContent = `Fertilizer x${save.inventory.fertilizer || 0} | Yield x${getCurrentFieldYieldMultiplier().toFixed(2)} | ${machine.name} Lv ${machineLevel}`;
    ui.objectiveBonus.textContent = `${machineFit.label}. Use Fertilize to speed growth and raise yield.`;
  }
  ui.comboBadge.textContent = comboCount > 1 ? `Combo x${comboCount}` : `Best x${save.bestCombo || 0}`;
  ui.comboBadge.classList.toggle('active', comboCount >= 8 && comboTimer > 0);
  ui.capacityFill.style.height = `${capacity}%`;
  ui.capacityText.textContent = `${capacity}%`;
  if (fieldMature) {
    ui.fertilizerButton.textContent = 'Ready';
    ui.fertilizerButton.disabled = true;
  } else if ((save.inventory.fertilizer || 0) > 0) {
    ui.fertilizerButton.textContent = `Fertilize x${save.inventory.fertilizer}`;
    ui.fertilizerButton.disabled = false;
  } else {
    const fertilizerCost = getFertilizerUnitCost();
    ui.fertilizerButton.textContent = `${fertilizerCost} Fert`;
    ui.fertilizerButton.disabled = save.coins < fertilizerCost;
  }
  const nearestUnload = getNearestUnloadStation();
  const nearUnload = Boolean(nearestUnload?.inside);
  const nearTargetUnload = nearUnload && nearestUnload.station.id === contract.stationId;
  ui.sellButton.textContent = 'Sell';
  ui.sellButton.disabled = cargo <= 0 || !nearUnload || ((contractDeliveryReady || fieldDeliveryReady) && !nearTargetUnload);
  ui.boostButton.textContent = turboSeconds > 0 ? `${turboSeconds}s` : 'Turbo';
  ui.boostButton.disabled = turboSeconds > 0 || ui.shopPanel.classList.contains('open') || ui.seasonPanel.classList.contains('open');
  const now = performance.now();
  const magnetActiveSec = Math.max(0, Math.ceil((magnetUntil - now) / 1000));
  const magnetCooldownSec = Math.max(0, Math.ceil((magnetCooldownUntil - now) / 1000));
  if (ui.magnetButton) {
    if (magnetActiveSec > 0) {
      ui.magnetButton.textContent = `🧲 ${magnetActiveSec}s`;
      ui.magnetButton.classList.add('active');
      ui.magnetButton.disabled = true;
    } else if (magnetCooldownSec > 0) {
      ui.magnetButton.textContent = `🧲 ${magnetCooldownSec}s`;
      ui.magnetButton.classList.remove('active');
      ui.magnetButton.disabled = true;
    } else {
      ui.magnetButton.textContent = '🧲 Magnet';
      ui.magnetButton.classList.remove('active');
      ui.magnetButton.disabled = ui.shopPanel.classList.contains('open') || ui.seasonPanel.classList.contains('open');
    }
  }
  ui.musicButton.textContent = musicEnabled ? 'Music' : 'Muted';
  updateSeasonStrip(progress);
  updateTitleStats();
  if (!fieldMature) {
    ui.siloGuide.textContent = `Growing - ${formatDuration(getFieldTimeLeftMs(fieldState))} left`;
    ui.siloGuide.classList.add('visible');
  } else if (cargo > 0 && nearTargetUnload) {
    ui.siloGuide.textContent = 'Press Sell to unload';
    ui.siloGuide.classList.add('visible');
  } else if (fieldDeliveryReady && cargo > 0) {
    ui.siloGuide.textContent = `Final load - drive to ${destinationName}`;
    ui.siloGuide.classList.add('visible');
  } else if (contractDeliveryReady && cargo > 0) {
    ui.siloGuide.textContent = `Contract ready - drive to ${destinationName}`;
    ui.siloGuide.classList.add('visible');
  } else if (cargo >= stats.capacity) {
    ui.siloGuide.textContent = `Trailer full - drive to ${destinationName}`;
    ui.siloGuide.classList.add('visible');
  } else if (cargo >= stats.capacity * SILO_GUIDE_RATIO) {
    ui.siloGuide.textContent = `Head to ${destinationName} to unload`;
    ui.siloGuide.classList.add('visible');
  } else {
    ui.siloGuide.classList.remove('visible');
  }
}

function getNextUnlockText() {
  const nextCrop = CROPS.find((crop) => save.field < crop.unlockField);
  const nextBuyableMachine = MACHINES.find((machine) => isMachineUnlocked(machine) && !isMachineOwned(machine.id));
  const nextMachine = MACHINES.find((machine) => save.field < machine.unlockField);
  const nextPaint = PAINTS.find((paint) => save.field < paint.unlockField);
  if (nextBuyableMachine) return `${nextBuyableMachine.name} available in Shop`;
  if (nextCrop) return `${nextCrop.name} unlocks at field ${nextCrop.unlockField}`;
  if (nextMachine) return `${nextMachine.name} unlocks at field ${nextMachine.unlockField}`;
  if (nextPaint) return `${nextPaint.name} paint unlocks at field ${nextPaint.unlockField}`;
  return `Best combo x${save.bestCombo || 0}`;
}

function updateSeasonStrip(progress) {
  const seasonField = getSeasonFieldNumber();
  ui.seasonStrip.innerHTML = CROPS.map((crop) => {
    const unlocked = save.field >= crop.unlockField;
    const active = crop.id === getCrop().id;
    return `<span class="season-node${unlocked ? ' unlocked' : ''}${active ? ' active' : ''}" title="${crop.name}">${crop.name.slice(0, 2)}</span>`;
  }).join('') + `<span class="season-meter"><b style="width:${Math.min(100, ((seasonField - 1) / SEASON_FIELD_TARGET) * 100 + progress / SEASON_FIELD_TARGET)}%"></b></span>`;
}

function updateTitleStats() {
  const unlocked = CROPS.filter((crop) => save.field >= crop.unlockField).length;
  const ownedMachines = MACHINES.filter((machine) => isMachineOwned(machine.id)).length;
  ui.titleStats.innerHTML = `
    <span><strong>${Math.floor(save.coins).toLocaleString('en-US')}</strong> coins</span>
    <span><strong>${getSeasonNumber()}-${getSeasonFieldNumber()}</strong> season</span>
    <span><strong>${unlocked}/${CROPS.length}</strong> crops</span>
    <span><strong>${ownedMachines}/${MACHINES.length}</strong> machines</span>
    <span><strong>${save.inventory.fertilizer || 0}</strong> fertilizer</span>
  `;
}

function maybeCompleteContract() {
  const contract = ensureContractForField();
  if (contract.completed || contract.readyToDeliver) return;
  const progress = getHarvestProgress();
  if (progress < contract.target) return;
  contract.readyToDeliver = true;
  persistSave();
  showNotice(`${contract.label} is ready. Deliver to ${contract.destinationName}.`);
}

function getNearestUnloadStation() {
  let nearest = null;
  for (const zone of sellZones) {
    const station = zone.userData.station;
    const dx = vehicle.position.x - zone.position.x;
    const dz = vehicle.position.z - zone.position.z;
    const distance = Math.hypot(dx, dz);
    if (!nearest || distance < nearest.distance) {
      nearest = {
        zone,
        station,
        distance,
        inside: distance <= station.radius,
      };
    }
  }
  return nearest;
}

function isNearSilo() {
  return Boolean(getNearestUnloadStation()?.inside);
}

function getNearestUnharvestedCropTarget() {
  let nearest = null;
  for (const tile of cropTiles) {
    if (tile.harvested) continue;
    const dx = tile.x - vehicle.position.x;
    const dz = tile.z - vehicle.position.z;
    const distanceSq = dx * dx + dz * dz;
    if (!nearest || distanceSq < nearest.distanceSq) {
      nearest = {
        x: tile.x,
        y: tile.y,
        z: tile.z,
        distanceSq,
      };
    }
  }
  return nearest;
}

function getRouteGuideTarget(stats = getStats()) {
  const contract = ensureContractForField();
  const fieldState = ensureFieldState();
  const fieldStateName = updateFieldStateFromClock(fieldState);
  const targetUnloadZone = getContractUnloadZone(contract);
  const deliveryReady = contract.readyToDeliver || isFieldReadyForDelivery(contract) || cargo >= stats.capacity * SILO_GUIDE_RATIO;
  if (cargo > 0 && deliveryReady) {
    return {
      type: 'delivery',
      label: contract.destinationName,
      x: targetUnloadZone.position.x,
      y: targetUnloadZone.position.y,
      z: targetUnloadZone.position.z,
      radius: targetUnloadZone.userData.station.radius + 0.8,
    };
  }
  if (fieldStateName !== FIELD_STATES.MATURE) {
    return {
      type: 'field',
      label: currentFieldAnchor.name,
      x: currentFieldAnchor.x,
      y: getTerrainHeightAt(currentFieldAnchor.x, currentFieldAnchor.z, 0),
      z: currentFieldAnchor.z,
      radius: 6.5,
    };
  }
  const cropTarget = getNearestUnharvestedCropTarget();
  if (cropTarget) {
    return {
      type: 'harvest',
      label: currentFieldAnchor.name,
      x: cropTarget.x,
      y: cropTarget.y,
      z: cropTarget.z,
      radius: 3.8,
    };
  }
  return {
    type: 'delivery',
    label: contract.destinationName,
    x: targetUnloadZone.position.x,
    y: targetUnloadZone.position.y,
    z: targetUnloadZone.position.z,
    radius: targetUnloadZone.userData.station.radius + 0.8,
  };
}

function updateRouteGuides(dt, stats = getStats()) {
  if (!siloArrow || !routeArrow || inMenu || paused || ui.shopPanel.classList.contains('open') || ui.seasonPanel.classList.contains('open')) {
    if (siloArrow) siloArrow.visible = false;
    if (routeArrow) routeArrow.visible = false;
    ui.routeGuide?.classList.remove('visible');
    return;
  }
  const target = getRouteGuideTarget(stats);
  if (!target) {
    siloArrow.visible = false;
    routeArrow.visible = false;
    ui.routeGuide?.classList.remove('visible');
    return;
  }
  const dx = target.x - vehicle.position.x;
  const dz = target.z - vehicle.position.z;
  const distance = Math.hypot(dx, dz);
  const arrived = distance <= target.radius;
  const targetAngle = Math.atan2(dx, dz);
  if (ui.routeGuide && ui.routeGuideArrow && ui.routeGuideLabel && ui.routeGuideDistance) {
    const routeLabel = target.type === 'delivery'
      ? `Deliver to ${target.label}`
      : target.type === 'field'
        ? `Go to ${target.label}`
        : 'Cut crops';
    ui.routeGuideLabel.textContent = routeLabel;
    ui.routeGuideDistance.textContent = arrived ? 'Arrived' : `${Math.round(distance)}m`;
    ui.routeGuideArrow.style.setProperty('--route-rotation', `${THREE.MathUtils.radToDeg(targetAngle - vehicle.angle)}deg`);
    ui.routeGuide.classList.toggle('visible', !arrived || target.type === 'delivery');
  }
  const showTargetMarker = !arrived && (target.type === 'delivery' || (target.type === 'field' && distance > ROUTE_MARKER_MIN_DISTANCE));
  siloArrow.visible = showTargetMarker;
  if (showTargetMarker) {
    siloArrow.position.x = target.x;
    siloArrow.position.z = target.z;
    siloArrow.rotation.y += dt * 2.2;
    siloArrow.position.y = target.y + 5.5 + Math.sin(performance.now() * 0.006) * 0.35;
    siloArrow.scale.setScalar(target.type === 'delivery' ? 1.05 : 0.72);
  }
  const showRouteArrow = !arrived && distance > ROUTE_GUIDE_MIN_DISTANCE && cameraMode !== 2;
  routeArrow.visible = showRouteArrow;
  if (showRouteArrow) {
    routeArrow.position.set(vehicle.position.x, vehicle.position.y + 3.15 + Math.sin(performance.now() * 0.007) * 0.12, vehicle.position.z);
    routeArrow.rotation.y = targetAngle;
    routeArrow.rotation.z = Math.sin(performance.now() * 0.005) * 0.05;
    routeArrow.scale.setScalar(target.type === 'delivery' ? 1.04 : 0.82);
  }
}

function sellCargo() {
  const contract = ensureContractForField();
  const deliveryReady = contract.readyToDeliver || isFieldReadyForDelivery(contract);
  if (cargo <= 0) {
    if (deliveryReady) showNotice(`Harvest a final load for ${contract.destinationName}.`);
    return;
  }
  const stats = getStats();
  const unload = getNearestUnloadStation();
  if (!unload?.inside) {
    playSample('error', 0.24);
    showNotice(`Follow the arrow to ${contract.destinationName}.`);
    return;
  }
  markFirstInput();
  const crop = getCrop();
  const matchedDestination = unload.station.id === contract.stationId;
  if (deliveryReady && !matchedDestination) {
    playSample('error', 0.24);
    showNotice(`This load belongs at ${contract.destinationName}.`);
    return;
  }
  const deliveredCargo = cargo;
  const finishFieldAfterUnload = matchedDestination && isFieldReadyForDelivery(contract);
  const destinationMultiplier = matchedDestination ? 1.12 : 0.88;
  const earned = Math.floor(cargo * crop.value * stats.priceMultiplier * getCurrentFieldYieldMultiplier() * destinationMultiplier);
  let contractPayout = 0;
  if (matchedDestination && contract.readyToDeliver && !contract.completed) {
    contractPayout = getContractPayout(contract);
    contract.completed = true;
    contract.readyToDeliver = false;
    save.totalContracts = (save.totalContracts || 0) + 1;
    save.coins += contractPayout;
  }
  save.coins += earned;
  save.totalSold += earned;
  cargo = 0;
  trackDailyProgress('sells', 1);
  checkAchievements();
  persistSave();
  renderShop();
  sdk.happyTime(2);
  playRewardSound();
  spawnPop(`+${earned}`, 50, 62);
  if (contractPayout > 0) spawnPop(`Contract +${contractPayout}`, 50, 54);
  if (finishFieldAfterUnload) {
    completeField(deliveredCargo);
    return;
  }
  showNotice(matchedDestination
    ? `Delivered load to ${unload.station.name} for ${earned + contractPayout} coins.`
    : `${contract.destinationName} pays the contract bonus. Sold here for ${earned}.`);
}

function completeField(deliveredCargo = cargo) {
  if (fieldCompleted) return;
  fieldCompleted = true;
  const stats = getStats();
  const crop = getCrop();
  const elapsed = Math.max(1, (performance.now() - fieldStartTime) / 1000);
  const speedBonus = elapsed < 180 ? Math.floor((180 - elapsed) * 0.2) : 0;
  const comboBonus = Math.floor(bestComboThisField * 0.25);
  const loadBonus = Math.floor(deliveredCargo * crop.value * stats.priceMultiplier * getCurrentFieldYieldMultiplier());
  const bonus = 80 + save.field * 20 + speedBonus + comboBonus + loadBonus;
  const previousSeason = getSeasonNumber();
  const completedField = save.field;
  save.coins += bonus;
  const completedFieldState = ensureFieldState(completedField);
  completedFieldState.state = FIELD_STATES.HARVESTED;
  save.field += 1;
  save.cropIndex = getUnlockedCropIndexForField(save.field);
  save.contract = createContractForField(save.field);
  plantField(save.field);
  save.totalFieldsCleared = (save.totalFieldsCleared || 0) + 1;
  if (!save.fastestFieldSec || elapsed < save.fastestFieldSec) save.fastestFieldSec = Math.round(elapsed * 10) / 10;
  const unlockedMachine = MACHINES.find((machine) => machine.unlockField === save.field);
  cargo = 0;
  trackDailyProgress('fields', 1);
  checkAchievements();
  persistSave();
  playRewardSound();
  spawnPop(`Field +${bonus}`, 50, 54);
  showNotice(unlockedMachine
    ? `Field cleared. ${unlockedMachine.name} is now available to buy.`
    : `Field cleared: ${comboBonus} combo, ${speedBonus} rush, ${loadBonus} load.`);
  sdk.happyTime(5);
  if (save.field > 1 && save.field % 3 === 0) {
    sdk.commercialBreak().catch(() => {});
  }
  buildField();
  updateVehicleStats();
  renderShop();
  placeVehicleAtFieldStart();
  showFieldBanner();
  if (getSeasonNumber() > previousSeason) {
    save.totalSeasons = (save.totalSeasons || 0) + 1;
    checkAchievements();
    showSeasonComplete();
  }
}

function showSeasonComplete() {
  const earned = Math.max(0, save.coins - currentSeasonStartCoins);
  save.bestSeasonCoins = Math.max(save.bestSeasonCoins, earned);
  persistSave();
  ui.seasonResult.textContent = `Season ${getSeasonNumber() - 1} earned ${earned.toLocaleString('en-US')} coins. Best season: ${save.bestSeasonCoins.toLocaleString('en-US')}.`;
  ui.seasonPanel.classList.add('open');
  stopMusic();
  sdk.gameplayStop();
  playRewardSound();
}

function continueSeason() {
  ui.seasonPanel.classList.remove('open');
  currentSeasonStartCoins = save.coins;
  if (gameplayStarted) sdk.gameplayStart();
  startMusic();
  showNotice(`Season ${getSeasonNumber()} started.`);
}

function renderShop() {
  ui.upgradeGrid.innerHTML = '';
  ui.machineGrid.innerHTML = '';
  ui.paintGrid.innerHTML = '';
  ui.consumableGrid.innerHTML = '';
  const stats = getStats();
  const machine = getCurrentMachine();
  const machineLevel = getMachineLevel(machine);
  const machineFit = getMachineCropFit(machine, getCrop());
  const fieldState = ensureFieldState();
  updateFieldStateFromClock(fieldState);
  const fieldStatus = fieldState.state === FIELD_STATES.MATURE
    ? 'Field ready'
    : `Growing ${formatPercent(getFieldGrowthProgress(fieldState) * 100, 0)} (${formatDuration(getFieldTimeLeftMs(fieldState))})`;
  const nextCrop = CROPS[Math.min(CROPS.length - 1, save.cropIndex + 1)];
  const nextCropText = save.cropIndex >= CROPS.length - 1 ? 'All crops unlocked' : `${nextCrop.name} unlocks at field ${nextCrop.unlockField}`;
  ui.shopSummary.textContent = `${machine.name} Lv ${machineLevel} | ${machineFit.label} | Speed ${stats.maxSpeed.toFixed(1)} | Cut ${stats.cutRadius.toFixed(1)} | Capacity ${stats.capacity} | ${fieldStatus} | ${nextCropText}`;
  ui.shopLedger.innerHTML = `
    <span><strong>${Math.floor(save.totalSold).toLocaleString('en-US')}</strong> sold</span>
    <span><strong>x${save.bestCombo || 0}</strong> best combo</span>
    <span><strong>${(save.ownedMachines || []).length}/${MACHINES.length}</strong> machines</span>
    <span><strong>${save.inventory.fertilizer || 0}</strong> fertilizer</span>
  `;
  ui.cropRoadmap.innerHTML = CROPS.map((crop) => {
    const unlocked = save.field >= crop.unlockField;
    const active = crop.id === getCrop().id;
    return `
      <span class="crop-step${unlocked ? ' unlocked' : ''}${active ? ' active' : ''}">
        <i style="background:#${crop.color.toString(16).padStart(6, '0')}"></i>
        <b>${crop.name}</b>
        <small>${unlocked ? 'Ready' : `Field ${crop.unlockField}`}</small>
      </span>
    `;
  }).join('');
  const fertilizerCost = getFertilizerBundleCost();
  const fertilizerItem = document.createElement('article');
  fertilizerItem.className = 'upgrade-item';
  fertilizerItem.innerHTML = `
    <h3>Basic Fertilizer x${FERTILIZER_BUNDLE_AMOUNT}</h3>
    <p>Speeds crop growth and adds +${Math.round(FERTILIZER_YIELD_BONUS * 100)}% yield to the active field.</p>
    <button class="wood-button" type="button">${fertilizerCost} coins</button>
  `;
  const fertilizerButton = fertilizerItem.querySelector('button');
  fertilizerButton.disabled = save.coins < fertilizerCost;
  fertilizerButton.addEventListener('click', buyFertilizerBundle);
  ui.consumableGrid.append(fertilizerItem);
  for (const machineOption of MACHINES) {
    const unlocked = isMachineUnlocked(machineOption);
    const owned = isMachineOwned(machineOption.id);
    const selected = machineOption.id === machine.id;
    const level = getMachineLevel(machineOption);
    const levelCost = getMachineLevelCost(machineOption);
    const fit = getMachineCropFit(machineOption, getCrop());
    const card = document.createElement('article');
    card.className = `machine-card${selected ? ' selected' : ''}${owned ? ' owned' : ''}${!unlocked ? ' locked' : ''}`;
    const cropTags = [...(machineOption.bestCrops || [])]
      .map((cropId) => CROPS.find((crop) => crop.id === cropId)?.name)
      .filter(Boolean)
      .join(', ');
    card.innerHTML = `
      <div class="machine-card-head">
        <b>${machineOption.name}</b>
        <small>${!unlocked ? `Unlocks field ${machineOption.unlockField}` : owned ? `Owned · Lv ${level}/${MACHINE_LEVEL_MAX}` : `${machineOption.cost} coins`}</small>
      </div>
      <span class="machine-role">${machineOption.role}</span>
      <span class="machine-specialty">${machineOption.specialty}</span>
      <span class="machine-fit ${fit.tier}">${fit.shortLabel} for ${getCrop().name}</span>
      <span class="machine-stats">Speed x${machineOption.speedMultiplier.toFixed(2)} | Cut x${machineOption.cutMultiplier.toFixed(2)} | Cargo x${machineOption.capacityMultiplier.toFixed(2)}</span>
      <span class="machine-crops">Best: ${cropTags || 'Any crop'}</span>
      <div class="machine-actions">
        <button class="wood-button equip-machine" type="button">${selected ? 'Equipped' : 'Equip'}</button>
        <button class="wood-button buy-machine" type="button">${owned ? (level >= MACHINE_LEVEL_MAX ? 'Max Lv' : `Upgrade ${levelCost}`) : `Buy ${machineOption.cost}`}</button>
      </div>
    `;
    const equipButton = card.querySelector('.equip-machine');
    const buyButton = card.querySelector('.buy-machine');
    equipButton.disabled = !owned || selected;
    buyButton.disabled = !unlocked || (owned ? level >= MACHINE_LEVEL_MAX || save.coins < levelCost : save.coins < machineOption.cost);
    equipButton.addEventListener('click', () => selectMachine(machineOption.id));
    buyButton.addEventListener('click', () => {
      if (owned) upgradeMachine(machineOption.id);
      else buyMachine(machineOption.id);
    });
    ui.machineGrid.append(card);
  }
  for (const [id, upgrade] of Object.entries(UPGRADE_DEFS)) {
    const level = save.upgrades[id] || 0;
    const cost = getUpgradeCost(id);
    const item = document.createElement('article');
    item.className = 'upgrade-item';
    item.innerHTML = `
      <h3>${upgrade.name} Lv ${level}/${upgrade.max}</h3>
      <p>${upgrade.desc}</p>
      <button class="wood-button" type="button">${level >= upgrade.max ? 'Maxed' : `${cost} coins`}</button>
    `;
    const button = item.querySelector('button');
    button.disabled = level >= upgrade.max || save.coins < cost;
    button.addEventListener('click', () => buyUpgrade(id));
    ui.upgradeGrid.append(item);
  }
  for (const paint of PAINTS) {
    const unlocked = isPaintUnlocked(paint);
    const button = document.createElement('button');
    button.className = `paint-swatch${save.paintId === paint.id ? ' selected' : ''}`;
    button.type = 'button';
    button.disabled = !unlocked;
    button.innerHTML = `<span style="background:#${paint.body.toString(16).padStart(6, '0')}"></span><b>${paint.name}</b><small>${unlocked ? 'Ready' : `Field ${paint.unlockField}`}</small>`;
    button.addEventListener('click', () => selectPaint(paint.id));
    ui.paintGrid.append(button);
  }
  renderAchievements();
}

function getUpgradeCost(id) {
  const upgrade = UPGRADE_DEFS[id];
  const level = save.upgrades[id] || 0;
  return Math.floor(upgrade.baseCost * Math.pow(1.68, level));
}

function buyUpgrade(id) {
  const upgrade = UPGRADE_DEFS[id];
  const level = save.upgrades[id] || 0;
  if (level >= upgrade.max) return;
  const cost = getUpgradeCost(id);
  if (save.coins < cost) {
    playSample('error', 0.24);
    showNotice('Not enough coins for this upgrade.');
    return;
  }
  save.coins -= cost;
  save.totalSpent = (save.totalSpent || 0) + cost;
  save.upgrades[id] = level + 1;
  trackDailyProgress('spent', cost);
  updateVehicleStats();
  checkAchievements();
  persistSave();
  renderShop();
  updateHud();
  playTone(420, 0.08, 'square', 0.025);
  playSample('select', 0.28);
  spawnPop('Upgrade!', 54, 56);
  showNotice(`${upgrade.name} upgraded.`);
}

function buyMachine(id) {
  const machine = MACHINES.find((item) => item.id === id);
  if (!machine || !isMachineUnlocked(machine)) return;
  if (isMachineOwned(machine.id)) {
    selectMachine(machine.id);
    return;
  }
  const cost = machine.cost || 0;
  if (save.coins < cost) {
    playSample('error', 0.24);
    showNotice(`Need ${cost} coins to buy ${machine.name}.`);
    return;
  }
  save.coins -= cost;
  save.totalSpent = (save.totalSpent || 0) + cost;
  save.ownedMachines = [...new Set([...(save.ownedMachines || []), machine.id])];
  save.machineLevels = { ...(save.machineLevels || {}), [machine.id]: 1 };
  save.machineId = machine.id;
  currentMachineId = null;
  trackDailyProgress('spent', cost);
  refreshMachineModel();
  updateVehicleStats();
  checkAchievements();
  persistSave();
  renderShop();
  updateHud();
  playRewardSound();
  spawnPop('New machine!', 54, 56);
  showNotice(`${machine.name} purchased and equipped.`);
}

function upgradeMachine(id) {
  const machine = MACHINES.find((item) => item.id === id);
  if (!machine || !isMachineOwned(machine.id)) return;
  const level = getMachineLevel(machine);
  if (level >= MACHINE_LEVEL_MAX) return;
  const cost = getMachineLevelCost(machine);
  if (save.coins < cost) {
    playSample('error', 0.24);
    showNotice(`Need ${cost} coins to upgrade ${machine.name}.`);
    return;
  }
  save.coins -= cost;
  save.totalSpent = (save.totalSpent || 0) + cost;
  save.machineLevels[machine.id] = level + 1;
  trackDailyProgress('spent', cost);
  updateVehicleStats();
  checkAchievements();
  persistSave();
  renderShop();
  updateHud();
  playRewardSound();
  spawnPop(`Lv ${level + 1}`, 55, 56);
  showNotice(`${machine.name} upgraded to level ${level + 1}.`);
}

function selectMachine(id) {
  const machine = MACHINES.find((item) => item.id === id);
  if (!machine || !isMachineOwned(machine.id)) {
    playSample('error', 0.24);
    showNotice(machine && isMachineUnlocked(machine)
      ? `Buy ${machine.name} before equipping it.`
      : `${machine?.name || 'Machine'} is not unlocked yet.`);
    return;
  }
  save.machineId = id;
  currentMachineId = null;
  refreshMachineModel();
  updateVehicleStats();
  persistSave();
  renderShop();
  updateHud();
  showNotice(`${machine.name} equipped.`);
  playSample('select', 0.24);
  playTone(520, 0.08, 'triangle', 0.025);
}

function selectPaint(id) {
  const paint = PAINTS.find((item) => item.id === id);
  if (!paint || !isPaintUnlocked(paint)) return;
  save.paintId = id;
  applyPaint();
  persistSave();
  renderShop();
  showNotice(`${paint.name} equipped.`);
  playSample('select', 0.24);
  playTone(540, 0.08, 'triangle', 0.025);
}

function resetFarm() {
  save = structuredClone(DEFAULT_SAVE);
  save.contract = createContractForField(save.field);
  cargo = 0;
  boostUntil = 0;
  magnetUntil = 0;
  magnetCooldownUntil = 0;
  tutorialIndex = 0;
  tutorialUntil = 0;
  fieldBannerUntil = 0;
  stopMusic();
  currentSeasonStartCoins = 0;
  placeVehicleAtFieldStart();
  currentMachineId = null;
  ensureDaily();
  persistSave();
  buildField();
  refreshMachineModel();
  applyPaint();
  renderShop();
  updateHud();
  updateDailyCard();
  ui.seasonPanel.classList.remove('open');
  ui.shopPanel.classList.remove('open');
  paused = false;
  ui.pausePanel.classList.remove('open');
  showNotice('Farm reset. Fresh field ready.');
}

function toggleCamera() {
  cameraMode = (cameraMode + 1) % 3;
  const labels = ['Follow camera.', 'Top field camera.', 'Farm overview camera.'];
  showNotice(labels[cameraMode]);
}

function showNotice(message) {
  ui.noticeText.textContent = message;
  ui.noticeText.classList.add('visible');
  noticeTimer = 2.8;
}

function spawnPop(message, xPercent, yPercent) {
  const pop = document.createElement('div');
  pop.className = 'coin-pop';
  pop.textContent = message;
  pop.style.left = `${xPercent}%`;
  pop.style.top = `${yPercent}%`;
  popLayer.append(pop);
  pop.addEventListener('animationend', () => pop.remove(), { once: true });
}

function isMagnetActive() {
  return performance.now() < magnetUntil;
}

function activateMagnet() {
  markFirstInput();
  const now = performance.now();
  if (now < magnetCooldownUntil) {
    playSample('error', 0.22);
    const secondsLeft = Math.ceil((magnetCooldownUntil - now) / 1000);
    showNotice(`Magnet cooling down — ${secondsLeft}s.`);
    return;
  }
  magnetUntil = now + MAGNET_DURATION_MS;
  magnetCooldownUntil = now + MAGNET_COOLDOWN_MS;
  save.totalMagnetUses = (save.totalMagnetUses || 0) + 1;
  persistSave();
  playRewardSound();
  playTone(620, 0.12, 'triangle', 0.05);
  showNotice('Magnet active — wider cut and crop pull!');
  spawnPop('🧲 MAGNET', 50, 46);
  pulseMagnetVisual();
}

function applyFertilizer() {
  markFirstInput();
  const fieldState = ensureFieldState();
  updateFieldStateFromClock(fieldState);
  if (fieldState.state === FIELD_STATES.MATURE) {
    playSample('select', 0.22);
    showNotice(`${getCrop().name} is already mature. Harvest it now.`);
    return;
  }
  const inventoryCount = save.inventory?.fertilizer || 0;
  if (inventoryCount > 0) {
    save.inventory.fertilizer = inventoryCount - 1;
  } else {
    const cost = getFertilizerUnitCost();
    if (save.coins < cost) {
      playSample('error', 0.24);
      showNotice(`Need ${cost} coins or fertilizer bags.`);
      return;
    }
    save.coins -= cost;
    save.totalSpent = (save.totalSpent || 0) + cost;
    trackDailyProgress('spent', cost);
  }
  fieldState.boostedMs = (fieldState.boostedMs || 0) + fieldState.growthTimeMs * FERTILIZER_GROWTH_BOOST_RATIO;
  fieldState.yieldMultiplier = Math.min(1.6, (fieldState.yieldMultiplier || 1) + FERTILIZER_YIELD_BONUS);
  fieldState.fertilized = true;
  save.totalFertilizerUsed = (save.totalFertilizerUsed || 0) + 1;
  updateFieldStateFromClock(fieldState);
  persistSave();
  buildField();
  renderShop();
  updateHud();
  playRewardSound();
  spawnDust(vehicle.position.x, vehicle.position.z, 12, 0x63b84e);
  spawnPop('Fertilized', 50, 54);
  showNotice(fieldState.state === FIELD_STATES.MATURE
    ? `${getCrop().name} is ready after fertilizer.`
    : `Fertilizer applied. ${formatDuration(getFieldTimeLeftMs(fieldState))} until mature.`);
}

function buyFertilizerBundle() {
  const cost = getFertilizerBundleCost();
  if (save.coins < cost) {
    playSample('error', 0.24);
    showNotice(`Need ${cost} coins for fertilizer.`);
    return;
  }
  save.coins -= cost;
  save.totalSpent = (save.totalSpent || 0) + cost;
  save.inventory.fertilizer = (save.inventory.fertilizer || 0) + FERTILIZER_BUNDLE_AMOUNT;
  trackDailyProgress('spent', cost);
  persistSave();
  renderShop();
  updateHud();
  playSample('select', 0.28);
  playTone(520, 0.08, 'triangle', 0.025);
  spawnPop(`+${FERTILIZER_BUNDLE_AMOUNT} Fertilizer`, 55, 56);
  showNotice(`${FERTILIZER_BUNDLE_AMOUNT} fertilizer bags added.`);
}

function pulseMagnetVisual() {
  const headerX = vehicle.position.x;
  const headerZ = vehicle.position.z;
  spawnDust(headerX, headerZ, 12, 0xffe27a);
}

function applyMagnetPull(dt) {
  if (!isMagnetActive()) return;
  const stats = getStats();
  if (cargo >= stats.capacity) return;
  if (!isCurrentFieldMature()) return;
  const crop = getCrop();
  let pulled = 0;
  const touchedRows = new Set();
  for (const tile of cropTiles) {
    if (tile.harvested) continue;
    const dx = tile.x - vehicle.position.x;
    const dz = tile.z - vehicle.position.z;
    if (dx * dx + dz * dz > MAGNET_RADIUS * MAGNET_RADIUS) continue;
    tile.harvested = true;
    harvestedCount += 1;
    rowHarvestedCounts[tile.row] = (rowHarvestedCounts[tile.row] || 0) + 1;
    touchedRows.add(tile.row);
    pulled += 1;
    cargo = Math.min(stats.capacity, cargo + crop.load);
    hideCropInstance(tile.index);
    if (cargo >= stats.capacity) break;
    if (pulled >= 14) break;
  }
  if (pulled > 0) {
    updateCombo(pulled);
    save.totalCropsHarvested = (save.totalCropsHarvested || 0) + pulled;
    trackDailyProgress('crops', pulled);
    for (const row of touchedRows) maybeRewardCleanRow(row);
    harvestPulse = 1;
    spawnDust(vehicle.position.x, vehicle.position.z, Math.min(8, pulled + 2), crop.accent);
    sdk.requestHapticFeedback('light');
    maybeCompleteContract();
    checkAchievements();
  }
}

function showFieldBanner(force = false) {
  const banner = ui.fieldBanner;
  if (!banner) return;
  const crop = getCrop();
  const fieldState = ensureFieldState();
  updateFieldStateFromClock(fieldState);
  const status = fieldState.state === FIELD_STATES.MATURE
    ? (force ? 'New field' : 'Get cutting!')
    : `Growing - ${formatDuration(getFieldTimeLeftMs(fieldState))} left`;
  const season = getSeasonNumber();
  const seasonField = getSeasonFieldNumber();
  banner.innerHTML = `
    <small>Season ${season} · Field ${seasonField}/${SEASON_FIELD_TARGET}</small>
    <strong>${crop.name}</strong>
    <span>${status}</span>
  `;
  banner.classList.add('visible');
  fieldBannerUntil = performance.now() + FIELD_BANNER_MS;
}

function updateFieldBanner() {
  if (fieldBannerUntil === 0) return;
  if (performance.now() > fieldBannerUntil) {
    ui.fieldBanner.classList.remove('visible');
    fieldBannerUntil = 0;
  }
}

function startTutorial() {
  if (save.tutorialSeen) return;
  tutorialIndex = 0;
  advanceTutorial();
}

function advanceTutorial() {
  if (tutorialIndex >= TUTORIAL_STEPS.length) {
    ui.tutorialCard.classList.remove('visible');
    save.tutorialSeen = true;
    persistSave();
    return;
  }
  const step = TUTORIAL_STEPS[tutorialIndex];
  ui.tutorialCard.innerHTML = `
    <span>Tip ${tutorialIndex + 1}/${TUTORIAL_STEPS.length}</span>
    <strong>${step.text}</strong>
  `;
  ui.tutorialCard.classList.add('visible');
  tutorialUntil = performance.now() + step.durationMs;
}

function updateTutorial() {
  if (tutorialUntil === 0) return;
  if (performance.now() > tutorialUntil) {
    tutorialIndex += 1;
    if (tutorialIndex >= TUTORIAL_STEPS.length) {
      ui.tutorialCard.classList.remove('visible');
      tutorialUntil = 0;
      save.tutorialSeen = true;
      persistSave();
    } else {
      advanceTutorial();
    }
  }
}

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function dayHashSeed(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function ensureDaily() {
  const today = getTodayKey();
  if (save.daily?.date === today) return save.daily;
  const seed = dayHashSeed(today);
  const challenge = DAILY_CHALLENGES[seed % DAILY_CHALLENGES.length];
  const targetMultiplier = 1 + ((seed >> 4) % 3) * 0.25;
  save.daily = {
    date: today,
    id: challenge.id,
    label: challenge.label,
    desc: challenge.desc.replace('{target}', Math.floor(challenge.baseTarget * targetMultiplier).toString()),
    metric: challenge.metric,
    target: Math.floor(challenge.baseTarget * targetMultiplier),
    progress: 0,
    reward: Math.floor(challenge.reward * (1 + ((seed >> 8) % 3) * 0.18)),
    completed: false,
    rewarded: false,
  };
  persistSave();
  return save.daily;
}

function trackDailyProgress(metric, amount = 1) {
  const daily = ensureDaily();
  if (daily.completed || daily.metric !== metric) {
    if (daily.metric === 'combo' && metric === 'combo') {
      daily.progress = Math.max(daily.progress, amount);
    } else if (daily.metric !== metric) {
      return;
    }
  }
  if (metric === 'combo') {
    daily.progress = Math.max(daily.progress, amount);
  } else {
    daily.progress = Math.min(daily.target + 50, daily.progress + amount);
  }
  if (!daily.completed && daily.progress >= daily.target) {
    daily.completed = true;
    if (!daily.rewarded) {
      save.coins += daily.reward;
      daily.rewarded = true;
      playRewardSound();
      spawnPop(`Daily +${daily.reward}`, 50, 38);
      showNotice(`Daily challenge complete: ${daily.label} (+${daily.reward} coins)!`);
    }
    persistSave();
    checkAchievements();
  }
  updateDailyCard();
}

function updateDailyCard() {
  const daily = ensureDaily();
  const pct = Math.min(100, Math.round((daily.progress / daily.target) * 100));
  if (ui.dailyCard) {
    if (daily.completed) {
      ui.dailyCard.innerHTML = `<span>Daily ✓</span><strong>${daily.label}</strong><small>+${daily.reward} coins claimed</small>`;
      ui.dailyCard.classList.add('done');
    } else {
      ui.dailyCard.innerHTML = `<span>Daily</span><strong>${daily.label}</strong><small>${daily.progress}/${daily.target} · +${daily.reward} coins</small>`;
      ui.dailyCard.classList.remove('done');
    }
    ui.dailyCard.classList.add('visible');
  }
  if (ui.titleDaily) {
    if (daily.completed) {
      ui.titleDaily.innerHTML = `<span class="daily-tag done">Daily ✓ ${daily.label}</span><small>+${daily.reward} coins claimed today</small>`;
    } else {
      ui.titleDaily.innerHTML = `<span class="daily-tag">Daily: ${daily.label}</span><small>${daily.desc} · Reward ${daily.reward} coins</small>`;
    }
  }
}

function checkAchievements() {
  const owned = new Set(save.achievements || []);
  for (const ach of ACHIEVEMENTS) {
    if (owned.has(ach.id)) continue;
    if (ach.check(save)) {
      owned.add(ach.id);
      save.achievements = [...owned];
      if (ach.reward) save.coins += ach.reward;
      showAchievementToast(ach);
    }
  }
}

let achievementQueue = [];
let achievementVisibleUntil = 0;

function showAchievementToast(ach) {
  achievementQueue.push(ach);
  persistSave();
  if (performance.now() > achievementVisibleUntil) drainAchievementToast();
}

function drainAchievementToast() {
  if (achievementQueue.length === 0) {
    ui.achievementToast?.classList.remove('visible');
    return;
  }
  const ach = achievementQueue.shift();
  if (!ui.achievementToast) return;
  ui.achievementToast.innerHTML = `
    <span class="ach-icon">${ach.icon}</span>
    <div>
      <small>Achievement unlocked</small>
      <strong>${ach.name}</strong>
      <span class="ach-desc">${ach.desc}${ach.reward ? ` · +${ach.reward} coins` : ''}</span>
    </div>
  `;
  ui.achievementToast.classList.add('visible');
  achievementVisibleUntil = performance.now() + 3600;
  playTone(680, 0.1, 'triangle', 0.038);
  window.setTimeout(() => playTone(880, 0.12, 'triangle', 0.038), 110);
  window.setTimeout(drainAchievementToast, 3700);
}

function renderAchievements() {
  if (!ui.achievementGrid) return;
  const owned = new Set(save.achievements || []);
  const total = ACHIEVEMENTS.length;
  const earned = ACHIEVEMENTS.filter((ach) => owned.has(ach.id)).length;
  ui.achievementGrid.innerHTML = `
    <div class="achievement-summary">
      <strong>${earned}/${total}</strong> unlocked
    </div>
  ` + ACHIEVEMENTS.map((ach) => {
    const isOwned = owned.has(ach.id);
    return `
      <article class="achievement-card ${isOwned ? 'owned' : 'locked'}">
        <span class="ach-icon">${ach.icon}</span>
        <div>
          <strong>${ach.name}</strong>
          <p>${ach.desc}</p>
          <small>${isOwned ? '✓ unlocked' : `+${ach.reward} coins`}</small>
        </div>
      </article>
    `;
  }).join('');
}

function resize() {
  const rect = shell.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

window.addEventListener('beforeunload', () => {
  sdk.gameplayStop?.();
});
