import { describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';

import Scene from '../Scene.js';
import KinematicCharacterController from './KinematicCharacterController.js';

const makeInputManager = (verticalAxis: number) => ({
  mouseHandler: {
    getPointerX: () => 0,
    getPointerY: () => 0,
  },
  readHorizontalAxis: () => 0,
  readVerticalAxis: () => verticalAxis,
  readLookHorizontalAxis: () => 0,
  readLookVerticalAxis: () => 0,
  isSprintPressed: () => false,
  isCrouchPressed: () => false,
  isJumpPressed: () => false,
});

describe('KinematicCharacterController fallback movement', () => {
  it('moves horizontally without falling through the floor when Rapier KCC throws', async () => {
    await RAPIER.init();
    const scene = new Scene({
      inputManager: makeInputManager(-1),
      gameOptions: { disablePhysics: false },
      getGameObjectClass: () => null,
    } as never);
    scene.rapierWorld = new RAPIER.World({ x: 0, y: -9.8, z: 0 });

    const player = new KinematicCharacterController(scene, {
      type: 'player',
      name: 'Player',
      position: { x: 0, y: 1, z: 0 },
    });
    await player.load();
    player.afterLoaded();
    expect(player.rapierCharacterController).not.toBeNull();
    player.rapierCharacterController!.computeColliderMovement = () => {
      throw new Error('unreachable');
    };

    player.beforeRender({ deltaTimeInSec: 1 / 60 });

    expect(player.threeJSGroup.position.y).toBe(1);
    expect(player.threeJSGroup.position.z).toBeLessThan(0);
    expect(player.threeJSGroup.userData.pixlLocomotionState).toMatchObject({
      moving: true,
      grounded: true,
      fallbackReason: 'unreachable',
    });
  });
});