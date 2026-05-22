// Helpers for finding and mutating PixlSceneObjects inside a scene tree.
// Pure functions — they receive a doc, return a new doc (or a found object).
// All mutations clone the path from the root to the touched node so the
// returned doc is structurally fresh (important for downstream content-hashing
// and for consumers that diff by reference).

import type { PixlProjectShape, PixlSceneObjectShape, PixlSceneShape } from './schema.js';

export const findScene = (
  doc: PixlProjectShape,
  sceneId: string,
): PixlSceneShape | undefined => doc.scenes.find((s) => s.id === sceneId);

const visit = (
  objects: PixlSceneObjectShape[],
  predicate: (object: PixlSceneObjectShape) => boolean,
): PixlSceneObjectShape | undefined => {
  for (const object of objects) {
    if (predicate(object)) return object;
    if (object.children?.length) {
      const found = visit(object.children, predicate);
      if (found) return found;
    }
  }
  return undefined;
};

export const findObjectInScene = (
  scene: PixlSceneShape,
  objectId: string,
): PixlSceneObjectShape | undefined => visit(scene.rootObjects, (o) => o.id === objectId);

export const findObjectInDoc = (
  doc: PixlProjectShape,
  objectId: string,
): { scene: PixlSceneShape; object: PixlSceneObjectShape } | undefined => {
  for (const scene of doc.scenes) {
    const object = findObjectInScene(scene, objectId);
    if (object) return { scene, object };
  }
  return undefined;
};

const mapObjects = (
  objects: PixlSceneObjectShape[],
  fn: (object: PixlSceneObjectShape) => PixlSceneObjectShape | null,
): PixlSceneObjectShape[] => {
  const next: PixlSceneObjectShape[] = [];
  for (const object of objects) {
    const mapped = fn(object);
    if (mapped === null) continue;
    let children = mapped.children;
    if (children?.length) {
      children = mapObjects(children, fn);
    }
    next.push(children ? { ...mapped, children } : mapped);
  }
  return next;
};

export const mapSceneObjects = (
  scene: PixlSceneShape,
  fn: (object: PixlSceneObjectShape) => PixlSceneObjectShape | null,
): PixlSceneShape => ({
  ...scene,
  rootObjects: mapObjects(scene.rootObjects, fn),
});

export const replaceScene = (
  doc: PixlProjectShape,
  sceneId: string,
  next: PixlSceneShape,
): PixlProjectShape => ({
  ...doc,
  scenes: doc.scenes.map((s) => (s.id === sceneId ? next : s)),
});

export const updateObjectInScene = (
  scene: PixlSceneShape,
  objectId: string,
  update: (object: PixlSceneObjectShape) => PixlSceneObjectShape,
): { scene: PixlSceneShape; found: boolean } => {
  let found = false;
  const next = mapSceneObjects(scene, (object) => {
    if (object.id !== objectId) return object;
    found = true;
    return update(object);
  });
  return { scene: next, found };
};

export const removeObjectFromScene = (
  scene: PixlSceneShape,
  objectId: string,
): { scene: PixlSceneShape; removed: boolean } => {
  let removed = false;
  const next = mapSceneObjects(scene, (object) => {
    if (object.id === objectId) {
      removed = true;
      return null;
    }
    return object;
  });
  return { scene: next, removed };
};

const collectDescendantIds = (object: PixlSceneObjectShape, out: string[]): void => {
  out.push(object.id);
  if (object.children) {
    for (const child of object.children) collectDescendantIds(child, out);
  }
};

export const descendantIds = (object: PixlSceneObjectShape): string[] => {
  const out: string[] = [];
  collectDescendantIds(object, out);
  return out;
};

export const addRootObject = (
  scene: PixlSceneShape,
  object: PixlSceneObjectShape,
): PixlSceneShape => ({
  ...scene,
  rootObjects: [...scene.rootObjects, object],
});

export const addChildObject = (
  scene: PixlSceneShape,
  parentId: string,
  child: PixlSceneObjectShape,
): { scene: PixlSceneShape; found: boolean } => {
  let found = false;
  const next = mapSceneObjects(scene, (object) => {
    if (object.id !== parentId) return object;
    found = true;
    return { ...object, children: [...(object.children ?? []), child] };
  });
  return { scene: next, found };
};
