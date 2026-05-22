import { beforeEach, describe, expect, it } from 'vitest';

import { captureEvents, readDoc, resetGlobalState, usingFixture } from '../../testHelpers.js';
import { importAsset } from './import.js';
import { removeAsset } from './remove.js';

describe('asset.import', () => {
  beforeEach(() => resetGlobalState());

  it('registra um asset com id determinístico', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const { events, stop } = captureEvents();
      const result = await importAsset(
        { projectDir: dir, agent: 'editor' },
        { name: 'Tree', kind: 'glb', path: 'Assets/3D_Models/tree.glb', id: 'asset_tree' },
      );
      expect(result.ok).toBe(true);
      const doc = await readDoc(dir);
      const entries = doc.assets?.entries ?? [];
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('asset_tree');
      expect(events[0].type).toBe('asset.imported');
      stop();
    });
  });

  it('rejeita path com ".."', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await importAsset(
        { projectDir: dir, agent: 'editor' },
        { name: 'X', kind: 'glb', path: '../etc/passwd' },
      );
      expect(result.ok).toBe(false);
    });
  });

  it('rejeita path duplicado', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await importAsset({ projectDir: dir, agent: 'test' }, {
        name: 'A', kind: 'glb', path: 'Assets/3D_Models/x.glb', id: 'a1',
      });
      const result = await importAsset({ projectDir: dir, agent: 'test' }, {
        name: 'B', kind: 'glb', path: 'Assets/3D_Models/x.glb', id: 'a2',
      });
      expect(result.ok).toBe(false);
    });
  });

  it('rejeita name vazio', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await importAsset({ projectDir: dir, agent: 'test' }, {
        name: '', kind: 'glb', path: 'Assets/x.glb',
      });
      expect(result.ok).toBe(false);
    });
  });
});

describe('asset.remove', () => {
  beforeEach(() => resetGlobalState());

  it('remove um asset pelo id', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      await importAsset({ projectDir: dir, agent: 'test' }, {
        name: 'Tree', kind: 'glb', path: 'Assets/3D_Models/tree.glb', id: 'a_tree',
      });
      const { events, stop } = captureEvents();
      const result = await removeAsset({ projectDir: dir, agent: 'editor' }, { assetId: 'a_tree' });
      expect(result.ok).toBe(true);
      const doc = await readDoc(dir);
      expect(doc.assets?.entries ?? []).toHaveLength(0);
      expect(events[0].type).toBe('asset.removed');
      stop();
    });
  });

  it('rejeita assetId desconhecido', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await removeAsset({ projectDir: dir, agent: 'editor' }, { assetId: 'nope' });
      expect(result.ok).toBe(false);
    });
  });

  it('rejeita assetId vazio', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const result = await removeAsset({ projectDir: dir, agent: 'editor' }, { assetId: '' });
      expect(result.ok).toBe(false);
    });
  });
});
