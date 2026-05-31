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

class KinematicCharacterController extends CharacterController {
  rapierCharacterController: RAPIER.KinematicCharacterController | null = null;
  verticalVelocity: number;
  kccOptions: KinematicCharacterControllerOptions;

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
  }

  afterLoaded(): void {
    const rapierWorld = this.getScene().rapierWorld;
    if (!rapierWorld) return;

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
  }

  beforeRender(ctx: { deltaTimeInSec: number }): void {
    if (!this.isLoaded() || !this.rapierCharacterController) {
      super.beforeRender(ctx);
      return;
    }

    const inputManager = this.getScene().game.inputManager;
    if (!inputManager) {
      super.beforeRender(ctx);
      return;
    }
    const time = performance.now();

    this.updateViewAngles(ctx.deltaTimeInSec);

    const yawAngle = finiteOrZero(this.getDesiredYaw());
    const pitchAngle = finiteOrZero(this.getDesiredPitch());

    const rigidBody = this.getComponent(RigidBodyComponent)?.getRapierRigidBody();
    if (!rigidBody) {
      super.beforeRender(ctx);
      return;
    }

    let attachedCamera: THREE.Camera | null = null;
    this.threeJSGroup.traverse((obj) => {
      if (obj instanceof THREE.Camera) attachedCamera = obj;
    });
    if (attachedCamera) {
      (attachedCamera as THREE.Camera).rotation.set(pitchAngle, 0, 0);
    }

    const inputMagnitude = Math.min(1, Math.hypot(inputManager.readHorizontalAxis(), inputManager.readVerticalAxis()));
    const sprinting = inputManager.isSprintPressed() && inputMagnitude > 0.05;
    const crouching = inputManager.isCrouchPressed();

    const desired = this.getDesiredTranslation(ctx.deltaTimeInSec);
    desired.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);

    let isOnGround = this.isOnGround();
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

    let movement: RAPIER.Vector;
    try {
      const collider = rigidBody.collider(0);
      if (!collider) {
        super.beforeRender(ctx);
        return;
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
    } catch {
      super.beforeRender(ctx);
      return;
    }

    const horizontalSpeed = Math.hypot(movement.x, movement.z) / Math.max(ctx.deltaTimeInSec, 0.001);
    this.threeJSGroup.userData.pixlLocomotionState = {
      inputMagnitude,
      speed: horizontalSpeed,
      moving: inputMagnitude > 0.05 || horizontalSpeed > 0.05,
      sprinting,
      crouching,
      grounded: isOnGround,
      jumping: jumpedThisFrame || !isOnGround || this.verticalVelocity > 0.1,
      verticalVelocity: this.verticalVelocity,
    };
    super.beforeRender(ctx);
  }
}

export default KinematicCharacterController;
