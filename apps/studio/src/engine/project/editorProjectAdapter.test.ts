import {
  createEditorSnapshotFromProjectDocument,
  createProjectDocumentFromEditorState,
  normalizeProjectDocument,
} from './editorProjectAdapter';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SceneObject } from '@/stores/editorStore';
import type { LegacyPixlProjectDocument } from './schema';

const modelObject: SceneObject = {
  id: 'tree-01',
  name: 'Tree 01',
  type: 'box',
  position: [2, 0, -3],
  rotation: [0, 1.2, 0],
  scale: [1.5, 1.5, 1.5],
  color: '#ffffff',
  visible: true,
  locked: false,
  animationSettings: {
    modelUrl: '/models/tree.glb',
    availableAnimations: [],
    autoPlay: false,
    loop: true,
    speed: 1,
    crossFadeDuration: 0.3,
    paused: false,
    currentTime: 0,
  },
};

describe('editor project adapter', () => {
  it('roundtrips editor objects through the PixlPlayground project schema', () => {
    const project = createProjectDocumentFromEditorState({
      gameScript: '// test',
      transformSpace: 'world',
      snapEnabled: true,
      snapTranslate: 0.5,
      snapRotate: 15,
      snapScale: 0.1,
      objects: [modelObject],
    }, {
      name: 'Roundtrip',
    });

    const snapshot = createEditorSnapshotFromProjectDocument(project);

    expect(project.version).toBe(2);
    expect(project.runtime.primary).toBe('three-3d');
    // One-runtime-per-game rule (engine/ARCHITECTURE.md): a 3D project ships
    // Three.js + Rapier only; Phaser is never bundled into a 3D player.
    expect(project.runtime.renderers).toEqual(['three']);
    expect(project.runtime.physics).toEqual(['rapier']);
    expect(project.scenes[0].rootObjects).toHaveLength(1);
    expect(project.scenes[0].rootObjects[0].data?.editorObject).toBeUndefined();
    expect(project.scenes[0].rootObjects[0].data?.editor).toEqual({ color: '#ffffff' });
    expect(project.assets.entries[0].url).toBe('/models/tree.glb');
    expect(snapshot.objects[0].color).toBe('#ffffff');
    expect(snapshot.objects[0].animationSettings?.modelUrl).toBe('/models/tree.glb');
    expect(snapshot.snapTranslate).toBe(0.5);
  });

  it('restores from structured components even when a stale editorObject blob exists', () => {
    const project = createProjectDocumentFromEditorState({
      gameScript: '// test',
      transformSpace: 'world',
      snapEnabled: true,
      snapTranslate: 0.5,
      snapRotate: 15,
      snapScale: 0.1,
      objects: [modelObject],
    }, {
      name: 'Component Source',
    });

    project.scenes[0].rootObjects[0].data = {
      editorObject: {
        type: 'sphere',
        position: [99, 99, 99],
        animationSettings: {
          modelUrl: '/models/stale.glb',
        },
      },
    };

    const snapshot = createEditorSnapshotFromProjectDocument(project);

    expect(snapshot.objects[0].type).toBe('box');
    expect(snapshot.objects[0].position).toEqual([2, 0, -3]);
    expect(snapshot.objects[0].animationSettings?.modelUrl).toBe('/models/tree.glb');
  });

  it('migrates legacy flat project files into version 2', () => {
    const legacy: LegacyPixlProjectDocument = {
      format: 'pixlplayground-project',
      version: 1,
      id: 'legacy',
      name: 'Legacy',
      savedAt: 1,
      currentTemplateId: null,
      gameScript: '// legacy',
      transformSpace: 'local',
      snapEnabled: false,
      snapTranslate: 1,
      snapRotate: 15,
      snapScale: 0.25,
      objects: [modelObject],
      assets: {
        folders: ['Assets'],
      },
    };

    const migrated = normalizeProjectDocument(legacy);
    const snapshot = createEditorSnapshotFromProjectDocument(migrated);

    expect(migrated.version).toBe(2);
    expect(migrated.runtime.primary).toBe('three-3d');
    expect(migrated.runtime.physics).toEqual(['rapier']);
    expect(migrated.name).toBe('Legacy');
    expect(snapshot.objects[0].id).toBe('tree-01');
    expect(snapshot.transformSpace).toBe('local');
  });

  it('normalizes lightweight v2 scene documents before feeding the editor', () => {
    const minimalModernProject = {
      format: 'pixlplayground-project',
      version: 2,
      id: 'primitive-demo',
      slug: 'primitive-demo',
      name: 'Primitive Demo (3D)',
      activeSceneId: 'arena',
      engine: { name: 'PixlPlayground', version: '0.2.0' },
      runtime: { primary: 'three-3d', renderers: ['three'], physics: ['rapier'] },
      scenes: [{
        id: 'arena',
        name: 'Arena',
        kind: '3d',
        rootObjects: [{
          id: 'ground',
          name: 'Ground',
          type: 'group',
          transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: [{ id: 'ground-mesh', type: 'pixl.primitive', enabled: true, data: { shape: 'box' } }],
        }],
      }],
      game: { templateId: null },
    };

    const normalized = normalizeProjectDocument(minimalModernProject as any);
    const snapshot = createEditorSnapshotFromProjectDocument(normalized);

    expect(normalized.assets.entries).toEqual([]);
    expect(normalized.editor.selectedSceneId).toBe('arena');
    expect(normalized.scenes[0].units).toBe('meters');
    expect(snapshot.activeSceneKind).toBe('3d');
    expect(snapshot.objects).toHaveLength(1);
    expect(snapshot.objects[0]).toMatchObject({
      id: 'ground',
      name: 'Ground',
      type: 'group',
      components: [expect.objectContaining({ type: 'pixl.primitive' })],
    });
  });

  it('preserves 2D schema objects, raw render data, components and project assets', () => {
    const project = createProjectDocumentFromEditorState({
      gameScript: '// 2d',
      transformSpace: 'world',
      snapEnabled: false,
      snapTranslate: 1,
      snapRotate: 15,
      snapScale: 0.25,
      activeSceneKind: '2d',
      objects: [
        {
          id: 'hero',
          name: 'Hero Sprite',
          type: 'sprite',
          position: [120, 180, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: '#ffffff',
          visible: true,
          locked: false,
          components: [
            {
              id: 'hero-physics',
              type: 'pixl.physics2d',
              enabled: true,
              data: { bodyType: 'dynamic' },
            },
          ],
          data: {
            imageUrl: 'Assets/Sprites/hero.png',
            frameWidth: 32,
            frameHeight: 48,
            depth: 10,
          },
        },
      ],
    }, {
      name: '2D Roundtrip',
    });

    const snapshot = createEditorSnapshotFromProjectDocument(project);

    expect(project.runtime.primary).toBe('phaser-2d');
    expect(project.runtime.renderers).toEqual(['phaser']);
    expect(project.runtime.physics).toEqual(['arcade']);
    expect(project.scenes[0].kind).toBe('2d');
    expect(project.scenes[0].units).toBe('pixels');
    expect(project.assets.entries[0]).toMatchObject({
      kind: 'spritesheet',
      path: 'Assets/Sprites/hero.png',
    });
    expect(snapshot.activeSceneKind).toBe('2d');
    expect(snapshot.projectAssets[0]).toMatchObject({
      type: 'spritesheet',
      url: 'Assets/Sprites/hero.png',
    });
    expect(snapshot.objects[0].type).toBe('sprite');
    expect(snapshot.objects[0].data?.imageUrl).toBe('Assets/Sprites/hero.png');
    expect(snapshot.objects[0].components?.[0].type).toBe('pixl.physics2d');
  });

  it('serializes parented editor objects as a scene tree and restores a flat editor hierarchy', () => {
    const project = createProjectDocumentFromEditorState({
      gameScript: '// hierarchy',
      transformSpace: 'world',
      snapEnabled: false,
      snapTranslate: 1,
      snapRotate: 15,
      snapScale: 0.25,
      activeSceneKind: '2d',
      objects: [
        {
          id: 'party',
          name: 'Party',
          type: 'group',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: '#ffffff',
          visible: true,
          locked: false,
        },
        {
          id: 'hero',
          parentId: 'party',
          name: 'Hero',
          type: 'sprite',
          position: [64, 96, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: '#ffffff',
          visible: true,
          locked: false,
          components: [
            {
              id: 'hero-physics',
              type: 'pixl.physics2d',
              enabled: true,
              data: { bodyType: 'dynamic' },
            },
          ],
          data: {
            imageUrl: 'Assets/Sprites/hero.png',
          },
        },
      ],
    }, {
      name: 'Hierarchy',
    });

    const root = project.scenes[0].rootObjects[0];
    const child = root.children?.[0];
    const snapshot = createEditorSnapshotFromProjectDocument(project);

    expect(project.scenes[0].rootObjects).toHaveLength(1);
    expect(root.id).toBe('party');
    expect(root.parentId).toBeNull();
    expect(child).toMatchObject({
      id: 'hero',
      parentId: 'party',
      components: [
        expect.objectContaining({ type: 'pixl.physics2d' }),
      ],
    });
    expect(snapshot.objects.map((object) => object.id)).toEqual(['party', 'hero']);
    expect(snapshot.objects[1].parentId).toBe('party');
    expect(snapshot.objects[1].components?.[0].type).toBe('pixl.physics2d');
  });

  it('keeps the bundled Harvest Rush sample portable across machines', () => {
    const samplePath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../public/sample-projects/harvest-rush-3d/project.pixlproject.json',
    );
    const sampleText = fs.readFileSync(samplePath, 'utf8');
    const sample = JSON.parse(sampleText);

    // Portability rule (ef4ac754 fix(engine): resolve local project assets
    // portably): no machine-specific Vite @fs URLs, no Windows/Unix absolute
    // paths, no host-rooted prefixes. Asset URLs must be relative to the
    // project folder so a .pixl is openable on any other machine.
    expect(sampleText).not.toMatch(/@fs|C:\\|C:\//);
    expect(sample.runtime.physics).toEqual(['rapier']);
    expect(sample.assets.entries.every((asset: { url?: string }) => {
      if (!asset.url) return true;
      // Allow protocol-prefixed URLs (https://, blob:, data:) and project-
      // relative paths; reject any path starting with a single '/'.
      if (/^[a-z][a-z0-9+.-]*:/i.test(asset.url)) return true;
      return !asset.url.startsWith('/');
    })).toBe(true);
  });
});
