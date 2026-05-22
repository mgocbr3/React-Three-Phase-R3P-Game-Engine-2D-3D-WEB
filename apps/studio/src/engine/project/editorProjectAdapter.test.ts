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
      currentTemplateId: null,
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
    expect(project.runtime.renderers).toEqual(['three', 'phaser']);
    expect(project.runtime.physics).toEqual(['rapier']);
    expect(project.scenes[0].rootObjects).toHaveLength(1);
    expect(project.assets.entries[0].url).toBe('/models/tree.glb');
    expect(snapshot.objects[0].animationSettings?.modelUrl).toBe('/models/tree.glb');
    expect(snapshot.snapTranslate).toBe(0.5);
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

  it('keeps the bundled Harvest Rush sample portable across machines', () => {
    const samplePath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../public/sample-projects/harvest-rush-3d/project.pixlproject.json',
    );
    const sampleText = fs.readFileSync(samplePath, 'utf8');
    const sample = JSON.parse(sampleText);

    expect(sampleText).not.toMatch(/@fs|C:\\|C:\//);
    expect(sample.runtime.physics).toEqual(['rapier']);
    expect(sample.assets.entries.every((asset: { url?: string }) => (
      !asset.url || asset.url.startsWith('/sample-projects/harvest-rush-3d/')
    ))).toBe(true);
  });
});
