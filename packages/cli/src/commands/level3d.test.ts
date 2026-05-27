import { describe, expect, it } from 'vitest';
import { exportProjectToLevel3D, importLevel3DToProject, type Level3DDocument } from './level3d.js';

const sampleLevel: Level3DDocument = {
  schema: 'pixlland.level3d.v1',
  game: 'sample-3d',
  engineTarget: 'phaser-enable3d',
  sourceScene: 'phaser/scenes/Sample.scene',
  notes: 'fixture test',
  world: { units: 'meters' },
  camera: { position: [10, 20, 30], target: [0, 0, 0] },
  assetLibrary: [
    { key: 'tree.fir.001', label: 'Fir Tree', kind: 'model', url: 'assets/fir.glb' },
    { key: 'rock.basalt.001', label: 'Basalt Rock', kind: 'model', url: 'assets/rock.glb' },
  ],
  objects: [
    {
      id: 'tree-1',
      name: 'Fir 1',
      assetKey: 'tree.fir.001',
      layer: 'tree-line',
      collider: 'auto',
      editable: true,
      transform: { position: [1, 0, 2], rotation: [0, 0.5, 0], scale: [1, 1, 1] },
    },
    {
      id: 'rock-1',
      name: 'Rock 1',
      assetKey: 'rock.basalt.001',
      layer: 'rocks',
      collider: 'none',
      editable: false,
      transform: { position: [-3, 0, 4], rotation: [0, 0, 0], scale: [2, 2, 2] },
    },
  ],
};

describe('importLevel3DToProject', () => {
  it('cria projeto 3D com objetos importados e asset library', () => {
    const project = importLevel3DToProject(sampleLevel);
    expect(project.scenes).toHaveLength(1);
    expect(project.scenes[0].kind).toBe('3d');
    expect(project.scenes[0].rootObjects).toHaveLength(2);
    expect(project.assets?.entries).toHaveLength(2);
  });

  it('preserva metadata do level3d na cena', () => {
    const project = importLevel3DToProject(sampleLevel);
    const metadata = project.scenes[0].metadata as Record<string, unknown>;
    expect(metadata.originalSchema).toBe('pixlland.level3d.v1');
    expect(metadata.originalGame).toBe('sample-3d');
    expect(metadata.originalEngineTarget).toBe('phaser-enable3d');
    expect(metadata.originalNotes).toBe('fixture test');
  });

  it('cria componentes pixl.mesh, pixl.physics, pixl.logic em cada objeto', () => {
    const project = importLevel3DToProject(sampleLevel);
    const object = project.scenes[0].rootObjects[0];
    const componentTypes = object.components?.map((c) => c.type);
    expect(componentTypes).toContain('pixl.mesh');
    expect(componentTypes).toContain('pixl.physics');
    expect(componentTypes).toContain('pixl.logic');
  });

  it('rejeita schema desconhecido', () => {
    expect(() =>
      importLevel3DToProject({ ...sampleLevel, schema: 'wrong.schema' as 'pixlland.level3d.v1' }),
    ).toThrow(/Schema desconhecido/);
  });
});

describe('exportProjectToLevel3D', () => {
  it('reverte um projeto importado pro level3d original (round-trip)', () => {
    const project = importLevel3DToProject(sampleLevel);
    const exported = exportProjectToLevel3D(project);

    expect(exported.schema).toBe('pixlland.level3d.v1');
    expect(exported.game).toBe(sampleLevel.game);
    expect(exported.engineTarget).toBe(sampleLevel.engineTarget);
    expect(exported.sourceScene).toBe(sampleLevel.sourceScene);
    expect(exported.notes).toBe(sampleLevel.notes);
    expect(exported.assetLibrary).toEqual(sampleLevel.assetLibrary);
    expect(exported.objects).toHaveLength(sampleLevel.objects.length);
    expect(exported.objects[0].id).toBe(sampleLevel.objects[0].id);
    expect(exported.objects[0].assetKey).toBe(sampleLevel.objects[0].assetKey);
    expect(exported.objects[0].layer).toBe(sampleLevel.objects[0].layer);
    expect(exported.objects[0].collider).toBe(sampleLevel.objects[0].collider);
    expect(exported.objects[0].editable).toBe(sampleLevel.objects[0].editable);
    expect(exported.objects[0].transform).toEqual(sampleLevel.objects[0].transform);
  });

  it('ignora objetos sem assetKey em customData (objetos sinteticos)', () => {
    const project = importLevel3DToProject(sampleLevel);
    project.scenes[0].rootObjects.push({
      id: 'synthetic-camera',
      name: 'Camera (synthetic)',
      type: 'camera',
      components: [{ id: 'l1', type: 'pixl.logic', enabled: true, data: { tags: [] } }],
    });
    const exported = exportProjectToLevel3D(project);
    expect(exported.objects).toHaveLength(2);
    expect(exported.objects.find((o) => o.id === 'synthetic-camera')).toBeUndefined();
  });

  it('exporta objetos com modelo estruturado mesmo sem assetKey legado', () => {
    const project = importLevel3DToProject(sampleLevel);
    project.assets?.entries?.push({
      id: 'tractor-model',
      name: 'Tractor',
      kind: 'model',
      path: 'Assets/3D_Models/tractor.glb',
      url: 'public/assets/tractor.glb',
    });
    project.scenes[0].rootObjects.push({
      id: 'tractor-1',
      name: 'Tractor 1',
      type: 'box',
      transform: {
        position: [4, 0, 6],
        rotation: [0, 1, 0],
        scale: [1, 1, 1],
      },
      visible: true,
      locked: false,
      components: [
        {
          id: 'anim-1',
          type: 'pixl.animation',
          enabled: true,
          data: { modelUrl: 'public/assets/tractor.glb' },
        },
        {
          id: 'logic-1',
          type: 'pixl.logic',
          enabled: true,
          data: {
            customData: {
              sourceLayer: 'vehicles',
            },
          },
        },
      ],
    });

    const exported = exportProjectToLevel3D(project);
    const tractor = exported.objects.find((object) => object.id === 'tractor-1');

    expect(tractor?.assetKey).toBe('tractor-model');
    expect(tractor?.layer).toBe('vehicles');
    expect(tractor?.source?.assetUrl).toBe('public/assets/tractor.glb');
  });

  it('exporta objetos level3d que vivem em children aninhados', () => {
    const project = importLevel3DToProject(sampleLevel);
    const child = project.scenes[0].rootObjects.pop()!;
    child.parentId = project.scenes[0].rootObjects[0].id;
    project.scenes[0].rootObjects[0].children = [child];

    const exported = exportProjectToLevel3D(project);

    expect(exported.objects.map((object) => object.id)).toEqual(['tree-1', 'rock-1']);
  });

  it('falha se a cena ativa nao for 3D', () => {
    const project = importLevel3DToProject(sampleLevel);
    project.scenes[0].kind = '2d';
    expect(() => exportProjectToLevel3D(project)).toThrow(/nao e 3D/);
  });
});
