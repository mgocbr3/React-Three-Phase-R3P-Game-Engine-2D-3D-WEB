import { createProjectDocumentFromEditorState } from '@/engine/project/editorProjectAdapter';
import type { PixlProjectDocument } from '@/engine/project/schema';
import type { CameraMode, GamePreset, SceneObject } from '@/stores/editorStore';

export type StarterTemplateId = 'first-person' | 'third-person';

export interface StarterTemplate {
  id: StarterTemplateId;
  name: string;
  description: string;
  cameraMode: CameraMode;
}

const MANNEQUIN_MODEL_URL = '/models/manequin/mixamo/xbot.glb';
const MANNEQUIN_ANIMATIONS = ['idle', 'walk', 'run', 'agree', 'headShake', 'sad_pose', 'sneak_pose'];
const ids: StarterTemplateId[] = ['first-person', 'third-person'];

const playerSettings = (gamePreset: GamePreset = 'custom') => ({
  speed: 5,
  jumpForce: 8,
  gravity: 20,
  maxHealth: 100,
  movementMode: 'free' as const,
  canDoubleJump: false,
  doubleJumpForce: 6,
  coyoteTime: 0.15,
  jumpBufferTime: 0.1,
  canSprint: true,
  sprintSpeed: 8,
  mouseSensitivity: 0.004,
  gamepadLookSpeed: 2.8,
  minPitch: -1.15,
  maxPitch: 0.9,
  sprintStaminaCost: 10,
  maxStamina: 100,
  staminaRegenRate: 15,
  canCrouch: true,
  crouchSpeed: 2.5,
  crouchHeightMultiplier: 0.5,
  canDodge: false,
  dodgeDistance: 4,
  dodgeDuration: 0.3,
  dodgeCooldown: 0.8,
  dodgeInvincibilityFrames: false,
  attackEnabled: false,
  attackType: 'melee' as const,
  attackDamage: 25,
  attackCooldown: 0.5,
  attackRange: 2,
  meleeWeaponType: 'fist' as const,
  meleeComboEnabled: false,
  meleeComboHits: 3,
  meleeKnockback: 5,
  meleeSweepAngle: 90,
  projectileSpeed: 50,
  projectileGravity: 0.1,
  projectileSpread: 0,
  projectilesPerShot: 1,
  ammoEnabled: false,
  maxAmmo: 30,
  ammoPerShot: 1,
  reloadTime: 1.5,
  projectileType: 'bullet' as const,
  explosionRadius: 0,
  explosionForce: 0,
  stompEnabled: false,
  stompDamage: 50,
  stompBounceForce: 10,
  stompRequiresDownward: true,
  canWallJump: false,
  canWallSlide: false,
  wallSlideSpeed: 2,
  wallJumpForce: 10,
  canSwim: false,
  swimSpeed: 3,
  airControlMultiplier: 0.7,
  gamePreset,
});

const visual = (castShadow = true, receiveShadow = true) => ({
  textureUrl: '',
  textureRepeat: [1, 1] as [number, number],
  textureOffset: [0, 0] as [number, number],
  textureRotation: 0,
  textureFlipY: false,
  textureAutoScale: true,
  opacity: 1,
  metalness: 0,
  roughness: 0.75,
  emissiveIntensity: 0,
  wireframe: false,
  castShadow,
  receiveShadow,
});

const logic = (tags: string[], customData: Record<string, unknown> = {}) => ({
  tags,
  behavior: 'none' as const,
  behaviorSpeed: 1,
  patrolDistance: 5,
  customData,
});

const physics = (
  bodyType: 'fixed' | 'dynamic',
  colliderShape: 'cuboid' | 'capsule',
  colliders: Array<Record<string, unknown>>,
) => ({
  bodyType,
  colliderShape,
  mass: bodyType === 'fixed' ? 0 : 1,
  restitution: 0.05,
  friction: 0.85,
  linearDamping: bodyType === 'dynamic' ? 0.15 : 0,
  angularDamping: 0.2,
  isSensor: false,
  colliders,
});

const baseObject = (object: Omit<SceneObject, 'visible' | 'locked'>): SceneObject => ({
  visible: true,
  locked: false,
  ...object,
});

type Vec3 = [number, number, number];

const arenaBlock = ({
  id,
  name,
  position,
  scale,
  color,
  rotation = [0, 0, 0],
  tags = ['arena'],
  castShadow = true,
  receiveShadow = true,
  friction = 0.92,
}: {
  id: string;
  name: string;
  position: Vec3;
  scale: Vec3;
  color: string;
  rotation?: Vec3;
  tags?: string[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  friction?: number;
}): SceneObject => baseObject({
  id,
  name,
  type: 'box',
  position,
  rotation,
  scale,
  color,
  isStatic: true,
  visualSettings: visual(castShadow, receiveShadow),
  physicsSettings: physics('fixed', 'cuboid', [{
    type: 'cuboid',
    hx: Math.abs(scale[0]) / 2,
    hy: Math.abs(scale[1]) / 2,
    hz: Math.abs(scale[2]) / 2,
    friction,
  }]),
  logicSettings: logic(tags),
});

const arenaStep = (index: number): SceneObject => {
  const height = 0.22 * index;
  return arenaBlock({
    id: `arena-stair-${index}`,
    name: `Stair ${index}`,
    position: [10.5, height / 2, 6 - index * 1.15],
    scale: [9.5, height, 1.2],
    color: index % 2 === 0 ? '#dbe8e9' : '#c9d9dc',
    tags: ['arena', 'stairs'],
  });
};

const createArenaObjects = (): SceneObject[] => [
  arenaBlock({
    id: 'ground-1',
    name: 'Ground',
    position: [0, -0.1, 0],
    scale: [72, 0.2, 72],
    color: '#5aa6c8',
    tags: ['ground', 'arena'],
    castShadow: false,
    friction: 0.95,
  }),
  arenaBlock({
    id: 'arena-main-platform',
    name: 'Main Platform',
    position: [0, 0.25, -9],
    scale: [30, 0.5, 24],
    color: '#d8e7e8',
    tags: ['arena', 'platform'],
  }),
  arenaBlock({
    id: 'arena-back-wall',
    name: 'Back Wall',
    position: [0, 5.5, -22.5],
    scale: [32, 11, 0.6],
    color: '#dfecee',
    tags: ['arena', 'wall'],
  }),
  arenaBlock({
    id: 'arena-right-wall',
    name: 'Right Wall',
    position: [15.7, 3.6, -9.8],
    scale: [0.7, 7.2, 25],
    color: '#dce9ea',
    tags: ['arena', 'wall'],
  }),
  arenaBlock({
    id: 'arena-left-gate-wall',
    name: 'Gate Wall',
    position: [-14.5, 3.4, -15.5],
    scale: [0.7, 6.8, 12],
    color: '#bfced1',
    tags: ['arena', 'wall'],
  }),
  arenaBlock({
    id: 'arena-upper-deck',
    name: 'Upper Deck',
    position: [7.5, 2.1, -17.2],
    scale: [16, 0.55, 10],
    color: '#f0f7f7',
    tags: ['arena', 'platform'],
  }),
  arenaBlock({
    id: 'arena-front-ramp',
    name: 'Entry Ramp',
    position: [-8.5, 0.45, 4.5],
    rotation: [-0.16, 0, 0],
    scale: [13, 0.45, 10],
    color: '#edf6f6',
    tags: ['arena', 'ramp'],
  }),
  ...[1, 2, 3, 4, 5, 6, 7].map(arenaStep),
  arenaBlock({
    id: 'arena-orange-left-block',
    name: 'Orange Cover Left',
    position: [-20, 1.1, 7.5],
    scale: [6, 2.2, 4],
    color: '#d69522',
    tags: ['arena', 'cover'],
  }),
  arenaBlock({
    id: 'arena-orange-right-rail',
    name: 'Orange Rail Right',
    position: [20.5, 0.9, 2.5],
    scale: [11, 1.8, 2.1],
    color: '#e0a026',
    tags: ['arena', 'cover'],
  }),
  arenaBlock({
    id: 'arena-orange-far-block',
    name: 'Orange Cover Far',
    position: [-21, 1, -13],
    scale: [4.5, 2, 6],
    color: '#c98920',
    tags: ['arena', 'cover'],
  }),
  arenaBlock({
    id: 'arena-orange-roof-cube',
    name: 'Orange Roof Cube',
    position: [10.5, 3.9, -22.2],
    scale: [3.4, 3.4, 3.4],
    color: '#d99b22',
    tags: ['arena', 'landmark'],
  }),
];

export const listStarterTemplates = (): StarterTemplate[] => [
  { id: 'first-person', name: 'Primeira Pessoa', description: 'Câmera FPS, mannequin, arena modular, céu e Rapier.', cameraMode: 'first-person' },
  { id: 'third-person', name: 'Terceira Pessoa', description: 'Câmera seguindo o player, mannequin, arena modular, céu e Rapier.', cameraMode: 'third-person' },
];

export const isStarterTemplateId = (value: unknown): value is StarterTemplateId => (
  typeof value === 'string' && ids.includes(value as StarterTemplateId)
);

export const createStarterTemplateObjects = (templateId: StarterTemplateId): SceneObject[] => {
  const mode = listStarterTemplates().find((template) => template.id === templateId)?.cameraMode ?? 'third-person';

  return [
    baseObject({
      id: 'sunlight-main',
      name: 'Sun Light',
      type: 'sunlight',
      position: [18, 24, 16],
      rotation: [-0.9, 0.62, 0],
      scale: [1, 1, 1],
      color: '#fffaf0',
      isStatic: true,
      lightSettings: {
        intensity: 1.35,
        distance: 0,
        decay: 2,
        temperature: 5600,
        useTemperature: false,
        angle: Math.PI / 6,
        penumbra: 0.35,
        sunElevation: 45,
        sunAzimuth: 135,
        castShadow: true,
        shadowMapSize: 4096,
        shadowBias: -0.0001,
        shadowNormalBias: 0.02,
        shadowRadius: 2,
        shadowCameraSize: 90,
        volumetric: false,
        volumetricIntensity: 0.3,
        helperVisible: false,
      },
    }),
    baseObject({
      id: 'main-camera',
      name: 'Main Camera',
      type: 'camera',
      position: mode === 'first-person' ? [-10, 1.7, 16] : [-10, 4.2, 24],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#60a5fa',
      cameraSettings: {
        mode,
        distance: mode === 'first-person' ? 0.1 : 7.5,
        height: mode === 'first-person' ? 1.7 : 3.8,
        fov: mode === 'first-person' ? 70 : 60,
        followPlayer: true,
        targetId: 'main-player',
        lockedZ: false,
        lockedY: false,
        smoothing: mode === 'first-person' ? 0.35 : 0.16,
        pitchMin: mode === 'first-person' ? -1.15 : -0.65,
        pitchMax: mode === 'first-person' ? 0.9 : 0.8,
      },
      logicSettings: logic(['camera']),
    }),
    baseObject({
      id: 'main-player',
      name: 'Player',
      type: 'player',
      position: [-10, 1, 16],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#cfd8df',
      playerSettings: playerSettings(),
      physicsSettings: physics('dynamic', 'capsule', [{ type: 'capsule', halfHeight: 0.65, radius: 0.32, friction: 0.85 }]),
      visualSettings: visual(true, true),
      logicSettings: logic(['player'], {
        templateId,
        mannequin: true,
        mixamoReady: true,
        sourceModel: MANNEQUIN_MODEL_URL,
      }),
      entitySettings: {
        entityType: 'character',
        team: 'player',
        maxHealth: 100,
        currentHealth: 100,
        isInvulnerable: false,
        invulnerabilityDuration: 0.5,
        canDealDamage: false,
        contactDamage: 0,
        knockbackResistance: 0.25,
        destroyOnDeath: true,
        isInteractable: false,
        interactionRange: 2,
        aiEnabled: false,
        aiType: 'none',
        aiSpeed: 0,
        aiDetectionRange: 0,
        aiAttackRange: 0,
        aiAttackCooldown: 1,
        modelScale: 1,
        modelOffset: [0, 0, 0],
        modelRotationOffset: [0, 0, 0],
        hitboxScale: [1, 1, 1],
        hitboxOffset: [0, 0.9, 0],
      },
      animationSettings: {
        modelUrl: MANNEQUIN_MODEL_URL,
        sourceAssetName: 'Mixamo X Bot',
        currentAnimation: 'idle',
        availableAnimations: MANNEQUIN_ANIMATIONS,
        movementClips: {
          idle: 'idle',
          walk: 'walk',
          run: 'run',
          jump: 'jump',
          fall: 'jump',
          crouch: 'sneak_pose',
          crouchWalk: 'sneak_pose',
        },
        driveByController: true,
        autoPlay: true,
        loop: true,
        speed: 1,
        crossFadeDuration: 0.3,
        paused: false,
        currentTime: 0,
      },
      components: [{
        id: 'main-player-mesh',
        type: 'pixl.mesh',
        enabled: true,
        data: { modelUrl: MANNEQUIN_MODEL_URL, assetPath: MANNEQUIN_MODEL_URL, castShadow: true, receiveShadow: true },
      }],
    }),
    ...createArenaObjects(),
  ];
};

export const buildStarterProjectDocument = (params: {
  id: string;
  name: string;
  templateId: StarterTemplateId;
  createdAt?: number;
}): PixlProjectDocument => {
  const now = params.createdAt ?? Date.now();
  const doc = createProjectDocumentFromEditorState({
    activeSceneKind: '3d',
    objects: createStarterTemplateObjects(params.templateId),
    gameScript: '// Game Script\n',
    transformSpace: 'world',
    snapEnabled: false,
    snapTranslate: 1,
    snapRotate: 15,
    snapScale: 0.25,
  }, {
    id: params.id,
    name: params.name,
    createdAt: now,
    savedAt: now,
  });
  doc.game.templateId = params.templateId;
  doc.scenes[0].environment = {
    ...doc.scenes[0].environment,
    background: '#7bc7ee',
    ambientLight: '#ffffff',
    ambientIntensity: 0.9,
    sunColor: '#fff7df',
    sunIntensity: 1.25,
  };
  doc.scenes[0].physics = { engine: 'rapier', gravity: [0, -9.81, 0] };
  return doc;
};
