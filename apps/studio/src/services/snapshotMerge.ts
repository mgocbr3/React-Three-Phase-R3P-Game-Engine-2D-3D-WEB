/**
 * Merge a snapshot's transform/visibility edits INTO a fresh sample doc
 * rather than replacing the doc wholesale.
 *
 * Why: useEditorAutosave persists a doc derived from `editorObjectToSceneObject`
 * (the adapter that flattens the legacy `SceneObject[]` model into the new
 * PixlSceneObject schema). That adapter is incomplete — it stores legacy data
 * inside `data.editorObject` and does NOT preserve render-side fields like
 * `data.imageUrl`, `data.frameWidth`, `data.color`, etc. that the runtime
 * adapters (PhaserRuntimeMount.drawObject, three-runtime) read directly.
 *
 * If we replaced the fresh sample with the snapshot, sprites would render as
 * magenta "missing texture" placeholders because the snapshot has no
 * `imageUrl` field. Instead we keep the sample's render data and only port
 * over the bits the user can actually edit: transform, visible, locked.
 *
 * Tracked in PLAN.md item 1 ("PixlSceneDocument is the source of truth").
 * Once that refactor lands, the snapshot will be self-sufficient and this
 * merge can collapse back to a direct doc replacement.
 */
import type { PixlProjectDocument, PixlSceneObject } from '@/engine/project/schema';

interface MergeableTransform {
  position?: PixlSceneObject['transform']['position'];
  rotation?: PixlSceneObject['transform']['rotation'];
  scale?: PixlSceneObject['transform']['scale'];
}

// PixlSceneObject is flat — hierarchy is expressed via `parentId`, not
// nested `children`. Each scene exposes `rootObjects: PixlSceneObject[]`
// at the top level, so a single-pass map is enough.
const indexById = (
  objects: readonly PixlSceneObject[],
): Map<string, PixlSceneObject> => {
  const out = new Map<string, PixlSceneObject>();
  for (const obj of objects) {
    if (obj.id) out.set(obj.id, obj);
  }
  return out;
};

const mergeObject = (
  fresh: PixlSceneObject,
  snapMatch: PixlSceneObject | undefined,
): PixlSceneObject => {
  if (!snapMatch) return fresh;
  // Only port over fields the user can edit. Render data (data.imageUrl,
  // data.color, etc.) stays as the sample author wrote it — the snapshot's
  // version is unreliable per the file header.
  const t: MergeableTransform = {};
  if (snapMatch.transform?.position) t.position = snapMatch.transform.position;
  if (snapMatch.transform?.rotation) t.rotation = snapMatch.transform.rotation;
  if (snapMatch.transform?.scale) t.scale = snapMatch.transform.scale;

  const merged: PixlSceneObject = {
    ...fresh,
    transform: {
      ...fresh.transform,
      ...t,
    },
  };
  if (typeof snapMatch.visible === 'boolean') merged.visible = snapMatch.visible;
  if (typeof snapMatch.locked === 'boolean') merged.locked = snapMatch.locked;
  if (snapMatch.name && snapMatch.name !== fresh.name) merged.name = snapMatch.name;
  return merged;
};

/**
 * Apply a snapshot's editable fields onto a fresh sample doc. The returned
 * document keeps every other byte of `fresh` intact — assets, environment,
 * camera, runtime manifest, etc. — and ONLY ports user-editable per-object
 * fields (transform, visible, locked, name).
 *
 * Returns `fresh` unchanged if `snapshot` is null or shares no object IDs.
 */
export const mergeSnapshotOntoFresh = (
  fresh: PixlProjectDocument,
  snapshot: PixlProjectDocument | null,
): PixlProjectDocument => {
  if (!snapshot) return fresh;
  // Build an id → snapshot-object index merged across all snapshot scenes.
  const snapSceneById = new Map<string, PixlSceneObject>();
  for (const scene of snapshot.scenes ?? []) {
    for (const [id, obj] of indexById(scene.rootObjects ?? [])) {
      snapSceneById.set(id, obj);
    }
  }
  if (snapSceneById.size === 0) return fresh;

  return {
    ...fresh,
    savedAt: snapshot.savedAt ?? fresh.savedAt,
    scenes: fresh.scenes.map((scene) => ({
      ...scene,
      rootObjects: scene.rootObjects.map((obj) =>
        mergeObject(obj, snapSceneById.get(obj.id)),
      ),
    })),
  };
};
