// Load / save the project document at projectDir/project.pixlproject.json.
//
// Writes are atomic: write to a sibling .tmp file, then rename. This guarantees
// that a reader at any point sees either the previous valid document or the
// new one — never a half-written file. The OS rename(2) is atomic on the same
// filesystem (which the .tmp sibling guarantees).

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { sha256OfString } from '@pixlland/engine-core';

import { PIXL_PROJECT_DOCUMENT_FILENAME, type PixlProjectShape } from './schema.js';
import { OpInputError } from './types.js';

export const projectDocumentPath = (projectDir: string): string =>
  path.join(projectDir, PIXL_PROJECT_DOCUMENT_FILENAME);

export const loadProjectDocument = async (projectDir: string): Promise<PixlProjectShape> => {
  const filePath = projectDocumentPath(projectDir);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new OpInputError(`Project document not found at ${filePath}.`);
    }
    throw error;
  }
  try {
    return JSON.parse(raw) as PixlProjectShape;
  } catch (error) {
    throw new OpInputError(
      `Project document at ${filePath} is not valid JSON: ${(error as Error).message}`,
    );
  }
};

export interface SaveOptions {
  /** Override savedAt timestamp (defaults to Date.now()). Tests pass a fixed value. */
  savedAt?: number;
}

export const saveProjectDocument = async (
  projectDir: string,
  doc: PixlProjectShape,
  options: SaveOptions = {},
): Promise<string> => {
  const stamped: PixlProjectShape = { ...doc, savedAt: options.savedAt ?? Date.now() };
  const filePath = projectDocumentPath(projectDir);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const json = `${JSON.stringify(stamped, null, 2)}\n`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tmpPath, json, 'utf8');
  await fs.rename(tmpPath, filePath);
  return computeContentHash(stamped);
};

export const computeContentHash = async (doc: PixlProjectShape): Promise<string> => {
  const json = JSON.stringify(doc, null, 2);
  return sha256OfString(json);
};

/** Returns true if projectDir/project.pixlproject.json exists. */
export const projectDocumentExists = async (projectDir: string): Promise<boolean> => {
  try {
    await fs.access(projectDocumentPath(projectDir));
    return true;
  } catch {
    return false;
  }
};
