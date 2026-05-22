// Op: project.validate — re-run schema + 2D/3D coherence check on disk.
// Read-only. Broadcasts `project.validated` for telemetry.

import { broadcastProjectEvent } from '../../broadcast.js';
import { computeContentHash, loadProjectDocument } from '../../doc.js';
import { withProjectLock } from '../../lock.js';
import { OpInputError, type OpContext, type OpResult } from '../../types.js';
import { validate } from '../../validate.js';

export const validateProject = async (ctx: OpContext): Promise<OpResult> => {
  return withProjectLock(ctx.projectDir, async () => {
    try {
      const doc = await loadProjectDocument(ctx.projectDir);
      const report = validate(doc);
      const contentHash = await computeContentHash(doc);
      broadcastProjectEvent({
        type: 'project.validated',
        projectDir: ctx.projectDir,
        contentHash,
        ok: report.ok,
        byAgent: ctx.agent,
      });
      return {
        ok: report.ok,
        changedFiles: [],
        contentHash,
        validationWarnings: report.warnings,
        validationErrors: report.errors,
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
