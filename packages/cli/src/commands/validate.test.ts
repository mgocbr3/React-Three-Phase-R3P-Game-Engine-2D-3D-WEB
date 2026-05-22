import { describe, expect, it } from 'vitest';
import { validateProjectDocument } from './validate.js';

const baseProject = () => ({
  format: 'pixlplayground-project',
  version: 2,
  id: 'project-1',
  name: 'Sample',
  activeSceneId: 'main',
  scenes: [
    {
      id: 'main',
      name: 'Main',
      kind: '3d' as const,
      rootObjects: [
        {
          id: 'cube-1',
          name: 'Cube',
          type: 'box',
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: [
            { id: 'c1', type: 'pixl.visual', enabled: true, data: {} },
          ],
        },
      ],
    },
  ],
});

describe('validateProjectDocument', () => {
  it('aceita um projeto valido sem warnings', () => {
    const report = validateProjectDocument(baseProject(), '/tmp/project.json');
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);
    expect(report.summary.objectCount).toBe(1);
    expect(report.summary.componentTypes).toContain('pixl.visual');
  });

  it('falha quando activeSceneId nao existe nas cenas', () => {
    const project = baseProject();
    project.activeSceneId = 'ghost';
    const report = validateProjectDocument(project, '/tmp/project.json');
    expect(report.ok).toBe(false);
    expect(report.errors.some((issue) => issue.path === '$.activeSceneId')).toBe(true);
  });

  it('avisa quando objetos carregam data.editorObject (leak de fonte de verdade)', () => {
    const project = baseProject();
    project.scenes[0].rootObjects[0] = {
      ...project.scenes[0].rootObjects[0],
      data: { editorObject: { id: 'cube-1', type: 'box' } },
    } as typeof project.scenes[0].rootObjects[0];
    const report = validateProjectDocument(project, '/tmp/project.json');
    expect(report.ok).toBe(true);
    expect(report.warnings.some((issue) => issue.message.includes('editorObject'))).toBe(true);
  });

  it('rejeita format incorreto', () => {
    const report = validateProjectDocument({ ...baseProject(), format: 'something-else' }, '/tmp/project.json');
    expect(report.ok).toBe(false);
    expect(report.errors.some((issue) => issue.path === '$.format')).toBe(true);
  });
});
