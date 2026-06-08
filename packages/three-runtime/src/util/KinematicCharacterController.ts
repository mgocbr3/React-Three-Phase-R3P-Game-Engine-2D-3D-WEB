// Adapted from tools/vendor/three-game-engine/src/util/KinematicCharacterController.ts
// (MIT, WesUnwin/three-game-engine).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import CharacterController from './CharacterController.js';
import RigidBodyComponent from '../components/RigidBodyComponent.js';
import type GameObject from '../GameObject.js';
import type { CharacterControllerOptions, GameObjectOptions } from '../types.js';

const DEFAULT_CAPSULE = { halfHeight: 0.45, radius: 0.4, density: 500 };

export interface KinematicCharacterControllerOptions {
  offset?: number;
  autoStep?: {
    maxHeight: number;
    minWidth: number;
    includeDynamicBodies: boolean;
  };
  maxSlopeClimbAngle?: number;
  minSlopeSlideAngle?: number;
  snapToGroundDistance?: number;
  applyImpulsesToDynamicBodies?: boolean;
}

const DEFAULT_JUMP_FORCE = 5;

const DEFAULT_KCC: Required<Pick<KinematicCharacterControllerOptions, 'offset' | 'applyImpulsesToDynamicBodies'>> = {
  offset: 0.05,
  applyImpulsesToDynamicBodies: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object'
);

const readControllerOptions = (options: GameObjectOptions): CharacterControllerOptions => {
  const raw = options.userData?.pixlControllerOptions;
  return isRecord(raw) ? raw as CharacterControllerOptions : {};
};

const readKinematicControllerOptions = (options: GameObjectOptions): KinematicCharacterControllerOptions => {
  const raw = options.userData?.pixlKinematicControllerOptions;
  return isRecord(raw) ? raw as KinematicCharacterControllerOptions : {};
};

const finiteOrZero = (value: number): number => (Number.isFinite(value) ? value : 0);

const Y_AXIS = new THREE.Vector3(0, 1, 0);

const getErrorMessage = (error: unknown): string => (
  error instanceof Error && error.message ? error.message : String(error || 'kcc-fallback')
);

type LocomotionDebugState = {
  inputMagnitude: number;
  movement: RAPIER.Vector | THREE.Vector3;
  sprinting: boolean;
  crouching: boolean;
  grounded: boolean;
  jumpedThisFrame: boolean;
  deltaTimeInSec: number;
  fallbackReason?: string;
};

class KinematicCharacterController extends CharacterController {
  rapierCharacterController: RAPIER.KinematicCharacterController | null = null;
  verticalVelocity: number;
  kccOptions: KinematicCharacterControllerOptions;
  private fallbackGroundY: number;
  private kccInitFailure: string | null;
  private kccFallbackReason: string | null;

  constructor(
    parent: GameObject['parent'],
    options: GameObjectOptions = {},
    controllerOptions: CharacterControllerOptions = {},
    kccOptions: KinematicCharacterControllerOptions = {},
  ) {
    const pixlControllerOptions = readControllerOptions(options);
    const mergedControllerOptions = { ...pixlControllerOptions, ...controllerOptions };
    super(
      parent,
      {
        ...options,
        components: [
          {
            type: 'rigidBody',
            rigidBodyType: 'kinematicPositionBased',
            colliders: [
              { type: 'capsule', ...DEFAULT_CAPSULE, ...(mergedControllerOptions.capsule ?? {}) },
            ],
            enabledRotations: { x: false, y: true, z: false },
          },
          ...(options.components ?? []),
        ],
      },
      mergedControllerOptions,
    );
    this.kccOptions = { ...DEFAULT_KCC, ...readKinematicControllerOptions(options), ...kccOptions };
    this.verticalVelocity = 0;
    this.fallbackGroundY = this.threeJSGroup.position.y;
    this.kccInitFailure = null;
    this.kccFallbackReason = null;
  }

  private setKinematicFallback(reason: string): void {
    this.rapierCharacterController = null;
    this.kccFallbackReason = reason;
    this.threeJSGroup.userData.pixlControllerDebug = 'kinematic-fallback';
    this.threeJSGroup.userData.pixlControllerFallbackReason = reason;
  }

  private publishLocomotionState(state: LocomotionDebugState): void {
    const horizontalSpeed = Math.hypot(state.movement.x, state.movement.z) / Math.max(state.deltaTimeInSec, 0.001);
    this.threeJSGroup.userData.pixlLocomotionState = {
      inputMagnitude: state.inputMagnitude,
      speed: horizontalSpeed,
      moving: state.inputMagnitude > 0.05 || horizontalSpeed > 0.05,
      sprinting: state.sprinting,
      crouching: state.crouching,
      grounded: state.grounded,
      jumping: state.jumpedThisFrame || !state.grounded || this.verticalVelocity > 0.1,
      verticalVelocity: this.verticalVelocity,
      fallbackReason: state.fallbackReason ? 'kinematic-fallback' : undefined,
    };
  }

  afterLoaded(): void {
    const rapierWorld = this.getScene().rapierWorld;
    if (!rapierWorld) return;

    try {
      const controller = rapierWorld.createCharacterController(this.kccOptions.offset ?? DEFAULT_KCC.offset);

      if (typeof this.kccOptions.maxSlopeClimbAngle === 'number') {
        controller.setMaxSlopeClimbAngle(this.kccOptions.maxSlopeClimbAngle);
      }
      if (typeof this.kccOptions.minSlopeSlideAngle === 'number') {
        controller.setMinSlopeSlideAngle(this.kccOptions.minSlopeSlideAngle);
      }
      if (this.kccOptions.autoStep) {
        const { maxHeight, minWidth, includeDynamicBodies } = this.kccOptions.autoStep;
        controller.enableAutostep(maxHeight, minWidth, includeDynamicBodies);
      } else {
        controller.disableAutostep();
      }
      if (typeof this.kccOptions.snapToGroundDistance === 'number') {
        controller.enableSnapToGround(this.kccOptions.snapToGroundDistance);
      } else {
        controller.disableSnapToGround();
      }
      controller.setApplyImpulsesToDynamicBodies(this.kccOptions.applyImpulsesToDynamicBodies ?? false);

      this.rapierCharacterController = controller;
      this.kccInitFailure = null;
      this.kccFallbackReason = null;
      delete this.threeJSGroup.userData.pixlControllerFallbackReason;
    } catch (error) {
      this.kccInitFailure = `kcc-init: ${getErrorMessage(error)}`;
      this.setKinematicFallback(this.kccInitFailure);
    }
  }

  beforeRender(ctx: { deltaTimeInSec: number }): void {
    if (!this.isLoaded()) {
      this.threeJSGroup.userData.pixlControllerDebug = 'not-loaded';
      super.beforeRender(ctx);
      return;
    }

    const inputManager = this.getScene().game.inputManager;
    if (!inputManager) {
      this.threeJSGroup.userData.pixlControllerDebug = 'missing-input-manager';
      super.beforeRender(ctx);
      return;
    }
    const time = performance.now();

    this.updateViewAngles(ctx.deltaTimeInSec);

    const yawAngle = finiteOrZero(this.getDesiredYaw());
    const pitchAngle = finiteOrZero(this.getDesiredPitch());

    const rigidBody = this.getComponent(RigidBodyComponent)?.getRapierRigidBody();

    let attachedCamera: THREE.Camera | null = null;
    this.threeJSGroup.traverse((obj) => {
      if (obj instanceof THREE.Camera) attachedCamera = obj;
    });
    if (attachedCamera) {
      (attachedCamera as THREE.Camera).rotation.set(pitchAngle, 0, 0);
    }

    const yawQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yawAngle, 0));
    this.threeJSGroup.quaternion.copy(yawQuaternion);
    const yawRotation = {
      x: yawQuaternion.x,
      y: yawQuaternion.y,
      z: yawQuaternion.z,
      w: yawQuaternion.w,
    };
    if (rigidBody) {
      try {
        if (this.getScene().hasDynamicRigidBodies()) {
          rigidBody.setNextKinematicRotation(yawRotation);
        } else {
          rigidBody.setRotation(yawRotation, true);
        }
      } catch {
        // Stale physics handles should not stop the visual player from facing input.
      }
    }

    const inputMagnitude = Math.min(1, Math.hypot(inputManager.readHorizontalAxis(), inputManager.readVerticalAxis()));
    const sprinting = inputManager.isSprintPressed() && inputMagnitude > 0.05;
    const crouching = inputManager.isCrouchPressed();

    const desired = this.getDesiredTranslation(ctx.deltaTimeInSec);
    desired.applyAxisAngle(Y_AXIS, yawAngle);

    let isOnGround = this.isOnGround();
    if (!isOnGround && this.threeJSGroup.position.y <= this.fallbackGroundY + 0.05) {
      isOnGround = true;
    }
    let jumpedThisFrame = false;
    if (inputManager.isJumpPressed()) {
      const timeSinceLastJump = time - this.lastJumpTime;
      const cooldown = this.controllerOptions.jumpCooldown ?? 1000;
      if (timeSinceLastJump > cooldown && isOnGround) {
        this.verticalVelocity = this.controllerOptions.jumpForce ?? DEFAULT_JUMP_FORCE;
        this.lastJumpTime = time;
        isOnGround = false;
        jumpedThisFrame = true;
      }
    }

    if (isOnGround && this.verticalVelocity < 0) {
      this.verticalVelocity = -1;
    } else {
      this.verticalVelocity -= 9.8 * ctx.deltaTimeInSec;
      if (this.verticalVelocity < -10) this.verticalVelocity = -10;
    }
    desired.y += this.verticalVelocity * ctx.deltaTimeInSec;

    let movement: RAPIER.Vector | THREE.Vector3;
    try {
      if (!rigidBody) {
        throw new Error('missing-rigid-body');
      }
      if (!this.rapierCharacterController) {
        throw new Error(this.kccFallbackReason ?? this.kccInitFailure ?? 'missing-kcc');
      }
      const collider = rigidBody.collider(0);
      if (!collider) {
        throw new Error('missing-collider');
      }
      this.rapierCharacterController.computeColliderMovement(collider, desired);
      movement = this.rapierCharacterController.computedMovement();
      const t = rigidBody.translation();
      const nextTranslation = {
        x: t.x + movement.x,
        y: t.y + movement.y,
        z: t.z + movement.z,
      };
      if (this.getScene().hasDynamicRigidBodies()) {
        rigidBody.setNextKinematicTranslation(nextTranslation);
      } else {
        rigidBody.setTranslation(nextTranslation, true);
      }
      this.threeJSGroup.position.set(nextTranslation.x, nextTranslation.y, nextTranslation.z);
      this.threeJSGroup.userData.pixlControllerDebug = 'kcc';
      this.kccFallbackReason = null;
      delete this.threeJSGroup.userData.pixlControllerFallbackReason;
    } catch (error) {
      const fallbackReason = getErrorMessage(error);
      this.setKinematicFallback(fallbackReason);
      const current = this.threeJSGroup.position;
      const fallbackMovement = desired.clone();
      let nextY = current.y + fallbackMovement.y;
      if (nextY <= this.fallbackGroundY && this.verticalVelocity <= 0) {
        nextY = this.fallbackGroundY;
        fallbackMovement.y = nextY - current.y;
        this.verticalVelocity = 0;
        isOnGround = true;
      }
      const nextTranslation = {
        x: current.x + fallbackMovement.x,
        y: nextY,
        z: current.z + fallbackMovement.z,
      };
      if (rigidBody) {
        try { rigidBody.setTranslation(nextTranslation, true); } catch { /* stale Rapier handles are handled visually below */ }
      }
      this.threeJSGroup.position.set(nextTranslation.x, nextTranslation.y, nextTranslation.z);
      movement = fallbackMovement;
    }

    this.publishLocomotionState({
      inputMagnitude,
      movement,
      sprinting,
      crouching,
      grounded: isOnGround,
      jumpedThisFrame,
      deltaTimeInSec: ctx.deltaTimeInSec,
      fallbackReason: this.kccFallbackReason ?? undefined,
    });
    super.beforeRender(ctx);
  }
}

export default KinematicCharacterController;
