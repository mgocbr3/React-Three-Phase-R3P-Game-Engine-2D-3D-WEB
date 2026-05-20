import { create } from 'zustand';
import * as THREE from 'three';

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
  
  // Actions
  setPlayerPosition: (position: THREE.Vector3) => void;
  setPlayerRotation: (rotation: THREE.Euler) => void;
  setIsPlaying: (playing: boolean) => void;
  reset: () => void;
}

export const useRuntimeGameStore = create<RuntimeGameState>((set) => ({
  playerPosition: new THREE.Vector3(0, 0, 0),
  playerRotation: new THREE.Euler(0, 0, 0),
  isPlaying: false,
  
  setPlayerPosition: (position) => set({ playerPosition: position.clone() }),
  setPlayerRotation: (rotation) => set({ playerRotation: rotation.clone() }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  reset: () => set({
    playerPosition: new THREE.Vector3(0, 0, 0),
    playerRotation: new THREE.Euler(0, 0, 0),
  }),
}));
