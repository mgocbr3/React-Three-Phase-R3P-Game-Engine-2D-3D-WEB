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
    expect(project.assets.entries[0].name).toBe('tree.glb');
    expect(project.assets.entries[0].url).toBe('/models/tree.glb');
    expect(project.assets.entries[0].metadata).toMatchObject({
      sourceObjectId: 'tree-01',
      sourceObjectName: 'Tree 01',
    });
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

  it('uses file names for scene-derived Project assets in the editor', () => {
    const project = createProjectDocumentFromEditorState({
      gameScript: '// test',
      transformSpace: 'world',
      snapEnabled: true,
      snapTranslate: 0.5,
      snapRotate: 15,
      snapScale: 0.1,
      objects: [modelObject],
    }, {
      name: 'Asset Display Name',
    });

    project.assets.entries[0].name = 'Tree 01';
    delete project.assets.entries[0].metadata?.sourceObjectName;

    const snapshot = createEditorSnapshotFromProjectDocument(project);

    expect(snapshot.projectAssets[0].name).toBe('tree.glb');
    expect(snapshot.projectAssets[0].metadata).toMatchObject({
      sourceObjectName: 'Tree 01',
    });
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

  it('upgrades old starter arena scale and mannequin facing on load', () => {
    const normalized = normalizeProjectDocument({
      format: 'pixlplayground-project',
      version: 2,
      id: 'starter',
      slug: 'starter',
      name: 'Starter',
      activeSceneId: 'main',
      engine: { name: 'PixlPlayground', version: '0.2.0' },
      runtime: { primary: 'three-3d', renderers: ['three'], physics: ['rapier'] },
      game: { templateId: null },
      scenes: [{
        id: 'main',
        name: 'Main',
        kind: '3d',
        rootObjects: [
          {
            id: 'ground-1',
            name: 'Ground',
            type: 'box',
            transform: { position: [0, -0.1, 0], rotation: [0, 0, 0], scale: [72, 0.2, 72] },
            components: [{ id: 'physics', type: 'pixl.physics', enabled: true, data: { colliders: [{ type: 'cuboid', hx: 36, hy: 0.1, hz: 36 }] } }],
          },
          {
            id: 'main-player',
            name: 'Player',
            type: 'player',
            transform: { position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
            components: [
              { id: 'entity', type: 'pixl.entity', enabled: true, data: { modelRotationOffset: [0, 0, 0] } },
              { id: 'anim', type: 'pixl.animation', enabled: true, data: { modelUrl: '/models/manequin/mixamo/xbot.glb' } },
            ],
          },
        ],
      }],
    } as any);
    const ground = normalized.scenes[0].rootObjects.find((object) => object.id === 'ground-1');
    const player = normalized.scenes[0].rootObjects.find((object) => object.id === 'main-player');

    expect(ground?.transform.scale).toEqual([160, 0.2, 160]);
    expect(ground?.components.find((component) => component.type === 'pixl.physics')?.data.colliders).toEqual([
      expect.objectContaining({ hx: 80, hy: 0.1, hz: 80 }),
    ]);
    expect(player?.components.find((component) => component.type === 'pixl.entity')?.data.modelRotationOffset).toEqual([0, Math.PI, 0]);
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

  it('does not auto-generate 3D components for inferred 2D objects', () => {
    const project = createProjectDocumentFromEditorState({
      gameScript: '// 2d inferred',
      transformSpace: 'world',
      snapEnabled: false,
      snapTranslate: 1,
      snapRotate: 15,
      snapScale: 0.25,
      activeSceneKind: '2d',
      objects: [
        {
          id: 'square-1',
          name: 'Square 1',
          type: 'rectangle',
          position: [400, 300, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: '#4aa3ff',
          visible: true,
          locked: false,
          components: [
            {
              id: 'legacy-visual',
              type: 'pixl.visual',
              enabled: true,
              data: { opacity: 1 },
            },
          ],
          visualSettings: {
            textureUrl: '',
            textureRepeat: [1, 1],
            textureOffset: [0, 0],
            textureRotation: 0,
            textureFlipY: false,
            textureAutoScale: true,
            textureFilter: undefined,
            opacity: 1,
            metalness: 0.3,
            roughness: 0.5,
            emissiveIntensity: 0,
            wireframe: false,
            castShadow: false,
            receiveShadow: false,
          },
          physicsSettings: {
            bodyType: 'fixed',
            mass: 1,
            friction: 0.5,
            restitution: 0.2,
            colliderShape: 'cuboid',
            linearDamping: 0,
            angularDamping: 0,
            isSensor: false,
          },
          logicSettings: {
            tags: ['ui'],
            behavior: 'none',
            behaviorSpeed: 1,
            patrolDistance: 5,
            customData: {},
          },
          data: {
            width: 64,
            height: 64,
            color: '#4aa3ff',
          },
        },
      ],
    }, {
      name: '2D Inferred Components',
    });

    const components = project.scenes[0].rootObjects[0].components?.map((component) => component.type) ?? [];

    expect(project.scenes[0].kind).toBe('2d');
    expect(components).not.toContain('pixl.visual');
    expect(components).not.toContain('pixl.physics');
    expect(components).not.toContain('pixl.logic');
    expect(components).not.toContain('pixl.light3d');
  });

  it('normalizes duplicate asset ids from imported documents', () => {
    const project = createProjectDocumentFromEditorState({
      gameScript: '// assets',
      transformSpace: 'world',
      snapEnabled: false,
      snapTranslate: 1,
      snapRotate: 15,
      snapScale: 0.25,
      activeSceneKind: '3d',
      objects: [],
    }, {
      name: 'Duplicate Assets',
    });

    project.assets.entries = [
      {
        id: 'asset-1',
        name: 'A',
        kind: 'image',
        path: 'Assets/A.png',
        url: 'Assets/A.png',
        tags: [],
      },
      {
        id: 'asset-1',
        name: 'B',
        kind: 'image',
        path: 'Assets/B.png',
        url: 'Assets/B.png',
        tags: [],
      },
    ];

    const snapshot = createEditorSnapshotFromProjectDocument(project);
    expect(snapshot.projectAssets.map((asset) => asset.id)).toEqual(['asset-1', 'asset-1-2']);
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
