import { render, waitFor } from '@testing-library/react';
import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOrbitControls } from './useOrbitControls';

const update = vi.fn();
const dispose = vi.fn();
type MockOrbitControls = {
  target: THREE.Vector3;
  update: () => boolean;
  dispose: () => void;
  addEventListener: (type: string, cb: () => void) => void;
  removeEventListener: (type: string, cb: () => void) => void;
  emit: (type: string) => void;
};
const controlsInstances: MockOrbitControls[] = [];

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn().mockImplementation(() => {
    const listeners = new Map<string, Set<() => void>>();
    const controls = {
      target: new THREE.Vector3(),
      update,
      dispose,
      addEventListener: (type: string, cb: () => void) => {
        const set = listeners.get(type) ?? new Set<() => void>();
        set.add(cb);
        listeners.set(type, set);
      },
      removeEventListener: (type: string, cb: () => void) => listeners.get(type)?.delete(cb),
      emit: (type: string) => listeners.get(type)?.forEach((cb) => cb()),
    };
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
  beforeEach(() => {
    update.mockReturnValue(false);
    update.mockClear();
    dispose.mockClear();
    controlsInstances.length = 0;
  });

  it('hands the created OrbitControls instance to the native 3D editor mount', async () => {
    const onReady = vi.fn();
    const { unmount } = render(<Harness onReady={onReady} />);

    await waitFor(() => expect(onReady).toHaveBeenCalledWith(controlsInstances[0]));
    expect(controlsInstances[0].target.toArray()).toEqual([1, 2, 3]);

    unmount();

    expect(dispose).toHaveBeenCalled();
    expect(onReady).toHaveBeenLastCalledWith(null);
  });

  it('requests a render when orbit controls change instead of running a permanent RAF loop', async () => {
    const onReady = vi.fn();
    render(<Harness onReady={onReady} />);

    await waitFor(() => expect(onReady).toHaveBeenCalledWith(controlsInstances[0]));
    expect(update).toHaveBeenCalledTimes(1);

    controlsInstances[0].emit('change');

    await waitFor(() => expect(update.mock.calls.length).toBeGreaterThan(1));
  });
});
