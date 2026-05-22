import { create } from 'zustand';
import * as THREE from 'three';
import { PixlProjectDocument } from '@/engine/project/schema';
import {
  RuntimePreviewSession,
  RuntimePreviewSource,
  createRuntimePreviewSession,
} from '@/engine/runtime/runtimePreview';

export type RuntimePreviewDisplayMode = 'inframe' | 'fullscreen';

/**
 * Runtime Game State Store
 * Tracks runtime-only state that doesn't need to be persisted
 * Used for AI systems to track player position, etc.
 */
interface RuntimeGameState {
  // Player runtime position (updated every frame during play)
  playerPosition: THREE.Vector3;
  playerRotation: THREE.Euler;
  isPlaying: boolean;
  previewSession: RuntimePreviewSession | null;
  previewDisplayMode: RuntimePreviewDisplayMode;
  
  // Actions
  setPlayerPosition: (position: THREE.Vector3) => void;
  setPlayerRotation: (rotation: THREE.Euler) => void;
  setIsPlaying: (playing: boolean) => void;
  startPreview: (
    document: PixlProjectDocument,
    options?: { source?: RuntimePreviewSource },
  ) => RuntimePreviewSession;
  stopPreview: () => void;
  setPreviewDisplayMode: (mode: RuntimePreviewDisplayMode) => void;
  togglePreviewFullscreen: () => void;
  reset: () => void;
}

export const useRuntimeGameStore = create<RuntimeGameState>((set) => ({
  playerPosition: new THREE.Vector3(0, 0, 0),
  playerRotation: new THREE.Euler(0, 0, 0),
  isPlaying: false,
  previewSession: null,
  previewDisplayMode: 'inframe',
  
  setPlayerPosition: (position) => set({ playerPosition: position.clone() }),
  setPlayerRotation: (rotation) => set({ playerRotation: rotation.clone() }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  startPreview: (document, options) => {
    const previewSession = createRuntimePreviewSession(document, options);
    set({
      previewSession,
      previewDisplayMode: 'inframe',
      isPlaying: true,
      playerPosition: new THREE.Vector3(0, 0, 0),
      playerRotation: new THREE.Euler(0, 0, 0),
    });
    return previewSession;
  },
  stopPreview: () => set({
    previewSession: null,
    previewDisplayMode: 'inframe',
    isPlaying: false,
    playerPosition: new THREE.Vector3(0, 0, 0),
    playerRotation: new THREE.Euler(0, 0, 0),
  }),
  setPreviewDisplayMode: (mode) => set({ previewDisplayMode: mode }),
  togglePreviewFullscreen: () => set((state) => ({
    previewDisplayMode: state.previewDisplayMode === 'fullscreen' ? 'inframe' : 'fullscreen',
  })),
  reset: () => set({
    playerPosition: new THREE.Vector3(0, 0, 0),
    playerRotation: new THREE.Euler(0, 0, 0),
  }),
}));
