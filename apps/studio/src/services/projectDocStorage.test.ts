import { describe, expect, it } from 'vitest';

import { createEmptyProjectDocument } from './projectDocStorage';

describe('createEmptyProjectDocument', () => {
  it('seeds blank 3D projects with a Unity-like starter scene', () => {
    const doc = createEmptyProjectDocument({
      id: 'project-blank-3d',
      name: 'Blank 3D',
      kind: '3d',
      createdAt: 100,
    });
    const scene = doc.scenes[0];
    const names = scene.rootObjects.map((object) => object.name);

    expect(doc.runtime.primary).toBe('three-3d');
    expect(scene.kind).toBe('3d');
    expect(names).toEqual(['Sun Light', 'Main Camera', 'Player', 'Ground']);
    expect(scene.rootObjects.find((object) => object.name === 'Main Camera')?.components).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'pixl.camera3d' })]),
    );
    expect(scene.rootObjects.find((object) => object.name === 'Player')?.components).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'pixl.player' })]),
    );
  });
});
