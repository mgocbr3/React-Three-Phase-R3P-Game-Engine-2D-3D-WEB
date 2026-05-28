import { applyProjectDocumentToEditor, resolveProjectDocumentAssetUrls } from './localProjectFiles';
import type { AnyPixlProjectDocument, PixlProjectDocument } from '@/engine/project/schema';
import { normalizeProjectDocument } from '@/engine/project/editorProjectAdapter';
import { loadProjectDocSnapshot } from './projectDocStorage';
import { mergeSnapshotOntoFresh } from './snapshotMerge';

const REPO_ROOT = import.meta.env.VITE_PIXL_REPO_ROOT as string | undefined;
const REPO_FS_ROOT = REPO_ROOT?.replace(/^\/+/, '');

export type SampleKind = '2d' | '3d';
export type SampleAccent = 'purple' | 'cyan' | 'pink' | 'orange' | 'red' | 'green' | 'blue';

export interface SampleProjectMeta {
  /** Public URL the studio fetches `project.pixlproject.json` from. */
  projectUrl: string;
  /** Optional asset base used when binaries live outside the project dir. */
  assetBaseUrl?: string;
  /** Optional packaged runtime root used by Play Mode. */
  runtimeBaseUrl?: string;
  /** Optional document base used by runtime relative assets. */
  documentBaseUrl?: string;
  /** Whether the Hub should open this sample through the native runtime viewport. */
  useNativeViewport?: boolean;
  /** Human-friendly title for Hub cards / page titles. */
  displayName: string;
  /** One-line elevator pitch shown beneath the title in the Hub. */
  description: string;
  /** Routes the editor to the right viewport (Three vs Phaser). */
  kind: SampleKind;
  /** Accent color for the Hub card. Optional — defaults to neutral. */
  accent?: SampleAccent;
  /** Keep direct URLs working without surfacing internal demos in the Hub. */
  hidden?: boolean;
}

const SAMPLE_PROJECTS: Record<string, SampleProjectMeta> = {
  'harvest-rush-3d': {
    projectUrl: '/sample-projects/harvest-rush-3d/project.pixlproject.json',
    assetBaseUrl: '/sample-projects/harvest-rush-3d/',
    runtimeBaseUrl: '/sample-projects/harvest-rush-3d/runtime/',
    documentBaseUrl: '/sample-projects/harvest-rush-3d/',
    displayName: 'Harvest Rush 3D',
    description: 'Farming sandbox 3D — Farm.glb completo, 11k+ objetos da cena decomposta',
    kind: '3d',
    accent: 'green',
  },
  'magic-battleground-mvp': {
    projectUrl: '/sample-projects/magic-battleground-mvp/project.pixlproject.json',
    // Não é o jogo Magic Battleground (que é 2D) — é um demo do pixl.primitive
    // component em 3D. Renomeado em apresentação pra deixar isso claro.
    displayName: 'Primitive Demo (3D)',
    description: 'Demonstração do componente pixl.primitive — box, sphere, cone, torus, plane',
    kind: '3d',
    accent: 'purple',
    hidden: true,
  },
  'magic-battleground-2d': {
    projectUrl: '/sample-projects/magic-battleground-2d/project.pixlproject.json',
    displayName: 'Magic Battleground 2D',
    description: 'Side-view fighter inspirado no jogo da Poki — mago, inimigo, rune glows, fireball',
    kind: '2d',
    accent: 'pink',
  },
  'sample-2d': {
    projectUrl: '/sample-projects/sample-2d/project.pixlproject.json',
    displayName: 'Sample 2D',
    description: 'Cena 2D mínima — player, inimigo, plataforma, moeda. Boilerplate de teste',
    kind: '2d',
    accent: 'cyan',
    hidden: true,
  },
  'where-angels-die': {
    projectUrl: '/sample-projects/where-angels-die/project.pixlproject.json',
    assetBaseUrl: import.meta.env.DEV && REPO_FS_ROOT ? `/@fs/${REPO_FS_ROOT}/doc/Three/WAD/` : undefined,
    useNativeViewport: false,
    displayName: 'Where Angels Die',
    description: 'Survival horror 3D migrado do Babylon 9 - cidade procedural, Sledge High e horda zumbi',
    kind: '3d',
    accent: 'red',
  },
};

const getSampleDocumentBaseUrl = (sample: SampleProjectMeta): string => (
  sample.projectUrl.replace(/\/project\.pixlproject\.json$/i, '')
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const applySampleRuntimeBases = (
  document: PixlProjectDocument,
  sample: SampleProjectMeta,
): PixlProjectDocument => {
  if (!sample.runtimeBaseUrl && !sample.documentBaseUrl) return document;
  const source = isRecord(document.game.source) ? document.game.source : {};
  return {
    ...document,
    game: {
      ...document.game,
      source: {
        ...source,
        ...(sample.runtimeBaseUrl ? { runtimeBaseUrl: sample.runtimeBaseUrl } : {}),
        ...(sample.documentBaseUrl ? { documentBaseUrl: sample.documentBaseUrl } : {}),
      },
    },
  };
};

export interface SampleProjectEntry extends SampleProjectMeta {
  slug: string;
}

/** Snapshot of every registered sample. Used by the Hub to render cards. */
export const listSampleProjects = (): SampleProjectEntry[] =>
  Object.entries(SAMPLE_PROJECTS).flatMap(([slug, meta]) => (
    meta.hidden ? [] : [{ slug, ...meta }]
  ));

/** Build the editor URL that opens a sample directly into its right viewport. */
export const buildSampleEditorUrl = (slug: string): string | null => {
  const meta = SAMPLE_PROJECTS[slug];
  if (!meta) return null;
  const params = new URLSearchParams();
  params.set('sampleProject', slug);
  if (meta.useNativeViewport !== false) params.set('engine', 'native');
  params.set('kind', meta.kind);
  return `/editor?${params.toString()}`;
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
  const resolved = await resolveProjectDocumentAssetUrls(document, {
    assetBaseUrl: sample.assetBaseUrl ?? getSampleDocumentBaseUrl(sample),
  });
  return applySampleRuntimeBases(resolved, sample);
};

export const openSampleProject = async (slug: string): Promise<PixlProjectDocument> => {
  const fresh = await loadSampleProjectDocument(slug);
  // Merge the user's autosaved edits ONTO the fresh sample. The snapshot
  // only carries transform / visible / locked / name per object — render
  // data (imageUrl, color, etc.) stays from the sample author, because
  // the editor adapter that writes the snapshot doesn't preserve them.
  // See `snapshotMerge.ts` for the rationale + the PLAN.md item that
  // would eventually let us replace the doc wholesale.
  const snapshot = loadProjectDocSnapshot(fresh.id);
  const useSnapshot = !!(snapshot
    && typeof snapshot.savedAt === 'number'
    && snapshot.savedAt > (fresh.savedAt ?? 0));
  const document = useSnapshot ? mergeSnapshotOntoFresh(fresh, snapshot) : fresh;
  applyProjectDocumentToEditor(document, {
    assetBaseUrl: SAMPLE_PROJECTS[slug].assetBaseUrl ?? getSampleDocumentBaseUrl(SAMPLE_PROJECTS[slug]),
  });
  return document;
};
