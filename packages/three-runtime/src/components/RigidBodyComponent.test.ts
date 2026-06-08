import { describe, expect, it, vi } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';

import GameObject from '../GameObject.js';
import RigidBodyComponent from './RigidBodyComponent.js';

const makeObjectWithPhysicsFlag = (disablePhysics: boolean) => {
  const scene = {
    rapierWorld: null,
    game: { gameOptions: { disablePhysics } },
    addGameObject: () => {},
    isActive: () => false,
  };
  return new GameObject(scene as never, { name: 'Physics Object' });
};

const makeObjectWithRapierWorld = (removeRigidBody = vi.fn()) => {
  const scene = {
    rapierWorld: { removeRigidBody },
    game: { gameOptions: {} },
    addGameObject: () => {},
    isActive: () => false,
  };
  return {
    object: new GameObject(scene as never, { name: 'Physics Object' }),
    removeRigidBody,
  };
};

describe('RigidBodyComponent', () => {
  it('skips rigid body creation when scene physics are disabled', () => {
    const object = makeObjectWithPhysicsFlag(true);
    const component = new RigidBodyComponent(object, {
      type: 'rigidBody',
      rigidBodyType: 'fixed',
      colliders: [{ type: 'cuboid', hx: 1, hy: 1, hz: 1 }],
    });

    expect(() => component.load()).not.toThrow();
    expect(component.getRapierRigidBody()).toBeNull();
  });

  it('removes the Rapier rigid body on unload', () => {
    const { object, removeRigidBody } = makeObjectWithRapierWorld();
    const component = new RigidBodyComponent(object, {
      type: 'rigidBody',
      rigidBodyType: 'fixed',
      colliders: [],
    });
    const body = { handle: 1 };
    component.rapierRigidBody = body as never;

    component.unload();

    expect(removeRigidBody).toHaveBeenCalledWith(body);
    expect(component.getRapierRigidBody()).toBeNull();
  });

  it('keeps scene loading when Rapier collider creation throws', async () => {
    await RAPIER.init();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const body = {
      setTranslation: vi.fn(),
      setRotation: vi.fn(),
    };
    const scene = {
      rapierWorld: {
        createRigidBody: vi.fn(() => body),
        createCollider: vi.fn(() => {
          throw new Error('unreachable');
        }),
        removeRigidBody: vi.fn(),
      },
      game: { gameOptions: {} },
      addGameObject: () => {},
      isActive: () => false,
    };
    const object = new GameObject(scene as never, { name: 'Bad Collider' });
    const component = new RigidBodyComponent(object, {
      type: 'rigidBody',
      rigidBodyType: 'fixed',
      colliders: [{ type: 'cuboid', hx: 1, hy: 1, hz: 1 }],
    });

    try {
      expect(() => component.load()).not.toThrow();
      expect(component.getRapierRigidBody()).toBe(body);
      expect(object.threeJSGroup.userData.pixlPhysicsDebug).toBe('collider-cuboid: unreachable');
    } finally {
      warn.mockRestore();
    }
  });
});
