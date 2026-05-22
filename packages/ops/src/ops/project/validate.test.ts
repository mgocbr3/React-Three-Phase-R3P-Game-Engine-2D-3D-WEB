import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { captureEvents, resetGlobalState, usingFixture, readDoc } from '../../testHelpers.js';
import { PIXL_PROJECT_DOCUMENT_FILENAME } from '../../schema.js';
import { validateProject } from './validate.js';

describe('project.validate', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('reporta ok=true para um projeto válido recém-criado', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const { events, stop } = captureEvents();
      const result = await validateProject({ projectDir: dir, agent: 'test' });
      expect(result.ok).toBe(true);
      expect(result.validationErrors).toHaveLength(0);
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('project.validated');
      stop();
    });
  });

  it('reporta ok=false quando o doc não tem activeSceneId', async () => {
    await usingFixture(
      {
        kind: '3d',
        setup: (doc) => ({ ...doc, activeSceneId: '' }),
      },
      async (dir) => {
        const result = await validateProject({ projectDir: dir, agent: 'test' });
        // Empty string still passes the "must be string" check but fails the
        // "activeSceneId exists in scenes[]" cross-check.
        expect(result.ok).toBe(false);
      },
    );
  });

  it('reporta ok=false quando o JSON é inválido', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const docPath = path.join(dir, PIXL_PROJECT_DOCUMENT_FILENAME);
      await writeFile(docPath, '{not valid json}', 'utf8');
      const result = await validateProject({ projectDir: dir, agent: 'test' });
      expect(result.ok).toBe(false);
      expect(result.validationErrors.join(' ')).toMatch(/JSON/);
    });
  });

  it('reporta ok=false quando o documento não existe', async () => {
    const result = await validateProject({ projectDir: '/tmp/__nonexistent_xyz__', agent: 'test' });
    expect(result.ok).toBe(false);
    expect(result.validationErrors.length).toBeGreaterThan(0);
  });

  it('não altera o documento on-disk', async () => {
    await usingFixture({ kind: '3d' }, async (dir) => {
      const before = await readDoc(dir);
      await validateProject({ projectDir: dir, agent: 'test' });
      const after = await readDoc(dir);
      expect(after).toEqual(before);
    });
  });
});
