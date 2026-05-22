// Adapted from tools/vendor/three-game-engine/src/util/DynamicCharacterController.ts
// (MIT, WesUnwin/three-game-engine).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import CharacterController from './CharacterController.js';
import RigidBodyComponent from '../components/RigidBodyComponent.js';
import type GameObject from '../GameObject.js';
import type { CharacterControllerOptions, GameObjectOptions } from '../types.js';

const DEFAULT_CAPSULE = { halfHeight: 0.45, radius: 0.4, density: 500 };

class DynamicCharacterController extends CharacterController {
  jumpImpulse: number;

  constructor(
    parent: GameObject['parent'],
    options: GameObjectOptions = {},
    controllerOptions: CharacterControllerOptions = {},
  ) {
    super(
      parent,
      {
        ...options,
        components: [
          {
            type: 'rigidBody',
            rigidBodyType: 'dynamic',
            colliders: [
              { type: 'capsule', ...DEFAULT_CAPSULE, ...(controllerOptions.capsule ?? {}) },
            ],
            enabledRotations: { x: false, y: true, z: false },
          },
          ...(options.components ?? []),
        ],
      },
      controllerOptions,
    );
    this.jumpImpulse = 1300;
  }

  beforeRender(ctx: { deltaTimeInSec: number }): void {
    super.beforeRender(ctx);
    if (!this.isLoaded()) return;

    const inputManager = this.getScene().game.inputManager;
    if (!inputManager) return;
    const keyboard = inputManager.keyboardHandler;
    const time = performance.now();

    const rigidBody = this.getComponent(RigidBodyComponent)?.getRapierRigidBody();
    if (!rigidBody) return;

    const yawAngle = this.getDesiredYaw();
    const pitchAngle = this.getDesiredPitch();
    const desiredRotation = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(pitchAngle, yawAngle, 0, 'YXZ'));
    rigidBody.setRotation(
      { x: desiredRotation.x, y: desiredRotation.y, z: desiredRotation.z, w: desiredRotation.w },
      true,
    );

    const desired = this.getDesiredTranslation(ctx.deltaTimeInSec);
    desired.applyQuaternion(desiredRotation);
    desired.multiplyScalar(400);
    rigidBody.applyImpulse({ x: desired.x, y: desired.y, z: desired.z }, true);

    if (keyboard.isKeyDown(' ')) {
      const timeSinceLastJump = time - this.lastJumpTime;
      const cooldown = this.controllerOptions.jumpCooldown ?? 1000;
      if (timeSinceLastJump > cooldown) {
        const rapierWorld = this.getScene().rapierWorld;
        if (!rapierWorld) return;
        const currentPosition = rigidBody.translation();
        const capsule = this.controllerOptions.capsule ?? DEFAULT_CAPSULE;
        const rayOrigin = {
          x: currentPosition.x,
          y: currentPosition.y - (capsule.halfHeight ?? DEFAULT_CAPSULE.halfHeight) - (capsule.radius ?? DEFAULT_CAPSULE.radius) - 0.05,
          z: currentPosition.z,
        };
        const ray = new RAPIER.Ray(rayOrigin, { x: 0, y: -0.1, z: 0 });
        const groundHit = rapierWorld.castRay(ray, 0.01, true);
        const isFalling = rigidBody.linvel().y < -0.1;
        if (groundHit && !isFalling) {
          rigidBody.applyImpulse({ x: 0, y: this.jumpImpulse, z: 0 }, true);
          this.lastJumpTime = time;
        }
      }
    }
  }
}

export default DynamicCharacterController;
