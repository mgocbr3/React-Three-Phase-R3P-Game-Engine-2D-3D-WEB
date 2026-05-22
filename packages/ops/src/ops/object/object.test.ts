import { beforeEach, describe, expect, it } from 'vitest';

import { captureEvents, readDoc, resetGlobalState, usingFixture } from '../../testHelpers.js';
import { addObject } from './add.js';
import { removeObject } from './remove.js';
import { reparentObject } from './reparent.js';
import { setObjectComponent } from './setComponent.js';
import { setObjectTransform } from './setTransform.js';
import { updateObject } from './update.js';

const seedTree = (dir: string) => async (): Promise<void> => {
  // Seed a small parent/child tree in the main scene.
  const doc = await readDoc(dir);
  const sceneId = doc.activeSceneId;
  await addObject({ projectDir: dir, agent: 'test' }, {
    sceneId, parentId: null, type: 'group', id: 'obj_parent', name: 'Parent',
  });
  await addObject({ projectDir: dir, agent: 'test' }, {
    sceneId, parentId: 'obj_parent', type: 'mesh', id: 'obj_child', name: 'Child',
  });
  await addObject({ projectDir: dir, agent: 'test' }, {
    sceneId, parentId: 'obj_child', type: 'mesh', id: 'obj_grand', name: 'Grand',
  });
};

describe('object.add', () => {
  beforeEach(() => resetGlobalState());

  it('adiciona um objeto na raiz da cena ativa', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      const { events, stop } = captureEvents();
      const result = await addObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, parentId: null, type: 'cube', id: 'obj_x' },
      );
      expect(result.ok).toBe(true);
      const after = await readDoc(dir);
      expect(after.scenes[0].rootObjects).toHaveLength(1);
      expect(after.scenes[0].rootObjects[0].id).toBe('obj_x');
      expect(events[0].type).toBe('object.added');
      stop();
    });
  });

  it('aninha sob um parentId existente', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: null, type: 'group', id: 'p',
      });
      const result = await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: 'p', type: 'mesh', id: 'c',
      });
      expect(result.ok).toBe(true);
      const after = await readDoc(dir);
      expect(after.scenes[0].rootObjects[0].children?.[0].id).toBe('c');
    });
  });

  it('rejeita sceneId desconhecido', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await addObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: 'scene_x', parentId: null, type: 'cube' },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('rejeita parentId desconhecido', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      const result = await addObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, parentId: 'never', type: 'cube' },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('rebobina (rollback) quando os componentes não casam com a cena', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      // pixl.sprite is 2D — adding it to a 3D scene must trip post-validate.
      const docBefore = await readDoc(dir);
      const result = await addObject(
        { projectDir: dir, agent: 'editor' },
        {
          sceneId: docBefore.activeSceneId,
          parentId: null,
          type: 'cube',
          id: 'obj_bad',
          components: [{ type: 'pixl.sprite', data: {} }],
        },
      );
      expect(result.ok).toBe(false);
      const docAfter = await readDoc(dir);
      // savedAt may have changed but rootObjects must be UNCHANGED — that's the rollback.
      expect(docAfter.scenes[0].rootObjects).toEqual(docBefore.scenes[0].rootObjects);
    });
  });
});

describe('object.update', () => {
  beforeEach(() => resetGlobalState());

  it('atualiza name + visible + tags', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: null, type: 'cube', id: 'o1',
      });
      const result = await updateObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'o1', name: 'New Name', visible: false, tags: ['t1'] },
      );
      expect(result.ok).toBe(true);
      const after = await readDoc(dir);
      const obj = after.scenes[0].rootObjects[0];
      expect(obj.name).toBe('New Name');
      expect(obj.visible).toBe(false);
      expect(obj.tags).toEqual(['t1']);
    });
  });

  it('rejeita quando nenhum campo é informado', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: null, type: 'cube', id: 'o1',
      });
      const result = await updateObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'o1' },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('rejeita objectId desconhecido', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      const result = await updateObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'nope', name: 'x' },
      );
      expect(result.ok).toBe(false);
    });
  });
});

describe('object.remove', () => {
  beforeEach(() => resetGlobalState());

  it('remove um objeto folha', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await seedTree(dir)();
      const doc = await readDoc(dir);
      const result = await removeObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'obj_grand' },
      );
      expect(result.ok).toBe(true);
      const after = await readDoc(dir);
      const child = after.scenes[0].rootObjects[0].children?.[0];
      expect(child?.children ?? []).toHaveLength(0);
    });
  });

  it('remove o objeto e todos os descendentes', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await seedTree(dir)();
      const doc = await readDoc(dir);
      const result = await removeObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'obj_parent' },
      );
      expect(result.ok).toBe(true);
      const after = await readDoc(dir);
      expect(after.scenes[0].rootObjects).toHaveLength(0);
    });
  });

  it('rejeita objectId desconhecido', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      const result = await removeObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'nope' },
      );
      expect(result.ok).toBe(false);
    });
  });
});

describe('object.reparent', () => {
  beforeEach(() => resetGlobalState());

  it('move um objeto pra outro parent', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await seedTree(dir)();
      const doc = await readDoc(dir);
      // Add a second root group to move things into.
      await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: null, type: 'group', id: 'obj_other',
      });
      const result = await reparentObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'obj_grand', newParentId: 'obj_other' },
      );
      expect(result.ok).toBe(true);
      const after = await readDoc(dir);
      const other = after.scenes[0].rootObjects.find((o) => o.id === 'obj_other');
      expect(other?.children?.[0].id).toBe('obj_grand');
    });
  });

  it('rejeita reparent pro próprio object', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await seedTree(dir)();
      const doc = await readDoc(dir);
      const result = await reparentObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'obj_parent', newParentId: 'obj_parent' },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('rejeita reparent que criaria ciclo (desc -> ancestral)', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await seedTree(dir)();
      const doc = await readDoc(dir);
      // obj_parent -> obj_child -> obj_grand. Move obj_parent under obj_grand: cycle.
      const result = await reparentObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'obj_parent', newParentId: 'obj_grand' },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('move pra raiz (newParentId=null)', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await seedTree(dir)();
      const doc = await readDoc(dir);
      const result = await reparentObject(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'obj_grand', newParentId: null },
      );
      expect(result.ok).toBe(true);
      const after = await readDoc(dir);
      expect(after.scenes[0].rootObjects.some((o) => o.id === 'obj_grand')).toBe(true);
    });
  });
});

describe('object.setTransform', () => {
  beforeEach(() => resetGlobalState());

  it('atualiza position', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: null, type: 'cube', id: 'o1',
      });
      const result = await setObjectTransform(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'o1', position: [10, 20, 30] },
      );
      expect(result.ok).toBe(true);
      const after = await readDoc(dir);
      expect(after.scenes[0].rootObjects[0].transform?.position).toEqual([10, 20, 30]);
    });
  });

  it('rejeita quando nenhum dos três valores é informado', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: null, type: 'cube', id: 'o1',
      });
      const result = await setObjectTransform(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'o1' },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('rejeita position com NaN', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: null, type: 'cube', id: 'o1',
      });
      const result = await setObjectTransform(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'o1', position: [NaN, 0, 0] },
      );
      expect(result.ok).toBe(false);
    });
  });
});

describe('object.setComponent', () => {
  beforeEach(() => resetGlobalState());

  it('adiciona um novo componente', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: null, type: 'cube', id: 'o1',
      });
      const { events, stop } = captureEvents();
      const result = await setObjectComponent(
        { projectDir: dir, agent: 'editor' },
        {
          sceneId: doc.activeSceneId, objectId: 'o1',
          type: 'pixl.mesh',
          data: { modelUrl: 'Assets/x.glb' },
          componentId: 'cmp_x',
        },
      );
      expect(result.ok).toBe(true);
      const after = await readDoc(dir);
      const cmp = after.scenes[0].rootObjects[0].components?.[0];
      expect(cmp?.type).toBe('pixl.mesh');
      expect(events[0].type).toBe('object.component.set');
      stop();
    });
  });

  it('atualiza um componente existente preservando o id', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: null, type: 'cube', id: 'o1',
        components: [{ type: 'pixl.mesh', id: 'cmp_x', data: { modelUrl: 'a.glb' } }],
      });
      const result = await setObjectComponent(
        { projectDir: dir, agent: 'editor' },
        {
          sceneId: doc.activeSceneId, objectId: 'o1',
          componentId: 'cmp_x',
          data: { modelUrl: 'b.glb' },
        },
      );
      expect(result.ok).toBe(true);
      const after = await readDoc(dir);
      expect(after.scenes[0].rootObjects[0].components?.[0].data.modelUrl).toBe('b.glb');
    });
  });

  it('remove um componente quando data=null', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: null, type: 'cube', id: 'o1',
        components: [{ type: 'pixl.mesh', id: 'cmp_x', data: {} }],
      });
      const result = await setObjectComponent(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'o1', componentId: 'cmp_x', data: null },
      );
      expect(result.ok).toBe(true);
      const after = await readDoc(dir);
      expect(after.scenes[0].rootObjects[0].components ?? []).toHaveLength(0);
    });
  });

  it('rejeita add sem type', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: null, type: 'cube', id: 'o1',
      });
      const result = await setObjectComponent(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'o1', data: {} },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('rejeita data=null com componentId inexistente', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      await addObject({ projectDir: dir, agent: 'test' }, {
        sceneId: doc.activeSceneId, parentId: null, type: 'cube', id: 'o1',
      });
      const result = await setObjectComponent(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId, objectId: 'o1', componentId: 'cmp_nope', data: null },
      );
      expect(result.ok).toBe(false);
    });
  });
});
