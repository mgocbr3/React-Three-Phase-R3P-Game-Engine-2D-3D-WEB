// Node-only helpers: read every file in a project folder into memory, write
// every file from a .pixl archive back to disk. Kept in a separate module so
// browser builds of @pixlland/engine-core never pull in node:fs / node:path.

import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  PIXL_PACKAGE_MANIFEST_PATH,
  PIXL_PROJECT_DOCUMENT_PATH,
} from './manifest.js';

const PROJECT_IGNORES = new Set<string>([
  'node_modules',
  '.git',
  '.DS_Store',
  '.pnpm-store',
  'Builds', // populated by export-* — never archived as project source
]);

const isIgnored = (segment: string): boolean => {
  if (PROJECT_IGNORES.has(segment)) return true;
  if (segment === PIXL_PACKAGE_MANIFEST_PATH) return true; // safety: packer rebuilds it
  return false;
};

const toPosix = (value: string): string => value.split(path.sep).join('/');

const walkProjectFiles = async function* (
  rootDir: string,
  current: string,
): AsyncGenerator<{ absPath: string; relPath: string }> {
  const dirents = await fs.readdir(current, { withFileTypes: true });
  for (const dirent of dirents) {
    if (isIgnored(dirent.name)) continue;
    const abs = path.join(current, dirent.name);
    if (dirent.isDirectory()) {
      yield* walkProjectFiles(rootDir, abs);
    } else if (dirent.isFile()) {
      yield { absPath: abs, relPath: toPosix(path.relative(rootDir, abs)) };
    }
  }
};

export const readProjectFolder = async (
  projectDir: string,
): Promise<{ path: string; bytes: Uint8Array }[]> => {
  const stat = await fs.stat(projectDir);
  if (!stat.isDirectory()) {
    throw new Error(`Pixl: not a directory: ${projectDir}`);
  }

  const projectFilePath = path.join(projectDir, PIXL_PROJECT_DOCUMENT_PATH);
  try {
    await fs.access(projectFilePath);
  } catch {
    throw new Error(
      `Pixl: ${PIXL_PROJECT_DOCUMENT_PATH} not found in ${projectDir}. Is this a PixlPlayground project folder?`,
    );
  }

  const files: { path: string; bytes: Uint8Array }[] = [];
  for await (const entry of walkProjectFiles(projectDir, projectDir)) {
    const data = await fs.readFile(entry.absPath);
    files.push({ path: entry.relPath, bytes: new Uint8Array(data) });
  }
  return files;
};

export const writeProjectFolder = async (
  projectDir: string,
  files: { path: string; bytes: Uint8Array }[],
): Promise<void> => {
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of files) {
    const abs = path.join(projectDir, file.path);
    const dir = path.dirname(abs);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(abs, file.bytes);
  }
};

export const writeBytesToFile = async (filePath: string, bytes: Uint8Array): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, bytes);
};

export const readBytesFromFile = async (filePath: string): Promise<Uint8Array> => {
  const data = await fs.readFile(filePath);
  return new Uint8Array(data);
};
