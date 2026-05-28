import { describe, expect, it } from 'vitest';

import { getEditorAddMenuSections, getEditorAddObjectPosition } from './editorAddMenu';

describe('editor add menu', () => {
  it('uses 2D object labels and hides 3D-only entries in 2D scenes', () => {
    const labels = getEditorAddMenuSections('2d').flatMap((section) => section.items.map((item) => item.label));

    expect(labels).toEqual(['Square', 'Circle', 'Text', 'Sprite']);
    expect(labels).not.toContain('Cube');
    expect(labels).not.toContain('Pixlland Terrain');
    expect(labels).not.toContain('Point Light');
  });

  it('keeps the 3D menu explicit and renames Pixlland Terrain to Terrain', () => {
    const labels = getEditorAddMenuSections('3d').flatMap((section) => section.items.map((item) => item.label));

    expect(labels).toContain('Terrain');
    expect(labels).toContain('Cube');
    expect(labels).toContain('Point Light');
    expect(labels).not.toContain('Pixlland Terrain');
    expect(labels).not.toContain('Square');
  });

  it('creates 2D objects at the current viewport center', () => {
    expect(getEditorAddObjectPosition('2d', {
      scene: {
        scenes: [{
          cameras: {
            main: {
              width: 800,
              height: 600,
              getWorldPoint: (x: number, y: number) => ({ x: x + 12.4, y: y - 8.6 }),
            },
          },
        }],
      },
    })).toEqual([412, 291, 0]);

    expect(getEditorAddObjectPosition('3d')).toBeUndefined();
  });

  it('creates 3D objects at the current Scene pivot when available', () => {
    const placement = {
      threeEditor: { getAddObjectPosition: () => [1.25, 3.5, -6] },
    } satisfies NonNullable<Parameters<typeof getEditorAddObjectPosition>[1]>;

    expect(getEditorAddObjectPosition('3d', placement)).toEqual([1.25, 3.5, -6]);
  });
});
