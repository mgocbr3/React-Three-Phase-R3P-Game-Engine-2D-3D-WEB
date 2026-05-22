// Op: build.exportThree — STUB. Implemented as part of ADR-003 Phase 4.
// Returns ok: false with a recognizable "not_implemented" code so consumers
// (CLI/MCP/HTTP) can detect the placeholder without parsing strings.

import { broadcastProjectEvent } from '../../broadcast.js';
import { withProjectLock } from '../../lock.js';
import type { OpContext, OpResult } from '../../types.js';

export const exportThree = async (
  ctx: OpContext,
  _args: { outDir: string },
): Promise<OpResult> => {
  return withProjectLock(ctx.projectDir, async () => {
    // Emit a build.completed event with outDir = '' so consumers can detect the stub.
    broadcastProjectEvent({
      type: 'build.completed',
      target: 'three-web',
      outDir: '',
      byAgent: ctx.agent,
    });
    return {
      ok: false,
      changedFiles: [],
      contentHash: '',
      validationWarnings: [],
      validationErrors: ['exportThree não implementado (planejado para ADR-003 Phase 4).'],
    };
  });
};
