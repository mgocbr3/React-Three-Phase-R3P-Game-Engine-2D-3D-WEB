import { beforeEach, describe, expect, it } from 'vitest';

import { captureEvents, readDoc, resetGlobalState, usingFixture } from '../../testHelpers.js';
import { createScene } from './create.js';
import { deleteScene } from './delete.js';
import { setActiveScene } from './setActive.js';

describe('scene.create', () => {
  beforeEach(() => resetGlobalState());

  it('adiciona uma cena 3D e a torna ativa se solicitado', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const { events, stop } = captureEvents();
      const result = await createScene(
        { projectDir: dir, agent: 'editor' },
        { name: 'Level 2', kind: '3d', activate: true, id: 'scene_lvl2' },
      );
      expect(result.ok).toBe(true);
      const doc = await readDoc(dir);
      expect(doc.scenes).toHaveLength(2);
      expect(doc.activeSceneId).toBe('scene_lvl2');
      expect(events[0].type).toBe('scene.created');
      stop();
    });
  });

  it('rejeita name vazio', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await createScene(
        { projectDir: dir, agent: 'editor' },
        { name: '   ', kind: '3d' },
      );
      expect(result.ok).toBe(false);
      expect(result.validationErrors.join(' ')).toMatch(/name/);
    });
  });

  it('rejeita kind inválido', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await createScene(
        { projectDir: dir, agent: 'editor' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { name: 'L', kind: 'voxel' as any },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('rejeita id duplicado', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await createScene(
        { projectDir: dir, agent: 'editor' },
        { name: 'A', kind: '3d', id: 'scene_dup' },
      );
      const result = await createScene(
        { projectDir: dir, agent: 'editor' },
        { name: 'B', kind: '3d', id: 'scene_dup' },
      );
      expect(result.ok).toBe(false);
    });
  });
});

describe('scene.delete', () => {
  beforeEach(() => resetGlobalState());

  it('deleta uma cena não-ativa', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await createScene(
        { projectDir: dir, agent: 'editor' },
        { name: 'L2', kind: '3d', id: 'scene_l2' },
      );
      const { events, stop } = captureEvents();
      const result = await deleteScene(
        { projectDir: dir, agent: 'editor' },
        { sceneId: 'scene_l2' },
      );
      expect(result.ok).toBe(true);
      const doc = await readDoc(dir);
      expect(doc.scenes).toHaveLength(1);
      expect(events[0].type).toBe('scene.deleted');
      stop();
    });
  });

  it('recusa deletar a cena ativa', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      const result = await deleteScene(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('recusa deletar quando há só uma cena', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      const result = await deleteScene(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('recusa sceneId desconhecido', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await deleteScene(
        { projectDir: dir, agent: 'editor' },
        { sceneId: 'scene_nope' },
      );
      expect(result.ok).toBe(false);
    });
  });
});

describe('scene.setActive', () => {
  beforeEach(() => resetGlobalState());

  it('muda a cena ativa', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await createScene(
        { projectDir: dir, agent: 'editor' },
        { name: 'L2', kind: '3d', id: 'scene_l2' },
      );
      const { events, stop } = captureEvents();
      const result = await setActiveScene(
        { projectDir: dir, agent: 'editor' },
        { sceneId: 'scene_l2' },
      );
      expect(result.ok).toBe(true);
      const doc = await readDoc(dir);
      expect(doc.activeSceneId).toBe('scene_l2');
      expect(events[0].type).toBe('scene.activated');
      stop();
    });
  });

  it('é idempotente quando a cena já é a ativa', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const doc = await readDoc(dir);
      const result = await setActiveScene(
        { projectDir: dir, agent: 'editor' },
        { sceneId: doc.activeSceneId },
      );
      expect(result.ok).toBe(true);
    });
  });

  it('rejeita sceneId desconhecido', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await setActiveScene(
        { projectDir: dir, agent: 'editor' },
        { sceneId: 'scene_nope' },
      );
      expect(result.ok).toBe(false);
    });
  });
});
