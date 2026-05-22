import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { EngineVersionsManifest, PixlProjectShape } from '../schema.js';

export interface FindManifestOptions {
  startKind?: 'file' | 'directory';
}

export const findEngineManifest = async (
  startFromPath: string,
  options: FindManifestOptions = {},
): Promise<{ path: string; manifest: EngineVersionsManifest }> => {
  let current = options.startKind === 'directory' ? startFromPath : dirname(startFromPath);
  while (true) {
    const candidate = join(current, 'engine', 'engine.versions.json');
    try {
      const raw = await readFile(candidate, 'utf8');
      return { path: candidate, manifest: JSON.parse(raw) as EngineVersionsManifest };
    } catch {
      const parent = dirname(current);
      if (parent === current) {
        throw new Error(
          `engine/engine.versions.json nao encontrado a partir de ${startFromPath}. Rode o comando dentro do monorepo Pixlland.`,
        );
      }
      current = parent;
    }
  }
};

export interface LoadedProject {
  projectPath: string;
  project: PixlProjectShape;
  manifestPath: string;
  manifest: EngineVersionsManifest;
}

export const loadProjectWithManifest = async (projectPath: string): Promise<LoadedProject> => {
  const absoluteProject = resolve(process.cwd(), projectPath);
  const raw = await readFile(absoluteProject, 'utf8');
  const project = JSON.parse(raw) as PixlProjectShape;
  const { path: manifestPath, manifest } = await findEngineManifest(absoluteProject);
  return { projectPath: absoluteProject, project, manifestPath, manifest };
};
