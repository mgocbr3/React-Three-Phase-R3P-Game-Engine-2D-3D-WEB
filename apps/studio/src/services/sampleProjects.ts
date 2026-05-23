import { applyProjectDocumentToEditor, resolveProjectDocumentAssetUrls } from './localProjectFiles';
import type { AnyPixlProjectDocument, PixlProjectDocument } from '@/engine/project/schema';
import { normalizeProjectDocument } from '@/engine/project/editorProjectAdapter';

const REPO_ROOT = import.meta.env.VITE_PIXL_REPO_ROOT as string | undefined;
const REPO_FS_ROOT = REPO_ROOT?.replace(/^\/+/, '');

const SAMPLE_PROJECTS: Record<string, { projectUrl: string; assetBaseUrl?: string }> = {
  'harvest-rush-3d': {
    projectUrl: '/sample-projects/harvest-rush-3d/project.pixlproject.json',
    assetBaseUrl: import.meta.env.DEV && REPO_FS_ROOT ? `/@fs/${REPO_FS_ROOT}/apps/portal/games-src/harvest-rush-3d/` : undefined,
  },
  'magic-battleground-mvp': {
    projectUrl: '/sample-projects/magic-battleground-mvp/project.pixlproject.json',
    // No external assetBaseUrl — every entity is a pixl.primitive, no GLBs to resolve.
  },
};

export const hasSampleProject = (slug: string) => Boolean(SAMPLE_PROJECTS[slug]);

export const loadSampleProjectDocument = async (slug: string): Promise<PixlProjectDocument> => {
  const sample = SAMPLE_PROJECTS[slug];
  if (!sample) {
    throw new Error(`Projeto local nao encontrado: ${slug}`);
  }

  const response = await fetch(`${sample.projectUrl}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Nao foi possivel abrir o projeto ${slug}.`);
  }

  const document = normalizeProjectDocument(await response.json() as AnyPixlProjectDocument);
  return resolveProjectDocumentAssetUrls(document, { assetBaseUrl: sample.assetBaseUrl });
};

export const openSampleProject = async (slug: string): Promise<PixlProjectDocument> => {
  const document = await loadSampleProjectDocument(slug);
  applyProjectDocumentToEditor(document, { assetBaseUrl: SAMPLE_PROJECTS[slug].assetBaseUrl ?? null });
  return document;
};
