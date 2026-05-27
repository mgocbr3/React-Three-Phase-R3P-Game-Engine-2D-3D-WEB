import { describe, expect, it } from 'vitest';

import type { PixlProjectDocument } from '@/engine/project/schema';
import { applyProjectDocumentToEditor } from './localProjectFiles';
import {
  createActiveProjectDiagnosticsSnapshot,
  createProjectDiagnosticConsoleMessages,
  createProjectDiagnostics,
} from './projectDiagnostics';

const buildProject = (kind: '2d' | '3d'): PixlProjectDocument => ({
  format: 'pixlplayground-project',
  version: 2,
  id: 'diagnostics-project',
  slug: 'diagnostics-project',
  name: 'Diagnostics Project',
  createdAt: 1770000000000,
  savedAt: 1770000000000,
  engine: { name: 'PixlPlayground', version: '0.2.0', schemaVersion: 2 },
  runtime: {
    primary: kind === '2d' ? 'phaser-2d' : 'three-3d',
    renderers: [kind === '2d' ? 'phaser' : 'three'],
    physics: [kind === '2d' ? 'arcade' : 'rapier'],
  },
  activeSceneId: 'main',
  scenes: [
    {
      id: 'main',
      name: 'Main',
      kind,
      units: kind === '2d' ? 'pixels' : 'meters',
      rootObjects: [
        {
          id: 'hero',
          name: 'Hero',
          type: kind === '2d' ? 'sprite' : 'box',
          transform: {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
          visible: true,
          locked: false,
          tags: [],
          components: kind === '2d'
            ? [
              {
                id: 'sprite',
                type: 'pixl.sprite',
                enabled: true,
                data: { imageUrl: 'Assets/Sprites/hero.png' },
              },
            ]
            : [],
          data: kind === '2d' ? { imageUrl: 'Assets/Sprites/hero.png' } : {},
        },
      ],
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
      physics: { engine: kind === '2d' ? 'arcade' : 'rapier', gravity: [0, kind === '2d' ? 980 : -9.81, 0] },
    },
  ],
  assets: {
    root: 'Assets',
    folders: ['Assets/Sprites'],
    entries: kind === '2d'
      ? [
        {
          id: 'hero-img',
          name: 'Hero',
          kind: 'sprite',
          path: 'Assets/Sprites/hero.png',
          tags: [],
        },
      ]
      : [],
  },
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

describe('project diagnostics', () => {
  it('summarizes a buildable active 2D project as ready', () => {
    const diagnostics = createProjectDiagnostics(buildProject('2d'));

    expect(diagnostics.status).toBe('ready');
    expect(diagnostics.errors).toBe(0);
    expect(diagnostics.warnings).toBe(0);
    expect(diagnostics.activeSceneName).toBe('Main');
    expect(diagnostics.sceneKind).toBe('2d');
    expect(diagnostics.runtimePrimary).toBe('phaser-2d');
    expect(diagnostics.build.primaryTarget).toBe('phaser-web');
  });

  it('groups runtime, scene, asset, and schema issues for editor surfaces', () => {
    const project = buildProject('3d');
    project.runtime.primary = 'phaser-2d';
    project.scenes[0]!.rootObjects[0]!.components = [
      {
        id: 'sprite',
        type: 'pixl.sprite',
        enabled: true,
        data: {},
      },
    ];
    project.scenes[0]!.rootObjects[0]!.data = {
      imageUrl: 'Assets/Sprites/missing.png',
      editorObject: { id: 'legacy' },
    };

    const diagnostics = createProjectDiagnostics(project);

    expect(diagnostics.status).toBe('blocked');
    expect(diagnostics.groups.map((group) => group.source)).toEqual(['runtime', 'scene', 'assets', 'schema']);
    expect(diagnostics.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'runtime', severity: 'error' }),
      expect.objectContaining({
        source: 'scene',
        message: '2D component "pixl.sprite" in 3D scene.',
        target: expect.objectContaining({ sceneId: 'main', objectId: 'hero', objectName: 'Hero' }),
      }),
      expect.objectContaining({
        source: 'assets',
        message: 'Asset reference is not declared: Assets/Sprites/missing.png',
        target: expect.objectContaining({ sceneId: 'main', objectId: 'hero', objectName: 'Hero' }),
      }),
      expect.objectContaining({
        source: 'schema',
        message: 'Object "Hero" still carries legacy editorObject data.',
        target: expect.objectContaining({ sceneId: 'main', objectId: 'hero', objectName: 'Hero' }),
      }),
    ]));
  });

  it('resolves nested child object targets from document paths', () => {
    const project = buildProject('3d');
    (project.scenes[0]!.rootObjects[0]! as PixlProjectDocument['scenes'][number]['rootObjects'][number] & {
      children: PixlProjectDocument['scenes'][number]['rootObjects'];
    }).children = [
      {
        id: 'child-sprite',
        name: 'Child Sprite',
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
            data: {},
          },
        ],
      },
    ] as PixlProjectDocument['scenes'][number]['rootObjects'];

    const diagnostics = createProjectDiagnostics(project);

    expect(diagnostics.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: '2D component "pixl.sprite" in 3D scene.',
        target: expect.objectContaining({
          sceneId: 'main',
          objectId: 'child-sprite',
          objectName: 'Child Sprite',
        }),
      }),
    ]));
  });

  it('creates diagnostics from the active editor document snapshot', () => {
    applyProjectDocumentToEditor(buildProject('2d'));

    const snapshot = createActiveProjectDiagnosticsSnapshot('Diagnostics Project');

    expect(snapshot.signature).toEqual(expect.any(String));
    expect(snapshot.diagnostics.status).toBe('ready');
    expect(snapshot.diagnostics.build.primaryTarget).toBe('phaser-web');
  });

  it('formats diagnostics as stable console messages', () => {
    const readyMessages = createProjectDiagnosticConsoleMessages(
      createProjectDiagnostics(buildProject('2d')),
      'now',
    );

    expect(readyMessages).toEqual([
      expect.objectContaining({
        type: 'info',
        source: 'Engine',
        path: '$',
        timestamp: 'now',
      }),
    ]);

    const project = buildProject('2d');
    project.runtime.primary = 'three-3d';

    const blockedMessages = createProjectDiagnosticConsoleMessages(
      createProjectDiagnostics(project),
      'now',
    );

    expect(blockedMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'error',
        source: 'Runtime',
        path: '$.runtime.primary',
        timestamp: 'now',
      }),
    ]));

    const projectWithObjectIssue = buildProject('3d');
    projectWithObjectIssue.scenes[0]!.rootObjects[0]!.components = [
      {
        id: 'sprite',
        type: 'pixl.sprite',
        enabled: true,
        data: {},
      },
    ];

    expect(createProjectDiagnosticConsoleMessages(
      createProjectDiagnostics(projectWithObjectIssue),
      'now',
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetObjectId: 'hero',
        targetObjectName: 'Hero',
        targetSceneId: 'main',
        targetSceneName: 'Main',
      }),
    ]));
  });
});
