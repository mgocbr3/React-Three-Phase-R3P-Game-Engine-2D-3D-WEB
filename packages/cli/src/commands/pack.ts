import path from 'node:path';

import {
  packProject,
  readManifestFromPackage,
  unpackPackage,
  type PixlPackageManifest,
} from '@pixlland/engine-core';
import {
  readBytesFromFile,
  readProjectFolder,
  writeBytesToFile,
  writeProjectFolder,
} from '@pixlland/engine-core/node';

export interface PackResult {
  outPath: string;
  manifest: PixlPackageManifest;
  archiveSize: number;
}

export interface UnpackResult {
  outDir: string;
  manifest: PixlPackageManifest;
  fileCount: number;
}

export const runPack = async (
  projectDir: string,
  outFile: string,
  options: { packedAt?: number } = {},
): Promise<PackResult> => {
  const absProjectDir = path.resolve(projectDir);
  const absOutFile = path.resolve(outFile);

  const files = await readProjectFolder(absProjectDir);
  const { bytes, manifest } = await packProject({ files, packedAt: options.packedAt });
  await writeBytesToFile(absOutFile, bytes);

  return { outPath: absOutFile, manifest, archiveSize: bytes.byteLength };
};

export const runUnpack = async (
  inFile: string,
  projectDir: string,
): Promise<UnpackResult> => {
  const absInFile = path.resolve(inFile);
  const absOutDir = path.resolve(projectDir);

  const bytes = await readBytesFromFile(absInFile);
  const { manifest, files } = await unpackPackage(bytes);
  await writeProjectFolder(absOutDir, files);

  return { outDir: absOutDir, manifest, fileCount: files.length };
};

export const runInspect = async (
  inFile: string,
): Promise<PixlPackageManifest> => {
  const absInFile = path.resolve(inFile);
  const bytes = await readBytesFromFile(absInFile);
  return readManifestFromPackage(bytes);
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const printPackResult = (result: PackResult): void => {
  console.log('pixl-engine pack');
  console.log(`  out:        ${result.outPath}`);
  console.log(`  size:       ${formatSize(result.archiveSize)}`);
  console.log(`  files:      ${result.manifest.files.length}`);
  console.log(`  project:    ${result.manifest.projectName} (${result.manifest.projectSlug})`);
  console.log(`  runtime:    ${result.manifest.runtime.primary}`);
  console.log(`  hash:       ${result.manifest.contentHash}`);
};

export const printUnpackResult = (result: UnpackResult): void => {
  console.log('pixl-engine unpack');
  console.log(`  out:        ${result.outDir}`);
  console.log(`  files:      ${result.fileCount}`);
  console.log(`  project:    ${result.manifest.projectName} (${result.manifest.projectSlug})`);
  console.log(`  runtime:    ${result.manifest.runtime.primary}`);
  console.log(`  hash:       ${result.manifest.contentHash}`);
};

export const printInspectResult = (manifest: PixlPackageManifest): void => {
  console.log('pixl-engine inspect');
  console.log(`  project:    ${manifest.projectName} (${manifest.projectSlug})`);
  console.log(`  id:         ${manifest.projectId}`);
  console.log(`  engine:     ${manifest.engine.name} ${manifest.engine.version} (schema v${manifest.engine.schemaVersion})`);
  console.log(`  runtime:    ${manifest.runtime.primary} renderers=[${manifest.runtime.renderers.join(',')}] physics=[${manifest.runtime.physics.join(',')}]`);
  console.log(`  files:      ${manifest.files.length}`);
  console.log(`  createdAt:  ${new Date(manifest.createdAt).toISOString()}`);
  console.log(`  packedAt:   ${new Date(manifest.packedAt).toISOString()}`);
  console.log(`  hash:       ${manifest.contentHash}`);
};
