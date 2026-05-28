import { buildSampleEditorUrl } from './sampleProjects';

describe('sample projects', () => {
  it('locks 2D and 3D samples to the right editor kind', () => {
    expect(buildSampleEditorUrl('magic-battleground-2d')).toBe('/editor?sampleProject=magic-battleground-2d&engine=native&kind=2d');
    expect(buildSampleEditorUrl('magic-battleground-mvp')).toBe('/editor?sampleProject=magic-battleground-mvp&engine=native&kind=3d');
  });
});
