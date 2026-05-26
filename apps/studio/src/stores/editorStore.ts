import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScriptInstance } from '@/scripts/types';
import type { TerrainSettings } from './terrainStore';
import { storageManager } from '@/services/storageManager';

export type ObjectType = 'box' | 'sphere' | 'cylinder' | 'plane' | 'platform' | 'light' | 'sunlight' | 'spotlight' | 'npc' | 'ring' | 'group' | 'camera' | 'player' | 'terrain';
export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';
export type TransformSpace = 'world' | 'local';
export type CameraMode = 'third-person' | 'first-person' | 'side-2d' | 'top-down' | 'fixed';

// GDD §6.6 Phase 6B step 6: single source of truth for which viewport
// the editor is showing. Toolbar 2D/3D buttons write here; Viewport reads
// from here. URL `?kind=2d|3d` is honored as the initial value (transitional).
export type SceneKind = '2d' | '3d';

const readSceneKindFromUrl = (): SceneKind => {
  if (typeof window === 'undefined') return '3d';
  const k = new URLSearchParams(window.location.search).get('kind');
  return k === '2d' ? '2d' : '3d';
};

// Light types for realistic lighting
export type LightType = 'point' | 'directional' | 'spot' | 'area';

// Physics types for Rapier
export type PhysicsBodyType = 'fixed' | 'dynamic' | 'kinematic';
export type ColliderShape = 'auto' | 'cuboid' | 'ball' | 'hull' | 'trimesh' | 'capsule';

// Behavior/Script types
export type BehaviorType = 'none' | 'rotate' | 'float' | 'patrol' | 'lookAtPlayer';

export interface CameraSettings {
  mode: CameraMode;
  distance: number;
  height: number;
  fov: number;
  followPlayer: boolean;
  targetId: string | null; // ID of the object to follow (usually the player)
  lockedZ: boolean; // For 2.5D games
  lockedY: boolean; // For top-down games
  smoothing: number;
}

// Game preset types for quick configuration
export type GamePreset = 
  | 'custom'
  | 'third-person-action'   // Like Dark Souls, Zelda
  | 'third-person-shooter'  // Like Gears of War
  | 'platformer-2d'         // Like Mario, Celeste
  | 'platformer-3d'         // Like Mario 64
  | 'fps-shooter'           // Like COD, CS
  | 'fps-horror'            // Like Resident Evil, Outlast
  | 'racing-arcade'         // Like Mario Kart
  | 'racing-sim'            // Like Forza
  | 'top-down-rpg'          // Like Zelda top-down
  | 'top-down-shooter';     // Like Hotline Miami

export interface PlayerSettings {
  // Core movement
  speed: number;
  jumpForce: number;
  gravity: number;
  maxHealth: number;
  movementMode: 'free' | '2d-sidescroll' | 'top-down';
  
  // Jump abilities
  canDoubleJump: boolean;
  doubleJumpForce: number;
  coyoteTime: number;        // Grace period after leaving platform (seconds)
  jumpBufferTime: number;    // Buffer jump input before landing (seconds)
  
  // Sprint
  canSprint: boolean;
  sprintSpeed: number;
  sprintStaminaCost: number; // Stamina per second while sprinting
  maxStamina: number;
  staminaRegenRate: number;
  
  // Crouch/Stealth
  canCrouch: boolean;
  crouchSpeed: number;
  crouchHeightMultiplier: number; // 0.5 = half height
  
  // Dodge/Roll/Dash
  canDodge: boolean;
  dodgeDistance: number;
  dodgeDuration: number;     // Seconds
  dodgeCooldown: number;     // Seconds
  dodgeInvincibilityFrames: boolean;
  
  // Attack System
  attackEnabled: boolean;
  attackType: 'melee' | 'ranged' | 'stomp' | 'combo';
  attackDamage: number;
  attackCooldown: number;    // Seconds
  attackRange: number;       // For melee: reach, for ranged: max distance
  
  // Melee Attack Settings
  meleeWeaponType: 'fist' | 'sword' | 'hammer' | 'spear' | 'axe';
  meleeComboEnabled: boolean;
  meleeComboHits: number;    // Number of hits in combo
  meleeKnockback: number;    // Force applied to hit targets
  meleeSweepAngle: number;   // Arc angle for sweep attacks (degrees)
  
  // Ranged Attack Settings
  projectileSpeed: number;
  projectileGravity: number; // 0 = straight, 1 = full gravity
  projectileSpread: number;  // Accuracy spread in degrees
  projectilesPerShot: number; // For shotgun-style weapons
  ammoEnabled: boolean;
  maxAmmo: number;
  ammoPerShot: number;
  reloadTime: number;        // Seconds
  projectileType: 'bullet' | 'arrow' | 'fireball' | 'laser' | 'grenade';
  explosionRadius: number;   // For grenades/explosives
  explosionForce: number;
  
  // Stomp Attack (Mario-style)
  stompEnabled: boolean;
  stompDamage: number;
  stompBounceForce: number;  // Upward force when stomping
  stompRequiresDownward: boolean; // Only stomp when falling
  
  // Wall mechanics (for platformers)
  canWallJump: boolean;
  canWallSlide: boolean;
  wallSlideSpeed: number;
  wallJumpForce: number;
  
  // Swim/Water
  canSwim: boolean;
  swimSpeed: number;
  
  // Air control
  airControlMultiplier: number; // 0-1, how much control in air
  
  // Game preset for quick setup
  gamePreset: GamePreset;
}

// NEW: Physics settings for objects
export interface PhysicsSettings {
  bodyType: PhysicsBodyType;
  colliderShape: ColliderShape;
  mass: number;
  restitution: number; // Bounciness (0-2)
  friction: number; // 0 = ice, 1 = rubber
  linearDamping: number;
  angularDamping: number;
  isSensor: boolean; // Trigger zones (no physical collision)
}

// NEW: Visual/Material settings
export interface VisualSettings {
  textureUrl: string;
  textureRepeat?: [number, number];
  textureOffset?: [number, number];
  textureRotation?: number; // radians
  textureFlipY?: boolean;
  textureAutoScale?: boolean;
  textureFilter?: 'nearest' | 'bilinear' | 'trilinear';
  opacity: number; // 0-1
  metalness: number; // 0-1
  roughness: number; // 0-1
  emissiveIntensity: number; // 0-2
  wireframe: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
}

// NEW: Logic/Scripting settings
export interface LogicSettings {
  tags: string[]; // e.g., ['enemy', 'damageable']
  behavior: BehaviorType;
  behaviorSpeed: number; // Speed of rotation, floating, patrol
  patrolDistance: number; // For patrol behavior
  customData: Record<string, any>; // For AI/custom scripts
}

// NEW: Entity settings for game entities (enemies, NPCs, interactables)
// This allows placeholders to be swapped with final assets while keeping all mechanics
export type EntityTeam = 'player' | 'enemy' | 'neutral' | 'ally';
export type EntityType = 'static' | 'character' | 'projectile' | 'pickup' | 'destructible' | 'trigger';

export interface EntitySettings {
  // Core entity properties
  entityType: EntityType;
  team: EntityTeam;
  
  // Health & Damage System
  maxHealth: number;
  currentHealth: number;
  isInvulnerable: boolean;
  invulnerabilityDuration: number; // Seconds of i-frames after hit
  
  // Combat (for enemies/NPCs)
  canDealDamage: boolean;
  contactDamage: number;       // Damage on touch
  knockbackResistance: number; // 0-1, how much knockback is resisted
  
  // Death & Destruction
  destroyOnDeath: boolean;
  deathAnimation?: string;     // Animation to play on death
  deathParticle?: string;      // Particle effect preset
  deathSound?: string;         // Sound to play on death
  dropOnDeath?: string[];      // Item IDs to spawn on death
  
  // Interaction
  isInteractable: boolean;
  interactionRange: number;
  interactionPrompt?: string;  // Text shown when player is near
  
  // AI Behavior (for characters)
  aiEnabled: boolean;
  aiType: 'none' | 'patrol' | 'chase' | 'flee' | 'guard' | 'follow';
  aiSpeed: number;
  aiDetectionRange: number;
  aiAttackRange: number;
  aiAttackCooldown: number;
  
  // Visual customization (keeps mechanics when swapping models)
  modelScale: number;          // Scale multiplier for 3D model
  modelOffset: [number, number, number]; // Position offset for model alignment
  modelRotationOffset: [number, number, number]; // Rotation offset for model alignment
  hitboxScale: [number, number, number]; // Separate hitbox from visual
  hitboxOffset: [number, number, number];
  
  // For pickups/collectibles
  pickupType?: 'health' | 'ammo' | 'coin' | 'key' | 'powerup' | 'custom';
  pickupValue?: number;        // Health restored, coins given, etc.
  pickupRespawns?: boolean;
  pickupRespawnTime?: number;  // Seconds until respawn
}

// Default entity settings for quick initialization
export const DEFAULT_ENTITY_SETTINGS: EntitySettings = {
  entityType: 'static',
  team: 'neutral',
  maxHealth: 100,
  currentHealth: 100,
  isInvulnerable: false,
  invulnerabilityDuration: 0.5,
  canDealDamage: false,
  contactDamage: 0,
  knockbackResistance: 0,
  destroyOnDeath: true,
  isInteractable: false,
  interactionRange: 2,
  aiEnabled: false,
  aiType: 'none',
  aiSpeed: 3,
  aiDetectionRange: 10,
  aiAttackRange: 2,
  aiAttackCooldown: 1,
  modelScale: 1,
  modelOffset: [0, 0, 0],
  modelRotationOffset: [0, 0, 0],
  hitboxScale: [1, 1, 1],
  hitboxOffset: [0, 0, 0],
};

// NEW: Audio settings for objects with 3D spatial audio support
export interface AudioSettings {
  audioSourceId?: string; // Reference to audio source in audioStore
  volume: number; // 0-1
  loop: boolean;
  autoplay: boolean;
  distance: number; // Maximum distance for 3D audio attenuation
  refDistance: number; // Reference distance at which volume is 1
  rolloffFactor: number; // How quickly audio attenuates with distance
  url?: string; // URL to audio file
}

// NEW: Animation settings for GLTF skeletal animations
export interface AnimationSettings {
  modelUrl?: string; // URL to GLTF/GLB model
  nodeName?: string; // Optional GLTF node to render/select from a shared model
  nodeIndex?: number; // GLTF node index used for traversal fallback and round-trip refs
  sourceAssetName?: string; // Friendly source asset name shown by importers/tools
  currentAnimation?: string; // Name of currently playing animation
  availableAnimations: string[]; // List populated after model load
  autoPlay: boolean;
  loop: boolean;
  speed: number; // Playback speed multiplier
  crossFadeDuration: number; // Blend duration between animations
  paused: boolean;
  currentTime: number; // For scrubbing/seeking
}

// NEW: Particle emitter settings
export type ParticlePreset = 'sparkles' | 'fire' | 'smoke' | 'rain' | 'snow' | 'magic' | 'explosion' | 'dust' | 'bubbles' | 'custom';

export interface ParticleSettings {
  enabled: boolean;
  preset: ParticlePreset;
  count: number;
  size: number;
  sizeVariation: number;
  speed: number;
  lifetime: number;
  spread: number;
  color: string;
  colorEnd?: string;
  opacity: number;
  opacityFade: boolean;
  gravity: number;
  turbulence: number;
  emissionRate: number;
  burst: boolean;
  loop: boolean;
  worldSpace: boolean;
  blending: 'normal' | 'additive' | 'multiply';
  direction: [number, number, number];
  cone: number;
}

// NEW: Advanced light settings for realistic lighting
export interface LightSettings {
  // Core properties
  intensity: number; // Light intensity (0-10)
  distance: number; // Max distance for point/spot (0 = infinite)
  decay: number; // Light falloff (physically correct = 2)
  
  // Color temperature (Kelvin) - warm (2700K) to cool (10000K)
  temperature: number; // 2700 = warm tungsten, 5600 = daylight, 10000 = blue sky
  useTemperature: boolean; // If true, use temperature instead of color
  
  // Spot light specific
  angle: number; // Cone angle in radians (0-PI/2)
  penumbra: number; // Soft edge (0 = hard, 1 = fully soft)
  
  // Sun/Directional light specific
  sunElevation: number; // Sun angle from horizon (0-90 degrees)
  sunAzimuth: number; // Sun rotation around Y axis (0-360 degrees)
  
  // Shadow settings
  castShadow: boolean;
  shadowMapSize: number; // 512, 1024, 2048, 4096
  shadowBias: number; // Prevent shadow acne (-0.001 typical)
  shadowNormalBias: number; // Prevent peter-panning
  shadowRadius: number; // Soft shadow blur (PCF)
  shadowCameraSize: number; // Orthographic size for directional lights
  
  // Advanced
  volumetric: boolean; // Volumetric light rays (god rays)
  volumetricIntensity: number;
  helperVisible: boolean; // Show light helper in editor
}

export interface SceneObject {
  id: string;
  name: string;
  type: ObjectType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  visible: boolean;
  locked: boolean;
  parentId?: string | null; // Parent object ID for hierarchy
  isStatic?: boolean; // Legacy, now use physicsSettings.bodyType
  emissive?: boolean;
  lightSettings?: LightSettings; // NEW: Advanced light properties
  cameraSettings?: CameraSettings;
  playerSettings?: PlayerSettings;
  physicsSettings?: PhysicsSettings;
  visualSettings?: VisualSettings;
  logicSettings?: LogicSettings;
  entitySettings?: EntitySettings; // NEW: Entity system for game objects (health, damage, AI)
  scriptInstances?: ScriptInstance[]; // NEW: Scripts attached to this object
  audioSettings?: AudioSettings; // NEW: Audio properties for 3D spatial audio
  animationSettings?: AnimationSettings; // NEW: GLTF skeletal animation controls
  particleSettings?: ParticleSettings; // NEW: Particle emitter settings
  terrainSettings?: TerrainSettings; // NEW: Terrain generation settings
}

export interface EditorCameraPoseTarget {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  fov?: number;
  timestamp: number;
}

interface EditorState {
  isEditMode: boolean;
  activeSceneKind: SceneKind;
  transformMode: TransformMode;
  transformSpace: TransformSpace;
  snapEnabled: boolean;
  snapTranslate: number;
  snapRotate: number;
  snapScale: number;
  selectedObjectId: string | null;
  objects: SceneObject[];
  showGrid: boolean;
  showStats: boolean;
  gameScript: string;
  
  // Camera focus target for double-click in hierarchy
  focusTarget: { position: [number, number, number]; timestamp: number; distance?: number } | null;
  cameraPoseTarget: EditorCameraPoseTarget | null;
  
  // Undo/Redo history
  history: SceneObject[][];
  historyIndex: number;
  
  loadTemplate: (templateId?: string | null) => void;
  setEditMode: (edit: boolean) => void;
  setCameraPoseTarget: (pose: Omit<EditorCameraPoseTarget, 'timestamp'>) => void;
  setActiveSceneKind: (kind: SceneKind) => void;
  setTransformMode: (mode: TransformMode) => void;
  setTransformSpace: (space: TransformSpace) => void;
  toggleTransformSpace: () => void;
  setSnapEnabled: (enabled: boolean) => void;
  toggleSnapEnabled: () => void;
  setSnapValues: (translate: number, rotate: number, scale: number) => void;
  toggleEditMode: () => void;
  selectObject: (id: string | null) => void;
  focusOnObject: (id: string) => void;
  addObject: (type: ObjectType, position?: [number, number, number]) => void;
  addModelFromAsset: (asset: { name: string; url: string; type?: string; thumbnailUrl?: string }, position?: [number, number, number]) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  setObjects: (objects: SceneObject[]) => void;
  toggleGrid: () => void;
  toggleStats: () => void;
  getSelectedObject: () => SceneObject | null;
  getCamera: () => SceneObject | null;
  getPlayer: () => SceneObject | null;
  setGameScript: (script: string) => void;
  
  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveToHistory: () => void;
  
  // Manual save/load
  saveProject: () => void;
  loadSavedProject: () => boolean;
  hasSavedProject: () => boolean;
  clearSavedProject: () => void;
  
  // Script management actions
  addScriptToObject: (objectId: string, scriptId: string, parameters?: Record<string, any>) => void;
  removeScriptFromObject: (objectId: string, scriptInstanceId: string) => void;
  updateScriptParams: (objectId: string, scriptInstanceId: string, params: Record<string, any>) => void;
  toggleScriptEnabled: (objectId: string, scriptInstanceId: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const getDefaultCameraSettings = (mode: CameraMode): CameraSettings => ({
  mode,
  distance: mode === 'side-2d' ? 20 : mode === 'top-down' ? 15 : 8,
  height: mode === 'top-down' ? 20 : 4,
  fov: 50,
  followPlayer: true,
  targetId: 'main-player', // Default target is the player
  lockedZ: mode === 'side-2d',
  lockedY: mode === 'top-down',
  smoothing: 0.1,
});

const getDefaultPlayerSettings = (movementMode: 'free' | '2d-sidescroll' | 'top-down', preset: GamePreset = 'custom'): PlayerSettings => {
  // Base settings
  const base: PlayerSettings = {
    // Core
    speed: 5,
    jumpForce: 8,
    gravity: 20,
    maxHealth: 100,
    movementMode,
    gamePreset: preset,
    
    // Jump
    canDoubleJump: false,
    doubleJumpForce: 6,
    coyoteTime: 0.15,
    jumpBufferTime: 0.1,
    
    // Sprint
    canSprint: true,
    sprintSpeed: 8,
    sprintStaminaCost: 10,
    maxStamina: 100,
    staminaRegenRate: 15,
    
    // Crouch
    canCrouch: true,
    crouchSpeed: 2.5,
    crouchHeightMultiplier: 0.5,
    
    // Dodge
    canDodge: true,
    dodgeDistance: 4,
    dodgeDuration: 0.3,
    dodgeCooldown: 0.8,
    dodgeInvincibilityFrames: true,
    
    // Attack System
    attackEnabled: true,
    attackType: 'melee',
    attackDamage: 25,
    attackCooldown: 0.5,
    attackRange: 2,
    
    // Melee Attack
    meleeWeaponType: 'fist',
    meleeComboEnabled: false,
    meleeComboHits: 3,
    meleeKnockback: 5,
    meleeSweepAngle: 90,
    
    // Ranged Attack
    projectileSpeed: 50,
    projectileGravity: 0.1,
    projectileSpread: 0,
    projectilesPerShot: 1,
    ammoEnabled: false,
    maxAmmo: 30,
    ammoPerShot: 1,
    reloadTime: 1.5,
    projectileType: 'bullet',
    explosionRadius: 0,
    explosionForce: 0,
    
    // Stomp Attack (Mario-style)
    stompEnabled: false,
    stompDamage: 50,
    stompBounceForce: 10,
    stompRequiresDownward: true,
    
    // Wall
    canWallJump: false,
    canWallSlide: false,
    wallSlideSpeed: 2,
    wallJumpForce: 10,
    
    // Water
    canSwim: false,
    swimSpeed: 3,
    
    // Air
    airControlMultiplier: 0.7,
  };
  
  // Apply preset-specific overrides
  switch (preset) {
    case 'third-person-action':
      return {
        ...base,
        speed: 5,
        sprintSpeed: 9,
        canSprint: true,
        canDodge: true,
        canCrouch: true,
        attackEnabled: true,
        attackType: 'melee',
        attackDamage: 30,
        attackRange: 2.5,
        meleeWeaponType: 'sword',
        meleeComboEnabled: true,
        meleeComboHits: 3,
        meleeKnockback: 8,
        meleeSweepAngle: 120,
        canDoubleJump: false,
        dodgeInvincibilityFrames: true,
      };
      
    case 'third-person-shooter':
      return {
        ...base,
        speed: 4,
        sprintSpeed: 7,
        canSprint: true,
        canDodge: true,
        dodgeDistance: 3,
        canCrouch: true,
        attackEnabled: true,
        attackType: 'ranged',
        attackDamage: 15,
        attackRange: 50,
        attackCooldown: 0.1,
      };
      
    case 'platformer-2d':
      return {
        ...base,
        movementMode: '2d-sidescroll',
        speed: 7,
        jumpForce: 14,
        canDoubleJump: true,
        doubleJumpForce: 10,
        coyoteTime: 0.12,
        jumpBufferTime: 0.15,
        canWallJump: true,
        canWallSlide: true,
        wallSlideSpeed: 2,
        wallJumpForce: 12,
        canDodge: true,
        dodgeDistance: 5,
        dodgeDuration: 0.2,
        canSprint: false,
        canCrouch: false,
        attackEnabled: true,
        attackType: 'stomp',
        stompEnabled: true,
        stompDamage: 100,
        stompBounceForce: 12,
        stompRequiresDownward: true,
        airControlMultiplier: 0.9,
      };
      
    case 'platformer-3d':
      return {
        ...base,
        speed: 6,
        sprintSpeed: 10,
        jumpForce: 12,
        canDoubleJump: true,
        doubleJumpForce: 8,
        canSprint: true,
        canDodge: false,
        canCrouch: true,
        crouchSpeed: 3,
        attackEnabled: true,
        attackType: 'melee',
        airControlMultiplier: 0.8,
      };
      
    case 'fps-shooter':
      return {
        ...base,
        speed: 5,
        sprintSpeed: 8,
        jumpForce: 6,
        canSprint: true,
        canDodge: false,
        canCrouch: true,
        crouchSpeed: 2,
        attackEnabled: true,
        attackType: 'ranged',
        attackDamage: 20,
        attackRange: 100,
        attackCooldown: 0.08,
        projectileSpeed: 80,
        projectileGravity: 0,
        projectileSpread: 1,
        projectilesPerShot: 1,
        projectileType: 'bullet',
        ammoEnabled: true,
        maxAmmo: 30,
        ammoPerShot: 1,
        reloadTime: 1.5,
        canDoubleJump: false,
      };
      
    case 'fps-horror':
      return {
        ...base,
        speed: 3,
        sprintSpeed: 5,
        sprintStaminaCost: 20,
        maxStamina: 60,
        jumpForce: 4,
        canSprint: true,
        canDodge: false,
        canCrouch: true,
        crouchSpeed: 1.5,
        attackEnabled: false,
        canDoubleJump: false,
      };
      
    case 'racing-arcade':
      return {
        ...base,
        speed: 0, // Vehicle controlled
        jumpForce: 0,
        canSprint: false,
        canDodge: false,
        canCrouch: false,
        attackEnabled: false,
        canDoubleJump: false,
      };
      
    case 'racing-sim':
      return {
        ...base,
        speed: 0,
        jumpForce: 0,
        canSprint: false,
        canDodge: false,
        canCrouch: false,
        attackEnabled: false,
        canDoubleJump: false,
      };
      
    case 'top-down-rpg':
      return {
        ...base,
        movementMode: 'top-down',
        speed: 5,
        sprintSpeed: 8,
        jumpForce: 0, // No jumping in top-down
        canSprint: true,
        canDodge: true,
        dodgeDistance: 3,
        canCrouch: false,
        attackEnabled: true,
        attackType: 'combo',
        attackDamage: 20,
        attackRange: 3,
        canDoubleJump: false,
      };
      
    case 'top-down-shooter':
      return {
        ...base,
        movementMode: 'top-down',
        speed: 6,
        sprintSpeed: 9,
        jumpForce: 0,
        canSprint: true,
        canDodge: true,
        dodgeDistance: 4,
        dodgeCooldown: 0.5,
        canCrouch: false,
        attackEnabled: true,
        attackType: 'ranged',
        attackDamage: 15,
        attackRange: 30,
        attackCooldown: 0.15,
        canDoubleJump: false,
      };
      
    default:
      return base;
  }
};

// NEW: Default physics settings
const getDefaultPhysicsSettings = (type: ObjectType, isStatic = false): PhysicsSettings => {
  const staticTypes: ObjectType[] = ['plane', 'platform'];
  const bodyType: PhysicsBodyType = isStatic || staticTypes.includes(type) ? 'fixed' : 'dynamic';
  
  let colliderShape: ColliderShape = 'auto';
  if (type === 'sphere') colliderShape = 'ball';
  if (type === 'cylinder') colliderShape = 'hull';
  
  return {
    bodyType,
    colliderShape,
    mass: 1,
    restitution: type === 'sphere' ? 0.8 : 0.3,
    friction: 0.5,
    linearDamping: 0,
    angularDamping: 0.1,
    isSensor: false,
  };
};

// NEW: Default visual settings
const getDefaultVisualSettings = (type: ObjectType): VisualSettings => ({
  textureUrl: '',
  textureRepeat: [1, 1],
  textureOffset: [0, 0],
  textureRotation: 0,
  textureFlipY: false,
  textureAutoScale: true,
  textureFilter: undefined,
  opacity: 1,
  metalness: type === 'light' || type === 'sunlight' || type === 'spotlight' ? 0 : 0.3,
  roughness: type === 'light' || type === 'sunlight' || type === 'spotlight' ? 0 : 0.5,
  emissiveIntensity: type === 'light' || type === 'sunlight' || type === 'spotlight' ? 2 : 0,
  wireframe: false,
  castShadow: type !== 'plane' && type !== 'light' && type !== 'sunlight' && type !== 'spotlight',
  receiveShadow: type === 'plane' || type === 'platform',
});

// Default light settings - simple and balanced
const getDefaultLightSettings = (type: ObjectType): LightSettings => {
  const isPoint = type === 'light';
  const isSun = type === 'sunlight';
  const isSpot = type === 'spotlight';
  
  return {
    // Core properties - following pmndrs/examples standards
    intensity: isSun ? 0.5 : isSpot ? 0.6 : 0.6,
    distance: isPoint ? 20 : isSpot ? 25 : 0,
    decay: 2,
    
    // Temperature
    temperature: 5500,
    useTemperature: false,
    
    // Spot light specific
    angle: Math.PI / 6,
    penumbra: 0.5,
    
    // Sun/Directional specific
    sunElevation: 45,
    sunAzimuth: 180,
    
    // Shadow settings
    castShadow: true,
    shadowMapSize: 2048,
    shadowBias: -0.0001,
    shadowNormalBias: 0.02,
    shadowRadius: 1,
    shadowCameraSize: 50,
    
    // Advanced
    volumetric: false,
    volumetricIntensity: 0.3,
    helperVisible: true,
  };
};

// NEW: Default logic settings
const getDefaultLogicSettings = (): LogicSettings => ({
  tags: [],
  behavior: 'none',
  behaviorSpeed: 1,
  patrolDistance: 5,
  customData: {},
});

const getDefaultObject = (type: ObjectType, position: [number, number, number]): SceneObject => {
  const id = generateId();
  const baseName = type.charAt(0).toUpperCase() + type.slice(1);
  
  // Set appropriate color based on light type
  const getColor = () => {
    switch (type) {
      case 'light': return '#ffcc88'; // Warm point light
      case 'sunlight': return '#fffaf0'; // Daylight white
      case 'spotlight': return '#ffffff'; // Pure white
      case 'camera': return '#4ade80';
      case 'player': return '#6366f1';
      default: return '#6366f1';
    }
  };
  
  const base: SceneObject = {
    id,
    name: `${baseName}_${id.substring(0, 4)}`,
    type,
    position,
    rotation: [0, 0, 0],
    scale: type === 'plane' ? [10, 1, 10] : type === 'camera' ? [1, 1, 1] : [1, 1, 1],
    color: getColor(),
    visible: true,
    locked: false,
    physicsSettings: getDefaultPhysicsSettings(type),
    visualSettings: getDefaultVisualSettings(type),
    logicSettings: getDefaultLogicSettings(),
  };

  // Add light settings for light types
  if (type === 'light' || type === 'sunlight' || type === 'spotlight') {
    base.lightSettings = getDefaultLightSettings(type);
  }

  if (type === 'camera') {
    base.cameraSettings = getDefaultCameraSettings('third-person');
  }

  if (type === 'player') {
    base.playerSettings = getDefaultPlayerSettings('free');
  }

  if (type === 'terrain') {
    // Terrain will be created by TerrainStore
    base.color = '#4a7c59';
    base.terrainSettings = {
      seed: Math.floor(Math.random() * 10000),
      scale: 0.02,
      height: 20,
      waterLevel: 5,
      segmentsX: 128,
      segmentsY: 128,
      terrainSize: 200,
      enableCollision: true,
      showVegetation: true,
      vegetationDensity: 0.4,
      waterColor: '#1ca3ec',
      waterDeepColor: '#0c2d4a',
      waveHeight: 0.8,
      waveSpeed: 1.0,
      waterOpacity: 0.85,
      foamIntensity: 0.5,
      biome: 'temperate',
      erosionStrength: 0.5,
      flatness: 0.4,
      mountainousness: 0.5,
      coastalBlend: 0.3,
    };
  }

  return base;
};

// Create the default scene camera. Movement/lock flags follow the camera
// mode itself (handled by getDefaultCameraSettings) — there is no longer a
// per-template override.
const createCameraObject = (mode: CameraMode = 'third-person'): SceneObject => {
  const settings = getDefaultCameraSettings(mode);

  return {
    id: 'main-camera',
    name: 'Main Camera',
    type: 'camera',
    position: [0, settings.height, settings.distance],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#4ade80',
    visible: true,
    locked: false,
    cameraSettings: settings,
  };
};

// Default 3rd-person player model — manequim CC-BY-4.0 baked into the
// studio's public/ folder so every new 3D project starts with a real
// character instead of a placeholder box. The renderer (EditableObject)
// checks `animationSettings.modelUrl` and falls back to the Minecraft-style
// stylized character if absent (e.g. legacy projects loaded from disk).
//
// Attribution required by CC-BY-4.0 lives in `apps/studio/public/models/manequin/license.txt`
// and is surfaced in the Help → Credits panel.
const DEFAULT_PLAYER_MODEL_URL = '/models/manequin/scene.gltf';

// Create the default player. The Lovable starter mapped each template to a
// specific (movementMode, preset) pair; the editor no longer ships those
// presets baked into scene initialization. New scenes start with the
// neutral free/custom defaults and the user dials presets in via the
// Inspector. Pass overrides explicitly if creating a scene from a custom
// flow (e.g. a future sample preset).
const createPlayerObject = (
  movementMode: 'free' | '2d-sidescroll' | 'top-down' = 'free',
  gamePreset: GamePreset = 'custom',
): SceneObject => {
  const settings = getDefaultPlayerSettings(movementMode, gamePreset);

  return {
    id: 'main-player',
    name: 'Player',
    type: 'player',
    position: [0, 1.5, 5],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#6366f1',
    visible: true,
    locked: false,
    playerSettings: settings,
    animationSettings: {
      modelUrl: DEFAULT_PLAYER_MODEL_URL,
      currentAnimation: undefined,
      availableAnimations: [],
      autoPlay: false,
      loop: true,
      speed: 1,
      crossFadeDuration: 0.3,
      paused: false,
      currentTime: 0,
    },
  };
};

// Helper to create Sun Light object for the hierarchy (reuses getDefaultObject for consistency)
const createSunLightObject = (): SceneObject => {
  const sunLight = getDefaultObject('sunlight', [0, 50, 0]);
  // Override with fixed ID and name for templates
  sunLight.id = 'sunlight-main';
  sunLight.name = 'Sun Light';
  return sunLight;
};

// Helper to create scene objects for the hierarchy
const createSceneObject = (
  id: string,
  name: string,
  type: ObjectType,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  color: string = '#4ade80',
  extraProps: Partial<SceneObject> = {}
): SceneObject => ({
  id,
  name,
  type,
  position,
  rotation: [0, 0, 0],
  scale,
  color,
  visible: true,
  locked: false,
  ...extraProps,
});

// Returns the default starting scene — sun light, camera, player, and a
// generic ground plane. The Lovable starter had a large switch here that
// seeded "Adventure", "FPS Horror", "Racing", etc. scenes with bespoke
// trees / zombies / barriers / NPCs. That whole catalogue is gone: new
// projects open empty, and samples (Harvest Rush 3D, Magic Battleground 2D,
// etc.) are loaded as full .pixlproject documents from disk, not seeded
// here. The templateId param is accepted only as a label for backward
// compatibility with callers that still pass one.
const getTemplateObjects = (_templateId?: string | null): SceneObject[] => {
  const camera = createCameraObject('third-person');
  const player = createPlayerObject();
  const sunLight = createSunLightObject();

  return [
    sunLight,
    camera,
    player,
    createSceneObject('ground-1', 'Chão', 'plane', [0, 0, 0], [100, 1, 100], '#3d3d3d'),
  ];
};

export const useEditorStore = create<EditorState>((set, get) => ({
  isEditMode: true,
  activeSceneKind: readSceneKindFromUrl(),
  transformMode: 'translate',
  transformSpace: 'world',
  snapEnabled: false,
  snapTranslate: 1,
  snapRotate: 15,
  snapScale: 0.25,
  selectedObjectId: null,
  objects: [],
  showGrid: true,
  showStats: true,
  gameScript: '// Game Script\n// Escreva sua lógica aqui\n',
  focusTarget: null,
  cameraPoseTarget: null,
  
  // Undo/Redo state
  history: [],
  historyIndex: -1,
  
  loadTemplate: (templateId) => {
    const objects = getTemplateObjects(templateId);
    set({
      objects,
      selectedObjectId: null,
      isEditMode: true,
      history: [JSON.parse(JSON.stringify(objects))],
      historyIndex: 0,
      focusTarget: null,
      cameraPoseTarget: null,
    });
  },
  
  setEditMode: (edit) => set({ isEditMode: edit, selectedObjectId: edit ? get().selectedObjectId : null }),
  setCameraPoseTarget: (pose) => set({
    cameraPoseTarget: {
      ...pose,
      timestamp: Date.now(),
    },
    focusTarget: null,
  }),
  setActiveSceneKind: (kind) => set({ activeSceneKind: kind }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  setTransformSpace: (space) => set({ transformSpace: space }),
  toggleTransformSpace: () => set({ transformSpace: get().transformSpace === 'world' ? 'local' : 'world' }),
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  toggleSnapEnabled: () => set({ snapEnabled: !get().snapEnabled }),
  setSnapValues: (translate, rotate, scale) => set({ snapTranslate: translate, snapRotate: rotate, snapScale: scale }),
  toggleEditMode: () => {
    const current = get().isEditMode;
    set({ isEditMode: !current, selectedObjectId: !current ? get().selectedObjectId : null });
  },
  
  selectObject: (id) => set({ selectedObjectId: id }),
  
  focusOnObject: (id) => {
    const obj = get().objects.find((o) => o.id === id);
    if (obj) {
      set({ 
        selectedObjectId: id,
        focusTarget: { 
          position: obj.position as [number, number, number], 
          timestamp: Date.now() 
        }
      });
    }
  },
  
  addObject: (type, position = [0, 2, 0]) => {
    const newObject = getDefaultObject(type, position);
    set((state) => ({
      objects: [...state.objects, newObject],
      selectedObjectId: newObject.id,
    }));
    get().saveToHistory();
  },
  
  addModelFromAsset: (asset, position = [0, 0, 0]) => {
    const id = generateId();
    const newObject: SceneObject = {
      id,
      name: asset.name || 'Imported Model',
      type: 'box', // Base type, but will render as model
      position: position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#ffffff',
      visible: true,
      locked: false,
      isStatic: true,
      physicsSettings: {
        bodyType: 'fixed',
        mass: 1,
        friction: 0.5,
        restitution: 0.2,
        colliderShape: 'auto', // Auto-detect from model
        linearDamping: 0,
        angularDamping: 0,
        isSensor: false,
      },
      animationSettings: {
        modelUrl: asset.url, // The GLB/GLTF URL
        currentAnimation: undefined,
        availableAnimations: [],
        autoPlay: false,
        loop: true,
        speed: 1,
        crossFadeDuration: 0.3,
        paused: false,
        currentTime: 0,
      },
    };
    
    set((state) => ({
      objects: [...state.objects, newObject],
      selectedObjectId: id,
    }));
    get().saveToHistory();
    
    return newObject;
  },
  
  updateObject: (id, updates) => {
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj
      ),
    }));
  },
  
  deleteObject: (id) => {
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== id),
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    }));
    get().saveToHistory();
  },
  
  duplicateObject: (id) => {
    const obj = get().objects.find((o) => o.id === id);
    if (!obj) return;
    
    const newId = generateId();
    const newObj: SceneObject = {
      ...obj,
      id: newId,
      name: `${obj.name}_copy`,
      position: [obj.position[0] + 2, obj.position[1], obj.position[2]],
    };
    
    set((state) => ({
      objects: [...state.objects, newObj],
      selectedObjectId: newId,
    }));
    get().saveToHistory();
  },
  
  setObjects: (objects) => set({ objects }),
  
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleStats: () => set((state) => ({ showStats: !state.showStats })),
  setGameScript: (script) => set({ gameScript: script }),
  
  getSelectedObject: () => {
    const { selectedObjectId, objects } = get();
    return objects.find((obj) => obj.id === selectedObjectId) || null;
  },
  
  getCamera: () => {
    return get().objects.find((obj) => obj.type === 'camera') || null;
  },
  
  getPlayer: () => {
    return get().objects.find((obj) => obj.type === 'player') || null;
  },
  
  // Undo/Redo implementation
  saveToHistory: () => {
    const { objects, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(objects)));
    
    // Limit history to 50 states
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },
  
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        objects: JSON.parse(JSON.stringify(history[newIndex])),
        historyIndex: newIndex,
        selectedObjectId: null,
      });
    }
  },
  
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        objects: JSON.parse(JSON.stringify(history[newIndex])),
        historyIndex: newIndex,
        selectedObjectId: null,
      });
    }
  },
  
  canUndo: () => {
    return get().historyIndex > 0;
  },
  
  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },
  
  // Manual save/load implementation
  saveProject: async () => {
    const { objects, gameScript, transformSpace, snapEnabled, snapTranslate, snapRotate, snapScale } = get();
    const saveData = {
      version: 1,
      savedAt: Date.now(),
      gameScript,
      transformSpace,
      snapEnabled,
      snapTranslate,
      snapRotate,
      snapScale,
      objects: JSON.parse(JSON.stringify(objects)),
    };
    
    // Use StorageManager for intelligent fallback
    const success = await storageManager.save('pixl-project-save', saveData);
    
    if (success) {
      console.log(' Project saved!', new Date().toLocaleTimeString());
    } else {
      console.warn(' Project save had issues, check cloud save');
    }
  },
  
  loadSavedProject: () => {
    try {
      // Use localStorage directly for sync operation
      const saved = localStorage.getItem('pixl-project-save');
      if (!saved) return false;
      
      const data = JSON.parse(saved);
      if (!data.objects || !Array.isArray(data.objects)) return false;
      
      set({
        objects: data.objects,
        gameScript: data.gameScript || '// Game Script\n',
        transformSpace: data.transformSpace || 'world',
        snapEnabled: data.snapEnabled ?? false,
        snapTranslate: data.snapTranslate ?? 1,
        snapRotate: data.snapRotate ?? 15,
        snapScale: data.snapScale ?? 0.25,
        selectedObjectId: null,
        history: [JSON.parse(JSON.stringify(data.objects))],
        historyIndex: 0,
      });
      console.log(' Project loaded!', new Date(data.savedAt).toLocaleString());
      return true;
    } catch (e) {
      console.error('Failed to load project:', e);
      return false;
    }
  },
  
  hasSavedProject: () => {
    return localStorage.getItem('pixl-project-save') !== null;
  },
  
  clearSavedProject: () => {
    localStorage.removeItem('pixl-project-save');
    console.log(' Saved project cleared');
  },
  
  // Script management implementation
  addScriptToObject: (objectId, scriptId, parameters = {}) => {
    const generateInstanceId = () => Math.random().toString(36).substring(2, 9);
    
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== objectId) return obj;
        
        const newInstance = {
          id: generateInstanceId(),
          scriptId,
          parameters,
          enabled: true,
        };
        
        return {
          ...obj,
          scriptInstances: [...(obj.scriptInstances || []), newInstance],
        };
      }),
    }));
    
    get().saveToHistory();
  },
  
  removeScriptFromObject: (objectId, scriptInstanceId) => {
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== objectId) return obj;
        
        return {
          ...obj,
          scriptInstances: (obj.scriptInstances || []).filter(
            (instance) => instance.id !== scriptInstanceId
          ),
        };
      }),
    }));
    
    get().saveToHistory();
  },
  
  updateScriptParams: (objectId, scriptInstanceId, params) => {
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== objectId) return obj;
        
        return {
          ...obj,
          scriptInstances: (obj.scriptInstances || []).map((instance) => {
            if (instance.id !== scriptInstanceId) return instance;
            
            return {
              ...instance,
              parameters: { ...instance.parameters, ...params },
            };
          }),
        };
      }),
    }));
  },
  
  toggleScriptEnabled: (objectId, scriptInstanceId) => {
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== objectId) return obj;
        
        return {
          ...obj,
          scriptInstances: (obj.scriptInstances || []).map((instance) => {
            if (instance.id !== scriptInstanceId) return instance;
            
            return {
              ...instance,
              enabled: !instance.enabled,
            };
          }),
        };
      }),
    }));
  },
}));
