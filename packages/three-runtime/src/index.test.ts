import { describe, expect, it } from 'vitest';

describe('@pixlland/three-runtime public API', () => {
  it('exports Pixl-only native components for external registration', async () => {
    const runtime = await import('./index.js');

    expect(runtime.PrimitiveComponent).toBeTypeOf('function');
    expect(runtime.GltfNodeComponent).toBeTypeOf('function');
    expect(runtime.AnimationComponent).toBeTypeOf('function');
  });
});
