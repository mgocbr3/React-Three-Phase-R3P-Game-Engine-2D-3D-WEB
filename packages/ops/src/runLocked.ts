// The op orchestrator. Every op in src/ops/ delegates to this so the
// load→validate→mutate→re-validate→atomic-write→broadcast contract is
// enforced once, in one place.
//
// Per GDD §6.1:
//   1. Acquire the project-folder lock
//   2. loadDoc
//   3. requireValid (pre)
//   4. body(doc) → returns { next, event, changedFiles? }
//   5. requireValid (post) — rollback on failure
//   6. computeHash
//   7. atomic write
//   8. broadcast
//   9. return OpResult

import { PIXL_PROJECT_DOCUMENT_FILENAME, type PixlProjectShape } from './schema.js';
import { broadcastProjectEvent } from './broadcast.js';
import { loadProjectDocument, saveProjectDocument } from './doc.js';
import { withProjectLock } from './lock.js';
import {
  OpInputError,
  OpValidationError,
  type OpContext,
  type OpResult,
  type ProjectEvent,
} from './types.js';
import { requireValid, validate } from './validate.js';

export type Mutator = (doc: PixlProjectShape) => {
  next: PixlProjectShape;
  /** Builder so we know the contentHash before the event is emitted. */
  event: (contentHash: string) => ProjectEvent;
  /** Optional: extra changedFiles besides project.pixlproject.json. */
  extraChangedFiles?: string[];
};

export interface RunLockedOptions {
  /** Skip the pre-mutation validate (used for createProject which writes the first doc). */
  skipPreValidate?: boolean;
  /** Fixed savedAt for deterministic tests. */
  savedAt?: number;
}

export const runLocked = async (
  ctx: OpContext,
  body: (doc: PixlProjectShape) => ReturnType<Mutator>,
  options: RunLockedOptions = {},
): Promise<OpResult> => {
  return withProjectLock(ctx.projectDir, async () => {
    try {
      const doc = await loadProjectDocument(ctx.projectDir);
      if (!options.skipPreValidate) requireValid(doc);

      const mutated = body(doc);
      // Re-validate the post-mutation snapshot. If invalid, rollback (= never
      // write). The caller's body must be pure (no IO); doc on disk remains
      // the previous valid one.
      const postReport = validate(mutated.next);
      if (!postReport.ok) {
        return {
          ok: false,
          changedFiles: [],
          contentHash: '',
          validationWarnings: postReport.warnings,
          validationErrors: postReport.errors,
        };
      }

      const contentHash = await saveProjectDocument(ctx.projectDir, mutated.next, {
        savedAt: options.savedAt,
      });
      const changedFiles = [PIXL_PROJECT_DOCUMENT_FILENAME, ...(mutated.extraChangedFiles ?? [])];
      const event = mutated.event(contentHash);
      broadcastProjectEvent(event);
      return {
        ok: true,
        changedFiles,
        contentHash,
        validationWarnings: postReport.warnings,
        validationErrors: [],
      };
    } catch (error) {
      if (error instanceof OpValidationError) {
        return {
          ok: false,
          changedFiles: [],
          contentHash: '',
          validationWarnings: error.warnings,
          validationErrors: error.errors,
        };
      }
      if (error instanceof OpInputError) {
        return {
          ok: false,
          changedFiles: [],
          contentHash: '',
          validationWarnings: [],
          validationErrors: [error.message],
        };
      }
      throw error;
    }
  });
};

/** Variant for ops that don't touch project.pixlproject.json (script.read,
 *  script.write, build.*). Acquires the lock and reports errors uniformly,
 *  but no load/validate cycle. */
export const runFileOp = async (
  ctx: OpContext,
  body: () => Promise<{ changedFiles: string[]; event?: ProjectEvent }>,
): Promise<OpResult> => {
  return withProjectLock(ctx.projectDir, async () => {
    try {
      const result = await body();
      if (result.event) broadcastProjectEvent(result.event);
      return {
        ok: true,
        changedFiles: result.changedFiles,
        contentHash: '',
        validationWarnings: [],
        validationErrors: [],
      };
    } catch (error) {
      if (error instanceof OpInputError) {
        return {
          ok: false,
          changedFiles: [],
          contentHash: '',
          validationWarnings: [],
          validationErrors: [error.message],
        };
      }
      throw error;
    }
  });
};
