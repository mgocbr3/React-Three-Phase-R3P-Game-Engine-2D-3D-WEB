import { describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';

import Scene from '../Scene.js';
import RigidBodyComponent from '../components/RigidBodyComponent.js';
import KinematicCharacterController from './KinematicCharacterController.js';

const makeInputManager = (verticalAxis: number, horizontalAxis = 0) => ({
  mouseHandler: {
    getPointerX: () => 0,
    getPointerY: () => 0,
  },
  readHorizontalAxis: () => horizontalAxis,
  readVerticalAxis: () => verticalAxis,
  readLookHorizontalAxis: () => 0,
  readLookVerticalAxis: () => 0,
  isSprintPressed: () => false,
  isCrouchPressed: () => false,
  isJumpPressed: () => false,
});

describe('KinematicCharacterController fallback movement', () => {
  it('keeps Play Mode alive when Rapier KCC setup throws', async () => {
    await RAPIER.init();
    const scene = new Scene({
      inputManager: makeInputManager(-1),
      gameOptions: { disablePhysics: false },
      getGameObjectClass: () => null,
    } as never);
    scene.rapierWorld = new RAPIER.World({ x: 0, y: -9.8, z: 0 });
    (scene.rapierWorld as unknown as { createCharacterController: () => never }).createCharacterController = () => {
      throw new Error('unreachable');
    };

    const player = new KinematicCharacterController(scene, {
      type: 'player',
      name: 'Player',
      position: { x: 0, y: 1, z: 0 },
    });
    await player.load();

    expect(() => player.afterLoaded()).not.toThrow();
    expect(player.rapierCharacterController).toBeNull();

    player.beforeRender({ deltaTimeInSec: 1 / 60 });

    expect(player.threeJSGroup.position.y).toBe(1);
    expect(player.threeJSGroup.position.z).toBeLessThan(0);
    expect(player.threeJSGroup.userData.pixlLocomotionState).toMatchObject({
      moving: true,
      grounded: true,
      fallbackReason: 'kinematic-fallback',
    });
    expect(player.threeJSGroup.userData.pixlControllerDebug).toBe('kinematic-fallback');
  });

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
      fallbackReason: 'kinematic-fallback',
    });
    expect(player.rapierCharacterController).toBeNull();
    expect(player.threeJSGroup.userData.pixlControllerDebug).toBe('kinematic-fallback');
  });

  it('uses visual fallback movement when Rapier rigid body creation failed', async () => {
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
    player.getComponent(RigidBodyComponent)!.rapierRigidBody = null;

    player.beforeRender({ deltaTimeInSec: 1 / 60 });

    expect(player.threeJSGroup.position.y).toBe(1);
    expect(player.threeJSGroup.position.z).toBeLessThan(0);
    expect(player.threeJSGroup.userData.pixlLocomotionState).toMatchObject({
      moving: true,
      grounded: true,
      fallbackReason: 'kinematic-fallback',
    });
    expect(player.threeJSGroup.userData.pixlControllerDebug).toBe('kinematic-fallback');
  });

  it('keeps the visible player facing the camera yaw while moving', async () => {
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
    player.rapierCharacterController!.computeColliderMovement = () => {
      throw new Error('unreachable');
    };
    (player as unknown as { yawAngle: number }).yawAngle = -Math.PI / 2;

    player.beforeRender({ deltaTimeInSec: 1 / 60 });

    expect(player.threeJSGroup.rotation.y).toBeCloseTo(-Math.PI / 2);
    expect(player.threeJSGroup.position.x).toBeGreaterThan(0);
    expect(Math.abs(player.threeJSGroup.position.z)).toBeLessThan(0.001);
  });
});
