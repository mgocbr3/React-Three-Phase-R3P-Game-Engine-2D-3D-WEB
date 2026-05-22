// Adapted from tools/vendor/three-game-engine/src/util/CharacterController.ts
// (MIT, WesUnwin/three-game-engine).

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import RapierNs from '@dimforge/rapier3d-compat';

import GameObject from '../GameObject.js';
import RigidBodyComponent from '../components/RigidBodyComponent.js';
import type { CharacterControllerOptions, GameObjectOptions } from '../types.js';

const DEFAULT_OPTIONS: Required<Pick<CharacterControllerOptions, 'walkingSpeed' | 'runningSpeed' | 'jumpCooldown'>> = {
  walkingSpeed: 2,
  runningSpeed: 4,
  jumpCooldown: 1000,
};

class CharacterController extends GameObject {
  controllerOptions: CharacterControllerOptions;
  lastJumpTime: number;

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
  }

  getDesiredYaw(): number {
    const inputManager = this.getScene().game.inputManager;
    return (inputManager?.mouseHandler.getPointerX() ?? 0) / -250.0;
  }

  getDesiredPitch(): number {
    const inputManager = this.getScene().game.inputManager;
    return (inputManager?.mouseHandler.getPointerY() ?? 0) / -250.0;
  }

  getDesiredTranslation(deltaTimeInSec: number): THREE.Vector3 {
    const inputManager = this.getScene().game.inputManager;
    if (!inputManager) return new THREE.Vector3();

    const keyboard = inputManager.keyboardHandler;
    const movementSpeed = keyboard.isShiftDown()
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

    const currentPosition = rigidBody.translation();
    const capsuleHalfHeight = 0.45 + 0.4;
    const rayOrigin = {
      x: currentPosition.x,
      y: currentPosition.y - capsuleHalfHeight - 0.01,
      z: currentPosition.z,
    };
    const rayDirection = { x: 0, y: -1, z: 0 };
    const ray = new RapierNs.Ray(rayOrigin, rayDirection);
    return rapierWorld.castRayAndGetNormal(ray, 1, true);
  }

  isOnGround(threshold = 0.3): boolean {
    const hit = this.rayCastToGround();
    return hit ? (hit as { timeOfImpact: number }).timeOfImpact < threshold : false;
  }
}

export default CharacterController;
