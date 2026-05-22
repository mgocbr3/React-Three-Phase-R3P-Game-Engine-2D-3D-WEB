import { describe, expect, it } from 'vitest';
import { compareProjectAgainstManifest } from './outdated.js';
import type { EngineVersionsManifest, PixlProjectShape } from '../schema.js';

const manifest: EngineVersionsManifest = {
  manifestVersion: 1,
  engine: { name: 'PixlPlayground', version: '0.2.0' },
  schemaVersion: 2,
  runtimes: {
    'three-3d': {
      dependencies: {
        three: '0.184.0',
        '@react-three/fiber': '9.6.1',
      },
    },
    'phaser-2d': {
      dependencies: {
        phaser: '4.1.0',
      },
    },
  },
};

const baseProject = (): PixlProjectShape => ({
  format: 'pixlplayground-project',
  version: 2,
  id: 'p-1',
  name: 'Sample',
  activeSceneId: 'main',
  scenes: [{ id: 'main', name: 'Main', kind: '3d', rootObjects: [] }],
  engine: {
    name: 'PixlPlayground',
    version: '0.2.0',
    schemaVersion: 2,
    runtimeManifest: {
      runtime: 'three-3d',
      dependencies: { three: '0.184.0', '@react-three/fiber': '9.6.1' },
    },
  },
  runtime: { primary: 'three-3d' },
});

describe('compareProjectAgainstManifest', () => {
  it('reporta OK quando projeto coincide com manifest', () => {
    const report = compareProjectAgainstManifest(baseProject(), manifest, '/tmp/p.json', '/tmp/m.json');
    expect(report.ok).toBe(true);
    expect(report.driftingDependencies).toHaveLength(0);
    expect(report.missingDependencies).toHaveLength(0);
    expect(report.extraDependencies).toHaveLength(0);
  });

  it('detecta dependencia defasada', () => {
    const project = baseProject();
    project.engine!.runtimeManifest!.dependencies.three = '0.171.0';
    const report = compareProjectAgainstManifest(project, manifest, '/tmp/p.json', '/tmp/m.json');
    expect(report.ok).toBe(false);
    expect(report.driftingDependencies).toEqual([
      { package: 'three', projectVersion: '0.171.0', manifestVersion: '0.184.0' },
    ]);
  });

  it('detecta dependencia faltando no projeto', () => {
    const project = baseProject();
    delete project.engine!.runtimeManifest!.dependencies['@react-three/fiber'];
    const report = compareProjectAgainstManifest(project, manifest, '/tmp/p.json', '/tmp/m.json');
    expect(report.missingDependencies).toContain('@react-three/fiber');
    expect(report.ok).toBe(false);
  });

  it('detecta dependencia extra nao abencoada', () => {
    const project = baseProject();
    project.engine!.runtimeManifest!.dependencies['random-pkg'] = '1.0.0';
    const report = compareProjectAgainstManifest(project, manifest, '/tmp/p.json', '/tmp/m.json');
    expect(report.extraDependencies).toContain('random-pkg');
    expect(report.ok).toBe(false);
  });

  it('reporta runtime nulo quando project.runtime.primary nao esta setado', () => {
    const project = baseProject();
    project.runtime = undefined;
    const report = compareProjectAgainstManifest(project, manifest, '/tmp/p.json', '/tmp/m.json');
    expect(report.runtime).toBeNull();
  });
});
