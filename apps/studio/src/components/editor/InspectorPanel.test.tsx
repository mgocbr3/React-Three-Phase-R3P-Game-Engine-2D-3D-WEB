import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAssetStore, type ProjectAsset } from '@/stores/assetStore';
import { useEditorStore, type CameraSettings, type PlayerSettings, type SceneObject } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { DockFrame } from './DockFrame';
import { InspectorPanel } from './InspectorPanel';

const sprite: SceneObject = {
  id: 'hero',
  name: 'Hero',
  type: 'sprite',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: '#ffffff',
  visible: true,
  locked: false,
};

const playerSettings: PlayerSettings = {
  speed: 5,
  jumpForce: 8,
  gravity: 20,
  maxHealth: 100,
  movementMode: 'free',
  canDoubleJump: false,
  doubleJumpForce: 6,
  coyoteTime: 0.15,
  jumpBufferTime: 0.1,
  canSprint: true,
  sprintSpeed: 8,
  mouseSensitivity: 0.002,
  gamepadLookSpeed: 2,
  minPitch: -1.2,
  maxPitch: 1.2,
  sprintStaminaCost: 10,
  maxStamina: 100,
  staminaRegenRate: 15,
  canCrouch: true,
  crouchSpeed: 2.5,
  crouchHeightMultiplier: 0.5,
  canDodge: true,
  dodgeDistance: 4,
  dodgeDuration: 0.3,
  dodgeCooldown: 0.8,
  dodgeInvincibilityFrames: true,
  attackEnabled: true,
  attackType: 'stomp',
  attackDamage: 25,
  attackCooldown: 0.5,
  attackRange: 2,
  meleeWeaponType: 'fist',
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
  projectileType: 'bullet',
  explosionRadius: 0,
  explosionForce: 0,
  stompEnabled: true,
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
  gamePreset: 'custom',
};

const player: SceneObject = {
  id: 'player',
  name: 'Player',
  type: 'player',
  position: [0, 1, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: '#6366f1',
  visible: true,
  locked: false,
  playerSettings,
  components: [{
    id: 'player-mesh',
    type: 'pixl.mesh',
    enabled: true,
    data: {
      modelUrl: '/models/xbot.glb',
      assetPath: 'Assets/3D_Models/xbot.glb',
      castShadow: true,
      receiveShadow: true,
    },
  }],
};

const camera: SceneObject = {
  id: 'main-camera',
  name: 'Main Camera',
  type: 'camera',
  position: [0, 4, 6],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: '#4ade80',
  visible: true,
  locked: false,
  cameraSettings: {
    mode: 'third-person',
    distance: 6,
    height: 3,
    fov: 60,
    followPlayer: true,
    targetId: 'player',
    lockedZ: false,
    lockedY: false,
    smoothing: 0.1,
  } satisfies CameraSettings,
};

const sunLight: SceneObject = {
  id: 'sunlight-main',
  name: 'Sun Light',
  type: 'sunlight',
  position: [0, 20, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: '#fffaf0',
  visible: true,
  locked: false,
  lightSettings: {
    intensity: 1.35,
    distance: 0,
    decay: 2,
    temperature: 5600,
    useTemperature: false,
    angle: Math.PI / 6,
    penumbra: 0.35,
    sunElevation: 45,
    sunAzimuth: 270,
    castShadow: true,
    shadowMapSize: 4096,
    shadowBias: -0.0001,
    shadowNormalBias: 0.02,
    shadowRadius: 2,
    shadowCameraSize: 90,
    volumetric: false,
    volumetricIntensity: 0.3,
    helperVisible: true,
  },
};

const modelAsset: ProjectAsset = {
  id: 'asset-xbot',
  name: 'xbot.glb',
  type: 'model',
  url: '/models/xbot.glb',
  path: 'Assets/3D_Models/xbot.glb',
  folder: 'Assets/3D_Models',
  createdAt: 1000,
  metadata: {
    format: 'glb',
    animations: ['Idle', 'Run'],
  },
};

describe('InspectorPanel object icons', () => {
  beforeEach(() => {
    useRuntimeGameStore.getState().stopPreview();
    useAssetStore.setState({
      projectAssets: [],
      loadingAssets: [],
      selectedAssetId: null,
    });
    useEditorStore.setState({
      activeSceneKind: '2d',
      isEditMode: true,
      objects: [sprite],
      selectedObjectId: 'hero',
    });
  });

  it('uses a 2D visual icon for sprite objects', () => {
    const { container } = render(<InspectorPanel />);

    expect(screen.getByDisplayValue('Hero')).toBeVisible();
    expect(container.querySelector('.glass-object-header .lucide-image')).not.toBeNull();
    expect(container.querySelector('.glass-object-header .lucide-box')).toBeNull();
  });

  it('locks inspector editing controls while Play Mode is active', () => {
    useEditorStore.setState({ isEditMode: false });

    render(<InspectorPanel />);

    expect(screen.getByDisplayValue('Hero')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Scripts' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Vibe Code' })).toBeDisabled();
  });

  it('keeps inspector tabs compact while preserving full labels for tools', () => {
    const { container } = render(<InspectorPanel />);

    const vibeTab = screen.getByRole('button', { name: 'Vibe Code' });

    expect(container.querySelector('.editor-dock-outline')).toBeNull();
    expect(container.querySelectorAll('.panel-header')).toHaveLength(1);
    expect(vibeTab).toHaveAttribute('title', 'Vibe Code');
    expect(vibeTab).toHaveTextContent('Vibe');
    expect(vibeTab).not.toHaveTextContent('Vibe Code');
    expect(vibeTab.querySelector('span')).toHaveClass('whitespace-nowrap');
  });

  it('shows selected Project asset details instead of the scene object placeholder', () => {
    useAssetStore.setState({
      projectAssets: [modelAsset],
      selectedAssetId: modelAsset.id,
    });

    render(<InspectorPanel />);

    expect(screen.getByDisplayValue('xbot.glb')).toBeVisible();
    expect(screen.getByText('Assets/3D_Models')).toBeVisible();
    expect(screen.getByText('/models/xbot.glb')).toBeVisible();
    expect(screen.getByText('Idle, Run')).toBeVisible();
    expect(screen.queryByDisplayValue('Hero')).not.toBeInTheDocument();
  });

  it('keeps Player inspector focused on editable properties instead of tutorial copy', () => {
    useEditorStore.setState({
      activeSceneKind: '3d',
      isEditMode: true,
      objects: [camera, player],
      selectedObjectId: 'player',
    });

    render(<InspectorPanel />);

    expect(screen.getByDisplayValue('Player')).toBeVisible();
    expect(screen.getByText('Movimento Base')).toBeVisible();
    expect(screen.queryByText('Controles')).not.toBeInTheDocument();
    expect(screen.queryByText(/WASD/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Como funciona/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Selecione Main Camera/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Configure manualmente/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Referencia de modelo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/modelUrl, assetPath/)).not.toBeInTheDocument();
  });

  it('keeps Sun Light presets tied to visible sun direction and color', () => {
    useEditorStore.setState({
      activeSceneKind: '3d',
      isEditMode: true,
      objects: [sunLight],
      selectedObjectId: sunLight.id,
    });

    render(<InspectorPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Por do Sol' }));

    const updatedSun = useEditorStore.getState().objects[0];
    expect(updatedSun.color).toBe('#ffaa55');
    expect(updatedSun.lightSettings).toEqual(expect.objectContaining({
      sunElevation: 18,
      sunAzimuth: 255,
      intensity: 1.2,
      temperature: 3000,
    }));
  });

  it('lets the unified inspector tab strip start a dock drag', () => {
    const onPointerDown = vi.fn();

    render(
      <DockFrame
        id="inspector"
        zone="main"
        label="Inspector"
        onClose={vi.fn()}
        onDockMain={vi.fn()}
        onDockBottom={vi.fn()}
        onResetDock={vi.fn()}
        dragging={false}
        draggingAny={false}
        dropActive={false}
        onPointerDown={onPointerDown}
        customChrome
      >
        <InspectorPanel />
      </DockFrame>,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Inspector' }));

    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });
});
