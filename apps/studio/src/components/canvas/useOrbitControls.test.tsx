import { render, waitFor } from '@testing-library/react';
import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { useOrbitControls } from './useOrbitControls';

const update = vi.fn();
const dispose = vi.fn();
const controlsInstances: Array<{ target: THREE.Vector3; update: () => void; dispose: () => void }> = [];

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn().mockImplementation(() => {
    const controls = { target: new THREE.Vector3(), update, dispose };
    controlsInstances.push(controls);
    return controls;
  }),
}));

const Harness = ({ onReady }: { onReady: (controls: unknown | null) => void }) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const camera = useMemo(() => new THREE.PerspectiveCamera(), []);
  useOrbitControls({
    canvas,
    camera,
    target: { x: 1, y: 2, z: 3 },
    onReady,
  });
  return <canvas ref={setCanvas} />;
};

describe('useOrbitControls', () => {
  it('hands the created OrbitControls instance to the native 3D editor mount', async () => {
    const onReady = vi.fn();
    const { unmount } = render(<Harness onReady={onReady} />);

    await waitFor(() => expect(onReady).toHaveBeenCalledWith(controlsInstances[0]));
    expect(controlsInstances[0].target.toArray()).toEqual([1, 2, 3]);

    unmount();

    expect(dispose).toHaveBeenCalled();
    expect(onReady).toHaveBeenLastCalledWith(null);
  });
});
