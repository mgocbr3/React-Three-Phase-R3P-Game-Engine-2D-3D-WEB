// Op: build.exportPhaser — STUB. Implemented as part of ADR-003/ADR-004 Phase 5.

import { broadcastProjectEvent } from '../../broadcast.js';
import { withProjectLock } from '../../lock.js';
import type { OpContext, OpResult } from '../../types.js';

export const exportPhaser = async (
  ctx: OpContext,
  _args: { outDir: string },
): Promise<OpResult> => {
  return withProjectLock(ctx.projectDir, async () => {
    broadcastProjectEvent({
      type: 'build.completed',
      target: 'phaser-web',
      outDir: '',
      byAgent: ctx.agent,
    });
    return {
      ok: false,
      changedFiles: [],
      contentHash: '',
      validationWarnings: [],
      validationErrors: ['exportPhaser não implementado (planejado para GDD §6.5).'],
    };
  });
};
