// Adapted from tools/vendor/three-game-engine/src/util/CharacterController.ts
// (MIT, WesUnwin/three-game-engine).

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import RapierNs from '@dimforge/rapier3d-compat';

import GameObject from '../GameObject.js';
import RigidBodyComponent from '../components/RigidBodyComponent.js';
import type { CharacterControllerOptions, GameObjectOptions } from '../types.js';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const DEFAULT_OPTIONS: Required<Pick<
  CharacterControllerOptions,
  'walkingSpeed' | 'runningSpeed' | 'crouchSpeed' | 'jumpCooldown' | 'mouseSensitivity' | 'gamepadLookSpeed' | 'minPitch' | 'maxPitch'
>> = {
  walkingSpeed: 2,
  runningSpeed: 4,
  crouchSpeed: 1.25,
  jumpCooldown: 1000,
  mouseSensitivity: 0.004,
  gamepadLookSpeed: 2.8,
  minPitch: -1.15,
  maxPitch: 0.9,
};

class CharacterController extends GameObject {
  controllerOptions: CharacterControllerOptions;
  lastJumpTime: number;
  protected yawAngle: number;
  protected pitchAngle: number;
  private lastPointerX: number;
  private lastPointerY: number;

  constructor(
    parent: GameObject['parent'],
    options: GameObjectOptions = {},
    controllerOptions: CharacterControllerOptions = {},
  ) {
    if (parent === null) {
      throw new Error('CharacterController: parent must not be null');
    }
    super(parent, options);
    this.controllerOptions = { ...DEFAULT_OPTIONS, ...controllerOptions };
    this.lastJumpTime = 0;
    this.yawAngle = options.rotation?.y ?? 0;
    this.pitchAngle = 0;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
  }

  updateViewAngles(deltaTimeInSec: number): void {
    const inputManager = this.getScene().game.inputManager;
    if (!inputManager) return;

    const pointerX = inputManager.mouseHandler.getPointerX();
    const pointerY = inputManager.mouseHandler.getPointerY();
    const mouseDeltaX = pointerX - this.lastPointerX;
    const mouseDeltaY = pointerY - this.lastPointerY;
    this.lastPointerX = pointerX;
    this.lastPointerY = pointerY;

    const mouseSensitivity = this.controllerOptions.mouseSensitivity ?? DEFAULT_OPTIONS.mouseSensitivity;
    const gamepadLookSpeed = this.controllerOptions.gamepadLookSpeed ?? DEFAULT_OPTIONS.gamepadLookSpeed;
    this.yawAngle -= mouseDeltaX * mouseSensitivity;
    this.pitchAngle -= mouseDeltaY * mouseSensitivity;
    this.yawAngle -= inputManager.readLookHorizontalAxis() * gamepadLookSpeed * deltaTimeInSec;
    this.pitchAngle -= inputManager.readLookVerticalAxis() * gamepadLookSpeed * deltaTimeInSec;
    this.pitchAngle = clamp(
      this.pitchAngle,
      this.controllerOptions.minPitch ?? DEFAULT_OPTIONS.minPitch,
      this.controllerOptions.maxPitch ?? DEFAULT_OPTIONS.maxPitch,
    );

    this.threeJSGroup.userData.pixlLookYaw = this.yawAngle;
    this.threeJSGroup.userData.pixlLookPitch = this.pitchAngle;
  }

  getDesiredYaw(): number {
    return this.yawAngle;
  }

  getDesiredPitch(): number {
    return this.pitchAngle;
  }

  getDesiredTranslation(deltaTimeInSec: number): THREE.Vector3 {
    const inputManager = this.getScene().game.inputManager;
    if (!inputManager) return new THREE.Vector3();

    const movementSpeed = inputManager.isCrouchPressed()
      ? (this.controllerOptions.crouchSpeed ?? DEFAULT_OPTIONS.crouchSpeed)
      : inputManager.isSprintPressed()
      ? (this.controllerOptions.runningSpeed ?? DEFAULT_OPTIONS.runningSpeed)
      : (this.controllerOptions.walkingSpeed ?? DEFAULT_OPTIONS.walkingSpeed);

    const desired = new THREE.Vector3(
      inputManager.readHorizontalAxis(),
      0,
      inputManager.readVerticalAxis(),
    );
    if (desired.lengthSq() > 0) {
      desired.normalize().multiplyScalar(movementSpeed * deltaTimeInSec);
    }
    return desired;
  }

  rayCastToGround(): RAPIER.RayColliderHit | null {
    const rapierWorld = this.getScene().rapierWorld;
    if (!rapierWorld) return null;

    const rigidBody = this.getComponent(RigidBodyComponent)?.getRapierRigidBody();
    if (!rigidBody) return null;

    let currentPosition: RAPIER.Vector;
    try {
      currentPosition = rigidBody.translation();
    } catch {
      return null;
    }
    const capsuleHalfHeight = 0.45 + 0.4;
    const rayOrigin = {
      x: currentPosition.x,
      y: currentPosition.y - capsuleHalfHeight - 0.01,
      z: currentPosition.z,
    };
    const rayDirection = { x: 0, y: -1, z: 0 };
    const ray = new RapierNs.Ray(rayOrigin, rayDirection);
    try {
      return rapierWorld.castRayAndGetNormal(ray, 1, true);
    } catch {
      return null;
    }
  }

  isOnGround(threshold = 0.3): boolean {
    const hit = this.rayCastToGround();
    return hit ? (hit as { timeOfImpact: number }).timeOfImpact < threshold : false;
  }
}

export default CharacterController;
