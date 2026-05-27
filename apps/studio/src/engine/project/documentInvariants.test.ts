import { describe, expect, it } from 'vitest';

import type { PixlProjectDocument } from './schema';
import { findLegacyEditorObjectData, hasLegacyEditorObjectData } from './documentInvariants';

const projectWithObjects = (rootObjects: PixlProjectDocument['scenes'][number]['rootObjects']): PixlProjectDocument => ({
  format: 'pixlplayground-project',
  version: 2,
  id: 'project-invariants',
  slug: 'project-invariants',
  name: 'Project Invariants',
  createdAt: 1,
  savedAt: 2,
  engine: { name: 'PixlPlayground', version: '0.2.0', schemaVersion: 2 },
  runtime: { primary: 'three-3d', renderers: ['three'], physics: ['rapier'] },
  activeSceneId: 'main',
  scenes: [
    {
      id: 'main',
      name: 'Main',
      kind: '3d',
      units: 'meters',
      rootObjects,
      camera: {
        id: 'camera',
        name: 'Camera',
        position: [0, 0, 0],
        target: [0, 0, 0],
        fov: 50,
        near: 0.1,
        far: 1000,
      },
      environment: {
        background: '#000000',
        ambientLight: '#ffffff',
        ambientIntensity: 1,
        sunColor: '#ffffff',
        sunIntensity: 1,
      },
      physics: { engine: 'rapier', gravity: [0, -9.81, 0] },
    },
  ],
  assets: { root: 'Assets', folders: [], entries: [] },
  editor: {
    mode: '3d',
    transformSpace: 'world',
    snapEnabled: false,
    snapTranslate: 1,
    snapRotate: 15,
    snapScale: 0.25,
    selectedSceneId: 'main',
  },
  game: { templateId: null, script: '// Game Script\n' },
});

describe('document invariants', () => {
  it('reports legacy editorObject data on root and child objects', () => {
    const project = projectWithObjects([
      {
        id: 'root',
        name: 'Root',
        type: 'group',
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        visible: true,
        locked: false,
        tags: [],
        components: [],
        data: { editorObject: { id: 'root' } },
        children: [
          {
            id: 'child',
            name: 'Child',
            type: 'box',
            transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
            visible: true,
            locked: false,
            tags: [],
            components: [],
            data: { editorObject: { id: 'child' } },
          },
        ],
      } as PixlProjectDocument['scenes'][number]['rootObjects'][number],
    ]);

    const issues = findLegacyEditorObjectData(project);

    expect(hasLegacyEditorObjectData(project)).toBe(true);
    expect(issues.map((issue) => issue.path)).toEqual([
      '$.scenes[0].rootObjects[0].data.editorObject',
      '$.scenes[0].rootObjects[0].children[0].data.editorObject',
    ]);
  });

  it('accepts schema-owned data without legacy editorObject blobs', () => {
    const project = projectWithObjects([
      {
        id: 'sprite',
        name: 'Sprite',
        type: 'sprite',
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        visible: true,
        locked: false,
        tags: [],
        components: [{ id: 'sprite-component', type: 'pixl.sprite', enabled: true, data: { textureId: 'hero' } }],
        data: { imageUrl: 'Assets/Sprites/hero.png' },
      },
    ]);

    expect(findLegacyEditorObjectData(project)).toEqual([]);
    expect(hasLegacyEditorObjectData(project)).toBe(false);
  });
});
