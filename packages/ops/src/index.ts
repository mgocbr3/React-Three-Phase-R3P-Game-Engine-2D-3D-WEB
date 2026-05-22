// Public surface of @pixlland/engine-ops.
//
// Every transport (editor, CLI, MCP, HTTP+WS) imports from this file ONLY.
// Internal modules (lock, doc, validate, runLocked, broadcast) are
// implementation detail and may change without notice.

export type {
  AgentKind,
  BuildTarget,
  OpContext,
  OpResult,
  ProjectEvent,
  ProjectEventListener,
} from './types.js';
export { OpInputError, OpValidationError } from './types.js';

export type {
  PixlAssetEntryShape,
  PixlComponentInstance,
  PixlProjectShape,
  PixlRuntimeKind,
  PixlSceneKind,
  PixlSceneObjectShape,
  PixlSceneShape,
  PixlVec3,
} from './schema.js';
export {
  PIXL_2D_COMPONENT_TYPES,
  PIXL_3D_COMPONENT_TYPES,
  PIXL_PROJECT_DOCUMENT_FILENAME,
  PIXL_PROJECT_FORMAT,
  PIXL_PROJECT_VERSION,
  PIXL_SHARED_COMPONENT_TYPES,
} from './schema.js';

export {
  broadcastProjectEvent,
  subscribeProjectEvents,
  unsubscribeAllProjectEvents,
} from './broadcast.js';

export type { ValidationReport } from './validate.js';
export { validate } from './validate.js';
export { setIdGenerator, resetIdGenerator } from './ids.js';

// project ops
export { createProject } from './ops/project/create.js';
export type { CreateProjectArgs } from './ops/project/create.js';
export { validateProject } from './ops/project/validate.js';
export { packProject } from './ops/project/pack.js';
export { unpackProject } from './ops/project/unpack.js';

// scene ops
export { createScene } from './ops/scene/create.js';
export type { CreateSceneArgs } from './ops/scene/create.js';
export { deleteScene } from './ops/scene/delete.js';
export { setActiveScene } from './ops/scene/setActive.js';

// object ops
export { addObject } from './ops/object/add.js';
export type { AddObjectArgs } from './ops/object/add.js';
export { updateObject } from './ops/object/update.js';
export type { UpdateObjectArgs } from './ops/object/update.js';
export { removeObject } from './ops/object/remove.js';
export { reparentObject } from './ops/object/reparent.js';
export { setObjectTransform } from './ops/object/setTransform.js';
export type { SetObjectTransformArgs } from './ops/object/setTransform.js';
export { setObjectComponent } from './ops/object/setComponent.js';
export type { SetObjectComponentArgs } from './ops/object/setComponent.js';

// asset ops
export { importAsset } from './ops/asset/import.js';
export type { ImportAssetArgs } from './ops/asset/import.js';
export { removeAsset } from './ops/asset/remove.js';

// script ops
export { readScript } from './ops/script/read.js';
export type { ReadScriptResult } from './ops/script/read.js';
export { writeScript } from './ops/script/write.js';
export type { WriteScriptArgs } from './ops/script/write.js';
export { deleteScript } from './ops/script/delete.js';

// build ops
export { exportThree } from './ops/build/exportThree.js';
export { exportPhaser } from './ops/build/exportPhaser.js';
export { exportPixlland } from './ops/build/exportPixlland.js';
