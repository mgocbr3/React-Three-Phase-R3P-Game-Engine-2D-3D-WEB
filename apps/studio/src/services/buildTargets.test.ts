import { describe, expect, it } from 'vitest';

import { analyzeBuildReadiness, createBuildTargetSummary } from './buildTargets';
import type { PixlProjectDocument } from '@/engine/project/schema';

const buildProject = (kind: '2d' | '3d'): PixlProjectDocument => ({
  format: 'pixlplayground-project',
  version: 2,
  id: 'sample',
  slug: 'sample-project',
  name: 'Sample Project',
  createdAt: 1770000000000,
  savedAt: 1770000000000,
  engine: { name: 'PixlPlayground', version: '0.2.0', schemaVersion: 2 },
  runtime: {
    primary: kind === '2d' ? 'phaser-2d' : 'three-3d',
    renderers: [kind === '2d' ? 'phaser' : 'three'],
    physics: ['rapier'],
  },
  activeSceneId: 'main',
  scenes: [
    {
      id: 'main',
      name: 'Main',
      kind,
      units: kind === '2d' ? 'pixels' : 'meters',
      rootObjects: [],
      camera: {
        id: 'camera',
        name: 'Camera',
        position: [0, 0, 0],
        target: [0, 0, 0],
        fov: kind === '2d' ? 0 : 50,
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
    mode: kind,
    transformSpace: 'world',
    snapEnabled: false,
    snapTranslate: 1,
    snapRotate: 15,
    snapScale: 0.25,
    selectedSceneId: 'main',
  },
  game: { templateId: null, script: '// Game Script\n' },
});

describe('createBuildTargetSummary', () => {
  it('marks Phaser as the primary target for 2D scenes', () => {
    const summary = createBuildTargetSummary(buildProject('2d'));

    expect(summary.runtimeLabel).toBe('Phaser 4');
    expect(summary.primaryTarget).toBe('phaser-web');
    expect(summary.targets.find((target) => target.id === 'phaser-web')?.availability).toBe('ready');
    expect(summary.targets.find((target) => target.id === 'three-web')?.availability).toBe('inactive-runtime');
    expect(summary.targets.find((target) => target.id === 'pixlland')?.command).toContain('export-pixlland');
    expect(summary.readiness.status).toBe('warning');
  });

  it('marks Three as the primary target for 3D scenes and uses workspace paths', () => {
    const summary = createBuildTargetSummary(buildProject('3d'), {
      directoryName: 'Farm Game',
      projectFilePath: 'pixlplayground/project.pixlproject.json',
      projectId: 'sample',
      writable: true,
    });

    expect(summary.runtimeLabel).toBe('Three.js');
    expect(summary.primaryTarget).toBe('three-web');
    expect(summary.projectPath).toBe('Farm Game/pixlplayground/project.pixlproject.json');
    expect(summary.targets.find((target) => target.id === 'three-web')?.command).toContain(
      '"Farm Game/pixlplayground/project.pixlproject.json"',
    );
  });

  it('blocks builds when runtime primary does not match scene kind', () => {
    const project = buildProject('2d');
    project.runtime.primary = 'three-3d';

    const readiness = analyzeBuildReadiness(project);

    expect(readiness.status).toBe('blocked');
    expect(readiness.errors).toBe(1);
    expect(readiness.issues[0]?.message).toContain('does not match');
  });

  it('reports invalid components and undeclared asset references', () => {
    const project = buildProject('3d');
    project.scenes[0]!.rootObjects = [
      {
        id: 'bad-sprite',
        name: 'Bad Sprite',
        type: 'sprite',
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        visible: true,
        locked: false,
        tags: [],
        components: [
          {
            id: 'sprite',
            type: 'pixl.sprite',
            enabled: true,
            data: { texturePath: 'Assets/Sprites/hero.png' },
          },
          {
            id: 'mystery',
            type: 'pixl.mystery',
            enabled: true,
            data: {},
          },
        ],
      },
    ];

    const readiness = analyzeBuildReadiness(project);

    expect(readiness.status).toBe('blocked');
    expect(readiness.errors).toBe(1);
    expect(readiness.warnings).toBe(2);
    expect(readiness.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      '2D component "pixl.sprite" in 3D scene.',
      'Unknown component type "pixl.mystery".',
      'Asset reference is not declared: Assets/Sprites/hero.png',
    ]));
  });

  it('accepts primitive mesh components in 3D scenes', () => {
    const project = buildProject('3d');
    project.scenes[0]!.rootObjects = [
      {
        id: 'box',
        name: 'Box',
        type: 'group',
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        visible: true,
        locked: false,
        tags: [],
        components: [
          {
            id: 'box-primitive',
            type: 'pixl.primitive',
            enabled: true,
            data: { shape: 'box', size: { x: 1, y: 1, z: 1 } },
          },
        ],
      },
    ];

    const readiness = analyzeBuildReadiness(project);

    expect(readiness.status).toBe('ready');
    expect(readiness.issues).toEqual([]);
  });

  it('reports legacy editorObject data through the shared document invariant audit', () => {
    const project = buildProject('3d');
    project.scenes[0]!.rootObjects = [
      {
        id: 'legacy-group',
        name: 'Legacy Group',
        type: 'group',
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        visible: true,
        locked: false,
        tags: [],
        components: [],
        children: [
          {
            id: 'legacy-child',
            name: 'Legacy Child',
            type: 'box',
            transform: {
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
            },
            visible: true,
            locked: false,
            tags: [],
            components: [],
            data: { editorObject: { id: 'legacy-child' } },
          },
        ],
      } as PixlProjectDocument['scenes'][number]['rootObjects'][number],
    ];

    const readiness = analyzeBuildReadiness(project);

    expect(readiness.status).toBe('warning');
    expect(readiness.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: '$.scenes[0].rootObjects[0].children[0].data.editorObject',
        message: 'Object "Legacy Child" still carries legacy editorObject data.',
      }),
    ]));
  });

  it('allows shared components in either scene family', () => {
    const project = buildProject('2d');
    project.scenes[0]!.rootObjects = [
      {
        id: 'speaker',
        name: 'Speaker',
        type: 'image',
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        visible: true,
        locked: false,
        tags: [],
        components: [
          {
            id: 'speaker-audio',
            type: 'pixl.audio',
            enabled: true,
            data: {},
          },
          {
            id: 'speaker-script',
            type: 'pixl.script',
            enabled: true,
            data: {},
          },
        ],
      },
    ];

    const readiness = analyzeBuildReadiness(project);

    expect(readiness.issues.map((issue) => issue.message)).not.toContain('3D component "pixl.audio" in 2D scene.');
    expect(readiness.issues.map((issue) => issue.message)).not.toContain('3D component "pixl.script" in 2D scene.');
  });
});
