import type { EngineVersionsManifest, PixlProjectShape } from '../schema.js';
import { loadProjectWithManifest } from './manifest-loader.js';

export interface OutdatedDiff {
  package: string;
  projectVersion: string;
  manifestVersion: string;
}

export interface OutdatedReport {
  projectPath: string;
  manifestPath: string;
  runtime: string | null;
  engineVersion: { project: string | null; manifest: string };
  schemaVersion: { project: number | null; manifest: number };
  driftingDependencies: OutdatedDiff[];
  missingDependencies: string[];
  extraDependencies: string[];
  ok: boolean;
}

export const compareProjectAgainstManifest = (
  project: PixlProjectShape,
  manifest: EngineVersionsManifest,
  projectPath: string,
  manifestPath: string,
): OutdatedReport => {
  const runtime = project.runtime?.primary ?? null;
  const projectDeps = project.engine?.runtimeManifest?.dependencies ?? {};

  const blessed = runtime ? manifest.runtimes[runtime]?.dependencies : undefined;
  const driftingDependencies: OutdatedDiff[] = [];
  const missingDependencies: string[] = [];
  const extraDependencies: string[] = [];

  if (blessed) {
    for (const [pkg, version] of Object.entries(blessed)) {
      const projectVersion = projectDeps[pkg];
      if (projectVersion === undefined) {
        missingDependencies.push(pkg);
      } else if (projectVersion !== version) {
        driftingDependencies.push({ package: pkg, projectVersion, manifestVersion: version });
      }
    }
    for (const pkg of Object.keys(projectDeps)) {
      if (!(pkg in blessed)) extraDependencies.push(pkg);
    }
  }

  const ok =
    driftingDependencies.length === 0 &&
    missingDependencies.length === 0 &&
    extraDependencies.length === 0 &&
    project.engine?.version === manifest.engine.version &&
    project.engine?.schemaVersion === manifest.schemaVersion;

  return {
    projectPath,
    manifestPath,
    runtime,
    engineVersion: {
      project: project.engine?.version ?? null,
      manifest: manifest.engine.version,
    },
    schemaVersion: {
      project: project.engine?.schemaVersion ?? null,
      manifest: manifest.schemaVersion,
    },
    driftingDependencies,
    missingDependencies,
    extraDependencies,
    ok,
  };
};

export const runOutdated = async (projectPath: string): Promise<OutdatedReport> => {
  const loaded = await loadProjectWithManifest(projectPath);
  return compareProjectAgainstManifest(loaded.project, loaded.manifest, loaded.projectPath, loaded.manifestPath);
};

export const printOutdatedReport = (report: OutdatedReport): void => {
  console.log(`pixl-engine outdated ${report.projectPath}`);
  console.log(`  manifest:           ${report.manifestPath}`);
  console.log(`  runtime:            ${report.runtime ?? '(nao definido)'}`);
  console.log(`  engine version:     ${report.engineVersion.project ?? '(nao definido)'} -> ${report.engineVersion.manifest}`);
  console.log(`  schema version:     ${report.schemaVersion.project ?? '(nao definido)'} -> ${report.schemaVersion.manifest}`);
  console.log('');

  if (report.driftingDependencies.length) {
    console.log(`dependencias defasadas (${report.driftingDependencies.length}):`);
    report.driftingDependencies.forEach((diff) => {
      console.log(`  ${diff.package}: ${diff.projectVersion} -> ${diff.manifestVersion}`);
    });
    console.log('');
  }

  if (report.missingDependencies.length) {
    console.log(`dependencias faltando (${report.missingDependencies.length}):`);
    report.missingDependencies.forEach((pkg) => console.log(`  ${pkg}`));
    console.log('');
  }

  if (report.extraDependencies.length) {
    console.log(`dependencias extras nao abencoadas (${report.extraDependencies.length}):`);
    report.extraDependencies.forEach((pkg) => console.log(`  ${pkg}`));
    console.log('');
  }

  console.log(report.ok ? 'OK (em sincronia com o manifest)' : 'OUTDATED — rode `pixl-engine migrate` pra alinhar.');
};
