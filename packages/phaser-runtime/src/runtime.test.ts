import { describe, expect, it } from 'vitest';

import Component from './Component.js';
import Game from './Game.js';
import GameObject from './GameObject.js';
import Scene from './Scene.js';
import Animation2DComponent from './components/Animation2DComponent.js';
import Physics2DComponent from './components/Physics2DComponent.js';
import SpriteComponent from './components/SpriteComponent.js';
import TilemapComponent from './components/TilemapComponent.js';

describe('Component base', () => {
  it('aceita um JSON e expõe type + enabled', () => {
    const cmp = new Component({ type: 'pixl.sprite', enabled: false, foo: 'bar' });
    expect(cmp.type).toBe('pixl.sprite');
    expect(cmp.enabled).toBe(false);
  });

  it('round-trip toJSON', () => {
    const cmp = new Component({ type: 'pixl.script', source: 'console.log(1)' });
    const json = cmp.toJSON();
    expect(json.type).toBe('pixl.script');
    expect(json.enabled).toBe(true);
    expect((json as { source: string }).source).toBe('console.log(1)');
  });

  it('rejeita JSON sem type', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => new Component({} as any)).toThrow(/type/);
  });
});

describe('GameObject', () => {
  const base = {
    id: 'g1',
    name: 'Go',
    type: 'sprite',
    transform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } },
  };

  it('constrói com transform default', () => {
    const go = new GameObject(base);
    expect(go.id).toBe('g1');
    expect(go.visible).toBe(true);
    expect(go.locked).toBe(false);
  });

  it('addComponent + addChild funcionam', () => {
    const go = new GameObject(base);
    go.addComponent({ type: 'pixl.sprite', textureKey: 't' });
    go.addChild(new GameObject({ ...base, id: 'g2' }));
    expect(go.components).toHaveLength(1);
    expect(go.children).toHaveLength(1);
    expect(go.children[0].parent).toBe(go);
  });

  it('findChild localiza descendente recursivamente', () => {
    const go = new GameObject(base);
    const c1 = new GameObject({ ...base, id: 'c1' });
    const c2 = new GameObject({ ...base, id: 'c2' });
    c1.addChild(c2);
    go.addChild(c1);
    expect(go.findChild('c2')?.id).toBe('c2');
  });

  it('removeChild devolve true/false corretamente', () => {
    const go = new GameObject(base);
    go.addChild(new GameObject({ ...base, id: 'c1' }));
    expect(go.removeChild('c1')).toBe(true);
    expect(go.removeChild('nope')).toBe(false);
  });
});

describe('Scene', () => {
  it('rejeita scene com kind=3d', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => new Scene({ id: 's', name: 'S', kind: '3d' as any, rootObjects: [] })).toThrow();
  });

  it('aceita scene 2d/hybrid e conta objetos recursivamente', () => {
    const scene = new Scene({
      id: 's',
      name: 'S',
      kind: '2d',
      rootObjects: [
        {
          id: 'p', name: 'P', type: 'group',
          transform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } },
          children: [
            { id: 'c', name: 'C', type: 'sprite',
              transform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } } },
          ],
        },
      ],
    });
    expect(scene.totalObjectCount()).toBe(2);
  });
});

describe('Game', () => {
  it('carrega múltiplas cenas e seta active baseado em initialScene', () => {
    const game = new Game(
      { initialScene: 's1', scenes: { s1: 's1', s2: 's2' } },
      [
        { id: 's1', name: 'S1', kind: '2d', rootObjects: [] },
        { id: 's2', name: 'S2', kind: '2d', rootObjects: [] },
      ],
    );
    expect(game.activeScene?.id).toBe('s1');
    game.setActiveScene('s2');
    expect(game.activeScene?.id).toBe('s2');
  });

  it('throw quando setActiveScene recebe id inexistente', () => {
    const game = new Game(
      { initialScene: 's1', scenes: { s1: 's1' } },
      [{ id: 's1', name: 'S1', kind: '2d', rootObjects: [] }],
    );
    expect(() => game.setActiveScene('inexistente')).toThrow();
  });
});

describe('2D-specific components', () => {
  it('SpriteComponent expõe getters', () => {
    const c = new SpriteComponent({ textureKey: 'p', alpha: 0.5, flipX: true });
    expect(c.type).toBe('pixl.sprite');
    expect(c.textureKey).toBe('p');
    expect(c.alpha).toBe(0.5);
    expect(c.flipX).toBe(true);
  });

  it('Physics2DComponent exige body + shape', () => {
    expect(() => new Physics2DComponent({})).toThrow();
    const c = new Physics2DComponent({ body: 'dynamic', shape: 'box', size: { x: 32, y: 32 } });
    expect(c.body).toBe('dynamic');
    expect(c.shape).toBe('box');
  });

  it('TilemapComponent exige tilemapPath', () => {
    expect(() => new TilemapComponent({})).toThrow();
    const c = new TilemapComponent({ tilemapPath: 'Assets/Tilemaps/level.json' });
    expect(c.tilemapPath).toBe('Assets/Tilemaps/level.json');
  });

  it('Animation2DComponent exige animationKey + frames não-vazios', () => {
    expect(() => new Animation2DComponent({})).toThrow();
    expect(() => new Animation2DComponent({ animationKey: 'x', frames: [] })).toThrow();
    const c = new Animation2DComponent({
      animationKey: 'walk',
      frames: [{ key: 'p', frame: 0 }, { key: 'p', frame: 1 }],
      frameRate: 8,
      repeat: -1,
    });
    expect(c.animationKey).toBe('walk');
    expect(c.frameRate).toBe(8);
    expect(c.frames).toHaveLength(2);
  });
});
