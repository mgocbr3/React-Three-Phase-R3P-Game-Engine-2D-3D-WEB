import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PixlProjectDocument } from '@/engine/project/schema';
import { useAssetStore } from '@/stores/assetStore';
import { useEditorStore } from '@/stores/editorStore';
import { useViewportStore } from '@/stores/viewportStore';
import {
  applyProjectDocumentToEditor,
  createActiveProjectDocumentSnapshot,
  createProjectDocumentFromEditor,
  createProjectDocumentContentSignature,
  getPortableAssetPath,
  importProjectAssetFiles,
  makeProjectDocumentPortable,
  moveProjectAssetToFolder,
  prepareProjectDocumentForRuntimePreview,
  resolveProjectDocumentAssetUrls,
} from './localProjectFiles';

class MemoryFileHandle {
  readonly kind = 'file';
  private textContent = '';

  constructor(
    public name: string,
    private file: File,
  ) {}

  async getFile(): Promise<File> {
    if (this.textContent) {
      return Object.assign(new Blob([this.textContent], { type: this.file.type }), {
        name: this.name,
        lastModified: Date.now(),
        __textContent: this.textContent,
      }) as unknown as File;
    }
    return this.file;
  }

  async text(): Promise<string> {
    return this.textContent;
  }

  async createWritable() {
    const chunks: string[] = [];
    return {
      write: async (data: BlobPart | File) => {
        const textContent = (data as { __textContent?: unknown }).__textContent;
        if (typeof textContent === 'string') {
          chunks.push(textContent);
          return;
        }
        if (typeof data === 'string') {
          chunks.push(data);
          return;
        }
        if (data instanceof ArrayBuffer) {
          chunks.push(new TextDecoder().decode(data));
          return;
        }
        if (ArrayBuffer.isView(data)) {
          chunks.push(new TextDecoder().decode(data));
          return;
        }
        chunks.push(await new Response(data as Blob).text());
      },
      close: async () => {
        this.textContent = chunks.join('');
        this.file = new File([this.textContent], this.name, { type: this.file.type });
      },
    };
  }
}

class MemoryDirectoryHandle {
  readonly kind = 'directory';
  private files = new Map<string, MemoryFileHandle>();
  private directories = new Map<string, MemoryDirectoryHandle>();

  constructor(public name: string) {}

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<MemoryFileHandle> {
    const existing = this.files.get(name);
    if (existing) return existing;
    if (!options?.create) throw new Error(`Missing file: ${name}`);

    const created = new MemoryFileHandle(name, new File([], name));
    this.files.set(name, created);
    return created;
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MemoryDirectoryHandle> {
    const existing = this.directories.get(name);
    if (existing) return existing;
    if (!options?.create) throw new Error(`Missing directory: ${name}`);

    const created = new MemoryDirectoryHandle(name);
    this.directories.set(name, created);
    return created;
  }

  async removeEntry(name: string): Promise<void> {
    if (this.files.delete(name) || this.directories.delete(name)) return;
    throw new Error(`Missing entry: ${name}`);
  }

  async readText(path: string): Promise<string> {
    const parts = path.split('/').filter(Boolean);
    let current: MemoryDirectoryHandle = this;
    for (const part of parts.slice(0, -1)) {
      current = await current.getDirectoryHandle(part);
    }
    const file = await current.getFileHandle(parts[parts.length - 1]);
    return file.text();
  }
}

let objectUrlIndex = 0;

const mockObjectUrls = () => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => `blob:asset-${++objectUrlIndex}`),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
};

const createTestFile = (content: string, name: string, type: string): File => (
  Object.assign(new Blob([content], { type }), {
    name,
    lastModified: Date.now(),
    __textContent: content,
  }) as unknown as File
);

afterEach(() => {
  vi.restoreAllMocks();
  objectUrlIndex = 0;
});

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

  it('resolves 2D imageUrl assets relative to sample project URLs and saves them portably', async () => {
    const project = createProject('Assets/Sprites/unused.glb');
    project.runtime = {
      primary: 'phaser-2d',
      renderers: ['phaser'],
      physics: ['arcade'],
    };
    project.scenes[0].kind = '2d';
    project.scenes[0].rootObjects[0].type = 'sprite';
    project.scenes[0].rootObjects[0].data = {
      imageUrl: 'assets/characters/mage-ember.png',
    };
    project.scenes[0].rootObjects[0].components = [
      {
        id: 'sprite',
        type: 'pixl.sprite',
        enabled: true,
        data: {
          imageUrl: 'assets/characters/mage-ember.png',
        },
      },
    ];
    project.assets.entries = [
      {
        id: 'mage',
        name: 'Mage Ember',
        kind: 'spritesheet',
        path: 'assets/characters/mage-ember.png',
        url: 'assets/characters/mage-ember.png',
        tags: [],
      },
    ];

    const resolved = await resolveProjectDocumentAssetUrls(project, {
      assetBaseUrl: '/sample-projects/magic-battleground-2d',
    });

    expect(resolved.scenes[0].rootObjects[0].data?.imageUrl).toBe(
      '/sample-projects/magic-battleground-2d/assets/characters/mage-ember.png',
    );
    expect(resolved.scenes[0].rootObjects[0].components[0].data.imageUrl).toBe(
      '/sample-projects/magic-battleground-2d/assets/characters/mage-ember.png',
    );
    expect(resolved.assets.entries[0].url).toBe(
      '/sample-projects/magic-battleground-2d/assets/characters/mage-ember.png',
    );

    delete project.assets.entries[0].url;
    const resolvedWithPathOnlyEntry = await resolveProjectDocumentAssetUrls(project, {
      assetBaseUrl: '/sample-projects/magic-battleground-2d',
    });
    expect(resolvedWithPathOnlyEntry.assets.entries[0].path).toBe('assets/characters/mage-ember.png');
    expect(resolvedWithPathOnlyEntry.assets.entries[0].url).toBe(
      '/sample-projects/magic-battleground-2d/assets/characters/mage-ember.png',
    );

    const portable = makeProjectDocumentPortable(resolved);

    expect(portable.scenes[0].rootObjects[0].data?.imageUrl).toBe('assets/characters/mage-ember.png');
    expect(portable.scenes[0].rootObjects[0].components[0].data.imageUrl).toBe('assets/characters/mage-ember.png');
    expect(portable.assets.entries[0].url).toBe('assets/characters/mage-ember.png');
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

  it('creates stable active document snapshots while detecting real content changes', () => {
    const project = createProject('public/assets/vendor/farm-pack/Farm.glb');
    applyProjectDocumentToEditor(project);

    const before = createActiveProjectDocumentSnapshot('Project Test');
    const sameContentLater = {
      ...before.document,
      savedAt: before.document.savedAt + 10_000,
    };

    expect(createProjectDocumentContentSignature(before.document)).toBe(
      createProjectDocumentContentSignature(sameContentLater),
    );

    useAssetStore.getState().addProjectAsset({
      name: 'Hero Sprite',
      type: 'sprite',
      url: 'Assets/Sprites/hero.png',
      path: 'Assets/Sprites/hero.png',
      folder: 'Assets/Sprites',
    });

    const afterAssetImport = createActiveProjectDocumentSnapshot('Project Test');

    expect(afterAssetImport.signature).not.toBe(before.signature);
    expect(afterAssetImport.document.assets.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Hero Sprite',
        kind: 'sprite',
        path: 'Assets/Sprites/hero.png',
      }),
    ]));
  });

  it('opens and saves 2D projects without dropping sprite data or viewport mode', () => {
    const project: PixlProjectDocument = {
      ...createProject('Assets/Sprites/hero.png'),
      id: 'project-2d',
      slug: 'project-2d',
      name: 'Project 2D',
      runtime: {
        primary: 'phaser-2d',
        renderers: ['phaser'],
        physics: ['arcade'],
      },
      editor: {
        ...createProject('Assets/Sprites/hero.png').editor,
        mode: '2d',
      },
      scenes: [
        {
          ...createProject('Assets/Sprites/hero.png').scenes[0],
          kind: '2d',
          units: 'pixels',
          physics: {
            engine: 'arcade',
            gravity: [0, 980, 0],
          },
          rootObjects: [
            {
              id: 'hero-sprite',
              name: 'Hero Sprite',
              type: 'sprite',
              transform: {
                position: [64, 96, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
              },
              visible: true,
              locked: false,
              tags: ['player'],
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
        },
      ],
      assets: {
        root: 'Assets',
        folders: ['Assets/Sprites'],
        entries: [
          {
            id: 'hero-img',
            name: 'Hero',
            kind: 'spritesheet',
            path: 'Assets/Sprites/hero.png',
            tags: [],
          },
        ],
      },
    };

    applyProjectDocumentToEditor(project);

    expect(useEditorStore.getState().activeSceneKind).toBe('2d');
    expect(useViewportStore.getState().viewportMode).toBe('2d');
    expect(useAssetStore.getState().projectAssets[0]).toMatchObject({
      type: 'spritesheet',
      url: 'Assets/Sprites/hero.png',
    });

    useEditorStore.getState().updateObject('hero-sprite', {
      name: 'Renamed Hero',
      position: [128, 192, 0],
    });

    const saved = createProjectDocumentFromEditor('Project 2D');
    const object = saved.scenes[0].rootObjects[0];

    expect(saved.runtime.primary).toBe('phaser-2d');
    expect(saved.editor.mode).toBe('2d');
    expect(saved.scenes[0].kind).toBe('2d');
    expect(object.name).toBe('Renamed Hero');
    expect(object.type).toBe('sprite');
    expect(object.transform.position).toEqual([128, 192, 0]);
    expect(object.data?.imageUrl).toBe('Assets/Sprites/hero.png');
    expect(object.components[0].type).toBe('pixl.physics2d');
  });

  it('imports 2D files into the active local project folder and persists manifest entries', async () => {
    mockObjectUrls();

    const directory = new MemoryDirectoryHandle('Sprite Game');
    applyProjectDocumentToEditor(createProject('Assets/Sprites/unused.png'), {
      workspace: {
        directory: directory as any,
        projectFilePath: ['project.pixlproject.json'],
      },
    });

    const [imported] = await importProjectAssetFiles([
      createTestFile('pixels', 'hero.png', 'image/png'),
    ], 'Assets/Sprites');

    expect(imported).toMatchObject({
      name: 'hero.png',
      path: 'Assets/Sprites/hero.png',
      folder: 'Assets/Sprites',
      url: 'blob:asset-1',
    });
    expect(await directory.readText('Assets/Sprites/hero.png')).toBe('pixels');

    useAssetStore.getState().addProjectAsset({
      name: imported.name,
      type: 'sprite',
      url: imported.url,
      path: imported.path,
      folder: imported.folder,
      metadata: imported.metadata,
    });

    const saved = createProjectDocumentFromEditor('Sprite Game');
    const entry = saved.assets.entries.find((asset) => asset.path === 'Assets/Sprites/hero.png');

    expect(saved.assets.folders).toContain('Assets/Sprites');
    expect(entry).toMatchObject({
      name: 'hero.png',
      kind: 'sprite',
      path: 'Assets/Sprites/hero.png',
      url: 'Assets/Sprites/hero.png',
    });
  });

  it('moves local project asset files between 2D folders', async () => {
    mockObjectUrls();

    const directory = new MemoryDirectoryHandle('Tilemap Game');
    applyProjectDocumentToEditor(createProject('Assets/Sprites/unused.png'), {
      workspace: {
        directory: directory as any,
        projectFilePath: ['project.pixlproject.json'],
      },
    });

    const [imported] = await importProjectAssetFiles([
      createTestFile('{"layers":[]}', 'level.tilemap.json', 'application/json'),
    ], 'Assets/Sprites');

    const moved = await moveProjectAssetToFolder({
      id: 'level-map',
      name: imported.name,
      type: 'tilemap',
      url: imported.url,
      path: imported.path,
      folder: imported.folder,
      createdAt: 1,
      metadata: imported.metadata,
    }, 'Assets/Tilemaps');

    expect(moved).toMatchObject({
      path: 'Assets/Tilemaps/level.tilemap.json',
      folder: 'Assets/Tilemaps',
      url: 'blob:asset-2',
    });
    expect(await directory.readText('Assets/Tilemaps/level.tilemap.json')).toBe('{"layers":[]}');
    await expect(directory.readText('Assets/Sprites/level.tilemap.json')).rejects.toThrow('Missing file');
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
