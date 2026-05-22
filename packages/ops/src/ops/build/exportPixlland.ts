// Op: build.exportPixlland — STUB. Eventually wraps `packProject` + portal
// metadata. Implementation deferred until the portal upload contract is
// finalized.

import { broadcastProjectEvent } from '../../broadcast.js';
import { withProjectLock } from '../../lock.js';
import type { OpContext, OpResult } from '../../types.js';

export const exportPixlland = async (
  ctx: OpContext,
  _args: { outDir: string },
): Promise<OpResult> => {
  return withProjectLock(ctx.projectDir, async () => {
    broadcastProjectEvent({
      type: 'build.completed',
      target: 'pixlland',
      outDir: '',
      byAgent: ctx.agent,
    });
    return {
      ok: false,
      changedFiles: [],
      contentHash: '',
      validationWarnings: [],
      validationErrors: ['exportPixlland não implementado.'],
    };
  });
};
