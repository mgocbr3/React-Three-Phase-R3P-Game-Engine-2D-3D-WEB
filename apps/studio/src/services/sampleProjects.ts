import { applyProjectDocumentToEditor } from './localProjectFiles';
import type { AnyPixlProjectDocument, PixlProjectDocument } from '@/engine/project/schema';
import { normalizeProjectDocument } from '@/engine/project/editorProjectAdapter';

const SAMPLE_PROJECTS: Record<string, string> = {
  'harvest-rush-3d': '/sample-projects/harvest-rush-3d/project.pixlproject.json',
};

export const hasSampleProject = (slug: string) => Boolean(SAMPLE_PROJECTS[slug]);

export const loadSampleProjectDocument = async (slug: string): Promise<PixlProjectDocument> => {
  const url = SAMPLE_PROJECTS[slug];
  if (!url) {
    throw new Error(`Projeto local nao encontrado: ${slug}`);
  }

  const response = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Nao foi possivel abrir o projeto ${slug}.`);
  }

  return normalizeProjectDocument(await response.json() as AnyPixlProjectDocument);
};

export const openSampleProject = async (slug: string): Promise<PixlProjectDocument> => {
  const document = await loadSampleProjectDocument(slug);
  applyProjectDocumentToEditor(document);
  return document;
};
