import { describe, expect, it } from 'vitest';
import { buildProjectDocument } from './new.js';
import type { EngineVersionsManifest } from '../schema.js';
import { PIXL_PROJECT_FORMAT, PIXL_PROJECT_VERSION } from '../schema.js';

const manifest: EngineVersionsManifest = {
  manifestVersion: 1,
  engine: { name: 'PixlPlayground', version: '0.2.0' },
  schemaVersion: 2,
  runtimes: {
    'three-3d': { dependencies: { three: '0.184.0' } },
    'phaser-2d': { dependencies: { phaser: '4.1.0' } },
  },
};

const fixedId = 'project_test';
const fixedNow = 1000000;

describe('buildProjectDocument', () => {
  it('cria projeto 3D com runtime three-3d e cena 3D', () => {
    const doc = buildProjectDocument(
      { name: 'My Game', targetDir: '/tmp/my-game', kind: '3d' },
      manifest,
      fixedNow,
      fixedId,
    );
    expect(doc.format).toBe(PIXL_PROJECT_FORMAT);
    expect(doc.version).toBe(PIXL_PROJECT_VERSION);
    expect(doc.id).toBe(fixedId);
    expect(doc.name).toBe('My Game');
    expect(doc.slug).toBe('my-game');
    expect(doc.runtime?.primary).toBe('three-3d');
    expect(doc.scenes[0].kind).toBe('3d');
    expect(doc.engine?.runtimeManifest?.dependencies.three).toBe('0.184.0');
  });

  it('cria projeto 2D com runtime phaser-2d e cena 2D', () => {
    const doc = buildProjectDocument(
      { name: 'Average Routine Clone', targetDir: '/tmp/avg', kind: '2d' },
      manifest,
      fixedNow,
      fixedId,
    );
    expect(doc.runtime?.primary).toBe('phaser-2d');
    expect(doc.scenes[0].kind).toBe('2d');
    expect(doc.engine?.runtimeManifest?.dependencies.phaser).toBe('4.1.0');
  });

  it('gera slug a partir do nome com caracteres especiais', () => {
    const doc = buildProjectDocument(
      { name: 'Bola Doida! (BR)', targetDir: '/tmp', kind: '3d' },
      manifest,
      fixedNow,
      fixedId,
    );
    expect(doc.slug).toBe('bola-doida-br');
  });

  it('preenche assets.folders com a estrutura padrao', () => {
    const doc = buildProjectDocument(
      { name: 'Test', targetDir: '/tmp', kind: '3d' },
      manifest,
      fixedNow,
      fixedId,
    );
    expect(doc.assets?.folders).toContain('Assets/3D_Models');
    expect(doc.assets?.folders).toContain('Assets/Sprites');
    expect(doc.assets?.folders).toContain('Scenes');
    expect(doc.assets?.folders).toContain('Scripts');
  });

  it('escolhe rapier pra fisica em 3D e arcade em 2D', () => {
    const doc3d = buildProjectDocument(
      { name: 'A', targetDir: '/tmp/a', kind: '3d' },
      manifest,
      fixedNow,
      fixedId,
    );
    const doc2d = buildProjectDocument(
      { name: 'B', targetDir: '/tmp/b', kind: '2d' },
      manifest,
      fixedNow,
      fixedId,
    );
    expect(doc3d.scenes[0].physics?.engine).toBe('rapier');
    expect(doc2d.scenes[0].physics?.engine).toBe('arcade');
  });
});
