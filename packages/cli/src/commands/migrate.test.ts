import { describe, expect, it } from 'vitest';
import { applyMigration } from './migrate.js';
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
  },
};

const projectAt = (engineVersion = '0.1.0'): PixlProjectShape => ({
  format: 'pixlplayground-project',
  version: 2,
  id: 'p-1',
  name: 'Sample',
  activeSceneId: 'main',
  scenes: [{ id: 'main', name: 'Main', kind: '3d', rootObjects: [] }],
  engine: { name: 'PixlPlayground', version: engineVersion, schemaVersion: 2 },
  runtime: { primary: 'three-3d' },
});

describe('applyMigration', () => {
  it('atualiza engine.version', () => {
    const { project, steps } = applyMigration(projectAt('0.1.0'), manifest);
    expect(steps.some((s) => s.kind === 'engine-version')).toBe(true);
    expect(project.engine?.version).toBe('0.2.0');
  });

  it('preenche runtimeManifest faltante a partir do manifest', () => {
    const { project, steps } = applyMigration(projectAt('0.2.0'), manifest);
    expect(steps.some((s) => s.kind === 'runtime-manifest')).toBe(true);
    expect(project.engine?.runtimeManifest?.runtime).toBe('three-3d');
    expect(project.engine?.runtimeManifest?.dependencies.three).toBe('0.184.0');
  });

  it('nao gera passos quando projeto ja esta sincronizado', () => {
    const synced = projectAt('0.2.0');
    synced.engine!.runtimeManifest = {
      runtime: 'three-3d',
      dependencies: { three: '0.184.0', '@react-three/fiber': '9.6.1' },
    };
    const { steps } = applyMigration(synced, manifest);
    expect(steps).toHaveLength(0);
  });

  it('atualiza schemaVersion quando difere', () => {
    const project = projectAt('0.2.0');
    project.engine!.schemaVersion = 1;
    const { project: migrated, steps } = applyMigration(project, manifest);
    expect(steps.some((s) => s.kind === 'schema-version')).toBe(true);
    expect(migrated.engine?.schemaVersion).toBe(2);
  });

  it('nao toca runtimeManifest quando runtime.primary nao esta setado', () => {
    const project = projectAt('0.2.0');
    project.runtime = undefined;
    const { project: migrated, steps } = applyMigration(project, manifest);
    expect(steps.some((s) => s.kind === 'runtime-manifest')).toBe(false);
    expect(migrated.engine?.runtimeManifest).toBeUndefined();
  });

  it('reescreve runtimeManifest defasado pro pinned pelo manifest', () => {
    const project = projectAt('0.2.0');
    project.engine!.runtimeManifest = {
      runtime: 'three-3d',
      dependencies: { three: '0.171.0', '@react-three/fiber': '8.0.0', 'random-pkg': '1.0.0' },
    };
    const { project: migrated, steps } = applyMigration(project, manifest);
    expect(steps.some((s) => s.kind === 'runtime-manifest')).toBe(true);
    expect(migrated.engine?.runtimeManifest?.dependencies.three).toBe('0.184.0');
    expect(migrated.engine?.runtimeManifest?.dependencies['random-pkg']).toBeUndefined();
  });
});
