import { describe, expect, it } from 'vitest';

import {
  pixlProjectToPhaserGame,
  pixlSceneToPhaserScene,
  phaserSceneToPixlScene,
  type PixlSceneDocument,
} from './pixlSchemaAdapter.js';

const buildScene = (overrides: Partial<PixlSceneDocument> = {}): PixlSceneDocument => ({
  id: 's1',
  name: 'Main',
  kind: '2d',
  rootObjects: [
    {
      id: 'player',
      name: 'Player',
      type: 'sprite',
      transform: {
        position: [10, 20, 0],
        rotation: [0, 0, 0.5],
        scale: [2, 2, 1],
      },
      components: [
        {
          id: 'cmp_s',
          type: 'pixl.sprite',
          enabled: true,
          data: { textureKey: 'player', frame: 0 },
        },
      ],
    },
  ],
  camera: { id: 'c', name: 'Cam', position: [5, 5, 0], zoom: 1.5 },
  environment: { background: '#101822' },
  physics: { engine: 'arcade', gravity: [0, 980] },
  ...overrides,
});

describe('pixlSceneToPhaserScene', () => {
  it('converte uma cena 2D simples preservando id e nome', () => {
    const phaser = pixlSceneToPhaserScene(buildScene());
    expect(phaser.id).toBe('s1');
    expect(phaser.kind).toBe('2d');
    expect(phaser.rootObjects).toHaveLength(1);
  });

  it('mapeia [x,y,z] → {x,y} e descarta o z em position/scale', () => {
    const phaser = pixlSceneToPhaserScene(buildScene());
    const obj = phaser.rootObjects[0];
    expect(obj.transform.position).toEqual({ x: 10, y: 20 });
    expect(obj.transform.scale).toEqual({ x: 2, y: 2 });
  });

  it('usa rotation[2] (z-axis) como rotação 2D', () => {
    const phaser = pixlSceneToPhaserScene(buildScene());
    expect(phaser.rootObjects[0].transform.rotation).toBe(0.5);
  });

  it('inline-flattens components: data fica no top-level', () => {
    const phaser = pixlSceneToPhaserScene(buildScene());
    const cmp = phaser.rootObjects[0].components![0];
    expect(cmp.type).toBe('pixl.sprite');
    expect(cmp.enabled).toBe(true);
    expect((cmp as { textureKey: string }).textureKey).toBe('player');
  });

  it('rejeita scene 3D', () => {
    const doc = buildScene({ kind: '3d' });
    expect(() => pixlSceneToPhaserScene(doc)).toThrow(/three-runtime/);
  });

  it('aceita scene hybrid', () => {
    const doc = buildScene({ kind: 'hybrid' });
    const phaser = pixlSceneToPhaserScene(doc);
    expect(phaser.kind).toBe('hybrid');
  });

  it('preserva environment e physics', () => {
    const phaser = pixlSceneToPhaserScene(buildScene());
    expect(phaser.environment?.background).toBe('#101822');
    expect(phaser.physics?.engine).toBe('arcade');
    expect(phaser.physics?.gravity).toEqual([0, 980]);
  });

  it('descende em children recursivamente', () => {
    const doc = buildScene({
      rootObjects: [
        {
          id: 'parent',
          name: 'Parent',
          type: 'container',
          children: [
            { id: 'child', name: 'Child', type: 'sprite' },
          ],
        },
      ],
    });
    const phaser = pixlSceneToPhaserScene(doc);
    expect(phaser.rootObjects[0].children?.[0].id).toBe('child');
  });
});

describe('pixlProjectToPhaserGame', () => {
  it('inclui apenas cenas 2d/hybrid', () => {
    const project = {
      id: 'proj',
      name: 'Proj',
      activeSceneId: 'a',
      scenes: [
        buildScene({ id: 'a', kind: '2d' }),
        buildScene({ id: 'b', kind: '3d' }),
        buildScene({ id: 'c', kind: 'hybrid' }),
      ],
    };
    const { game, scenes } = pixlProjectToPhaserGame(project);
    expect(scenes.map((s) => s.id)).toEqual(['a', 'c']);
    expect(game.initialScene).toBe('a');
  });
});

describe('phaserSceneToPixlScene (round-trip)', () => {
  it('roda round-trip preservando estrutura essencial', () => {
    const original = buildScene();
    const phaser = pixlSceneToPhaserScene(original);
    const back = phaserSceneToPixlScene(phaser);
    expect(back.id).toBe(original.id);
    expect(back.kind).toBe(original.kind);
    expect(back.rootObjects[0].id).toBe('player');
    // Position should round-trip exactly.
    expect(back.rootObjects[0].transform?.position).toEqual([10, 20, 0]);
  });

  it('round-trip preserva component data', () => {
    const original = buildScene();
    const back = phaserSceneToPixlScene(pixlSceneToPhaserScene(original));
    const comp = back.rootObjects[0].components![0];
    expect(comp.type).toBe('pixl.sprite');
    expect((comp.data as { textureKey: string }).textureKey).toBe('player');
  });
});
