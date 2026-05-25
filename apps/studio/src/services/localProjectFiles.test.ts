import { describe, expect, it } from 'vitest';

import type { PixlProjectDocument } from '@/engine/project/schema';
import { useEditorStore } from '@/stores/editorStore';
import {
  applyProjectDocumentToEditor,
  createProjectDocumentFromEditor,
  getPortableAssetPath,
  makeProjectDocumentPortable,
  prepareProjectDocumentForRuntimePreview,
  resolveProjectDocumentAssetUrls,
} from './localProjectFiles';

const createProject = (modelUrl: string): PixlProjectDocument => ({
  format: 'pixlplayground-project',
  version: 2,
  id: 'project-test',
  slug: 'project-test',
  name: 'Project Test',
  createdAt: 1,
  savedAt: 2,
  engine: {
    name: 'PixlPlayground',
    version: '0.1.0',
    schemaVersion: 2,
  },
  runtime: {
    primary: 'three-3d',
    renderers: ['three'],
    physics: ['rapier'],
  },
  activeSceneId: 'main',
  scenes: [
    {
      id: 'main',
      name: 'Main',
      kind: '3d',
      units: 'meters',
      rootObjects: [
        {
          id: 'farm-scene',
          name: 'Farm.glb',
          type: 'box',
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
              id: 'farm-scene-animation',
              type: 'pixl.animation',
              enabled: true,
              data: {
                modelUrl,
              },
            },
          ],
          data: {
            editorObject: {
              animationSettings: {
                modelUrl,
              },
            },
          },
        },
      ],
      camera: {
        id: 'editor-camera',
        name: 'Editor Camera',
        position: [0, 5, 10],
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
      physics: {
        engine: 'rapier',
        gravity: [0, -9.81, 0],
      },
    },
  ],
  assets: {
    root: 'Assets',
    folders: ['Assets/3D_Models'],
    entries: [
      {
        id: 'farm-model',
        name: 'Farm.glb',
        kind: 'model',
        path: 'Assets/3D_Models/Farm.glb',
        url: modelUrl,
        tags: [],
      },
    ],
  },
  editor: {
    mode: '3d',
    transformSpace: 'world',
    snapEnabled: false,
    snapTranslate: 1,
    snapRotate: 15,
    snapScale: 0.25,
    selectedSceneId: 'main',
  },
  game: {
    templateId: null,
    script: '// test',
    source: {
      game: 'project-test-runtime',
    },
  },
  integrations: {
    pixlland: {
      gameSlug: 'project-test',
    },
  },
});

describe('local project files', () => {
  it('normalizes machine-specific Vite file URLs into portable project paths', () => {
    expect(getPortableAssetPath(
      '/@fs/C:/Users/PCSP/Documents/doc/pixlland-poki/apps/portal/games-src/harvest-rush-3d/public/assets/vendor/farm-pack/Farm.glb',
    )).toBe('public/assets/vendor/farm-pack/Farm.glb');
  });

  it('resolves sample assets for the current local repo and saves them back as portable paths', async () => {
    const project = createProject('public/assets/vendor/farm-pack/Farm.glb');
    const resolved = await resolveProjectDocumentAssetUrls(project, {
      assetBaseUrl: '/@fs/private/tmp/pixlland-poki/apps/portal/games-src/harvest-rush-3d/',
    });

    expect(resolved.assets.entries[0].url).toBe(
      '/@fs/private/tmp/pixlland-poki/apps/portal/games-src/harvest-rush-3d/public/assets/vendor/farm-pack/Farm.glb',
    );
    expect(
      resolved.scenes[0].rootObjects[0].components[0].data.modelUrl,
    ).toBe('/@fs/private/tmp/pixlland-poki/apps/portal/games-src/harvest-rush-3d/public/assets/vendor/farm-pack/Farm.glb');
    expect(resolved.assets.entries[0].path).toBe('Assets/3D_Models/Farm.glb');

    const portable = makeProjectDocumentPortable(resolved);

    expect(portable.assets.entries[0].url).toBe('public/assets/vendor/farm-pack/Farm.glb');
    expect(
      portable.scenes[0].rootObjects[0].components[0].data.modelUrl,
    ).toBe('public/assets/vendor/farm-pack/Farm.glb');
  });

  it('preserves active project metadata when saving editor changes', () => {
    const project = createProject('public/assets/vendor/farm-pack/Farm.glb');
    project.engine.version = '0.2.0';
    applyProjectDocumentToEditor(project);

    useEditorStore.getState().updateObject('farm-scene', {
      name: 'Renamed Farm Scene',
      position: [4, 1, -2],
    });

    const saved = createProjectDocumentFromEditor('Project Test');
    const object = saved.scenes[0].rootObjects[0];

    expect(saved.id).toBe('project-test');
    expect(saved.engine.version).toBe('0.2.0');
    expect(saved.game.source).toEqual({ game: 'project-test-runtime' });
    expect(saved.integrations?.pixlland).toEqual({ gameSlug: 'project-test' });
    expect(object.name).toBe('Renamed Farm Scene');
    expect(object.transform.position).toEqual([4, 1, -2]);
    expect(object.data?.editorObject).toBeUndefined();
  });

  it('keeps explicit runtime bases when preparing a sample preview', () => {
    const project = createProject('public/assets/vendor/farm-pack/Farm.glb');
    project.game.source = {
      game: 'sample-3d-runtime',
      runtimeFile: 'src/main.js',
      runtimeBaseUrl: '/sample-projects/sample-3d-runtime/runtime/',
      documentBaseUrl: '/sample-projects/sample-3d-runtime/',
    };
    applyProjectDocumentToEditor(project, {
      assetBaseUrl: '/@fs/private/tmp/game-repo/apps/portal/games-src/sample-3d-runtime/',
    });

    const preview = prepareProjectDocumentForRuntimePreview(project);

    expect(preview.game.source).toMatchObject({
      runtimeBaseUrl: '/sample-projects/sample-3d-runtime/runtime/',
      documentBaseUrl: '/sample-projects/sample-3d-runtime/',
    });
  });
});
