import { describe, expect, it } from 'vitest';

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
});
