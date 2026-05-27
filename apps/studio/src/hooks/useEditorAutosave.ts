/**
 * Autosave the editor's working document to localStorage on a debounced timer.
 *
 * Why: `useEditorStore.updateObject` mutates in-memory state, but until this
 * hook was added nothing was syncing those mutations back to
 * `pixl-project-document` (or to the per-project snapshot key). That meant
 * any Inspector edit, drag, scale, or gizmo move was lost on reload — the
 * editor would re-hydrate from the original sample doc on next load.
 *
 * This hook subscribes to the slice of editor state that actually affects
 * persistence (objects, scene kind, assets, script + transform settings) and,
 * after a 500 ms debounce,
 * writes a fresh `PixlProjectDocument` to both the singleton key and the
 * per-id snapshot key (the latter is what `openStoredProjectWorkspace`
 * uses as fallback when a project has no file-system backing).
 */
import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { useAssetStore } from '@/stores/assetStore';
import {
  createActiveProjectDocumentSnapshot,
  hasLoadedAnyProjectDocument,
  type LocalProjectWorkspace,
} from '@/services/localProjectFiles';
import {
  SINGLE_PROJECT_DOC_KEY,
  saveProjectDocSnapshot,
} from '@/services/projectDocStorage';

interface UseEditorAutosaveArgs {
  /** Project name to embed in the saved document. */
  projectName?: string;
  /** Debounce window in ms. Default 500. */
  debounceMs?: number;
  /** Disable entirely (e.g. in legacy cloud path that owns its own save). */
  enabled?: boolean;
}

const safeWrite = (key: string, value: string): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (error) {
    console.warn(`[useEditorAutosave] Failed to persist ${key}:`, error);
  }
};

export const useEditorAutosave = ({
  projectName,
  debounceMs = 500,
  enabled = true,
}: UseEditorAutosaveArgs = {}): void => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteSignatureRef = useRef<string>('');

  // Track the slices that matter for persistence. We deliberately read the
  // FULL objects array (a reference, not a deep value) because zustand's
  // selector returns the same reference unless the array identity changes
  // — and `updateObject` always rebuilds `objects` via `state.objects.map`,
  // so this fires exactly when something actually mutated.
  const objects = useEditorStore((s) => s.objects);
  const activeSceneKind = useEditorStore((s) => s.activeSceneKind);
  const transformSpace = useEditorStore((s) => s.transformSpace);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const snapTranslate = useEditorStore((s) => s.snapTranslate);
  const snapRotate = useEditorStore((s) => s.snapRotate);
  const snapScale = useEditorStore((s) => s.snapScale);
  const gameScript = useEditorStore((s) => s.gameScript);
  const projectAssets = useAssetStore((s) => s.projectAssets);

  useEffect(() => {
    if (!enabled) return undefined;
    // Skip autosave during the boot window before any project document has
    // been loaded. Without this guard, the hook would fire on the first
    // render with an empty `objects` array AND `currentProjectDocument`
    // still null — `createProjectDocumentFromEditor` would then generate a
    // fresh `project_<random>` id and persist an orphan doc under
    // `pixl-project-doc:project_<random>`. Subsequent sample loads would
    // happen against the right id, but the orphan stays around forever.
    if (!hasLoadedAnyProjectDocument()) return undefined;
    // Also skip if there's literally nothing in the scene yet — same
    // reasoning, no useful work to persist.
    if (!objects || objects.length === 0) return undefined;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      // Re-check inside the timeout: a project may have been unloaded
      // between effect schedule and fire.
      if (!hasLoadedAnyProjectDocument()) return;
      try {
        const snapshot = createActiveProjectDocumentSnapshot(projectName);
        if (snapshot.signature === lastWriteSignatureRef.current) return;
        lastWriteSignatureRef.current = snapshot.signature;

        const doc = snapshot.document;
        const serialized = JSON.stringify(doc);
        safeWrite(SINGLE_PROJECT_DOC_KEY, serialized);
        saveProjectDocSnapshot(doc);

        // Editor diagnostics — strip later. Helpful for the QA harness to
        // know when the last autosave landed.
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__pixlAutosaveLast = { id: doc.id, savedAt: doc.savedAt };
        }
      } catch (error) {
        console.warn('[useEditorAutosave] Failed:', error);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    enabled,
    debounceMs,
    projectName,
    objects,
    activeSceneKind,
    transformSpace,
    snapEnabled,
    snapTranslate,
    snapRotate,
    snapScale,
    gameScript,
    projectAssets,
  ]);
};

// Type re-export so callers don't need a second import to type the workspace.
export type { LocalProjectWorkspace };
