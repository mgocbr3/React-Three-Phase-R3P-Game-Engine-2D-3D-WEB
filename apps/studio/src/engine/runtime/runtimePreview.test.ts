import { describe, expect, it } from 'vitest';

import { createProjectDocumentFromEditorState } from '@/engine/project/editorProjectAdapter';
import { PixlProjectDocument } from '@/engine/project/schema';
import {
  createRuntimePreviewSession,
  getRuntimeAdapterLabel,
  resolveRuntimeLaunchTarget,
  resolveRuntimeKind,
} from './runtimePreview';

const createProject = (): PixlProjectDocument => createProjectDocumentFromEditorState({
  currentTemplateId: null,
  gameScript: '// runtime',
  transformSpace: 'world',
  snapEnabled: false,
  snapTranslate: 1,
  snapRotate: 15,
  snapScale: 0.25,
  objects: [
    {
      id: 'player-01',
      name: 'Player',
      type: 'player',
      position: [1, 2, 3],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#ffffff',
      visible: true,
      locked: false,
    },
  ],
}, {
  id: 'project-runtime-test',
  name: 'Runtime Test',
});

describe('runtime preview', () => {
  it('creates an immutable runtime snapshot separate from editor mutations', () => {
    const project = createProject();
    const session = createRuntimePreviewSession(project, {
      source: 'editor',
      startedAt: 123,
    });

    project.name = 'Edited After Play';
    project.scenes[0].rootObjects[0].name = 'Changed In Editor';

    expect(session.projectId).toBe('project-runtime-test');
    expect(session.projectName).toBe('Runtime Test');
    expect(session.launchTarget).toEqual({ kind: 'scene-preview' });
    expect(session.startedAt).toBe(123);
    expect(session.document.name).toBe('Runtime Test');
    expect(session.document.scenes[0].rootObjects[0].name).toBe('Player');
    expect(Object.isFrozen(session.document)).toBe(true);
    expect(Object.isFrozen(session.document.scenes[0])).toBe(true);
  });

  it('routes hybrid projects to the renderer that matches the active scene', () => {
    const project = createProject();
    project.runtime.primary = 'hybrid';
    project.scenes[0].kind = '2d';

    expect(resolveRuntimeKind(project)).toBe('phaser-2d');
    expect(getRuntimeAdapterLabel('phaser-2d')).toBe('Phaser 2D');
  });

  it('opens projects with a real game runtime as a web runtime target', () => {
    const project = createProject();
    project.game.source = {
      game: 'harvest-rush-3d',
      runtimeFile: 'src/main.js',
    };
    project.integrations = {
      pixlland: {
        gameSlug: 'harvest-rush-3d',
      },
    };
    project.assets.entries.push({
      id: 'farm-scene',
      name: 'Farm.glb',
      kind: 'model',
      path: 'Assets/3D_Models/Farm.glb',
      url: '/@fs/private/tmp/pixlland-poki/apps/portal/games-src/harvest-rush-3d/public/assets/vendor/farm-pack/Farm.glb',
      tags: [],
      metadata: {
        sourceAsset: 'public/assets/vendor/farm-pack/Farm.glb',
      },
    });

    expect(resolveRuntimeLaunchTarget(project)).toEqual({
      kind: 'web-runtime',
      gameSlug: 'harvest-rush-3d',
      runtimeFile: 'src/main.js',
      scriptUrl: '/@fs/private/tmp/pixlland-poki/apps/portal/games-src/harvest-rush-3d/src/main.js',
      documentBaseUrl: '/@fs/private/tmp/pixlland-poki/apps/portal/games-src/harvest-rush-3d/public/',
      sdkUrl: 'https://pixlland.com/sdk/v1/pixlland.js',
    });
  });

  it('uses an in-memory runtime base URL for portable project documents', () => {
    const project = createProject();
    project.game.source = {
      game: 'harvest-rush-3d',
      runtimeFile: 'src/main.js',
      runtimeBaseUrl: '/@fs/private/tmp/pixlland-poki/apps/portal/games-src/harvest-rush-3d/',
    };

    expect(resolveRuntimeLaunchTarget(project)).toMatchObject({
      kind: 'web-runtime',
      scriptUrl: '/@fs/private/tmp/pixlland-poki/apps/portal/games-src/harvest-rush-3d/src/main.js',
      documentBaseUrl: '/@fs/private/tmp/pixlland-poki/apps/portal/games-src/harvest-rush-3d/public/',
    });
  });

  it('supports packaged samples with separate runtime and document bases', () => {
    const project = createProject();
    project.game.source = {
      game: 'sample-3d-runtime',
      runtimeFile: 'src/main.js',
      runtimeBaseUrl: '/sample-projects/sample-3d-runtime/runtime/',
      documentBaseUrl: '/sample-projects/sample-3d-runtime/',
    };

    expect(resolveRuntimeLaunchTarget(project)).toMatchObject({
      kind: 'web-runtime',
      scriptUrl: '/sample-projects/sample-3d-runtime/runtime/src/main.js',
      documentBaseUrl: '/sample-projects/sample-3d-runtime/',
    });
  });
});
