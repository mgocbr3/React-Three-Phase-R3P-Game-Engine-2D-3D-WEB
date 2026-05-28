import { describe, expect, it } from 'vitest';

import { getEditorAddMenuSections } from './editorAddMenu';

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
});
