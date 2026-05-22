import { writeFile } from 'node:fs/promises';
import type { EngineVersionsManifest, PixlProjectShape } from '../schema.js';
import { compareProjectAgainstManifest, type OutdatedReport } from './outdated.js';
import { loadProjectWithManifest } from './manifest-loader.js';

export interface MigrationStep {
  kind: 'engine-version' | 'schema-version' | 'runtime-manifest';
  description: string;
}

export interface MigrationResult {
  projectPath: string;
  manifestPath: string;
  before: OutdatedReport;
  applied: MigrationStep[];
  dryRun: boolean;
  written: boolean;
}

export interface MigrationOptions {
  dryRun?: boolean;
}

export const applyMigration = (
  project: PixlProjectShape,
  manifest: EngineVersionsManifest,
): { project: PixlProjectShape; steps: MigrationStep[] } => {
  const steps: MigrationStep[] = [];
  const next = JSON.parse(JSON.stringify(project)) as PixlProjectShape;
  next.engine = next.engine ?? {};

  if (next.engine.version !== manifest.engine.version) {
    steps.push({
      kind: 'engine-version',
      description: `engine.version: ${next.engine.version ?? '(none)'} -> ${manifest.engine.version}`,
    });
    next.engine.version = manifest.engine.version;
  }

  if (next.engine.schemaVersion !== manifest.schemaVersion) {
    steps.push({
      kind: 'schema-version',
      description: `engine.schemaVersion: ${next.engine.schemaVersion ?? '(none)'} -> ${manifest.schemaVersion}`,
    });
    next.engine.schemaVersion = manifest.schemaVersion;
  }

  const runtime = next.runtime?.primary;
  const blessed = runtime ? manifest.runtimes[runtime]?.dependencies : undefined;
  if (runtime && blessed) {
    const currentManifest = next.engine.runtimeManifest;
    const currentDeps = currentManifest?.dependencies ?? {};
    const hasChange =
      !currentManifest ||
      currentManifest.runtime !== runtime ||
      Object.entries(blessed).some(([pkg, version]) => currentDeps[pkg] !== version) ||
      Object.keys(currentDeps).some((pkg) => !(pkg in blessed));

    if (hasChange) {
      steps.push({
        kind: 'runtime-manifest',
        description: `engine.runtimeManifest realinhado pro runtime "${runtime}" (${Object.keys(blessed).length} deps).`,
      });
      next.engine.runtimeManifest = {
        runtime,
        dependencies: { ...blessed },
      };
    }
  }

  return { project: next, steps };
};

export const runMigrate = async (
  projectPath: string,
  options: MigrationOptions = {},
): Promise<MigrationResult> => {
  const loaded = await loadProjectWithManifest(projectPath);
  const before = compareProjectAgainstManifest(loaded.project, loaded.manifest, loaded.projectPath, loaded.manifestPath);
  const { project: migrated, steps } = applyMigration(loaded.project, loaded.manifest);

  let written = false;
  if (steps.length > 0 && !options.dryRun) {
    await writeFile(loaded.projectPath, `${JSON.stringify(migrated, null, 2)}\n`, 'utf8');
    written = true;
  }

  return {
    projectPath: loaded.projectPath,
    manifestPath: loaded.manifestPath,
    before,
    applied: steps,
    dryRun: Boolean(options.dryRun),
    written,
  };
};

export const printMigrationResult = (result: MigrationResult): void => {
  console.log(`pixl-engine migrate ${result.projectPath}${result.dryRun ? ' (dry-run)' : ''}`);
  console.log(`  manifest:  ${result.manifestPath}`);

  if (!result.applied.length) {
    console.log('Sem alteracoes pendentes — projeto ja alinhado com o manifest.');
    return;
  }

  console.log(`Aplicado ${result.applied.length} passo(s):`);
  result.applied.forEach((step) => console.log(`  - ${step.description}`));

  if (result.dryRun) {
    console.log('\nDry-run: nenhum arquivo escrito.');
  } else if (result.written) {
    console.log('\nProjeto atualizado em disco.');
  }
};
