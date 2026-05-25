import { describe, expect, it } from 'vitest';

import { buildRuntimeHtml } from './RuntimeGameFrame';
import type { RuntimePreviewSession } from '@/engine/runtime/runtimePreview';

const session: RuntimePreviewSession = {
  id: 'runtime-test',
  projectId: 'project-test',
  projectName: 'Sample 3D Runtime',
  runtime: 'three-3d',
  sceneId: 'main',
  sceneKind: '3d',
  source: 'editor',
  startedAt: 1,
  document: {} as RuntimePreviewSession['document'],
  launchTarget: {
    kind: 'web-runtime',
    gameSlug: 'sample-3d-runtime',
    runtimeFile: 'src/main.js',
    scriptUrl: '/sample-projects/sample-3d-runtime/runtime/src/main.js',
    documentBaseUrl: '/sample-projects/sample-3d-runtime/',
    sdkUrl: null,
  },
};

describe('RuntimeGameFrame', () => {
  it('adds import maps for browser-native sample runtimes', () => {
    const html = buildRuntimeHtml(session);

    expect(html).toContain('<script type="importmap">');
    expect(html).toContain('"three": "/node_modules/three/build/three.module.js"');
    expect(html).toContain('"three/": "/node_modules/three/"');
  });
});
